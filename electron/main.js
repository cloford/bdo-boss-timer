const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, powerMonitor } = require("electron");
const path = require("path");

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    title: "ボス出現タイマー",
    icon: path.join(__dirname, "..", "assets", "app-icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "app-icon.ico"));
  tray = new Tray(icon);
  tray.setToolTip("ボス出現タイマー");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "表示",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "終了",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]));

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  powerMonitor.on("resume", () => {
    if (Notification.isSupported()) {
      new Notification({
        title: "ボス出現タイマー",
        body: "PCが復帰しました。逃したボスがないか確認してください。",
      }).show();
    }
    mainWindow.webContents.send("system-resume");
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
