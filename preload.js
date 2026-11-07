const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("attachments", {
  import: () => ipcRenderer.invoke("attachments:import"),
  download: (file) => ipcRenderer.invoke("attachments:download", file)
});
