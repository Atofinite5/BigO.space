import { useState, useRef, useEffect } from "react"

interface LoginPageProps {
  onValidKey: () => void
}

export default function LoginPage({ onValidKey }: LoginPageProps) {
  const [key, setKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI?.updateContentDimensions?.({ width: 420, height: 480 })
    inputRef.current?.focus()
  }, [])

  async function handleActivate() {
    const trimmed = key.trim()
    if (!trimmed) {
      setError("Please enter your license key.")
      return
    }
    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.validateLicenseKey(trimmed)
      if (result.valid) {
        setSuccess(true)
        setTimeout(onValidKey, 800)
      } else {
        setError(result.error || "Invalid license key. Please check and try again.")
      }
    } catch {
      setError("Could not reach BigO servers. Check your internet connection.")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenPurchase() {
    window.electronAPI.openExternalUrl("https://bigo.space/pricing")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleActivate()
  }

  return (
    <div
      ref={containerRef}
      className="h-[480px] w-[420px] bg-black flex flex-col items-center justify-center px-8"
    >
      {/* Logo / name */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">BigO</h1>
        <p className="text-white/40 text-sm mt-1">Invisible AI for technical interviews</p>
      </div>

      {/* License key input */}
      <div className="w-full space-y-3">
        <label className="text-xs text-white/50 uppercase tracking-widest">License Key</label>
        <input
          ref={inputRef}
          type="text"
          value={key}
          onChange={(e) => { setKey(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          placeholder="BIGO-XXXX-XXXX-XXXX-XXXX"
          className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
          disabled={loading || success}
          spellCheck={false}
          autoComplete="off"
        />

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs px-1">{error}</p>
        )}

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={loading || success || !key.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all
            bg-white text-black hover:bg-white/90 active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {success ? "✓ Activated" : loading ? "Checking…" : "Activate License"}
        </button>
      </div>

      {/* Divider */}
      <div className="w-full flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-white/20 text-xs">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Free-tier CTA */}
      <div className="w-full text-center space-y-3">
        <p className="text-white/40 text-xs leading-relaxed">
          Don&apos;t have a key? Use free tier (5 solves/day) or purchase Pro for unlimited.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleOpenPurchase}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-white/70 text-xs
              hover:bg-white/[0.05] hover:text-white transition-all"
          >
            Get Pro →
          </button>
          <button
            onClick={onValidKey}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.06] text-white/30 text-xs
              hover:bg-white/[0.03] transition-all"
          >
            Continue Free
          </button>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="mt-8 flex items-center gap-4 text-white/20 text-[10px]">
        <span><kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[9px]">⌘B</kbd> toggle</span>
        <span><kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[9px]">⌘Q</kbd> quit</span>
      </div>
    </div>
  )
}
