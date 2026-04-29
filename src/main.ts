import {
  app,
  BrowserWindow,
  desktopCapturer,
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
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Store } from './store';

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_NAME    = 'Fluxer World';
const APP_URL     = 'https://fluxer.world';
const APP_ID      = 'org.fluxer.World';
const PROTOCOL    = 'fluxerworld';

/** Hostnames we consider "internal" – navigation and new windows are allowed. */
const ALLOWED_HOSTS = new Set(['fluxer.world', 'cdn.fluxer.world', 'media.fluxer.world']);

// ─── Wayland app_id / WM_CLASS ────────────────────────────────────────────────
// Must be set before any BrowserWindow is created so that Wayland compositors
// and KDE/GNOME can match the window to the .desktop file and show the correct icon.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('wayland-app-id', APP_ID);
  app.commandLine.appendSwitch('wm-class', APP_ID);

  const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' ||
                    Boolean(process.env.WAYLAND_DISPLAY);
  const hasNvidia = fs.existsSync('/proc/driver/nvidia/version');

  // Nvidia proprietary drivers on Wayland hang vkAcquireNextImageKHR()
  // which kills Chromium's GPU process. Force-disable Vulkan on that combo
  // so the compositor falls back to OpenGL (stable on Nvidia for years).
  if (hasNvidia && isWayland) {
    app.commandLine.appendSwitch('disable-features', 'Vulkan');
  } else {
    // Use Vulkan ANGLE backend if a Vulkan driver is installed.
    // Fixes EGL/ANGLE crashes on some AMD + Wayland setups.
    try {
      const icdDir = '/usr/share/vulkan/icd.d';
      const hasVulkan = fs.existsSync(icdDir) &&
        fs.readdirSync(icdDir).some(f => f.endsWith('.json'));
      if (hasVulkan) {
        app.commandLine.appendSwitch('use-angle', 'vulkan');
        app.commandLine.appendSwitch('enable-features', 'Vulkan');
      }
    } catch {}
  }
}
app.name = APP_ID;
app.setName(APP_ID);

// ─── Globals ──────────────────────────────────────────────────────────────────

const store       = new Store();
let mainWindow:   BrowserWindow | null = null;
let tray:         Tray | null = null;
let isQuitting    = false;

/** Track active native notifications so we can close them by id. */
const activeNotifications = new Map<string, Notification>();

// ─── Persistent launch log ────────────────────────────────────────────────────
// Tee console output to ~/.cache/fluxer-world/launch.log (or the XDG/Win/Mac
// equivalent) so we can diagnose issues that happen at startup — black
// screens, pre-wifi failures, autostart races, etc. Rotates at ~1 MB.
try {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'launch.log');
  try {
    const st = fs.statSync(logPath);
    if (st.size > 1024 * 1024) {
      fs.renameSync(logPath, logPath + '.old');
    }
  } catch {}
  const stamp = () => new Date().toISOString();
  // Write each line synchronously with appendFileSync so the log is
  // always up-to-date on disk. If the app is killed (SIGKILL, crash,
  // force-quit), nothing sits in a buffer waiting to be flushed.
  // The slight per-write cost is fine for startup diagnostics.
  const tee = (orig: (...args: unknown[]) => void, level: string) =>
    (...args: unknown[]) => {
      const line = args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      try { fs.appendFileSync(logPath, `${stamp()} ${level} ${line}\n`); } catch {}
      orig(...args);
    };
  console.log   = tee(console.log.bind(console),   'INFO');
  console.info  = tee(console.info.bind(console),  'INFO');
  console.warn  = tee(console.warn.bind(console),  'WARN');
  console.error = tee(console.error.bind(console), 'ERROR');
  console.log(`[boot] Fluxer ${app.getVersion()} starting, platform=${process.platform}, arch=${process.arch}`);
} catch (err) {
  // Logging is best-effort; never block app startup on it.
}

