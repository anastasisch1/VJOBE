const { app, BrowserWindow, nativeImage, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");

// Keep community builds separate from existing personal installations.
app.setName("VJOBE Community");
if (!app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath("userData", path.join(app.getPath("appData"), "VJOBE Community"));
}

ipcMain.handle("attachments:import", async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ["openFile", "multiSelections"]
  });
  if (result.canceled) return [];
  const directory = path.join(app.getPath("userData"), "attachments");
  await fs.mkdir(directory, { recursive: true });
  return Promise.all(result.filePaths.map(async (source) => {
    const destination = path.join(directory, randomUUID() + path.extname(source));
    await fs.copyFile(source, destination);
    return { name: path.basename(source), path: destination, size: (await fs.stat(destination)).size };
  }));
});

ipcMain.handle("attachments:download", async (event, file) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    if (!file || typeof file.path !== "string" || !file.path) throw new Error("Missing file");
    await fs.access(file.path);
    const result = await dialog.showSaveDialog(win, { defaultPath: path.basename(file.name || file.path) });
    if (result.canceled) return;
    if (path.resolve(result.filePath) !== path.resolve(file.path)) await fs.copyFile(file.path, result.filePath);
  } catch {
    await dialog.showMessageBox(win, { type: "info", message: "File unavailable", detail: "Please attach this file again. The original file is no longer available." });
  }
});

function createWindow() {
  const appIconPath = path.join(__dirname, "app_icon.svg");
  const win = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 1080,
    minHeight: 720,
    title: "VJOBE",
    backgroundColor: "#fee5a2",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const icon = nativeImage.createFromPath(appIconPath);
    if (!icon.isEmpty()) {
      win.setIcon(icon);
      if (process.platform === "darwin" && app.dock) {
        app.dock.setIcon(icon);
      }
    }
  } catch (error) {
    console.warn("Could not load app icon:", error);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch((error) => console.warn("Could not open external link:", error));
    }
    return { action: "deny" };
  });

  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
