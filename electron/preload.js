const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Platform detection
  platform: process.platform,
  
  // Example: App version
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Example: Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // Example: File operations
  openFile: () => ipcRenderer.invoke('dialog-open-file'),
  saveFile: (content) => ipcRenderer.invoke('dialog-save-file', content),
  
  // Example: Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
});