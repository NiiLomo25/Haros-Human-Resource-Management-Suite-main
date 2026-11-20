/**
 * Haros HRMIS - Workstation Identity, Hardware Fingerprinting & Permanent Registry Vault
 * Survives app restarts, upgrades, and database resets by mirroring signed hardware bindings
 * in an isolated IndexedDB vault alongside the primary SQLite-emulated database.
 */

import { sha256Hex, computeIntegritySignature } from '../../db/password';
import { RegisteredComputer, ApplicationExpiryConfig } from '../../types';

export interface WorkstationIdentity {
  computerName: string;
  hardwareId: string;
  osPlatform: string;
  source: 'windows-native-bridge' | 'hardware-fingerprint';
}

interface NativeHostBridge {
  getComputerName?: () => Promise<string> | string;
  getMachineInfo?: () => Promise<{ computerName?: string; hardwareId?: string; osPlatform?: string }> | {
    computerName?: string;
    hardwareId?: string;
    osPlatform?: string;
  };
}

const VAULT_DB_NAME = 'HarosHRMIS_PermanentRegistryVault';
const VAULT_DB_VERSION = 1;
const VAULT_STORE = 'machineBindings';
const VAULT_KEY_COMPUTERS = 'registered_computers_v1';
const VAULT_KEY_EXPIRY = 'expiry_config_v1';

function getWebGlRendererFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'no-webgl';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
      return `${vendor}::${renderer}`;
    }
    return String(gl.getParameter(gl.RENDERER) || 'webgl-basic');
  } catch {
    return 'webgl-unavailable';
  }
}

function getCanvasDigest(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-2d';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#006B3F';
    ctx.fillRect(4, 4, 18, 18);
    ctx.fillStyle = '#0F1F1A';
    ctx.fillText('HAROS-HRMIS-HW-BIND', 28, 10);
    return sha256Hex(canvas.toDataURL()).slice(0, 16);
  } catch {
    return 'canvas-unavailable';
  }
}

function detectOsLabel(): { prefix: string; osPlatform: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
        navigator.platform ||
        ''
      : '';

  if (/Windows NT 10\.0/i.test(ua) || /Windows/i.test(platform) || /Win/i.test(ua)) {
    return { prefix: 'WIN11', osPlatform: 'Windows 10/11 x64 Workstation' };
  }
  if (/Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform)) {
    return { prefix: 'MACOS', osPlatform: 'macOS Workstation' };
  }
  if (/Linux|X11/i.test(ua) || /Linux/i.test(platform)) {
    return { prefix: 'WIN11-CLIENT', osPlatform: 'Linux / Chromium Workstation' };
  }
  return { prefix: 'HRMIS-PC', osPlatform: platform || 'Workstation' };
}

export async function detectWindowsWorkstation(): Promise<WorkstationIdentity> {
  const { prefix, osPlatform: detectedPlatform } = detectOsLabel();

  // 1. Check native Windows Desktop wrapper bridges (Electron / WebView2 / Tauri) if present
  try {
    const win = window as unknown as {
      hrmisHost?: NativeHostBridge;
      electronAPI?: NativeHostBridge;
      chrome?: { webview?: { hostObjects?: { hrmis?: NativeHostBridge } } };
    };
    const bridge = win.hrmisHost || win.electronAPI || win.chrome?.webview?.hostObjects?.hrmis;
    if (bridge) {
      if (typeof bridge.getMachineInfo === 'function') {
        const info = await bridge.getMachineInfo();
        if (info?.computerName) {
          const cleanName = info.computerName.trim().toUpperCase();
          const hwId =
            info.hardwareId?.trim() ||
            `HW-${sha256Hex(`NATIVE::${cleanName}::${info.osPlatform || detectedPlatform}`).slice(0, 16).toUpperCase()}`;
          return {
            computerName: cleanName,
            hardwareId: hwId,
            osPlatform: info.osPlatform || detectedPlatform,
            source: 'windows-native-bridge',
          };
        }
      }
      if (typeof bridge.getComputerName === 'function') {
        const nativeName = await bridge.getComputerName();
        if (nativeName && nativeName.trim()) {
          const cleanName = nativeName.trim().toUpperCase();
          return {
            computerName: cleanName,
            hardwareId: `HW-${sha256Hex(`NATIVE::${cleanName}::${detectedPlatform}`).slice(0, 16).toUpperCase()}`,
            osPlatform: detectedPlatform,
            source: 'windows-native-bridge',
          };
        }
      }
    }
  } catch {
    // Fall through to deterministic hardware fingerprint
  }

  // 2. Deterministic hardware fingerprint (stable across reinstalls & DB resets on same machine)
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({ width: 1920, height: 1080, colorDepth: 24 } as Screen);
  const tz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';
  const mem = (nav as unknown as { deviceMemory?: number }).deviceMemory || 8;
  const cores = nav.hardwareConcurrency || 4;
  const webgl = getWebGlRendererFingerprint();
  const canvasSig = getCanvasDigest();

  const rawSignals = [
    nav.platform || 'Win32',
    cores.toString(),
    mem.toString(),
    `${scr.width}x${scr.height}x${scr.colorDepth}`,
    tz,
    nav.language || 'en-US',
    webgl,
    canvasSig,
  ].join('|');

  const fullHash = sha256Hex(rawSignals).toUpperCase();
  const hardwareId = `HW-${fullHash.slice(0, 16)}`;
  const computerName = `${prefix}-${fullHash.slice(0, 7)}`;

  return {
    computerName,
    hardwareId,
    osPlatform: detectedPlatform,
    source: 'hardware-fingerprint',
  };
}

