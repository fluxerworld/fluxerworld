/**
 * Preload – runs in an isolated sandboxed context before the renderer loads.
 * contextIsolation: true  →  we must use contextBridge to talk to the page.
 * sandbox: true           →  no Node.js APIs here; only contextBridge + ipcRenderer.
 *
 * This wrapper doesn't need to push anything custom into the page, but we
 * expose a minimal read-only token so the site can detect it's inside Electron
 * if it ever wants to (e.g. to skip an "install the app" banner).
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fluxerElectron', {
  /** True when running inside the Electron shell. */
  isElectron: true as const,

  /** Host OS – lets the site adapt any OS-specific UX if desired. */
  platform: process.platform,

  /**
   * Ask the main process to open a URL in the system default browser.
   * The main process already does this automatically for external navigation,
   * but the page can call this directly too.
   */
  openExternal: (url: string) => {
    // Validate before sending – never trust renderer input blindly.
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        ipcRenderer.send('open-external', url);
      }
    } catch {
      // silently drop malformed URLs
    }
  },
} as const);
