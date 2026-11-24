/**
 * Haros HRMIS — Printing Service
 *
 * window.print() has no preview support inside Electron (Chromium shows
 * "This app doesn't support print preview"). On the desktop shell we route
 * printing through the main process instead:
 *
 *   printPage()  -> native OS print dialog (physical printers, PDF printers,
 *                   copies, etc.) via webContents.print()
 *   previewPdf() -> renders the current page to PDF honouring the @page CSS
 *                   (A4 landscape), saves it under %LOCALAPPDATA%\HRMIS\Reports
 *                   and opens it in the default PDF viewer — a true preview.
 *
 * In a plain browser both fall back to window.print() / browser print.
 */

interface PrintHost {
  print?: () => Promise<{ ok: boolean; error?: string }>;
  printToPdf?: (opts?: { landscape?: boolean }) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
}

function host(): PrintHost | undefined {
  return (window as unknown as { hrmisHost?: PrintHost }).hrmisHost;
}

export function isDesktopPrint(): boolean {
  return typeof host()?.print === 'function';
}

/** Open the native OS print dialog for the current page. */
export async function printPage(): Promise<{ ok: boolean; error?: string }> {
  const h = host();
  if (typeof h?.print === 'function') {
    try {
      return await h.print();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  // Browser fallback
  window.print();
  return { ok: true };
}

/** Render current page to PDF and open it — the print-preview path. */
export async function previewPdf(landscape = true): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  const h = host();
  if (typeof h?.printToPdf === 'function') {
    try {
      return await h.printToPdf({ landscape });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  // Browser fallback: print dialog is the closest preview available
  window.print();
  return { ok: true };
}
