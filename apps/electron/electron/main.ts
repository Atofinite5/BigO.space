import { app, BrowserWindow, Menu, screen, shell, desktopCapturer, type BrowserWindowConstructorOptions } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { ProcessingHelper } from "./ProcessingHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { initAutoUpdater } from "./autoUpdater"
import { configHelper } from "./ConfigHelper"
import { YenHelper } from "./YenHelper"
import { ListenHelper } from "./ListenHelper"
import { authHelper } from "./AuthHelper"
import * as dotenv from "dotenv"

interface ProblemInfo {
  id?: string
  title?: string
  description?: string
  language?: string
  metadata?: Record<string, unknown>
  // Dynamic fields produced by the LLM extraction step / consumed by solution generation
  question?: string
  problem_statement?: string
  topic?: string
  type?: string
  options?: string[]
  [key: string]: any
}

// Constants
const isDev = process.env.NODE_ENV === "development"

// Configure writable cache and user data paths under ~/Library/Application Support
try {
  const appName = 'BigO';
  const appDataDir = app.getPath('appData');
  const userDataDir = path.join(appDataDir, appName);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  app.setPath('userData', userDataDir);
  const cacheDir = path.join(userDataDir, 'Cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
} catch (err) {
  console.error('Failed to configure userData/cache paths:', err);
}

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as ProcessingHelper | null,
  yenHelper: null as YenHelper | null,
  listenHelper: null as ListenHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as ProblemInfo | null,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => ProblemInfo | null
  setProblemInfo: (info: ProblemInfo) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  yenHelper: YenHelper | null
  listenHelper: ListenHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  yenHelper: YenHelper | null
  listenHelper: ListenHelper | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: () => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.yenHelper = new YenHelper(getMainWindow)
  state.listenHelper = new ListenHelper(getMainWindow)
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    yenHelper: state.yenHelper,
    listenHelper: state.listenHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step)
  } as IShortcutsHelperDeps)
}

// Auth callback handler

// Register the interview-coder protocol (macOS)
app.setAsDefaultProtocolClient("bigo")

