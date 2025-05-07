const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
});

console.log('Preload script loaded');