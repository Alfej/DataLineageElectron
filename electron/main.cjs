const { app, BrowserWindow, Menu, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// More robust development detection
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_DEV === 'true';

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ELECTRON_DEV:', process.env.ELECTRON_DEV);
console.log('app.isPackaged:', app.isPackaged);
console.log('isDev:', isDev);

// Keep a global reference of the window object
let mainWindow;
let isQuitting = false;

// Function to save localStorage to file
async function saveLocalStorageToFile() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log('Window not available for localStorage backup');
    return;
  }

  try {
    // Execute script in renderer process to get localStorage data
    const localStorageData = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        return data;
      })();
    `);

    // Define the backup file path
    const userDataPath = app.getPath('userData');
    const backupFilePath = path.join(userDataPath, 'localStorage-backup.json');

    // Add timestamp to the backup
    const backupData = {
      timestamp: new Date().toISOString(),
      data: localStorageData
    };

    // Write to file
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log('LocalStorage backed up to:', backupFilePath);
    console.log('Backed up data:', Object.keys(localStorageData).length, 'items');

  } catch (error) {
    console.error('Failed to backup localStorage:', error);
  }
}

// Function to restore localStorage from file (optional)
async function restoreLocalStorageFromFile() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const userDataPath = app.getPath('userData');
    const backupFilePath = path.join(userDataPath, 'localStorage-backup.json');

    if (fs.existsSync(backupFilePath)) {
      const backupContent = fs.readFileSync(backupFilePath, 'utf8');
      const backupData = JSON.parse(backupContent);
      
      // Restore localStorage data
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const data = ${JSON.stringify(backupData.data)};
          for (const [key, value] of Object.entries(data)) {
            localStorage.setItem(key, value);
          }
          console.log('LocalStorage restored from backup');
        })();
      `);
      
      console.log('LocalStorage restored from backup file');
    }
  } catch (error) {
    console.error('Failed to restore localStorage:', error);
  }
}

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  console.log(`Display size: ${screenWidth}x${screenHeight}`);
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: true,
      partition: 'persist:main'
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  console.log('Loading URL:', startUrl);
  console.log('Current directory:', __dirname);
  
  if (isDev) {
    console.log('Development mode - loading from Vite dev server');
  } else {
    console.log('Production mode - loading from built files');
    console.log('Looking for dist at:', path.join(__dirname, '../dist/index.html'));
  }
  
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Restore localStorage from backup if available
    setTimeout(() => {
      restoreLocalStorageFromFile();
    }, 1000);
  });

  // Handle window close event - backup localStorage before closing
  mainWindow.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault();
      isQuitting = true;
      
      console.log('Window closing - backing up localStorage...');
      await saveLocalStorageToFile();
      
      // Force close all windows and quit app
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      });
      
      app.quit();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers
ipcMain.handle('backup-localstorage', async () => {
  await saveLocalStorageToFile();
  return 'Backup completed';
});

ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', async () => {
  if (mainWindow && !isQuitting) {
    isQuitting = true;
    await saveLocalStorageToFile();
    app.quit();
  }
});

ipcMain.handle('dialog-open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('dialog-save-file', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content);
    return result.filePath;
  }
  return null;
});

ipcMain.on('show-notification', (event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body
    }).show();
  }
});

// Handle app termination
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;
    
    console.log('App terminating - backing up localStorage...');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      await saveLocalStorageToFile();
    }
    
    // Force quit after backup
    setImmediate(() => {
      app.exit(0);
    });
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  if (!isQuitting) {
    isQuitting = true;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      await saveLocalStorageToFile();
    }
    
    // Force quit the app completely
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, url) => {
    navigationEvent.preventDefault();
    require('electron').shell.openExternal(url);
  });
});

// Handle unexpected crashes with forced exit
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await saveLocalStorageToFile();
    } catch (backupError) {
      console.error('Failed to backup during crash:', backupError);
    }
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await saveLocalStorageToFile();
    } catch (backupError) {
      console.error('Failed to backup during crash:', backupError);
    }
  }
});

// Force exit after a timeout if app doesn't quit naturally
app.on('will-quit', () => {
  console.log('App will quit');
  // Set a timeout to force exit if the app hangs
  setTimeout(() => {
    console.log('Force exiting app');
    process.exit(0);
  }, 5000);
});