// Auth callback removed as we no longer use Supabase authentication

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 24
  state.currentY = 50

  const windowSettings: BrowserWindowConstructorOptions = {
    width: 800,
    height: 600,
    minWidth: 750,
    minHeight: 550,
    x: state.currentX,
    y: 50,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    opacity: 1.0,  // Start with full opacity
    backgroundColor: "#00000000",
    focusable: false,
    skipTaskbar: true,
    // NOTE: we deliberately do NOT use type: "panel" on macOS. NSPanel is
    // non-activating by design — even setFocusable(true) cannot make it the
    // key window, so Cmd+V / typing have no destination (system bonk).
    // Stealth (invisible to capture, hidden from Mission Control, sits above
    // meetings) is provided by setContentProtection + setHiddenInMissionControl
    // + setAlwaysOnTop, NOT by the panel type.
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // ── Listen feature: auto-grant system-audio capture ──────────────────────
  // When the renderer calls getDisplayMedia({ audio: true }) for Listen mode,
  // grant it silently (no picker) and request macOS system-audio loopback so
  // BigO hears the interviewer through the meeting app. Requires the Screen
  // Recording permission (macOS 13+).
  try {
    state.mainWindow.webContents.session.setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
          // @ts-ignore — 'loopback' captures macOS system audio (Electron runtime supports it)
          callback({ video: sources[0], audio: "loopback" })
        }).catch(() => callback({}))
      }
    )
  } catch (e) {
    console.warn("[Listen] setDisplayMediaRequestHandler unavailable:", e)
  }

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading")
  })
  
  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      console.error("Window failed to load:", errorCode, errorDescription)
      if (isDev) {
        // In development, retry loading after a short delay
        console.log("Retrying to load development server...")
        setTimeout(() => {
          if (state.mainWindow && !state.mainWindow.isDestroyed()) {
            state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
              console.error("Failed to load dev server on retry:", error)
            })
          }
        }, 1000)
      }
    }
  )

  if (isDev) {
    // In development, load from the dev server
    console.log("Loading from development server: http://localhost:54321")
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      console.error("Failed to load dev server, falling back to local file:", error)
      // Fallback to local file if dev server is not available
      const indexPath = path.join(__dirname, "../dist/index.html")
      console.log("Falling back to:", indexPath)
      if (fs.existsSync(indexPath)) {
        state.mainWindow?.loadFile(indexPath).catch((fallbackError) => {
          console.error("Failed to load fallback index.html:", fallbackError)
        })
      } else {
        console.error("Could not find index.html in dist folder")
      }
    })
  } else {
    // In production, load from the built files
    const indexPath = path.join(__dirname, "../dist/index.html")
    console.log("Loading production build:", indexPath)
    
    if (fs.existsSync(indexPath)) {
      state.mainWindow.loadFile(indexPath).catch((error) => {
        console.error("Failed to load production index.html:", error)
      })
    } else {
      console.error("Could not find index.html in dist folder at:", indexPath)
      // Try alternative path
      const altPath = path.join(__dirname, "../../dist/index.html")
      if (fs.existsSync(altPath)) {
        state.mainWindow.loadFile(altPath).catch((error) => {
          console.error("Failed to load alternative index.html:", error)
        })
      }
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomLevel(0) // Use setZoomLevel instead of deprecated setZoomFactor
  if (isDev) {
    state.mainWindow.webContents.openDevTools()
  }
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Attempting to open URL:", url)
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname;
      const allowedHosts = ["google.com", "supabase.co"];
      if (allowedHosts.includes(hostname) || hostname.endsWith(".google.com") || hostname.endsWith(".supabase.co")) {
        shell.openExternal(url).catch((error) => {
          console.error("Failed to open external URL:", url, error)
        })
        return { action: "deny" }; // Do not open this URL in a new Electron window
      }
    } catch (error) {
      console.error("Invalid URL in setWindowOpenHandler:", url, error);
      return { action: "deny" }; // Deny access as URL string is malformed or invalid
    }
    return { action: "allow" };
  })

  // Enhanced screen capture resistance + stealth window placement.
  if (process.env.IC_DISABLE_CONTENT_PROTECTION !== "1") state.mainWindow.setContentProtection(true)
  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })

  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

  // Hide from Mission Control / window switcher / shadow.
  state.mainWindow.setHiddenInMissionControl(true)
  state.mainWindow.setWindowButtonVisibility(false)
  state.mainWindow.setBackgroundColor("#00000000")
  state.mainWindow.setSkipTaskbar(true)
  state.mainWindow.setHasShadow(false)

  // Prevent the window from being captured by screen recording
  state.mainWindow.webContents.setBackgroundThrottling(false)
  state.mainWindow.webContents.setFrameRate(60)

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true
  
  // Set opacity based on user preferences or hide initially
  // Ensure the window is visible for the first launch or if opacity > 0.1
  const savedOpacity = configHelper.getOpacity();
  console.log(`Initial opacity from config: ${savedOpacity}`);
  
  // Always make sure window is shown first (macOS uses showInactive
  // so we don't steal focus from the underlying app).
  state.mainWindow.showInactive();
  
  if (savedOpacity <= 0.1) {
    console.log('Initial opacity too low, setting to 0 and hiding window');
    state.mainWindow.setOpacity(0);
    state.mainWindow.hide();
    state.isWindowVisible = false;
  } else {
    console.log(`Setting initial opacity to ${savedOpacity}`);
    state.mainWindow.setOpacity(savedOpacity);
    state.isWindowVisible = true;
  }
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Window visibility functions
function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    try {
      const bounds = state.mainWindow.getBounds();
      state.windowPosition = { x: bounds.x, y: bounds.y };
      state.windowSize = { width: bounds.width, height: bounds.height };
      state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
      state.mainWindow.hide();
      state.mainWindow.setOpacity(0);
      state.isWindowVisible = false;
      console.log('Window hidden');
    } catch (error) {
      console.error('Error hiding window:', error);
    }
  }
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    try {
      if (state.windowPosition && state.windowSize) {
        state.mainWindow.setBounds({
          ...state.windowPosition,
          ...state.windowSize
        });
      }
      // Start with click-through enabled — the renderer will dynamically
      // toggle ignore=false when the mouse hovers a real UI element.
      state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
      state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);

      // setVisibleOnAllWorkspaces and setContentProtection are set ONCE at
      // window creation. Re-applying on every show used to trigger Spaces
      // transitions that exited the underlying app's fullscreen.
      
      // Restore the user's saved opacity instead of forcing it to 1.
      // (Bug fix: Cmd+B used to reset opacity changes from Cmd+[ / Cmd+].)
      let restoredOpacity = 1;
      try {
        const cfg = configHelper.loadConfig();
        if (typeof cfg.opacity === "number" && cfg.opacity > 0) {
          restoredOpacity = Math.min(1, Math.max(0.05, cfg.opacity));
        }
      } catch (e) {
        console.warn("Could not read saved opacity, using 1.0:", e);
      }
      state.mainWindow.setOpacity(restoredOpacity);

      // showInactive() displays the window WITHOUT stealing focus, so
      // fullscreen apps stay fullscreen.
      state.mainWindow.showInactive();

      state.isWindowVisible = true;
      console.log(`Window shown (inactive), opacity restored to ${restoredOpacity}`);

      // Tell the renderer the window just came back. Without this, after
      // Cmd+B → Cmd+B the renderer's cached "lastIgnore" state stays in
      // sync with what it thinks main is, but main was just reset to
      // ignore=true above. Result: a Settings dialog (or any UI) becomes
      // visible-but-unclickable until Cmd+Q. The renderer reacts by
      // invalidating its cache and forcing a re-evaluation.
      try {
        state.mainWindow.webContents.send("window-reshown");
      } catch (e) {
        console.warn("[showMainWindow] could not notify renderer:", e);
      }
    } catch (error) {
      console.error('Error showing window:', error);
    }
  }
}

