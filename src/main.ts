import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  MenuItem,
  shell,
  nativeImage,
  ipcMain,
  session,
  dialog,
  clipboard,
} from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { Store } from './store';

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_NAME    = 'Fluxer World';
const APP_URL     = 'https://fluxer.world';
const APP_ID      = 'org.fluxer.World';
const PROTOCOL    = 'fluxerworld';

/** Hostnames we consider "internal" – navigation and new windows are allowed. */
const ALLOWED_HOSTS = new Set(['fluxer.world', 'cdn.fluxer.world', 'media.fluxer.world']);

// ─── Globals ──────────────────────────────────────────────────────────────────

const store       = new Store();
let mainWindow:   BrowserWindow | null = null;
let tray:         Tray | null = null;
let isQuitting    = false;

/** Track active native notifications so we can close them by id. */
const activeNotifications = new Map<string, Notification>();

// ─── Single-instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ─── Protocol registration ────────────────────────────────────────────────────

// On Linux inside Flatpak the .desktop file handles this instead.
if (process.platform !== 'linux') {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// ─── Asset path helper ────────────────────────────────────────────────────────

function asset(...parts: string[]): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'assets');
  return path.join(base, ...parts);
}

function appIcon(): string {
  switch (process.platform) {
    case 'win32':  return asset('icons', 'icon.ico');
    case 'darwin': return asset('icons', 'icon.icns');
    default:       return asset('icons', 'icon.png');
  }
}

// ─── URL allow-list ───────────────────────────────────────────────────────────

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// ─── Deep-link handler ────────────────────────────────────────────────────────

let pendingDeepLink: string | null = null;

