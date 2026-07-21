// Flasqo Desktop — Electron shell.
// Spawns the Python FastAPI backend as a local sidecar (FLASQO_LOCAL=1, SQLite storage
// in the OS user-data dir), waits for it to become healthy, then loads the UI it serves.

const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

const IS_DEV = process.env.FLASQO_DEV === '1';

let backendProcess = null;
let mainWindow = null;
let backendPort = null;

function findFreePort(preferred = 8765) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      // preferred port taken — let the OS pick one
      const s2 = net.createServer();
      s2.listen(0, '127.0.0.1', () => {
        const port = s2.address().port;
        s2.close(() => resolve(port));
      });
    });
    server.listen(preferred, '127.0.0.1', () => {
      server.close(() => resolve(preferred));
    });
  });
}

function backendCommand() {
  if (IS_DEV) {
    // Dev: run backend.py from the repo with the project venv
    const backendDir = path.join(__dirname, '..', 'backend');
    const venvPython = process.platform === 'win32'
      ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
      : path.join(backendDir, '.venv', 'bin', 'python');
    const python = fs.existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3');
    return { cmd: python, args: [path.join(backendDir, 'backend.py')], cwd: backendDir };
  }
  // Packaged: run the PyInstaller-built sidecar from resources
  const exe = process.platform === 'win32' ? 'flasqo-backend.exe' : 'flasqo-backend';
  const backendDir = path.join(process.resourcesPath, 'backend');
  return { cmd: path.join(backendDir, exe), args: [], cwd: backendDir };
}

function startBackend(port) {
  const { cmd, args, cwd } = backendCommand();
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const logPath = path.join(app.getPath('userData'), 'backend.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  backendProcess = spawn(cmd, args, {
    cwd,
    env: {
      ...process.env,
      FLASQO_LOCAL: '1',
      FLASQO_DATA_DIR: dataDir,
      PORT: String(port),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);

  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (code !== 0 && code !== null && !app.isQuittingFlag) {
      dialog.showErrorBox(
        'Flasqo backend stopped',
        `The local engine exited unexpectedly (code ${code}).\nSee log: ${logPath}`
      );
    }
  });
}

function waitForBackend(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/auth/local', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error('Backend did not start in time'));
      setTimeout(poll, 500);
    };
    poll();
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Flasqo',
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // External links open in the system browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const startPath = process.env.FLASQO_START_PATH || '/';
  mainWindow.loadURL(`http://127.0.0.1:${port}${startPath}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function stopBackend() {
  if (backendProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (_) { /* already gone */ }
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    backendPort = await findFreePort(8765);
    startBackend(backendPort);
    await waitForBackend(backendPort);
    createWindow(backendPort);
  } catch (err) {
    dialog.showErrorBox('Flasqo failed to start', String(err && err.message ? err.message : err));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && backendPort) createWindow(backendPort);
  });
});

app.on('before-quit', () => { app.isQuittingFlag = true; stopBackend(); });
app.on('window-all-closed', () => {
  // The backend is tied to the window lifecycle on every platform
  app.quit();
});
