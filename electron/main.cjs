const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// More robust development detection
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_DEV === 'true' || 
              !app.isPackaged;

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ELECTRON_DEV:', process.env.ELECTRON_DEV);
console.log('app.isPackaged:', app.isPackaged);
console.log('isDev:', isDev);

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      // Add preload script if you need to communicate between main and renderer
      // preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // Don't show until ready-to-show
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:5173' // Vite default port
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
    
    // Focus on window
    // if (isDev) {
    //   mainWindow.webContents.openDevTools();
    // }
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

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
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

app.whenReady().then(() => {
  createWindow();
});