function toggleMainWindow(): void {
  console.log(`[TOGGLE] Current window state: ${state.isWindowVisible ? 'visible' : 'hidden'}`);
  console.log(`[TOGGLE] Main window exists: ${!!state.mainWindow}`);
  console.log(`[TOGGLE] Main window destroyed: ${state.mainWindow?.isDestroyed()}`);
  
  if (state.isWindowVisible) {
    console.log('[TOGGLE] Attempting to hide window...');
    hideMainWindow();
  } else {
    console.log('[TOGGLE] Attempting to show window...');
    showMainWindow();
  }
}

// Window movement functions
let moveAnimHandle: NodeJS.Timeout | null = null
function tweenWindowTo(targetX: number, targetY: number): void {
  if (!state.mainWindow) return
  if (moveAnimHandle) {
    clearInterval(moveAnimHandle)
    moveAnimHandle = null
  }
  const startX = state.currentX
  const startY = state.currentY
  const dx = targetX - startX
  const dy = targetY - startY
  if (dx === 0 && dy === 0) return
  const durationMs = 110
  const frameMs = 16
  const steps = Math.max(1, Math.round(durationMs / frameMs))
  let frame = 0
  moveAnimHandle = setInterval(() => {
    frame++
    const t = Math.min(1, frame / steps)
    const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
    const nx = startX + dx * eased
    const ny = startY + dy * eased
    state.currentX = nx
    state.currentY = ny
    state.mainWindow?.setPosition(Math.round(nx), Math.round(ny))
    if (t >= 1) {
      if (moveAnimHandle) clearInterval(moveAnimHandle)
      moveAnimHandle = null
    }
  }, frameMs)
}

function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  const target = updateFn(state.currentX)
  tweenWindowTo(target, state.currentY)
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const newY = updateFn(state.currentY)
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3

  // Log the current state and limits
  console.log({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY
  })

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    tweenWindowTo(state.currentX, newY)
  }
}

// Window dimension functions
function setWindowDimensions(width: number, height: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    const [currentX, currentY] = state.mainWindow.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    const maxWidth = Math.floor(workArea.width * 0.5)
    const maxHeight = Math.floor(workArea.height * 0.85)

    state.mainWindow.setBounds({
      x: Math.min(currentX, workArea.width - maxWidth),
      y: currentY,
      width: Math.min(width + 32, maxWidth),
      height: Math.min(Math.ceil(height), maxHeight)
    })
  }
}