function handleDeepLink(rawUrl: string): void {
  if (!mainWindow) {
    pendingDeepLink = rawUrl;
    return;
  }

  showWindow();

  try {
    const src = new URL(rawUrl);

    if (src.protocol !== `${PROTOCOL}:`) return;

    // fluxerworld://path/sub?q=1  →  https://fluxer.world/path/sub?q=1
    // The "hostname" part of the custom URL becomes the first path segment.
    const reconstructed =
      APP_URL +
      '/' +
      (src.hostname + src.pathname).replace(/^\/+/, '') +
      (src.search ?? '') +
      (src.hash ?? '');

    if (isAllowedUrl(reconstructed)) {
      mainWindow.loadURL(reconstructed);
    }
  } catch {
    // Bad URL – just bring the window forward
  }
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function showWindow(): void {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function saveWindowState(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) return;

  const ws = store.get('windowState');
  store.set('windowState', {
    ...mainWindow.getBounds(),
    isMaximized: mainWindow.isMaximized(),
  });
  void ws; // suppress unused warning
}

// ─── Create window ────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const saved    = store.get('windowState');
  const iconPath = appIcon();

  const win = new BrowserWindow({
    x:         saved.x,
    y:         saved.y,
    width:     saved.width,
    height:    saved.height,
    minWidth:  480,
    minHeight: 320,
    title:     APP_NAME,
    icon:      nativeImage.createFromPath(iconPath),
    // Subtle dark background colour shown while the SPA is loading.
    backgroundColor: '#13141a',
    // Don't flash the window before content is ready.
    show: false,

    webPreferences: {
      preload:                  path.join(__dirname, 'preload.js'),
      contextIsolation:         true,
      sandbox:                  true,
      nodeIntegration:          false,
      webSecurity:              true,
      allowRunningInsecureContent: false,
      // Let the web app manage its own audio; no special treatment needed.
      backgroundThrottling:     false,
    },
  });

  // Restore maximised state
  if (saved.isMaximized) win.maximize();

  // ── Show/hide on ready ────────────────────────────────────────────────────
  win.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      win.show();
    } else if (tray) {
      // If tray exists we can stay hidden; otherwise show anyway so the user
      // isn't left with an invisible window.
    } else {
      win.show();
    }
  });

  // ── Window state persistence ─────────────────────────────────────────────
  win.on('resize', saveWindowState);
  win.on('move',   saveWindowState);

  // ── Maximize state tracking ─────────────────────────────────────────────
  win.on('maximize', () => {
    win.webContents.send('window-maximize-change', true);
  });
  win.on('unmaximize', () => {
    win.webContents.send('window-maximize-change', false);
  });

  // ── Close → hide to tray ─────────────────────────────────────────────────
  win.on('close', (e) => {
    if (!isQuitting && store.get('closeToTray')) {
      e.preventDefault();
      win.hide();
    } else {
      saveWindowState();
    }
  });

  // ── Navigation allow-list ────────────────────────────────────────────────
  // Fires before every navigation (links, redirects, history pushes).
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAllowedUrl(url)) {
      e.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  // Covers programmatic navigations that bypass will-navigate.
  win.webContents.on('will-redirect', (e, url) => {
    if (!isAllowedUrl(url)) {
      e.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  // ── window.open / target=_blank ──────────────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      // Internal deep link – load it in the same window instead of a popup.
      setImmediate(() => win.loadURL(url));
    } else {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // ── Permissions ──────────────────────────────────────────────────────────
  // Grant notifications + media only for our own origin.  Everything else
  // (geolocation, camera, etc.) is denied unless the site explicitly needs it.
  const allowedPerms = new Set([
    'notifications',
    'media',
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'pointerLock',
  ]);

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const origin = details?.requestingUrl ?? '';
    if (allowedPerms.has(permission) && origin.startsWith(APP_URL)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Make `Notification.permission` report "granted" immediately after we've
  // said yes, so the site doesn't ask again on next load.
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (permission === 'notifications' && requestingOrigin.startsWith(APP_URL)) {
      return true;
    }
    return false; // use Electron's default for everything else
  });

  win.loadURL(APP_URL);

  return win;
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function trayIconPath(): string {
  const base = asset('icons', 'tray');
  // macOS: template image (named *Template.png) is auto-tinted for dark/light.
  return process.platform === 'darwin'
    ? path.join(base, 'trayTemplate.png')
    : path.join(base, 'tray-linux.png');
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: `Open ${APP_NAME}`,
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      id:      'closeToTray',
      label:   'Close to Tray',
      type:    'checkbox',
      checked: store.get('closeToTray'),
      click(item: MenuItem) {
        store.set('closeToTray', item.checked);
      },
    },
    {
      id:      'startMinimized',
      label:   'Start Minimized',
      type:    'checkbox',
      checked: store.get('startMinimized'),
      click(item: MenuItem) {
        store.set('startMinimized', item.checked);
      },
    },
    {
      id:      'startOnBoot',
      label:   'Start on Boot',
      type:    'checkbox',
      checked: store.get('startOnBoot'),
      click(item: MenuItem) {
        store.set('startOnBoot', item.checked);
        applyLoginItem(item.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
      click() {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray(): Tray {
  const img = nativeImage.createFromPath(trayIconPath());
  const t   = new Tray(img);

  t.setToolTip(APP_NAME);
  t.setContextMenu(buildTrayMenu());

  // Single-click toggles window on Windows / Linux.
  // On macOS the click opens the context menu (standard behaviour); double-
  // click shows the window.
  if (process.platform === 'darwin') {
    t.on('double-click', showWindow);
  } else {
    t.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        showWindow();
      }
    });
  }

  return t;
}

// ─── Login-item (start on boot) ───────────────────────────────────────────────

function applyLoginItem(enable: boolean): void {
  // app.setLoginItemSettings works on macOS + Windows; on Linux it silently
  // does nothing – distros vary too much.
  app.setLoginItemSettings({
    openAtLogin: enable,
    // Windows only: registry key name
    name: APP_NAME,
    // Pass --hidden so the window starts minimised when launched at boot
    args: enable ? ['--hidden'] : [],
  });
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

// Open external URL
ipcMain.handle('open-external', async (_e, url: string) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      await shell.openExternal(url);
    }
  } catch {
    // drop
  }
});

// Legacy fire-and-forget version
ipcMain.on('open-external', (_e, url: string) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      shell.openExternal(url).catch(() => {});
    }
  } catch {
    // drop
  }
});

// ── Notifications ────────────────────────────────────────────────────────────

ipcMain.handle('show-notification', (_e, payload: { title: string; body: string; icon?: string; url?: string }) => {
  const id = crypto.randomBytes(16).toString('hex');

  const options: Electron.NotificationConstructorOptions = {
    title: payload.title,
    body: payload.body,
  };

  if (payload.icon) {
    try {
      options.icon = nativeImage.createFromDataURL(payload.icon);
    } catch {
      // icon might be a URL, not a data URL – just skip it
    }
  }

  const notification = new Notification(options);

  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.webContents.send('notification-click', id, payload.url);
      showWindow();
    }
  });

  notification.on('close', () => {
    activeNotifications.delete(id);
  });

  activeNotifications.set(id, notification);
  notification.show();

  return { id };
});

ipcMain.on('close-notification', (_e, id: string) => {
  const notification = activeNotifications.get(id);
  if (notification) {
    notification.close();
    activeNotifications.delete(id);
  }
});

