export function Features() {
  return (
    <section id="features" className="py-16 px-6 max-w-[1280px] mx-auto">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Invisible to screen capture — wide */}
        <div className="md:col-span-2 bg-surface-container-low p-12 border border-outline-variant rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-semibold text-on-surface mb-3">Invisible to Screen Capture</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Our content-protection layer ensures overlays are excluded from the window-capture
              APIs used by Zoom, Google Meet, Microsoft Teams, and CoderPad.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="p-3 border border-outline-variant bg-surface rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary">videocam_off</span>
              <span className="font-sys text-xs tracking-wider">ZOOM HIDDEN</span>
            </div>
            <div className="p-3 border border-outline-variant bg-surface rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary">security</span>
              <span className="font-sys text-xs tracking-wider">NO RECAP</span>
            </div>
          </div>
        </div>

        {/* Response time — orange */}
        <div className="bg-primary-container p-12 rounded-xl flex flex-col justify-center items-center text-center space-y-6">
          <span className="material-symbols-outlined text-on-primary-container text-[64px]" style={{ fontVariationSettings: "'wght' 200" }}>speed</span>
          <h3 className="text-xl font-semibold text-on-primary-container">Under 5s Response</h3>
          <p className="text-sm text-on-primary-container/80 leading-relaxed">
            GPT-4o, Gemini, Claude, Grok, or Groq — pick your engine for instant code synthesis.
          </p>
        </div>

        {/* Zero-config — outlined */}
        <div className="bg-surface border border-on-surface p-12 rounded-xl">
          <span className="material-symbols-outlined text-primary mb-3">settings_input_component</span>
          <h3 className="text-xl font-semibold text-on-surface mb-3">Zero-Config Setup</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Download, paste your key, and launch. No browser extensions or complex IDE plugins required.
          </p>
        </div>

        {/* System intelligence — dark, wide */}
        <div className="md:col-span-2 bg-inverse-surface p-12 rounded-xl text-inverse-on-surface overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-xl font-semibold mb-3">System Intelligence</h3>
            <p className="text-sm opacity-80 mb-6 leading-relaxed max-w-lg">
              BigO reads the captured screen and active problem context to deliver the optimal
              algorithm — with complexity analysis — the moment you hit a mental block.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 p-6 opacity-20 translate-x-1/4 translate-y-1/4">
            <span className="material-symbols-outlined text-[120px]">psychology</span>
          </div>
        </div>
      </div>
    </section>
  )
}