// Environment setup
function loadEnvVariables() {
  if (isDev) {
    console.log("Loading env variables from:", path.join(process.cwd(), ".env"))
    dotenv.config({ path: path.join(process.cwd(), ".env") })
  } else {
    console.log(
      "Loading env variables from:",
      path.join(process.resourcesPath, ".env")
    )
    dotenv.config({ path: path.join(process.resourcesPath, ".env") })
  }
  console.log("Environment variables loaded for open-source version")
}

// Initialize application
async function initializeApp() {
  try {
    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(app.getPath('appData'), 'BigO')
    const sessionPath = path.join(appDataPath, 'session')
    const tempPath = path.join(appDataPath, 'temp')
    const cachePath = path.join(appDataPath, 'cache')
    
    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    
    app.setPath('userData', appDataPath)
    app.setPath('sessionData', sessionPath)      
    app.setPath('temp', tempPath)
    app.setPath('cache', cachePath)
      
    loadEnvVariables()

    // Install a minimal application menu. Without this, macOS has no Edit menu
    // installed and Cmd+C / Cmd+V / Cmd+X / Cmd+A don't reach the renderer
    // (paste-into-Settings doesn't work). The menu is hidden from view (the
    // window has its own UI) but the OS still routes the standard edit
    // accelerators through it.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: "appMenu" },
      {
        label: "Edit",
        submenu: [
          { role: "undo" }, { role: "redo" }, { type: "separator" },
          { role: "cut" }, { role: "copy" }, { role: "paste" },
          { role: "selectAll" },
        ],
      },
      { role: "windowMenu" },
    ]))

    // ── BigO auth: validate license on startup ──────────────────────────────
    authHelper.initialize().then((authState) => {
      console.log(`[Auth] startup status: ${authState.status} / plan: ${authState.plan}`)
    }).catch((err) => {
      console.error('[Auth] initialize failed:', err)
    })
    authHelper.startPeriodicRevalidation()

    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      console.log("No API key found in configuration. User will need to set up.")
    }
    
    initializeHelpers()
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      yenHelper: state.yenHelper,
      listenHelper: state.listenHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    // STEALTH: hide from Dock + Cmd+Tab + menu bar BEFORE the window opens.
    // Without this, screen-sharing reveals the app in the Dock even though
    // the window itself is content-protected.
    if (app.dock) {
      try { app.dock.hide() } catch (e) { console.warn('app.dock.hide() failed:', e) }
    }

    await createWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    console.log(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    console.error("Failed to initialize application:", error)
    app.quit()
  }
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  console.log("open-url event received:", url)
  event.preventDefault()
})

// Handle second instance (removed auth callback handling)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", (event, commandLine) => {
    console.log("second-instance event received:", commandLine)
    
    // Focus or create the main window
    if (!state.mainWindow) {
      createWindow().catch((error) => {
        console.error("Failed to create window on second-instance:", error)
      })
    } else {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore()
      state.mainWindow.focus()
    }
  })
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error("Failed to create window on activate:", error)
    })
  }
})

app.on("window-all-closed", () => {
  // macOS convention: keep the app alive when all windows are closed.
})

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): ProblemInfo | null {
  return state.problemInfo
}

function setProblemInfo(problemInfo: ProblemInfo): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available")
  try {
    const result = await state.screenshotHelper?.takeScreenshot(
      () => hideMainWindow(),
      () => showMainWindow()
    ) || ""
    return result
  } catch (error) {
    console.error("Error taking screenshot:", error)
    throw error
  }
}

async function getImagePreview(filepath: string): Promise<string> {
  try {
    return await state.screenshotHelper?.getImagePreview(filepath) || ""
  } catch (error) {
    console.error("Error getting image preview:", error)
    return ""
  }
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  } catch (error) {
    console.error("Error deleting screenshot:", error)
    return {
      success: false,
      error: `Failed to delete screenshot: ${error}`
    }
  }
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged
}

app.whenReady().then(initializeApp)
