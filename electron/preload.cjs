/**
 * Haros HRMIS — Electron Preload Bridge
 *
 * Exposes a minimal, audited surface to the renderer:
 *  - window.hrmisHost / window.electronAPI : machine identity + data paths
 *  - window.hrmisDesktop                    : SQLite snapshot sync bridge
 *
 * contextIsolation stays enabled; no Node APIs leak into the page.
 */

const { contextBridge, ipcRenderer } = require('electron');

const hostApi = {
  getMachineInfo: () => ipcRenderer.invoke('hrmis:get-machine-info'),
  getComputerName: () => ipcRenderer.invoke('hrmis:get-computer-name'),
  getDataPaths: () => ipcRenderer.invoke('hrmis:get-data-paths'),
  getDbStats: () => ipcRenderer.invoke('hrmis:db-stats'),
  saveFile: (opts) => ipcRenderer.invoke('hrmis:save-file', opts),
  openPath: (p) => ipcRenderer.invoke('hrmis:open-path', p),
};

const desktopApi = {
  // Synchronous on purpose: storage.ts hydrates localStorage at module load,
  // before any async bridge call could resolve.
  getInitialSnapshot: () => {
    try {
      return ipcRenderer.sendSync('hrmis:get-initial-snapshot-sync');
    } catch {
      return {};
    }
  },
  syncSetItem: (key, value) => ipcRenderer.invoke('hrmis:kv-set', key, value),
  syncRemoveItem: (key) => ipcRenderer.invoke('hrmis:kv-remove', key),
  flush: () => ipcRenderer.invoke('hrmis:db-flush'),
};

contextBridge.exposeInMainWorld('hrmisHost', hostApi);
contextBridge.exposeInMainWorld('electronAPI', hostApi);
contextBridge.exposeInMainWorld('hrmisDesktop', desktopApi);
