const electron = require('electron');
const path = require('path');
const url = require('url');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

const args = process.argv.slice(1);
const watch = args.some((val) => val === '--watch');
if (watch) {
    require('electron-reload')(__dirname, {});
}

let appDataPath = null;
if (process.env.FF_PASSWORD_EXPORTER_APPDATA_DIR != null) {
    appDataPath = process.env.FF_PASSWORD_EXPORTER_APPDATA_DIR;
} else if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_DIR != null) {
    appDataPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'ff-password-exporter-appdata');
}

if (appDataPath != null) {
    app.setPath('userData', appDataPath);
}
app.setPath('logs', path.join(app.getPath('userData'), 'logs'));

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({ width: 400, height: 550 });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true,
    }));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
