import { contextBridge, ipcRenderer } from "electron";

/**
 * Renderer-facing bridge for the desktop shell. The web UI detects the
 * desktop runtime via `window.tongflowDesktop` (absent in plain browsers) and
 * uses it to render the update button. Keep this surface minimal — the web
 * app must keep working without it.
 */
contextBridge.exposeInMainWorld("tongflowDesktop", {
    getUpdateState: () => ipcRenderer.invoke("tongflow:update-get-state"),
    checkForUpdates: () => ipcRenderer.invoke("tongflow:update-check"),
    installUpdate: () => ipcRenderer.invoke("tongflow:update-install"),
    onUpdateState: (callback: (state: unknown) => void) => {
        const listener = (_event: unknown, state: unknown) => callback(state);
        ipcRenderer.on("tongflow:update-state", listener);
        return () => {
            ipcRenderer.removeListener("tongflow:update-state", listener);
        };
    },
});