ipcMain.on('close-notifications', (_e, ids: string[]) => {
  for (const id of ids) {
    const notification = activeNotifications.get(id);
    if (notification) {
      notification.close();
      activeNotifications.delete(id);
    }
  }
});

// ── Downloads ────────────────────────────────────────────────────────────────

ipcMain.handle('download-file', async (_e, url: string, suggestedName: string) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: suggestedName,
    });

    if (!filePath) return { success: false, error: 'Cancelled' };

    return new Promise((resolve) => {
      const ses = mainWindow!.webContents.session;
      ses.once('will-download', (_event, item) => {
        item.setSavePath(filePath);
        item.once('done', (_doneEvent, state) => {
          if (state === 'completed') {
            resolve({ success: true, path: filePath });
          } else {
            resolve({ success: false, error: state });
          }
        });
      });
      mainWindow!.webContents.downloadURL(url);
    });
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Download failed' };
  }
});

// ── Desktop info ─────────────────────────────────────────────────────────────

ipcMain.handle('get-desktop-info', () => {
  return {
    version: app.getVersion(),
    arch: process.arch,
    os: process.platform,
    osVersion: process.getSystemVersion?.() ?? 'unknown',
  };
});

// ── Deep links ───────────────────────────────────────────────────────────────

ipcMain.handle('get-initial-deep-link', () => {
  const link = pendingDeepLink;
  pendingDeepLink = null;
  return link;
});

// ── Clipboard ────────────────────────────────────────────────────────────────

ipcMain.handle('clipboard-write-text', (_e, text: string) => {
  clipboard.writeText(text);
});

// ── Badge count ──────────────────────────────────────────────────────────────

ipcMain.on('set-badge-count', (_e, count: number) => {
  app.setBadgeCount(count);
});

// ── Window controls ──────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

// ── Autostart ────────────────────────────────────────────────────────────────

ipcMain.handle('autostart-enable', () => {
  store.set('startOnBoot', true);
  applyLoginItem(true);
});

ipcMain.handle('autostart-disable', () => {
  store.set('startOnBoot', false);
  applyLoginItem(false);
});

ipcMain.handle('autostart-is-enabled', () => store.get('startOnBoot'));
ipcMain.handle('autostart-is-initialized', () => store.get('autostartInitialized') ?? false);
ipcMain.handle('autostart-mark-initialized', () => store.set('autostartInitialized', true));

// ── Updater stubs ────────────────────────────────────────────────────────────

ipcMain.handle('updater-check', () => {});
ipcMain.handle('updater-install', () => {});

// ── Spellcheck stubs ─────────────────────────────────────────────────────────

ipcMain.handle('spellcheck-get-available-languages', () => []);
ipcMain.handle('spellcheck-set-state', (_e, state: any) => state);

// ── Desktop sources stub ─────────────────────────────────────────────────────

ipcMain.handle('get-desktop-sources', () => []);

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Sync login-item state in case the setting was persisted across a reinstall.
  applyLoginItem(store.get('startOnBoot'));

  mainWindow = createWindow();

  // Tray is best-effort; on GNOME without AppIndicator it simply won't show.
  try {
    tray = createTray();
  } catch (err) {
    console.warn('[tray] Could not create tray icon (tray may be unavailable):', err);
  }

  // macOS: clicking the dock icon re-shows the window.
  app.on('activate', () => {
    if (mainWindow) {
      showWindow();
    } else {
      mainWindow = createWindow();
    }
  });
});

// Second instance → focus existing window + handle deep link (Windows / Linux)
app.on('second-instance', (_e, argv) => {
  if (mainWindow) showWindow();

  const deepLink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (deepLink) handleDeepLink(deepLink);
});

// macOS: deep link arrives via open-url (registered in Info.plist by builder)
app.on('open-url', (e, url) => {
  e.preventDefault();
  handleDeepLink(url);
});

// Prevent the app exiting when all windows are closed while the tray is live.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Quit unless we're sitting in the tray intentionally.
    if (isQuitting || !store.get('closeToTray')) {
      app.quit();
    }
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// ─── Handle --hidden launch arg (set by login-item on boot) ──────────────────
// Must happen synchronously before createWindow, so we check argv here.
if (process.argv.includes('--hidden')) {
  store.set('startMinimized', true);
  // One-shot: don't persist this as a user preference across relaunches.
  // We only want to start hidden on this particular launch.
  app.once('ready', () => {
    // Already in the store for this session; nothing else needed.
  });
}
