import { app, BrowserWindow } from 'electron';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

// Define __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  // Clear cache to ensure fresh content
  win.webContents.session.clearCache().then(() => {
    console.log('Cache cleared');
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : url.format({
        pathname: path.join(__dirname, 'build', 'index.html'),
        protocol: 'file:',
        slashes: true,
      });

  console.log('Loading URL:', startUrl);
  win.loadURL(startUrl).catch((err) => {
    console.error('Failed to load URL:', err);
    win.loadURL('data:text/html,<h1>Failed to load app</h1><p>Check the console for details.</p>');
  });

  win.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
    // Removed the line that opens DevTools automatically
    // win.webContents.openDevTools();
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', { errorCode, errorDescription });
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});