// ─── Single-instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
console.log(`[boot] single-instance lock: gotLock=${gotLock} pid=${process.pid}`);
if (!gotLock) {
  console.log(`[boot] another instance detected, quitting pid=${process.pid}`);
  app.quit();
  process.exit(0);
}
// If another instance tries to start after us, Electron fires this event
// instead of letting it continue. Focus our existing window so the user
// sees the already-running Fluxer instead of a dead second process.
app.on('second-instance', (_event, _argv, _cwd) => {
  console.log('[boot] second-instance fired — focusing existing window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

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

/** Static pages that should open in the browser, not the app. */
const EXTERNAL_PATHS = ['/status', '/selfhost', '/help', '/contact', '/privacy', '/terms', '/premium', '/oauth2/authorize'];

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) return false;
    if (u.hostname === 'fluxer.world') {
      const path = u.pathname.replace(/\.html$/, '');
      if (EXTERNAL_PATHS.includes(path)) return false;
    }
    return true;
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
      mainWindow.loadURL(reconstructed).catch((err) => console.log("[loadURL] rejected (handled):", err?.message ?? String(err)));
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

  const MIN_W = 800;
  const MIN_H = 500;

  // Clamp saved dimensions to the current minimum so a stored size
  // from a previous version (or a badly serialized state) can't force
  // the window below our floor at startup.
  const initialWidth  = Math.max(saved.width,  MIN_W);
  const initialHeight = Math.max(saved.height, MIN_H);

  const win = new BrowserWindow({
    x:         saved.x,
    y:         saved.y,
    width:     initialWidth,
    height:    initialHeight,
    minWidth:  MIN_W,
    minHeight: MIN_H,
    title:     APP_NAME,
    icon:      nativeImage.createFromPath(iconPath),
    // Subtle dark background colour shown while the SPA is loading.
    backgroundColor: '#13141a',
    // Show the window immediately on creation.
    show: !(store.get('startMinimized') || launchHidden),
    // Hide the default menu bar (removes duplicate window controls + File menu)
    autoHideMenuBar: true,
    // Remove the native window frame on Linux so the web app's own title bar
    // controls are the only set of min/max/close buttons.
    ...(process.platform === 'linux' && { frame: false }),
    // Dark title bar on Windows — prevents the OS accent colour from bleeding in.
    ...(process.platform === 'win32' && {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: '#13141a',
        symbolColor: '#e4e4e7',
        height: 32,
      },
    }),

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

  // Remove the application menu bar entirely (no File/Edit/View etc.)
  win.setMenu(null);

  // Explicit setMinimumSize — Wayland + frame: false sometimes ignores the
  // constructor minWidth/minHeight, so re-apply here to force compositors
  // like KWin/GNOME to respect our floor during resize.
  win.setMinimumSize(MIN_W, MIN_H);

  // Belt-and-suspenders: some Wayland compositors still let the user drag
  // the window below the minimum despite setMinimumSize. Intercept the
  // resize event at the Electron layer and reject any attempt to go below
  // the floor — works regardless of compositor quirks.
  win.on('will-resize', (event, newBounds) => {
    if (newBounds.width < MIN_W || newBounds.height < MIN_H) {
      event.preventDefault();
    }
  });
  // Backstop: if a resize somehow gets through (e.g. programmatic),
  // snap the window back to the minimum afterwards.
  win.on('resize', () => {
    const [w, h] = win.getSize();
    if (w < MIN_W || h < MIN_H) {
      win.setSize(Math.max(w, MIN_W), Math.max(h, MIN_H));
    }
  });

  // Last-resort poll — some Wayland compositors (confirmed: KWin on
  // Plasma 6 with xdg_toplevel frameless surfaces) silently drop min-size
  // hints AND never fire will-resize/resize for compositor-driven
  // resizes. Check every 250ms and snap back. Cheap (~0 CPU when idle)
  // and guarantees the floor holds regardless of event-layer bugs.
  const sizeEnforcer = setInterval(() => {
    if (win.isDestroyed() || win.isMinimized()) return;
    const [w, h] = win.getSize();
    if (w < MIN_W || h < MIN_H) {
      win.setSize(Math.max(w, MIN_W), Math.max(h, MIN_H));
    }
  }, 250);
  win.on('closed', () => clearInterval(sizeEnforcer));

  // Restore maximised state
  if (saved.isMaximized) win.maximize();

  // ── KDE Wayland focus workaround ────────────────────────────────────────
  // KDE Wayland prevents focus stealing.  We request activation at multiple
  // points to maximise the chance the window actually appears on screen.
  if (!(store.get('startMinimized') || launchHidden)) {
    app.focus({ steal: true });
    win.once('ready-to-show', () => {
      win.showInactive();
      win.moveTop();
      app.focus({ steal: true });
      win.focus();
    });
  }

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
      setImmediate(() => win.loadURL(url).catch((err) => console.log("[loadURL] rejected (handled):", err?.message ?? String(err))));
    } else {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // ── Native context menu (Cut / Copy / Paste / Select All) ───────────────
  win.webContents.on('context-menu', (_e, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup();
  });

  // ── DevTools (Ctrl+Shift+I / F12) ───────────────────────────────────────
  win.webContents.on('before-input-event', (_e, input) => {
    if (
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      input.key === 'F12'
    ) {
      win.webContents.toggleDevTools();
    }
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

  // Report granted for permissions we auto-allow, so the web app doesn't
  // think it needs to re-request them.
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (allowedPerms.has(permission) && requestingOrigin.startsWith(APP_URL)) {
      return true;
    }
    return false;
  });

  // ── Screen share display media handler ────────────────────────────────
  // Let the web app handle source selection via IPC instead of the default
  // Electron dialog. This enables screen share with audio support.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const requestId = crypto.randomUUID();

    // Notify the renderer that a display media request is pending
    win.webContents.send('display-media-requested', requestId, {
      videoRequested: request.videoRequested,
      audioRequested: request.audioRequested,
      supportsLoopbackAudio: true,
      supportsSystemAudioCapture: process.platform !== 'darwin',
    });

    // Wait for the renderer to pick a source
    const handler = (_e: Electron.Event, respRequestId: string, sourceId: string | null, withAudio: boolean) => {
      if (respRequestId !== requestId) return;
      ipcMain.removeListener('select-display-media-source', handler);

      if (sourceId) {
        callback({
          video: { id: sourceId, name: '' } as Electron.DesktopCapturerSource,
          audio: withAudio ? 'loopback' as const : undefined,
        });
      } else {
        callback({});
      }
    };

    ipcMain.on('select-display-media-source', handler);
  });

  // Retry the initial load if it fails (common when the app launches
  // before wifi is ready — user sees "no connection" and has to quit
  // and relaunch). Keep retrying until we get a successful load, with
  // short first attempt (1s) and backoff up to 30s.
  let retryDelay = 1000;
  let retryAttempt = 0;
  let retryTimer: NodeJS.Timeout | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  // True if did-fail-load fired for the current navigation. Reset on
  // did-start-loading (a new navigation begins). did-finish-load checks
  // this — when true, the "finish" is just the chrome-error page render
  // and shouldn't be treated as success.
  let currentLoadFailed = false;
  win.webContents.on('did-start-loading', () => { currentLoadFailed = false; });
  const startHeartbeat = () => {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      console.log(`[load-retry] heartbeat attempt=${retryAttempt} delay=${retryDelay}ms timerActive=${retryTimer !== null}`);
    }, 5000);
  };
  const stopHeartbeat = () => {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };
  // Path to bundled assets/loading.html — shown during retry loops so the
  // user sees what's happening instead of a blank chrome-error page.
  const loadingPagePath = asset('loading.html');
  let onLoadingPage = false;
  const showLoadingPage = (statusInfo: Record<string, unknown> | null) => {
    onLoadingPage = true;
    win.loadFile(loadingPagePath).then(() => {
      if (statusInfo) {
        try { win.webContents.send('loading-status', statusInfo); } catch {}
      }
    }).catch((err) => {
      console.log('[load-retry] failed to show loading page:', err && err.message ? err.message : String(err));
    });
  };
  // When the user clicks "Try again" on the loading page, fire an
  // immediate retry instead of waiting for the timer.
  ipcMain.on('loading-retry-now', () => {
    console.log('[load-retry] manual retry-now from loading page');
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    retryAttempt++;
    onLoadingPage = false;
    try { win.webContents.send('loading-retrying'); } catch {}
    win.loadURL(APP_URL).catch((err) =>
      console.log('[load-retry] manual loadURL rejected (handled):', err && err.message ? err.message : String(err)),
    );
    retryDelay = 1000; // reset backoff after a manual retry
  });

  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return; // ERR_ABORTED (user navigation), don't retry
    currentLoadFailed = true;
    console.log(`[load-retry] failed attempt=${retryAttempt} err=${errorCode} ${errorDescription}, scheduling retry in ${retryDelay}ms`);
    if (retryTimer) clearTimeout(retryTimer);
    startHeartbeat();
    const thisDelay = retryDelay;
    const scheduledAt = Date.now();
    // Show the loading page with friendly status so the user isn't
    // staring at a chrome-error screen during the retry wait.
    showLoadingPage({
      errorCode,
      errorDescription,
      retryInMs: thisDelay,
      attempt: retryAttempt + 1,
    });
    retryTimer = setTimeout(() => {
      retryAttempt++;
      const actualDelay = Date.now() - scheduledAt;
      console.log(`[load-retry] firing attempt=${retryAttempt} (scheduled=${thisDelay}ms actual=${actualDelay}ms)`);
      onLoadingPage = false;
      try { win.webContents.send('loading-retrying'); } catch {}
      // loadURL returns a Promise that REJECTS on failure. Unhandled
      // rejections crash the main process in modern Node, which killed
      // our retry entirely (the setTimeout never got to fire a second
      // time). Swallow the rejection here — did-fail-load still fires
      // with the details.
      win.webContents
        .loadURL(validatedURL || APP_URL)
        .catch((err) => {
          console.log(`[load-retry] loadURL rejected (handled):`, err && err.message ? err.message : String(err));
        });
      retryDelay = Math.min(retryDelay * 2, 30000);
      retryTimer = null;
    }, retryDelay);
  });
  win.webContents.on('did-finish-load', () => {
    // did-finish-load fires for: real successes, chrome-error pages
    // after did-fail-load, AND our local loading.html. We must skip
    // both error and loading-page cases — only treat real https loads
    // as success.
    if (onLoadingPage) {
      console.log('[load-retry] did-finish-load on loading page (ignoring)');
      return;
    }
    if (currentLoadFailed) {
      console.log(`[load-retry] did-finish-load with currentLoadFailed=true (ignoring) attempt=${retryAttempt}`);
      return;
    }
    console.log(`[load-retry] did-finish-load real success (attempt=${retryAttempt})`);
    stopHeartbeat();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    retryDelay = 1000;
    retryAttempt = 0;
  });

  win.loadURL(APP_URL).catch((err) => console.log("[loadURL] rejected (handled):", err?.message ?? String(err)));

  return win;
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function trayIconPath(count = 0): string {
  const base = asset('icons', 'tray');
  // macOS: template image (named *Template.png) is auto-tinted for dark/light.
  if (process.platform === 'darwin') return path.join(base, 'trayTemplate.png');
  if (count <= 0) return path.join(base, 'tray-linux.png');
  if (count >= 10) return path.join(base, 'tray-linux-9plus.png');
  return path.join(base, `tray-linux-${count}.png`);
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
  if (process.platform === 'linux') {
    applyLinuxAutostart(enable);
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: enable,
    name: APP_NAME,
    args: enable ? ['--hidden'] : [],
  });
}

