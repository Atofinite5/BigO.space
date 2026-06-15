// ipcHandlers.ts

import { ipcMain, shell, dialog, clipboard } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { authHelper } from "./AuthHelper"
import {
  getStatus as getMemoryStatus,
  initMemory,
  isEnabled as isMemoryEnabled,
  setupDatabase as setupMemoryDatabase,
  likeMemory
} from "./MemoryHelper"
import { Pool } from "pg"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  })

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })

  // ===== Memory IPC =====
  ipcMain.handle("memory-status", () => {
    return { ...getMemoryStatus(), enabled: isMemoryEnabled() };
  })

  ipcMain.handle("memory-test-connection", async (_event, connectionString: string) => {
    const url = (connectionString && connectionString.trim()) ||
      configHelper.loadConfig().memoryConnectionString;
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 5_000,
      max: 1
    });
    try {
      const client = await pool.connect();
      try {
        const r = await client.query("SELECT 1 AS ok");
        let hasVector = false;
        try {
          const v = await client.query(
            "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
          );
          hasVector = v.rowCount! > 0;
        } catch { /* ignore */ }
        return { ok: r.rowCount === 1, hasVector };
      } finally {
        client.release();
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    } finally {
      await pool.end().catch(() => {});
    }
  })

  ipcMain.handle("memory-reinit", async () => {
    const cfg = configHelper.loadConfig();
    await initMemory({
      enabled: !!cfg.memoryEnabled,
      connectionString: cfg.memoryConnectionString
    });
    return { ...getMemoryStatus(), enabled: isMemoryEnabled() };
  })

  // Dynamic click-through: renderer reports whether the mouse is over a UI
  // element. When false, transparent areas of the window pass clicks through
  // to whatever is underneath (so the tool doesn't pull the user out of
  // fullscreen apps when clicking on empty space).
  //
  // When Settings is open we set inputLockActive=true and ignore any
  // renderer requests to re-enable click-through. Otherwise the App.tsx
  // mousemove listener would flip click-through ON the moment the cursor
  // strays from the input → the API-key field would silently lose focus
  // and the next keystroke would bonk.
  let inputLockActive = false
  ipcMain.on("set-ignore-mouse-events", (event, ignore: boolean) => {
    if (inputLockActive && ignore) return  // hard-ignore while Settings open
    const win = event.sender ? require("electron").BrowserWindow.fromWebContents(event.sender) : null;
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(!!ignore, { forward: true });
    }
  })

  // Settings dialog focus gate: renderer calls this when the Settings dialog
  // opens/closes so text inputs work without permanently making the window
  // focusable (which would let clicks steal focus from fullscreen apps).
  ipcMain.on("set-window-focusable", (event, focusable: boolean) => {
    const electron = require("electron");
    const win = event.sender ? electron.BrowserWindow.fromWebContents(event.sender) : null;
    if (!win || win.isDestroyed()) return;

    win.setFocusable(focusable);

    if (focusable) {
      // ENGAGE input lock — App.tsx's mousemove listener will keep trying to
      // re-enable click-through; the set-ignore-mouse-events handler above
      // hard-ignores those requests while inputLockActive is true.
      inputLockActive = true;
      win.setIgnoreMouseEvents(false, { forward: true });

      // Step the always-on-top level DOWN from "screen-saver" to "floating".
      // macOS refuses to make a window at the screen-saver level the key
      // (focused) window, so Cmd+V / typing have nowhere to land → system
      // bonk. "floating" still keeps it above the meeting/IDE but lets
      // it become the key window so inputs accept keys.
      win.setAlwaysOnTop(true, "floating", 1);

      // Make BigO the active app, focus the window, focus the webContents
      // so the React input element actually receives keystrokes.
      try { electron.app.focus({ steal: true }); } catch { /* noop */ }
      win.show();
      win.focus();
      win.webContents.focus();
    } else {
      // Settings closed → release the lock + restore stealth on-top level.
      inputLockActive = false;
      win.setAlwaysOnTop(true, "screen-saver", 1);
    }
  })

  ipcMain.handle("memory-like", async (_event, id: number, liked: boolean) => {
    await likeMemory(id, liked);
    return { ok: true };
  })

  ipcMain.handle("memory-setup-database", async (_event, connectionString?: string) => {
    const cfg = configHelper.loadConfig();
    const url = (connectionString && connectionString.trim()) || cfg.memoryConnectionString;
    const result = await setupMemoryDatabase(url);
    if (result.ok) {
      // Reinit so the running app starts using the freshly-set-up DB
      await initMemory({ enabled: true, connectionString: url });
    }
    return { ...result, status: { ...getMemoryStatus(), enabled: isMemoryEnabled() } };
  })

  // ===== Yen (memory bucket) IPC =====
  ipcMain.handle("yen-get-state", () => {
    return deps.yenHelper?.getState() || null;
  })

  ipcMain.handle("yen-toggle-panel", () => {
    deps.yenHelper?.togglePanel();
    return deps.yenHelper?.getState() || null;
  })

  ipcMain.handle("yen-close-panel", () => {
    deps.yenHelper?.closePanel();
    return deps.yenHelper?.getState() || null;
  })

  ipcMain.handle("yen-open-bucket", (_event, bucketIndex: number) => {
    deps.yenHelper?.openBucket(bucketIndex);
    return deps.yenHelper?.getState() || null;
  })

  ipcMain.handle("yen-process-captures", async () => {
    if (!deps.yenHelper) return { ok: false, error: "Yen helper unavailable" };
    return deps.yenHelper.processCaptures();
  })

  ipcMain.handle("yen-delete-bucket", (_event, bucketIndex: number) => {
    const ok = deps.yenHelper?.deleteBucket(bucketIndex) ?? false;
    return { ok };
  })

  ipcMain.handle("yen-clear-all", () => {
    deps.yenHelper?.clearAll();
    return { ok: true };
  })

  ipcMain.handle("yen-copy-text", (_event, text: string) => {
    try {
      clipboard.writeText(text ?? "");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  })

  ipcMain.handle("yen-clear-captures", () => {
    deps.yenHelper?.clearCaptureQueue();
    return { ok: true };
  })
  
  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return { 
        valid: false, 
        error: "Invalid API key format. OpenAI API keys start with 'sk-'" 
      };
    }
    
    // Then test the API key with OpenAI
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      console.error("Error decrementing credits:", error)
    }
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }
    
    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })
  
  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  })

  // Settings portal handler
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }
      
      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })
  
  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue" 
        ? deps.getScreenshotQueue() 
        : deps.getExtraScreenshotQueue()
      
      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" }
      }
      
      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1]
      
      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot)
      
      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }
      
      return result
    } catch (error) {
      console.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })

  // ── Listen & Answer handlers ──────────────────────────────────────────────

  ipcMain.handle("listen-get-state", () => {
    return deps.listenHelper?.getState() ?? null
  })

  ipcMain.handle("listen-set", (_event, on: boolean) => {
    deps.listenHelper?.setListening(!!on)
    return deps.listenHelper?.getState() ?? null
  })

  ipcMain.handle("listen-toggle", () => {
    deps.listenHelper?.toggleListening()
    return deps.listenHelper?.getState() ?? null
  })

  ipcMain.handle("listen-clear", () => {
    deps.listenHelper?.clear()
    return { ok: true }
  })

  ipcMain.handle(
    "listen-process-audio",
    async (_event, payload: { audioBase64: string; mimeType: string }) => {
      if (!deps.listenHelper) return { ok: false, error: "Listen not available" }
      const result = await deps.listenHelper.processAudio(payload.audioBase64, payload.mimeType)
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("listen-result", result)
      }
      return result
    }
  )

  // ── BigO Auth / License handlers ──────────────────────────────────────────

  ipcMain.handle("auth-get-state", async () => {
    return authHelper.getState()
  })

  ipcMain.handle("auth-validate-license", async (_event, key: string) => {
    const state = await authHelper.setLicenseKey(key)
    // Broadcast the new state so all renderer windows stay in sync
    const mainWindow = deps.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth-state-changed", state)
    }
    if (state.status === 'active') {
      return { valid: true }
    }
    return {
      valid: false,
      error: state.status === 'invalid_key'
        ? "Invalid or expired license key."
        : "Could not verify key. Please check your connection.",
    }
  })

  ipcMain.handle("auth-remove-license", async () => {
    await authHelper.removeLicenseKey()
    const state = authHelper.getState()
    const mainWindow = deps.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth-state-changed", state)
    }
    return { ok: true }
  })

  // Forward auth state changes to the renderer whenever they happen
  authHelper.on("state-changed", (state) => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth-state-changed", state)
    }
  })
}
