const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Must be set before any windows — tells Windows the app identity (name + icon in Task Manager, Startup apps, etc.)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.salaat.widget');
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
let tray = null;
let isExpanded = false;
let settings = {};

// Sizes
const COMPACT_WIDTH = 200;
const COMPACT_HEIGHT = 48;
const EXPANDED_WIDTH = 340;
const EXPANDED_HEIGHT = 540;
const SETTINGS_WIDTH = 560;
const SETTINGS_HEIGHT = 720;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  
  settings = {
    position: settings.position || null,
    alwaysOnTop: settings.alwaysOnTop !== false,
    isExpanded: settings.isExpanded || false,
    corner: settings.corner || 'bottom-left',
    widgetSettings: settings.widgetSettings || {},
    ...settings
  };
  
  return settings;
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function getTaskbarPosition() {
  const primary = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primary.size; // Full screen size
  const { width: workW, height: workH } = primary.workAreaSize; // Usable area
  const { x: workX, y: workY } = primary.workArea;
  
  // Determine taskbar position and size
  if (workY > 0) return { position: 'top', height: workY };
  if (workH < screenH) return { position: 'bottom', height: screenH - workH };
  if (workX > 0) return { position: 'left', width: workX };
  if (workW < screenW) return { position: 'right', width: screenW - workW };
  return { position: 'bottom', height: 40 }; // Default
}

function getCornerPosition(corner, width, height, onTaskbar = false) {
  const primary = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primary.size;
  const workArea = primary.workArea;
  const taskbar = getTaskbarPosition();
  const margin = 4;
  
  let x, y;
  
  if (onTaskbar && taskbar.position === 'bottom') {
    // Snap ON the taskbar (work area): widget bottom = taskbar top, so it’s clickable
    y = screenH - height;
    if (corner.includes('left')) {
      x = margin;
    } else {
      x = screenW - width - margin;
    }
  } else if (onTaskbar && taskbar.position === 'top') {
    // Snap ON the top taskbar: widget top = screen top
    y = 0;
    if (corner.includes('left')) {
      x = margin;
    } else {
      x = screenW - width - margin;
    }
  } else {
    // Normal positioning in work area (not snapped to taskbar)
    switch (corner) {
      case 'top-left': x = workArea.x + margin; y = workArea.y + margin; break;
      case 'top-right': x = workArea.x + workArea.width - width - margin; y = workArea.y + margin; break;
      case 'bottom-right': x = workArea.x + workArea.width - width - margin; y = workArea.y + workArea.height - height - margin; break;
      default: x = workArea.x + margin; y = workArea.y + workArea.height - height - margin;
    }
  }
  
  return { x, y };
}

function createWindow() {
  loadSettings();
  isExpanded = settings.isExpanded;
  
  const winWidth = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const winHeight = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  const useStoredPos = !snapToTaskbar && settings.position;
  let pos = useStoredPos ? settings.position : getCornerPosition(settings.corner, winWidth, winHeight, snapToTaskbar);
  
  // Ensure on screen
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().size;
  pos.x = Math.max(0, Math.min(pos.x, screenW - winWidth));
  pos.y = Math.max(0, Math.min(pos.y, screenH - winHeight));

  const desktopIconPath = path.join(app.getAppPath(), 'icons', 'salaat-icon-256 (1).png');
  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    show: false,
    icon: fs.existsSync(desktopIconPath) ? desktopIconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setBackgroundThrottling(false);

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'geolocation') callback(true);
    else callback(false);
  });

  if (snapToTaskbar) {
    mainWindow.setAlwaysOnTop(true);
    settings.alwaysOnTop = true;
  }

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('moved', () => {
    const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
    if (snapToTaskbar) return; // keep snapped position, don't persist drag
    const [px, py] = mainWindow.getPosition();
    settings.position = { x: px, y: py };
    saveSettings();
  });

  mainWindow.on('closed', () => mainWindow = null);
  mainWindow.on('blur', () => { dragAnchor = null; });
  mainWindow.on('hide', () => { dragAnchor = null; });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('init-state', { 
      isExpanded, 
      widgetSettings: settings.widgetSettings,
      corner: settings.corner,
      autoStart: getOpenAtLogin()
    });
  });
}