// Filenames a Fluxer autostart .desktop file might appear under.
// Canonical is the first; rest are legacy names from older versions
// or OS tools that may have written them. We always clean up non-
// canonical names to prevent duplicate-launch races.
const AUTOSTART_FILENAMES = [
  `${APP_ID}.desktop`,
  'fluxer-world.desktop',
  'Fluxer World.desktop',
  'fluxer.desktop',
];

function getAutostartDir(): string {
  const os = require('os');
  return path.join(os.homedir(), '.config', 'autostart');
}

/**
 * Remove any non-canonical Fluxer autostart .desktop files. Prevents the
 * dual-launch race where two different filenames both point at Fluxer and
 * the session manager fires them both at login.
 */
function cleanupStaleAutostart(): void {
  const autostartDir = getAutostartDir();
  const canonical = AUTOSTART_FILENAMES[0];
  for (const name of AUTOSTART_FILENAMES.slice(1)) {
    try {
      fs.unlinkSync(path.join(autostartDir, name));
      console.log(`[autostart] removed stale entry: ${name}`);
    } catch {
      // doesn't exist, fine
    }
  }
  void canonical;
}

/**
 * Reconcile the in-app `startOnBoot` store value with the actual
 * presence of an autostart .desktop file. If they disagree, trust the
 * store as the source of truth and rewrite/delete the file to match.
 * Called on startup so users can never end up in a split-brain state.
 */
