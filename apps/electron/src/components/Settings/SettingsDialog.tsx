import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";
import { LanguageSelector } from "../shared/LanguageSelector";

type APIProvider = "openai" | "gemini" | "anthropic" | "xai" | "groq";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel';
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
  xaiModels?: AIModel[];
  groqModels?: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    title: 'Problem Extraction',
    description: 'Model used to analyze screenshots and extract problem details',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    xaiModels: [
      {
        id: "grok-vision-beta",
        name: "Grok Vision Beta",
        description: "Multimodal model for analyzing screenshots"
      }
    ],
    groqModels: [
      {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B",
        description: "Vision model for screenshots"
      }
    ]
  },
  {
    key: 'solutionModel',
    title: 'Solution Generation',
    description: 'Model used to generate coding solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    xaiModels: [
      {
        id: "grok-beta",
        name: "Grok Beta",
        description: "Strong reasoning capabilities"
      }
    ],
    groqModels: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B (Versatile)",
        description: "Strongest free Groq model for coding & reasoning"
      },
      {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B",
        description: "Fallback option"
      }
    ]
  },
  {
    key: 'debuggingModel',
    title: 'Debugging',
    description: 'Model used to debug and improve solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    xaiModels: [
      {
        id: "grok-beta",
        name: "Grok Beta",
        description: "Strong reasoning capabilities"
      }
    ],
    groqModels: [
      {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B",
        description: "Vision model — required to read error screenshots"
      },
      {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B",
        description: "Text-only fallback (cannot read screenshots)"
      }
    ]
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [language, setLanguageState] = useState<string>("python");
  const [yenModeEnabled, setYenModeEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── License / subscription state ──────────────────────────────────────────
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<
    "checking" | "unauthenticated" | "invalid_key" | "no_subscription" | "active"
  >("checking");
  const [licensePlan, setLicensePlan] = useState<string>("free");
  const [licenseEmail, setLicenseEmail] = useState<string>("");
  const [solvesUsedToday, setSolvesUsedToday] = useState<number>(0);
  const [solvesLimit, setSolvesLimit] = useState<number | null>(5);
  const [licenseLoading, setLicenseLoading] = useState(false);

  const { showToast } = useToast();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes — enable window focus so text inputs work,
  // disable it again when closed so clicks don't exit fullscreen apps.
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    window.electronAPI.setWindowFocusable(newOpen);
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
        language?: string;
        yenModeEnabled?: boolean;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
          setLanguageState(config.language || "python");
          setYenModeEnabled(!!config.yenModeEnabled);
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Load license / auth state when the dialog opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    window.electronAPI
      .getAuthState?.()
      .then((state: {
        status: typeof licenseStatus;
        plan: string;
        email?: string;
        solvesUsedToday: number;
        solvesLimit: number | null;
      }) => {
        if (!alive || !state) return;
        setLicenseStatus(state.status);
        setLicensePlan(state.plan);
        setLicenseEmail(state.email || "");
        setSolvesUsedToday(state.solvesUsedToday);
        setSolvesLimit(state.solvesLimit);
      })
      .catch(() => {
        /* backend offline — leave defaults */
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const handleActivateLicense = async () => {
    const key = licenseKeyInput.trim();
    if (!key) {
      showToast("License", "Please enter your license key.", "error");
      return;
    }
    setLicenseLoading(true);
    try {
      const result = await window.electronAPI.validateLicenseKey(key);
      if (result?.valid) {
        showToast("Activated", "Your BigO Pro license is now active.", "success");
        // Refresh auth state
        const state = await window.electronAPI.getAuthState();
        setLicenseStatus(state.status);
        setLicensePlan(state.plan);
        setLicenseEmail(state.email || "");
        setSolvesUsedToday(state.solvesUsedToday);
        setSolvesLimit(state.solvesLimit);
        setLicenseKeyInput("");
      } else {
        showToast("Invalid key", result?.error || "License key was rejected.", "error");
      }
    } catch {
      showToast("Error", "Could not reach BigO servers. Check your connection.", "error");
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleRemoveLicense = async () => {
    setLicenseLoading(true);
    try {
      await window.electronAPI.removeLicenseKey();
      const state = await window.electronAPI.getAuthState();
      setLicenseStatus(state.status);
      setLicensePlan(state.plan);
      setLicenseEmail(state.email || "");
      setSolvesUsedToday(state.solvesUsedToday);
      setSolvesLimit(state.solvesLimit);
      showToast("License removed", "Reverted to the free tier.", "neutral");
    } catch {
      showToast("Error", "Could not remove license.", "error");
    } finally {
      setLicenseLoading(false);
    }
  };

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    
    // Reset models to defaults when changing provider
    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-1.5-pro");
      setSolutionModel("gemini-1.5-pro");
      setDebuggingModel("gemini-1.5-pro");
    } else if (provider === "anthropic") {
      setExtractionModel("claude-3-7-sonnet-20250219");
      setSolutionModel("claude-3-7-sonnet-20250219");
      setDebuggingModel("claude-3-7-sonnet-20250219");
    } else if (provider === "xai") {
      setExtractionModel("grok-vision-beta");
      setSolutionModel("grok-beta");
      setDebuggingModel("grok-beta");
    } else if (provider === "groq") {
      setExtractionModel("meta-llama/llama-4-scout-17b-16e-instruct");
      setSolutionModel("llama-3.3-70b-versatile");
      setDebuggingModel("meta-llama/llama-4-scout-17b-16e-instruct");
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        language,
        yenModeEnabled,
      });
      
      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Force reload removed to prevent connection refused errors
        // The backend updates dynamically via config-updated event
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >        
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API key and model preferences. You'll need your own API key to use this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* ── License / Subscription ──────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">License</label>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  licenseStatus === "active"
                    ? "text-green-400 bg-green-400/10"
                    : licenseStatus === "no_subscription"
                    ? "text-amber-400 bg-amber-400/10"
                    : "text-white/40 bg-white/[0.06]"
                }`}
              >
                {licenseStatus === "active"
                  ? `${licensePlan.toUpperCase()} · Active`
                  : licenseStatus === "no_subscription"
                  ? "Limit reached"
                  : "Free tier"}
              </span>
            </div>

            {licenseStatus === "active" ? (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white">
                  {licensePlan.toUpperCase()} plan — unlimited solves
                </p>
                {licenseEmail && (
                  <p className="text-xs text-white/50 mt-0.5">{licenseEmail}</p>
                )}
                <button
                  type="button"
                  onClick={handleRemoveLicense}
                  disabled={licenseLoading}
                  className="mt-2 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  {licenseLoading ? "Removing…" : "Remove license"}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-2">
                <p className="text-xs text-white/60">
                  Free tier: {solvesUsedToday}/{solvesLimit ?? "∞"} solves used today.
                  Enter your license key to unlock unlimited.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="BIGO-XXXX-XXXX-XXXX-XXXX"
                    spellCheck={false}
                    autoComplete="off"
                    className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={handleActivateLicense}
                    disabled={licenseLoading || !licenseKeyInput.trim()}
                    className="px-3 py-2 rounded-md bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {licenseLoading ? "…" : "Activate"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalLink("https://bigo.space/pricing")}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Don&apos;t have a key? Get Pro →
                </button>
              </div>
            )}
          </div>

          {/* Output mode / language — choose programming language or Subjective for theory answers */}
          <LanguageSelector
            currentLanguage={language}
            setLanguage={(lang) => setLanguageState(lang)}
          />

          {/* Yen (memory bucket) toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">BigO</label>
            <div
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                yenModeEnabled
                  ? "bg-white/10 border border-white/20"
                  : "bg-black/30 border border-white/5 hover:bg-white/5"
              }`}
              onClick={() => setYenModeEnabled((v) => !v)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                    yenModeEnabled ? "bg-white" : "bg-white/20"
                  }`}
                />
                <div className="flex flex-col">
                  <p className="font-medium text-white text-sm">
                    {yenModeEnabled ? "Enabled" : "Disabled"}
                  </p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Capture screenshots and save them as a Topics + Answers + Key Points
                    block in one of 5 in-memory buckets. Press <span className="font-mono text-white/80">Cmd+P</span> then{" "}
                    <span className="font-mono text-white/80">0</span> to open the panel,{" "}
                    <span className="font-mono text-white/80">1–5</span> to jump to a bucket.{" "}
                    <span className="font-mono text-white/80">Cmd+H</span> captures,{" "}
                    <span className="font-mono text-white/80">Cmd+Enter</span> saves. Buckets
                    live in memory only — deleting one wipes it permanently.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="flex gap-2 flex-wrap">
              <div
                className={`flex-1 min-w-[120px] p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                    <p className="text-xs text-white/60">GPT-4o models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 min-w-[120px] p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                    <p className="text-xs text-white/60">Gemini 1.5 models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 min-w-[120px] p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "anthropic"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("anthropic")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "anthropic" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude</p>
                    <p className="text-xs text-white/60">Claude 3 models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 min-w-[120px] p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "xai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("xai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "xai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">xAI</p>
                    <p className="text-xs text-white/60">Grok models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 min-w-[120px] p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "groq"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("groq")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "groq" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Groq</p>
                    <p className="text-xs text-white/60">Llama/Mixtral</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
            {apiProvider === "openai" ? "OpenAI API Key" : 
             apiProvider === "gemini" ? "Gemini API Key" : 
             apiProvider === "xai" ? "xAI API Key" :
             apiProvider === "groq" ? "Groq API Key" :
             "Anthropic API Key"}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiProvider === "openai" ? "sk-..." : 
                apiProvider === "gemini" ? "Enter your Gemini API key" :
                apiProvider === "groq" ? "gsk_..." :
                apiProvider === "xai" ? "xai-..." :
                "sk-ant-..."
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {apiProvider === "openai" ? "OpenAI" : apiProvider === "gemini" ? "Google" : apiProvider === "xai" ? "xAI" : apiProvider === "groq" ? "Groq" : "Anthropic"}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://platform.openai.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://platform.openai.com/api-keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ?  (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/')} 
                    className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : apiProvider === "xai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.x.ai/')} 
                    className="text-blue-400 hover:underline cursor-pointer">xAI Console</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.x.ai/')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : apiProvider === "groq" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.groq.com/')} 
                    className="text-blue-400 hover:underline cursor-pointer">Groq Console</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.groq.com/keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">Anthropic</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              )}
            </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>
                
                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>
                
                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>
                
                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>
                
                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>
                
                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>
                
                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>
                
                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>
                
                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>
                
                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>

                <div className="text-white/70">Toggle Yen Panel</div>
                <div className="text-white/90 font-mono">Cmd+P then 0</div>

                <div className="text-white/70">Open Yen Bucket 1–5</div>
                <div className="text-white/90 font-mono">Cmd+P then 0 then 1–5</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>
            
            {modelCategories.map((category) => {
              // Get the appropriate model list based on selected provider
              const models = 
                apiProvider === "openai" ? category.openaiModels : 
                apiProvider === "gemini" ? category.geminiModels :
                apiProvider === "xai" ? category.xaiModels || [] :
                apiProvider === "groq" ? category.groqModels || [] :
                category.anthropicModels;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        debuggingModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        setDebuggingModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{m.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