function createTray() {
  // When packaged, icons are unpacked (asarUnpack) - use real path so Windows tray shows the icon
  const trayIconName = 'salaat-icon-256 (1).png';
  let iconPath;
  if (app.isPackaged) {
    const unpackedIcons = path.join(process.resourcesPath, 'app.asar.unpacked', 'icons', trayIconName);
    iconPath = fs.existsSync(unpackedIcons) ? unpackedIcons : path.join(app.getAppPath(), 'icons', trayIconName);
  } else {
    iconPath = path.join(app.getAppPath(), 'icons', trayIconName);
  }

  let trayIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  // Windows tray works best with 16x16; resize if we have a larger image
  if (!trayIcon.isEmpty() && (trayIcon.getSize().width > 32 || trayIcon.getSize().height > 32)) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip('Salaat Widget');
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else showAndFocusMain();
  });
}

const NUDGE_DELAY_MS = 50;
const NUDGE_INTERVAL_MS = 90 * 1000; // re-nudge every 90s when visible + snapped

function ensureAlwaysOnTopWhenSnapped() {
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  if (!snapToTaskbar || !mainWindow) return;
  const b = mainWindow.getBounds();
  const isWidget = (b.width === COMPACT_WIDTH || b.width === EXPANDED_WIDTH);
  if (isWidget) {
    const w = b.width;
    const h = b.height;
    const pos = getCornerPosition(settings.corner, w, h, true);
    mainWindow.setPosition(pos.x, pos.y);
  }
  mainWindow.setAlwaysOnTop(false);
  setTimeout(() => {
    if (!mainWindow) return;
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  }, NUDGE_DELAY_MS);
}

function maybePeriodicNudge() {
  if (!mainWindow || !mainWindow.isVisible()) return;
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  if (!snapToTaskbar) return;
  const b = mainWindow.getBounds();
  const isWidget = b.width === COMPACT_WIDTH || b.width === EXPANDED_WIDTH;
  if (!isWidget) return;
  ensureAlwaysOnTopWhenSnapped();
}

function startNudgeInterval() {
  setInterval(maybePeriodicNudge, NUDGE_INTERVAL_MS);
}

function showAndFocusMain() {
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  if (snapToTaskbar) {
    mainWindow.setAlwaysOnTop(false);
    const w = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
    const h = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
    const pos = getCornerPosition(settings.corner, w, h, true);
    mainWindow.setPosition(pos.x, pos.y);
  }
  mainWindow.show();
  mainWindow.focus();
  ensureAlwaysOnTopWhenSnapped();
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: () => mainWindow.isVisible() ? mainWindow.hide() : showAndFocusMain() },
    { label: 'Stop Adhan', click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stop-adhan'); } },
    { label: 'Always on Top', type: 'checkbox', checked: settings.alwaysOnTop, click: (m) => {
      settings.alwaysOnTop = m.checked;
      mainWindow.setAlwaysOnTop(m.checked);
      saveSettings();
    }},
    { type: 'separator' },
    { label: 'Snap to Corner', submenu: [
      { label: 'Bottom Left', type: 'radio', checked: settings.corner === 'bottom-left', click: () => snapToCorner('bottom-left') },
      { label: 'Bottom Right', type: 'radio', checked: settings.corner === 'bottom-right', click: () => snapToCorner('bottom-right') },
      { label: 'Top Left', type: 'radio', checked: settings.corner === 'top-left', click: () => snapToCorner('top-left') },
      { label: 'Top Right', type: 'radio', checked: settings.corner === 'top-right', click: () => snapToCorner('top-right') },
    ]},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
}