export function detectWorkstationIdentitySync(): WorkstationIdentity {
  const { prefix, osPlatform } = detectOsLabel();
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({ width: 1920, height: 1080, colorDepth: 24 } as Screen);
  const tz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';
  const mem = (nav as unknown as { deviceMemory?: number }).deviceMemory || 8;
  const cores = nav.hardwareConcurrency || 4;
  const webgl = getWebGlRendererFingerprint();
  const canvasSig = getCanvasDigest();

  const rawSignals = [
    nav.platform || 'Win32',
    cores.toString(),
    mem.toString(),
    `${scr.width}x${scr.height}x${scr.colorDepth}`,
    tz,
    nav.language || 'en-US',
    webgl,
    canvasSig,
  ].join('|');

  const fullHash = sha256Hex(rawSignals).toUpperCase();
  return {
    computerName: `${prefix}-${fullHash.slice(0, 7)}`,
    hardwareId: `HW-${fullHash.slice(0, 16)}`,
    osPlatform,
    source: 'hardware-fingerprint',
  };
}

export function signComputerRegistration(rec: Omit<RegisteredComputer, 'integritySignature'>): string {
  return computeIntegritySignature(
    `COMP::${rec.id}::${rec.hardwareId}::${rec.computerName.toUpperCase()}::${rec.registeredAt}::${rec.registeredBy}`
  );
}

export function verifyComputerSignature(rec: RegisteredComputer): boolean {
  const expected = signComputerRegistration({
    id: rec.id,
    computerName: rec.computerName,
    hardwareId: rec.hardwareId,
    osPlatform: rec.osPlatform,
    registeredAt: rec.registeredAt,
    registeredBy: rec.registeredBy,
    tradeEDate: rec.tradeEDate,
    status: rec.status,
  });
  return rec.integritySignature === expected;
}

export function signExpiryConfig(cfg: Omit<ApplicationExpiryConfig, 'integritySignature'>): string {
  return computeIntegritySignature(
    `EXP::${cfg.tradeEDate}::${cfg.maxSeenUtcMs}::${cfg.updatedAt}::${cfg.updatedBy}::${cfg.clockTamperDetected ? '1' : '0'}`
  );
}

export function verifyExpiryConfigSignature(cfg: ApplicationExpiryConfig): boolean {
  const expected = signExpiryConfig({
    tradeEDate: cfg.tradeEDate,
    updatedAt: cfg.updatedAt,
    updatedBy: cfg.updatedBy,
    maxSeenUtcMs: cfg.maxSeenUtcMs,
    lastValidatedUtcMs: cfg.lastValidatedUtcMs,
    clockTamperDetected: cfg.clockTamperDetected,
    clockTamperReason: cfg.clockTamperReason,
  });
  return cfg.integritySignature === expected;
}

// =========================================================================
// Permanent IndexedDB Hardware Registry Vault (Survives DB Reset & Reinstall)
// =========================================================================

function openRegistryVault(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(VAULT_STORE)) {
          db.createObjectStore(VAULT_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveToPermanentVault(
  computers: RegisteredComputer[],
  expiryConfig: ApplicationExpiryConfig
): Promise<boolean> {
  const idb = await openRegistryVault();
  if (!idb) return false;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(VAULT_STORE, 'readwrite');
      const store = tx.objectStore(VAULT_STORE);
      store.put(computers, VAULT_KEY_COMPUTERS);
      store.put(expiryConfig, VAULT_KEY_EXPIRY);
      tx.oncomplete = () => {
        idb.close();
        resolve(true);
      };
      tx.onerror = () => {
        idb.close();
        resolve(false);
      };
    } catch {
      idb.close();
      resolve(false);
    }
  });
}

export async function readFromPermanentVault(): Promise<{
  computers: RegisteredComputer[];
  expiryConfig: ApplicationExpiryConfig | null;
  vaultAvailable: boolean;
}> {
  const idb = await openRegistryVault();
  if (!idb) {
    return { computers: [], expiryConfig: null, vaultAvailable: false };
  }
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(VAULT_STORE, 'readonly');
      const store = tx.objectStore(VAULT_STORE);
      const compReq = store.get(VAULT_KEY_COMPUTERS);
      const expReq = store.get(VAULT_KEY_EXPIRY);
      tx.oncomplete = () => {
        const computers = Array.isArray(compReq.result) ? (compReq.result as RegisteredComputer[]) : [];
        const expiryConfig =
          expReq.result && typeof expReq.result === 'object'
            ? (expReq.result as ApplicationExpiryConfig)
            : null;
        idb.close();
        resolve({ computers, expiryConfig, vaultAvailable: true });
      };
      tx.onerror = () => {
        idb.close();
        resolve({ computers: [], expiryConfig: null, vaultAvailable: false });
      };
    } catch {
      idb.close();
      resolve({ computers: [], expiryConfig: null, vaultAvailable: false });
    }
  });
}
