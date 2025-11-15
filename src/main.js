const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');

// Crash reporter hatasını gizle
app.disableHardwareAcceleration();
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Data klasörü yolu
const isDev = !app.isPackaged;
const dataPath = isDev 
  ? path.join(__dirname, '../data')
  : path.join(process.resourcesPath, 'data');

// Development modunda direkt data klasörünü kullan
if (isDev) {
  global.dataPath = dataPath;
} else {
  // Production'da userData'ya kopyala
  const userDataPath = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
    if (fs.existsSync(dataPath)) {
      fs.readdirSync(dataPath).forEach(file => {
        fs.copyFileSync(
          path.join(dataPath, file),
          path.join(userDataPath, file)
        );
      });
    }
  }
  global.dataPath = userDataPath;
}

let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // İlk başta gizli, hazır olunca göster
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
    // icon yolunu kaldırdık (dosya yoksa crash oluyor)
  });

  // Pencere hazır olunca göster
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadFile('src/renderer/index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // Pencere kapatıldığında null yap
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverApp = express();
  serverApp.use(express.json({ limit: '50mb' }));
  serverApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  serverApp.use(express.static(path.join(__dirname, 'renderer')));
  
  // API routes
  require('./api/routes')(serverApp);
  
  server = serverApp.listen(3000, () => {
    console.log('Backend server running on port 3000');
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('select-csv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  return result.filePaths[0];
});