function snapToCorner(corner) {
  settings.corner = corner;
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  const h = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  const w = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const pos = getCornerPosition(corner, w, h, snapToTaskbar);
  mainWindow.setPosition(pos.x, pos.y);
  settings.position = pos;
  if (snapToTaskbar) {
    mainWindow.setAlwaysOnTop(true);
    settings.alwaysOnTop = true;
  }
  saveSettings();
  updateTrayMenu();
  ensureAlwaysOnTopWhenSnapped();
}

ipcMain.on('toggle-expand', () => {
  isExpanded = !isExpanded;
  settings.isExpanded = isExpanded;
  
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  const newW = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const newH = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  
  let x, y;
  if (snapToTaskbar) {
    const pos = getCornerPosition(settings.corner, newW, newH, true);
    x = pos.x;
    y = pos.y;
  } else {
    const [currentX, currentY] = mainWindow.getPosition();
    x = currentX;
    y = isExpanded
      ? Math.max(0, currentY - (EXPANDED_HEIGHT - COMPACT_HEIGHT))
      : currentY + (EXPANDED_HEIGHT - COMPACT_HEIGHT);
  }
  
  mainWindow.setBounds({ x, y, width: newW, height: newH });
  mainWindow.webContents.send('expanded-changed', isExpanded);
  settings.position = { x, y };
  saveSettings();
  ensureAlwaysOnTopWhenSnapped();
});

ipcMain.on('open-settings', () => {
  const [currentX] = mainWindow.getPosition();
  const primary = screen.getPrimaryDisplay();
  const { width: workW, height: workH } = primary.workAreaSize;
  const { x: workX, y: workY } = primary.workArea;
  
  const h = Math.min(SETTINGS_HEIGHT, Math.max(520, workH - 48));
  const newY = Math.max(workY, workY + Math.floor((workH - h) / 2));
  let x = Math.max(workX, Math.min(currentX, workX + workW - SETTINGS_WIDTH));
  mainWindow.setBounds({ x, y: newY, width: SETTINGS_WIDTH, height: h });
  mainWindow.webContents.send('settings-opened');
});

ipcMain.on('close-settings', () => {
  const [currentX] = mainWindow.getPosition();
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  
  const w = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const h = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  const pos = getCornerPosition(settings.corner, w, h, snapToTaskbar);
  
  mainWindow.setBounds({ x: currentX, y: pos.y, width: w, height: h });
  mainWindow.webContents.send('settings-closed');
  ensureAlwaysOnTopWhenSnapped();
});

ipcMain.on('save-widget-settings', (event, widgetSettings) => {
  settings.widgetSettings = widgetSettings;
  saveSettings();
});

ipcMain.on('close-app', () => mainWindow.hide());

function getWindowsStartupFolder() {
  return path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const STARTUP_REG_NAMES = ['Salaat Widget', 'Electron', 'Salaat'];

function removeStartupShortcuts() {
  if (process.platform !== 'win32') return;
  const startupFolder = getWindowsStartupFolder();
  const toRemove = ['Salaat Widget.lnk', 'Electron.lnk'];
  toRemove.forEach((name) => {
    const fullPath = path.join(startupFolder, name);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
      console.warn('Could not remove startup shortcut:', fullPath, e.message);
    }
  });
  // Electron and Windows also use the Registry Run key — remove those entries too
  STARTUP_REG_NAMES.forEach((valueName) => {
    try {
      execSync(`reg delete "${RUN_KEY}" /v "${valueName.replace(/"/g, '\\"')}" /f`, { stdio: 'ignore', windowsHide: true });
    } catch (e) {
      // Value may not exist; ignore
    }
  });
}

function createWindowsStartupShortcut() {
  const startupFolder = getWindowsStartupFolder();
  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath);
  const shortcutPath = path.join(startupFolder, 'Salaat Widget.lnk');
  const script = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = '${exePath.replace(/'/g, "''")}'
