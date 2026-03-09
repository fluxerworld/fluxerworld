/**
 * Preload – runs in an isolated sandboxed context before the renderer loads.
 * contextIsolation: true  →  we must use contextBridge to talk to the page.
 * sandbox: true           →  no Node.js APIs here; only contextBridge + ipcRenderer.
 *
 * Exposes a `window.electron` API matching the ElectronAPI interface expected
 * by the Fluxer web app (NativeUtils.tsx).
 */

import { contextBridge, ipcRenderer } from 'electron';

// Helper to create a one-off listener that returns a cleanup function.
function onEvent(channel: string, callback: (...args: any[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  // ── Navigation / External ──────────────────────────────────────────────────
  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external', url);
  },

  // ── Downloads ──────────────────────────────────────────────────────────────
  downloadFile: (url: string, suggestedName: string) => {
    return ipcRenderer.invoke('download-file', url, suggestedName);
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  showNotification: (payload: { title: string; body: string; icon?: string; url?: string }) => {
    return ipcRenderer.invoke('show-notification', payload);
  },
  closeNotification: (id: string) => {
    ipcRenderer.send('close-notification', id);
  },
  closeNotifications: (ids: string[]) => {
    ipcRenderer.send('close-notifications', ids);
  },
  onNotificationClick: (callback: (id: string, url?: string) => void): (() => void) => {
    return onEvent('notification-click', callback);
  },

  // ── Updater ────────────────────────────────────────────────────────────────
  onUpdaterEvent: (callback: (event: any) => void): (() => void) => {
    return onEvent('updater-event', callback);
  },
  updaterCheck: (context: string) => {
    return ipcRenderer.invoke('updater-check', context);
  },
  updaterInstall: () => {
    return ipcRenderer.invoke('updater-install');
  },

  // ── Desktop info ───────────────────────────────────────────────────────────
  getDesktopInfo: () => {
    return ipcRenderer.invoke('get-desktop-info');
  },

  // ── Screen capture sources ─────────────────────────────────────────────────
  getDesktopSources: (types: string[], requestId?: string) => {
    return ipcRenderer.invoke('get-desktop-sources', types, requestId);
  },
  selectDisplayMediaSource: (requestId: string, sourceId: string | null, withAudio: boolean) => {
    ipcRenderer.send('select-display-media-source', requestId, sourceId, withAudio);
  },

  // ── Deep links ─────────────────────────────────────────────────────────────
  getInitialDeepLink: () => {
    return ipcRenderer.invoke('get-initial-deep-link');
  },
  onDeepLink: (callback: (url: string) => void): (() => void) => {
    return onEvent('deep-link', callback);
  },

  // ── Context menu / Spellcheck ──────────────────────────────────────────────
  onTextareaContextMenu: (callback: (params: any) => void): (() => void) => {
    return onEvent('textarea-context-menu', callback);
  },
  onSpellcheckStateChanged: (callback: (state: any) => void): (() => void) => {
    return onEvent('spellcheck-state-changed', callback);
  },
  spellcheckGetAvailableLanguages: () => {
    return ipcRenderer.invoke('spellcheck-get-available-languages');
  },
  spellcheckSetState: (state: any) => {
    return ipcRenderer.invoke('spellcheck-set-state', state);
  },

  // ── Autostart ──────────────────────────────────────────────────────────────
  autostartEnable: () => ipcRenderer.invoke('autostart-enable'),
  autostartDisable: () => ipcRenderer.invoke('autostart-disable'),
  autostartIsEnabled: () => ipcRenderer.invoke('autostart-is-enabled'),
  autostartIsInitialized: () => ipcRenderer.invoke('autostart-is-initialized'),
  autostartMarkInitialized: () => ipcRenderer.invoke('autostart-mark-initialized'),

  // ── Global key hooks (stubs – not implemented for this build) ──────────────
  globalKeyHookStart: async () => false,
  globalKeyHookStop: async () => {},
  onGlobalKeyEvent: (_callback: any) => () => {},
  onGlobalMouseEvent: (_callback: any) => () => {},
  onGlobalShortcut: (_callback: any) => () => {},
  registerGlobalShortcut: async (_id: string, _accelerator: string) => {},
  unregisterAllGlobalShortcuts: async () => {},

  // ── macOS-specific stubs ───────────────────────────────────────────────────
  checkInputMonitoringAccess: async () => false,
  checkAccessibility: async (_prompt: boolean) => false,
  checkMediaAccess: async (_type: string) => 'not-determined' as const,
  requestMediaAccess: async (_type: string) => false,
  openAccessibilitySettings: async () => {},
  openInputMonitoringSettings: async () => {},
  openMediaAccessSettings: async (_type: string) => {},

  // ── Badge ──────────────────────────────────────────────────────────────────
  setBadgeCount: (count: number) => {
    ipcRenderer.send('set-badge-count', count);
  },

  // ── Window controls ────────────────────────────────────────────────────────
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    return onEvent('window-maximize-change', callback);
  },
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // ── Clipboard ──────────────────────────────────────────────────────────────
  clipboardWriteText: (text: string) => {
    return ipcRenderer.invoke('clipboard-write-text', text);
  },
});