function reconcileAutostart(): void {
  const autostartDir = getAutostartDir();
  const canonicalPath = path.join(autostartDir, AUTOSTART_FILENAMES[0]);
  const wantEnabled = !!store.get('startOnBoot');
  const fileExists = fs.existsSync(canonicalPath);
  if (wantEnabled !== fileExists) {
    console.log(`[autostart] reconcile: store=${wantEnabled} file=${fileExists}, fixing`);
    applyLinuxAutostart(wantEnabled);
  }
}

function applyLinuxAutostart(enable: boolean): void {
  const autostartDir = getAutostartDir();
  const desktopFile = path.join(autostartDir, AUTOSTART_FILENAMES[0]);

  // Always clean up legacy filenames first, regardless of enable/disable.
  cleanupStaleAutostart();

  if (enable) {
    const entry = [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${APP_NAME}`,
      `Exec=fluxer-world --hidden`,
      `Icon=${APP_ID}`,
      'Terminal=false',
      `StartupWMClass=${APP_NAME}`,
      'X-GNOME-Autostart-enabled=true',
    ].join('\n') + '\n';

    try {
      fs.mkdirSync(autostartDir, { recursive: true });
      fs.writeFileSync(desktopFile, entry, 'utf8');
    } catch (err) {
      console.warn('[autostart] Failed to create autostart entry:', err);
    }
  } else {
    try {
      fs.unlinkSync(desktopFile);
    } catch {
      // file doesn't exist, that's fine
    }
  }
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
  const hasUnread = count > 0;

  if (mainWindow && !mainWindow.isFocused() && hasUnread) {
    // flashFrame sets the urgency hint (X11) or xdg-activation (Wayland).
    if (process.platform === 'linux') {
      mainWindow.flashFrame(true);
    }
  } else if (mainWindow && !hasUnread) {
    mainWindow.flashFrame(false);
  }

  // Swap tray icon to show the unread count badge.
  if (tray) {
    try {
      tray.setImage(nativeImage.createFromPath(trayIconPath(count)));
    } catch { /* ignore */ }
    tray.setToolTip(hasUnread ? `${APP_NAME} (${count} unread)` : APP_NAME);
  }
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

// ── Updater ──────────────────────────────────────────────────────────────────

import { autoUpdater } from 'electron-updater';

const GITHUB_REPO  = 'fluxerworld/fluxerworld';
const isAppImage   = !!process.env.APPIMAGE;

// Detect if this is a Linux install that electron-updater can't handle natively
// (i.e. not AppImage — tar.gz, deb, rpm, AUR all install to /opt/fluxer-world)
const useManualLinuxUpdater = process.platform === 'linux' && !isAppImage;

let manualUpdateVersion: string | null = null;
let manualDownloadedPath: string | null = null;
let updaterContext: string = 'background';

function sendUpdaterEvent(event: Record<string, unknown>): void {
  mainWindow?.webContents.send('updater-event', event);
}

// ── electron-updater (Windows, macOS, AppImage) ─────────────────────────────

if (!useManualLinuxUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent({ type: 'checking', context: updaterContext });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdaterEvent({ type: 'available', context: updaterContext, version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterEvent({ type: 'not-available', context: updaterContext });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterEvent({
      type: 'progress', context: updaterContext,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterEvent({ type: 'downloaded', context: updaterContext, version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendUpdaterEvent({ type: 'error', context: updaterContext, message: String(err) });
  });
}

// ── Manual updater (Linux tar.gz, deb, rpm, AUR) ───────────────────────────

function compareVersions(current: string, latest: string): number {
  const a = current.replace(/^v/, '').split('.').map(Number);
  const b = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function httpsGet(url: string): Promise<string> {
  const https = require('https') as typeof import('https');
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': `FluxerWorld/${app.getVersion()}` } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpsDownload(url: string, dest: string, context: string): Promise<void> {
  const https = require('https') as typeof import('https');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const startTime = Date.now();

    const doRequest = (requestUrl: string) => {
      https.get(requestUrl, {
        headers: { 'User-Agent': `FluxerWorld/${app.getVersion()}` },
      }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let transferred = 0;

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          file.write(chunk);
          const elapsed = (Date.now() - startTime) / 1000;
          sendUpdaterEvent({
            type: 'progress', context,
            percent: total > 0 ? (transferred / total) * 100 : 0,
            transferred, total,
            bytesPerSecond: elapsed > 0 ? Math.round(transferred / elapsed) : 0,
          });
        });

        res.on('end', () => file.end(() => resolve()));
        res.on('error', (err) => { file.close(); reject(err); });
      }).on('error', (err) => { file.close(); reject(err); });
    };

    doRequest(url);
  });
}

async function manualCheckForUpdate(context: string): Promise<void> {
  sendUpdaterEvent({ type: 'checking', context });

  try {
    const data = await httpsGet(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const release = JSON.parse(data);
    const latestVersion = (release.tag_name as string).replace(/^v/, '');

    if (compareVersions(app.getVersion(), latestVersion) <= 0) {
      sendUpdaterEvent({ type: 'not-available', context });
      return;
    }

    // Find the tar.gz asset (all non-AppImage Linux installs use the same files)
    const assets = (release.assets ?? []) as Array<{ name: string; browser_download_url: string }>;
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const asset = assets.find(a => a.name.endsWith(`linux-${arch}.tar.gz`));

    if (!asset) {
      sendUpdaterEvent({ type: 'error', context, message: 'No tar.gz asset found for this architecture' });
      return;
    }

    manualUpdateVersion = latestVersion;
    sendUpdaterEvent({ type: 'available', context, version: latestVersion });

    // Download to temp
    const tmpPath = path.join(app.getPath('temp'), `fluxer-world-${latestVersion}.tar.gz`);
    await httpsDownload(asset.browser_download_url, tmpPath, context);
    manualDownloadedPath = tmpPath;
    sendUpdaterEvent({ type: 'downloaded', context, version: latestVersion });
  } catch (err) {
    sendUpdaterEvent({ type: 'error', context, message: String(err) });
  }
}

function manualInstallUpdate(): void {
  if (!manualDownloadedPath || !manualUpdateVersion) return;

  const { execSync } = require('child_process') as typeof import('child_process');
  const os = require('os') as typeof import('os');
  const tmpExtract = path.join(app.getPath('temp'), 'fluxer-world-update');
  const localDir = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'fluxer-world');

  // Disable Electron's special .asar handling so fs operations treat
  // app.asar as a regular file instead of a virtual directory.
  const origAsar = process.noAsar;
  process.noAsar = true;

  try {
    // Clean up any previous extraction
    fs.rmSync(tmpExtract, { recursive: true, force: true });
    fs.mkdirSync(tmpExtract, { recursive: true });

    // Extract the tar.gz
    execSync(`tar -xzf "${manualDownloadedPath}" -C "${tmpExtract}"`, { timeout: 30000 });

    // The tar.gz extracts to "Fluxer World-{version}-linux-x64/" or similar
    const entries = fs.readdirSync(tmpExtract);
    const extractedDir = entries.find(e => fs.statSync(path.join(tmpExtract, e)).isDirectory());
    if (!extractedDir) throw new Error('No directory found in extracted archive');

    const sourcePath = path.join(tmpExtract, extractedDir);

    // Copy to user-local directory (no root needed)
    fs.rmSync(localDir, { recursive: true, force: true });
    fs.cpSync(sourcePath, localDir, { recursive: true });
    fs.chmodSync(path.join(localDir, 'fluxer-world'), 0o755);

    // Relaunch via the wrapper script so it picks up the local copy.
    // app.relaunch() uses process.execPath which bypasses the wrapper.
    const { spawn, execSync: execSyncCmd } = require('child_process') as typeof import('child_process');
    let wrapperPath = '/usr/bin/fluxer-world';
    try {
      wrapperPath = execSyncCmd('which fluxer-world', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {}
    spawn(wrapperPath, [], { detached: true, stdio: 'ignore' }).unref();
    app.exit(0);
  } catch (err) {
    console.error('[updater-install] Failed:', err);
    shell.openExternal(`https://github.com/${GITHUB_REPO}/releases/tag/v${manualUpdateVersion}`);
  } finally {
    process.noAsar = origAsar;
    try { fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(manualDownloadedPath!); } catch {}
  }
}

// ── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('updater-check', (_e, context: string) => {
  updaterContext = context;
  if (useManualLinuxUpdater) {
    manualCheckForUpdate(context);
  } else {
    autoUpdater.checkForUpdates();
  }
});

