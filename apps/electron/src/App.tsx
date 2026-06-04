import SubscribedApp from "./_pages/SubscribedApp"
import { UpdateNotification } from "./components/UpdateNotification"
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsDialog } from "./components/Settings/SettingsDialog"

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

// Root component that provides the QueryClient
function App() {
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as "neutral" | "success" | "error"
  })
  const [credits, setCredits] = useState<number>(999) // Unlimited credits
  const [currentLanguage, setCurrentLanguage] = useState<string>("python")
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  // Note: Model selection is now handled via separate extraction/solution/debugging model settings

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Set unlimited credits
  const updateCredits = useCallback(() => {
    setCredits(999) // No credit limit in this version
    window.__CREDITS__ = 999
  }, [])

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage)
    window.__LANGUAGE__ = newLanguage
  }, [])

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setIsInitialized(true)
    window.__IS_INITIALIZED__ = true
  }, [])

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant
      })
    },
    []
  )

  // Check for OpenAI API key and prompt if not found
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await window.electronAPI.checkApiKey()
        setHasApiKey(hasKey)
        
        // If no API key is found, show the settings dialog after a short delay
        if (!hasKey) {
          setTimeout(() => {
            setIsSettingsOpen(true)
          }, 1000)
        }
      } catch (error) {
        console.error("Failed to check API key:", error)
      }
    }
    
    if (isInitialized) {
      checkApiKey()
    }
  }, [isInitialized])

  // Initialize dropdown handler
  useEffect(() => {
    if (isInitialized) {
      // Process all types of dropdown elements with a shorter delay
      const timer = setTimeout(() => {
        // Find both native select elements and custom dropdowns
        const selectElements = document.querySelectorAll('select');
        const customDropdowns = document.querySelectorAll('.dropdown-trigger, [role="combobox"], button:has(.dropdown)');
        
        // Enable native selects
        selectElements.forEach(dropdown => {
          dropdown.disabled = false;
        });
        
        // Enable custom dropdowns by removing any disabled attributes
        customDropdowns.forEach(dropdown => {
          if (dropdown instanceof HTMLElement) {
            dropdown.removeAttribute('disabled');
            dropdown.setAttribute('aria-disabled', 'false');
          }
        });
        
        console.log(`Enabled ${selectElements.length} select elements and ${customDropdowns.length} custom dropdowns`);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Listen for settings dialog open requests
  useEffect(() => {
    const unsubscribeSettings = window.electronAPI.onShowSettings(() => {
      console.log("Show settings dialog requested");
      setIsSettingsOpen(true);
    });

    return () => {
      unsubscribeSettings();
    };
  }, []);

  // Cmd+P theme toggle: switch between light glass (default) and dark glass.
  // The preference is persisted in localStorage.
  useEffect(() => {
    const apply = (theme: "light" | "dark") => {
      document.documentElement.setAttribute("data-theme", theme)
      try { localStorage.setItem("ic-theme", theme) } catch { /* ignore */ }
    }
    const saved = (() => {
      try { return localStorage.getItem("ic-theme") as "light" | "dark" | null } catch { return null }
    })()
    apply(saved || "light")

    const unsub = window.electronAPI.onToggleTheme?.(() => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
      apply(cur === "dark" ? "light" : "dark")
    })
    return () => { if (unsub) unsub() }
  }, [])

  // Click-through on transparent areas: tell main process to ignore mouse
  // events whenever the cursor is NOT over a real UI element. The window is
  // started with ignore=true; we flip to false only while hovering UI.
  useEffect(() => {
    if (!window.electronAPI?.setIgnoreMouseEvents) return
    let lastIgnore: boolean | null = null
    let yenPanelOpen = false
    const setIgnore = (ignore: boolean) => {
      if (ignore === lastIgnore) return
      lastIgnore = ignore
      window.electronAPI.setIgnoreMouseEvents(ignore)
    }

    const isTransparent = (el: Element | null): boolean => {
      if (!el) return true
      if (el === document.body || el === document.documentElement) return true
      let cur: Element | null = el
      while (cur && cur !== document.body) {
        const he = cur as HTMLElement
        if (he.classList?.contains("answer-card")) return false
        if (he.dataset?.interactive === "true") return false
        cur = cur.parentElement
      }
      return true
    }

    const recheck = (e: MouseEvent | WheelEvent) => {
      // While Yen bucket panel is open, the whole window is interactive UI —
      // never let the click-through layer re-engage, otherwise scroll/clicks
      // get swallowed and the user has to Cmd+B to recover.
      if (yenPanelOpen) {
        setIgnore(false)
        return
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)
      setIgnore(isTransparent(el))
    }

    window.addEventListener("mousemove", recheck)
    window.addEventListener("wheel", recheck as EventListener, { passive: true })

    // After Cmd+B → Cmd+B the main process has just re-asserted
    // ignore=true on its own (see showMainWindow). The renderer's cache
    // is now wrong — invalidate it and re-evaluate immediately so any
    // open dialog/panel under the cursor doesn't sit there
    // unclickable. Without this, the user has to Cmd+Q to recover.
    let lastMouseX = window.innerWidth / 2
    let lastMouseY = window.innerHeight / 2
    const trackMouse = (e: MouseEvent) => {
      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }
    window.addEventListener("mousemove", trackMouse)

    let unsubReshown: (() => void) | undefined
    unsubReshown = window.electronAPI.onWindowReshown?.(() => {
      lastIgnore = null
      if (yenPanelOpen) {
        setIgnore(false)
        return
      }
      const el = document.elementFromPoint(lastMouseX, lastMouseY)
      setIgnore(isTransparent(el))
    })

    // Same problem fires on tab visibility / window focus — the OS may
    // have changed our ignore state between when the renderer last set
    // it and when it's needed again. Cheap to invalidate; correct.
    const onVisibilityChange = () => {
      if (!document.hidden) {
        lastIgnore = null
      }
    }
    const onFocus = () => {
      lastIgnore = null
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)

    // Subscribe to Yen panel state.
    let unsubYen: (() => void) | undefined
    window.electronAPI.yenGetState?.().then((s: { panelOpen: boolean } | null) => {
      if (s?.panelOpen) {
        yenPanelOpen = true
        // Force-assert: main may already be at false but the renderer
        // cache could be stale; bypass it with a null reset.
        lastIgnore = null
        setIgnore(false)
      }
    })
    unsubYen = window.electronAPI.onYenState?.((s: { panelOpen: boolean }) => {
      const wasOpen = yenPanelOpen
      yenPanelOpen = s.panelOpen
      if (yenPanelOpen) {
        lastIgnore = null
        setIgnore(false)
      } else if (wasOpen) {
        // Panel just closed. YenHelper.broadcast() flips main's ignore
        // back to true on its own. The renderer's cache is now stale —
        // invalidate so the next mousemove definitely re-syncs (without
        // this, scroll/clicks pass through to whatever is behind the
        // window and the user has to Cmd+B to recover).
        lastIgnore = null
      }
    })

    requestAnimationFrame(() => {
      if (yenPanelOpen) {
        setIgnore(false)
        return
      }
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
      setIgnore(isTransparent(el))
    })
    return () => {
      window.removeEventListener("mousemove", recheck)
      window.removeEventListener("wheel", recheck as EventListener)
      window.removeEventListener("mousemove", trackMouse)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onFocus)
      unsubYen?.()
      unsubReshown?.()
    }
  }, [])

  // Initialize basic app state
  useEffect(() => {
    // Load config and set values
    const initializeApp = async () => {
      try {
        // Set unlimited credits
        updateCredits()
        
        // Load config including language and model settings
        const config = await window.electronAPI.getConfig()
        
        // Load language preference
        if (config && config.language) {
          updateLanguage(config.language)
        } else {
          updateLanguage("python")
        }
        
        // Model settings are now managed through the settings dialog
        // and stored in config as extractionModel, solutionModel, and debuggingModel
        
        markInitialized()
      } catch (error) {
        console.error("Failed to initialize app:", error)
        // Fallback to defaults
        updateLanguage("python")
        markInitialized()
      }
    }
    
    initializeApp()

    // Event listeners for process events
    const onApiKeyInvalid = () => {
      showToast(
        "API Key Invalid",
        "Your OpenAI API key appears to be invalid or has insufficient credits",
        "error"
      )
      setApiKeyDialogOpen(true)
    }

    // Setup API key invalid listener
    window.electronAPI.onApiKeyInvalid(onApiKeyInvalid)

    // Define a no-op handler for solution success
    const unsubscribeSolutionSuccess = window.electronAPI.onSolutionSuccess(
      () => {
        console.log("Solution success - no credits deducted in this version")
        // No credit deduction in this version
      }
    )

    // Cleanup function
    return () => {
      window.electronAPI.removeListener("API_KEY_INVALID", onApiKeyInvalid)
      unsubscribeSolutionSuccess()
      window.__IS_INITIALIZED__ = false
      setIsInitialized(false)
    }
  }, [updateCredits, updateLanguage, markInitialized, showToast])

  // API Key dialog management
  useEffect(() => {
    const open = () => setIsSettingsOpen(true)
    window.addEventListener("yen-open-settings", open)
    return () => window.removeEventListener("yen-open-settings", open)
  }, [])

  const handleOpenSettings = useCallback(() => {
    console.log('Opening settings dialog');
    setIsSettingsOpen(true);
  }, []);
  
  const handleCloseSettings = useCallback((open: boolean) => {
    console.log('Settings dialog state changed:', open);
    setIsSettingsOpen(open);
  }, []);

  const handleApiKeySave = useCallback(async (apiKey: string) => {
    try {
      await window.electronAPI.updateConfig({ apiKey })
      setHasApiKey(true)
      showToast("Success", "API key saved successfully", "success")
      
      // Reload app after a short delay to reinitialize with the new API key
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error("Failed to save API key:", error)
      showToast("Error", "Failed to save API key", "error")
    }
  }, [showToast])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <div>
            {isInitialized ? (
              hasApiKey ? (
                <SubscribedApp
                  credits={credits}
                  currentLanguage={currentLanguage}
                  setLanguage={updateLanguage}
                />
              ) : (
                <WelcomeScreen onOpenSettings={handleOpenSettings} />
              )
            ) : (
              <div className="answer-card">
                <div className="answer-card__loading">Initializing…</div>
              </div>
            )}
            <UpdateNotification />
          </div>
          
          {/* Fixed corner settings button — always visible, opens the same
              dialog as Cmd+,. Lives outside the answer-card so it doesn't get
              clipped by the card's overflow:hidden. */}
          {isInitialized && hasApiKey && (
            <button
              type="button"
              className="yen-corner-gear"
              onClick={handleOpenSettings}
              data-interactive="true"
              aria-label="Settings"
              title="Settings (API · shortcuts · language) — Cmd+,"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}

          {/* Settings Dialog */}
          <SettingsDialog
            open={isSettingsOpen}
            onOpenChange={handleCloseSettings}
          />
          
          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App