$Shortcut.WorkingDirectory = '${exeDir.replace(/'/g, "''")}'
$Shortcut.Description = 'Salaat Widget'
$Shortcut.Save()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($WshShell) | Out-Null
`;
  try {
    execSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script.trim()], { windowsHide: true });
  } catch (e) {
    console.error('Failed to create startup shortcut:', e.message);
  }
  // Also add Registry Run entry so it shows in Task Manager → Startup apps (some Windows setups rely on this)
  try {
    const exeValue = exePath.includes(' ') ? `"${exePath}"` : exePath;
    execSync(`reg add "${RUN_KEY}" /v "Salaat Widget" /t REG_SZ /d "${exeValue.replace(/"/g, '\\"')}" /f`, { stdio: 'ignore', windowsHide: true });
  } catch (e) {
    console.warn('Failed to add startup registry entry:', e.message);
  }
}

function getOpenAtLogin() {
  if (process.platform === 'win32') {
    const shortcutPath = path.join(getWindowsStartupFolder(), 'Salaat Widget.lnk');
    if (fs.existsSync(shortcutPath)) return true;
    // Also check Registry (in case only registry entry exists from an old run)
    try {
      const out = execSync(`reg query "${RUN_KEY}" /v "Salaat Widget"`, { encoding: 'utf8', windowsHide: true });
      return out.includes('Salaat Widget');
    } catch (e) {
      return false;
    }
  }
  return app.getLoginItemSettings().openAtLogin;
}

ipcMain.on('set-auto-start', (event, enabled) => {
  if (process.platform === 'win32') {
    removeStartupShortcuts();
    if (enabled) createWindowsStartupShortcut();
    // Don't call setLoginItemSettings(true) on Windows — it creates "Electron.lnk" and duplicates
    if (!enabled) app.setLoginItemSettings({ openAtLogin: false });
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled, path: app.getPath('exe') });
  }
});

ipcMain.on('select-adhan-file', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const src = result.filePaths[0];
    const dest = path.join(app.getPath('userData'), 'custom-adhan' + path.extname(src));
    fs.copyFileSync(src, dest);
    event.reply('adhan-file-selected', dest);
  }
});

function selectCustomSound(type) {
  return async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const src = result.filePaths[0];
      const dest = path.join(app.getPath('userData'), 'custom-' + type + path.extname(src));
      fs.copyFileSync(src, dest);
      event.reply(type + '-file-selected', dest);
    }
  };
}
ipcMain.on('select-reminder-file', selectCustomSound('reminder'));
ipcMain.on('select-elapsed-file', selectCustomSound('elapsed'));

ipcMain.on('snap-corner', (event, corner) => snapToCorner(corner));

let dragAnchor = null;
ipcMain.on('drag-start', (event, { screenX, screenY }) => {
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  dragAnchor = { startScreenX: screenX, startScreenY: screenY, startX: b.x, startY: b.y, width: b.width, height: b.height };
});
ipcMain.on('move-window', (event, { screenX, screenY }) => {
  if (!mainWindow || !dragAnchor) return;
  const x = Math.round(dragAnchor.startX + screenX - dragAnchor.startScreenX);
  const y = Math.round(dragAnchor.startY + screenY - dragAnchor.startScreenY);
  mainWindow.setBounds({ x, y, width: dragAnchor.width, height: dragAnchor.height });
});
ipcMain.on('drag-end', () => {
  dragAnchor = null;
  ensureAlwaysOnTopWhenSnapped();
});

ipcMain.on('reposition', () => {
  const snapToTaskbar = settings.widgetSettings?.general?.snapToTaskbar !== false;
  const w = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const h = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  const pos = getCornerPosition(settings.corner, w, h, snapToTaskbar);
  mainWindow.setPosition(pos.x, pos.y);
  settings.position = pos;
  saveSettings();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  startNudgeInterval();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWindow) showAndFocusMain(); });
}