ipcMain.handle('updater-install', () => {
  if (useManualLinuxUpdater) {
    manualInstallUpdate();
  } else {
    autoUpdater.quitAndInstall(true, true);
  }
});

// ── Spellcheck stubs ─────────────────────────────────────────────────────────

ipcMain.handle('spellcheck-get-available-languages', () => []);
ipcMain.handle('spellcheck-set-state', (_e, state: any) => state);

// ── Desktop screen share sources ─────────────────────────────────────────────

ipcMain.handle('get-desktop-sources', async (_e, types: string[]) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: types as Array<'window' | 'screen'>,
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      display_id: source.display_id,
      appIcon: source.appIcon?.toDataURL() ?? null,
    }));
  } catch (err) {
    console.error('[desktop-sources] Failed to get sources:', err);
    return [];
  }
});

ipcMain.on('select-display-media-source', (_e, requestId: string, sourceId: string | null, withAudio: boolean) => {
  if (!mainWindow) return;
  if (sourceId) {
    mainWindow.webContents.send('display-media-source-selected', requestId, sourceId, withAudio);
  } else {
    mainWindow.webContents.send('display-media-source-selected', requestId, null, false);
  }
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Reconcile autostart on every launch so the OS autostart dir can't
  // drift out of sync with the user's in-app preference. Also clears
  // out legacy .desktop filenames from older installs which could
  // otherwise fire a duplicate launch at login.
  if (process.platform === 'linux') {
    cleanupStaleAutostart();
    reconcileAutostart();
  } else {
    applyLoginItem(store.get('startOnBoot'));
  }

  // Clear HTTP cache on startup so the app always fetches the latest web client.
  // Hashed assets will still be served from disk cache until the HTML references new ones.
  await session.defaultSession.clearCache();

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

// ─── One-time migration: clear startMinimized stuck by ≤1.0.34 bug ───────────
if (store.get('startMinimized') && !store.get('startMinimizedMigrated')) {
  store.set('startMinimized', false);
}
store.set('startMinimizedMigrated', true);

// ─── Handle --hidden launch arg (set by login-item on boot) ──────────────────
// Runtime-only flag: --hidden makes this single launch start minimized without
// touching the persistent store (which is controlled by the tray menu toggle).
const launchHidden = process.argv.includes('--hidden');
