import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { YEN_BUCKET_COUNT } from "./YenHelper"

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps

  // Chord state for Cmd+P + N (Yen shortcut family).
  // Cmd+P alone still toggles the theme; if a digit 0-5 is pressed within
  // CHORD_WINDOW_MS, that digit is consumed by Yen and theme does NOT toggle.
  private chordActive = false
  private chordTimer: ReturnType<typeof setTimeout> | null = null
  private chordConsumed = false
  private static readonly CHORD_WINDOW_MS = 500

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    let currentOpacity = mainWindow.getOpacity();
    // Allow opacity to go down to 0.02 (almost invisible)
    let newOpacity = Math.max(0.02, Math.min(1.0, currentOpacity + delta));
    console.log(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);

    mainWindow.setOpacity(newOpacity);

    // Save the opacity setting to config without re-initializing the client
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      console.error('Error saving opacity to config:', error);
    }

    // If we're making the window visible, also make sure it's shown and interaction is enabled
    if (newOpacity > 0.02 && !this.deps.isVisible()) {
      this.deps.toggleMainWindow();
    }
  }

  // ---- Chord (Cmd+P + N) plumbing -------------------------------------

  private fireThemeToggle(): void {
    const mainWindow = this.deps.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("toggle-theme")
    }
  }

  private startChord(): void {
    // Clear any in-flight chord first
    if (this.chordTimer) clearTimeout(this.chordTimer)
    if (!this.chordActive) {
      this.registerChordKeys()
    }
    this.chordActive = true
    this.chordConsumed = false
    this.chordTimer = setTimeout(() => this.endChord(), ShortcutsHelper.CHORD_WINDOW_MS)
  }

  private endChord(): void {
    if (!this.chordActive) return
    this.chordActive = false
    if (this.chordTimer) {
      clearTimeout(this.chordTimer)
      this.chordTimer = null
    }
    this.unregisterChordKeys()
    if (!this.chordConsumed) {
      // No digit followed Cmd+P — fall back to plain theme toggle.
      this.fireThemeToggle()
    }
    this.chordConsumed = false
  }

  private registerChordKeys(): void {
    // Temporarily replace Cmd+0 (zoom reset) with the Yen-toggle handler.
    globalShortcut.unregister("CommandOrControl+0")
    globalShortcut.register("CommandOrControl+0", () => this.consumeChord(0))
    for (let i = 1; i <= YEN_BUCKET_COUNT; i++) {
      globalShortcut.register(`CommandOrControl+${i}`, () => this.consumeChord(i))
    }
  }

  private unregisterChordKeys(): void {
    // Restore Cmd+0 to its zoom-reset behavior.
    globalShortcut.unregister("CommandOrControl+0")
    globalShortcut.register("CommandOrControl+0", () => {
      console.log("Command/Ctrl + 0 pressed. Resetting zoom.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) mainWindow.webContents.setZoomLevel(0)
    })
    for (let i = 1; i <= YEN_BUCKET_COUNT; i++) {
      globalShortcut.unregister(`CommandOrControl+${i}`)
    }
  }

  private consumeChord(digit: number): void {
    this.chordConsumed = true

    const cfg = configHelper.loadConfig()
    if (!cfg.yenModeEnabled) {
      // Yen is disabled — close out the chord and surface a hint.
      this.chordActive = false
      if (this.chordTimer) {
        clearTimeout(this.chordTimer)
        this.chordTimer = null
      }
      this.unregisterChordKeys()
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("yen-disabled-hint")
      }
      return
    }

    if (digit === 0) {
      // Cmd+P → 0 toggles the panel, AND re-extends the chord window so the
      // user can press 1..5 next to jump into a specific bucket
      // (i.e. Cmd+P → 0 → N is a 3-key chord for "open bucket N").
      this.deps.yenHelper?.togglePanel()
      if (this.chordTimer) {
        clearTimeout(this.chordTimer)
      }
      this.chordTimer = setTimeout(() => this.endChord(), ShortcutsHelper.CHORD_WINDOW_MS)
      return
    }

    // 1..5 → close out the chord and open the bucket.
    this.chordActive = false
    if (this.chordTimer) {
      clearTimeout(this.chordTimer)
      this.chordTimer = null
    }
    this.unregisterChordKeys()
    this.deps.yenHelper?.openBucket(digit)
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow()
      if (!mainWindow) return
      console.log("Taking screenshot...")
      try {
        const screenshotPath = await this.deps.takeScreenshot()
        const preview = await this.deps.getImagePreview(screenshotPath)
        // If Yen capture mode is on, route the new screenshot to the Yen
        // bucket queue and inform the renderer (Yen UI updates via yen-state).
        if (this.deps.yenHelper?.isCapturing()) {
          this.deps.yenHelper.addCapture(screenshotPath)
        }
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
      } catch (error) {
        console.error("Error capturing screenshot:", error)
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      // In Yen capture mode, Cmd+Enter summarizes the captured shots into a bucket
      // instead of running the regular extraction/solution pipeline.
      if (this.deps.yenHelper?.isCapturing()) {
        const mainWindow = this.deps.getMainWindow()
        const result = await this.deps.yenHelper.processCaptures()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("yen-process-result", result)
        }
        return
      }
      await this.deps.processingHelper?.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+Shift+X", () => {
      console.log(
        "Command/Ctrl + Shift + X pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests()

      // Clear both screenshot queues
      this.deps.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.deps.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    })

    // Cmd+Shift+R: reset (alias of Cmd+Shift+X)
    globalShortcut.register("CommandOrControl+Shift+R", () => {
      console.log("Command/Ctrl + Shift + R pressed. Resetting...")
      this.deps.processingHelper?.cancelOngoingRequests()
      this.deps.clearQueues()
      this.deps.setView("queue")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    })

    // Window movement
    globalShortcut.register("CommandOrControl+L", () => {
      console.log("Command/Ctrl + L pressed. Moving window left.")
      this.deps.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log("Command/Ctrl + R pressed. Moving window right.")
      this.deps.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+D", () => {
      console.log("Command + D pressed. Moving window down.")
      this.deps.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+U", () => {
      console.log("Command + U pressed. Moving window Up.")
      this.deps.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+B", () => {
      console.log("Command/Ctrl + B pressed. Toggling window visibility.")
      try {
        this.deps.toggleMainWindow()
      } catch (error) {
        console.error("Error toggling window:", error)
      }
    })

    // Cmd+P: theme toggle, OR chord-prefix for Yen (Cmd+P then 0-5).
    // The theme toggle is delayed by CHORD_WINDOW_MS so a digit can intercept.
    globalShortcut.register("CommandOrControl+P", () => {
      console.log("Command/Ctrl + P pressed. Starting chord window…")
      this.startChord()
    })

    // Cmd+,: open Settings dialog (replaces the gear icon from removed toolbar)
    globalShortcut.register("CommandOrControl+,", () => {
      console.log("Command/Ctrl + , pressed. Opening settings.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("show-settings-dialog")
      }
    })

    // Cmd+Shift+L: toggle Listen & Answer mode (captures interviewer audio →
    // transcribes → bullet answer). The renderer reacts to the broadcast
    // listen-state to start/stop system-audio capture.
    globalShortcut.register("CommandOrControl+Shift+L", () => {
      console.log("Command/Ctrl + Shift + L pressed. Toggling Listen mode.")
      const on = this.deps.listenHelper?.toggleListening()
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("listen-toggle-hotkey")
        if (on && !this.deps.isVisible()) this.deps.toggleMainWindow()
      }
    })

    globalShortcut.register("CommandOrControl+Q", () => {
      console.log("Command/Ctrl + Q pressed. Quitting application.")
      app.quit()
    })

    // Adjust opacity in fine 0.05 steps (20 levels between fully hidden
    // and fully visible — more granular than the old 0.1 step).
    globalShortcut.register("CommandOrControl+[", () => {
      console.log("Command/Ctrl + [ pressed. Decreasing opacity by 0.05.")
      this.adjustOpacity(-0.05)
    })

    globalShortcut.register("CommandOrControl+]", () => {
      console.log("Command/Ctrl + ] pressed. Increasing opacity by 0.05.")
      this.adjustOpacity(0.05)
    })

    // Zoom controls
    globalShortcut.register("CommandOrControl+-", () => {
      console.log("Command/Ctrl + - pressed. Zooming out.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
      }
    })

    globalShortcut.register("CommandOrControl+0", () => {
      console.log("Command/Ctrl + 0 pressed. Resetting zoom.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
      }
    })

    globalShortcut.register("CommandOrControl+=", () => {
      console.log("Command/Ctrl + = pressed. Zooming in.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
      }
    })

    // Delete last screenshot shortcut
    globalShortcut.register("CommandOrControl+Backspace", () => {
      console.log("Command/Ctrl + Backspace pressed. Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (!mainWindow) return
      // In Yen capture mode, drop the last Yen capture instead of the
      // regular screenshot queue's last item.
      if (this.deps.yenHelper?.isCapturing()) {
        this.deps.yenHelper.removeLastCapture()
        return
      }
      mainWindow.webContents.send("delete-last-screenshot")
    })

    // Toggle Click-Through Mode (Ghost Mode)
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      console.log("Command/Ctrl + Shift + I pressed. Toggling click-through mode.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        // We need to track the state, but for now we can toggle based on a property we attach or just toggle
        // Since we don't have easy state access here, we'll assume if it's ignoring mouse events, we want to disable it
        // But Electron doesn't provide a getter for ignoreMouseEvents.
        // We'll use a simple toggle mechanism by sending an event to the main process or managing state in main.ts
        // For simplicity, let's just toggle it and notify the user via console/toast if possible

        // Note: We can't easily check the current state of ignoreMouseEvents without tracking it.
        // Let's assume the user knows what they are doing.
        // Actually, let's use a variable in the class if possible, or just toggle.
        // Since we can't check, we'll implement a "Ghost Mode" toggle in main.ts state if we could,
        // but here we are in ShortcutsHelper.

        // Let's try to use the window's user data or just toggle blindly?
        // Better approach: Let's make it "Enable" with one shortcut and "Disable" with another if we can't track.
        // OR, we can just use a static variable here.

        // @ts-ignore
        const isIgnoring = mainWindow._isIgnoringMouseEvents || false;
        // @ts-ignore
        mainWindow._isIgnoringMouseEvents = !isIgnoring;

        // @ts-ignore
        mainWindow.setIgnoreMouseEvents(!isIgnoring, { forward: true });
        console.log(`Click-through mode set to: ${!isIgnoring}`);

        // Visual feedback (optional, maybe flash opacity)
        const currentOpacity = mainWindow.getOpacity();
        mainWindow.setOpacity(currentOpacity * 0.5);
        setTimeout(() => mainWindow.setOpacity(currentOpacity), 200);
      }
    })

    // Hold-to-repeat for window movement (Cmd+L/R/U/D).
    //
    // globalShortcut only fires once per press on macOS — it does not
    // expose OS-level auto-repeat. So holding Cmd+L moves the window
    // exactly one step; the user has to mash the key to slide it across.
    //
    // Fix: subscribe to the renderer's before-input-event. macOS sends
    // keydown events with input.isAutoRepeat=true while the key is held;
    // we react to those by re-firing the move. Initial press is still
    // handled by globalShortcut (works without window focus); auto-repeat
    // works whenever the window is keyboard-focused (i.e. while the user
    // is actively interacting with Yen).
    this.attachHoldToRepeat()
    // Re-attach if the window is recreated.
    app.on("browser-window-created", () => this.attachHoldToRepeat())

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }

  private holdToRepeatAttached = new WeakSet<Electron.WebContents>()

  private attachHoldToRepeat(): void {
    const win = this.deps.getMainWindow()
    if (!win || win.isDestroyed()) return
    const wc = win.webContents
    if (this.holdToRepeatAttached.has(wc)) return
    this.holdToRepeatAttached.add(wc)

    wc.on("before-input-event", (_event, input) => {
      if (input.type !== "keyDown") return
      if (!input.isAutoRepeat) return
      if (!input.meta && !input.control) return
      // Modifiers other than Cmd/Ctrl (e.g. Shift+Cmd+L) shouldn't repeat
      // window movement, so ignore those combos.
      if (input.shift || input.alt) return
      switch (input.key.toLowerCase()) {
        case "l":
          this.deps.moveWindowLeft()
          break
        case "r":
          this.deps.moveWindowRight()
          break
        case "u":
          this.deps.moveWindowUp()
          break
        case "d":
          this.deps.moveWindowDown()
          break
      }
    })
  }
}
