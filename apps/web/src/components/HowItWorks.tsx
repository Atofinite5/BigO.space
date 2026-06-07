export function HowItWorks() {
  return (
    <section id="architecture" className="py-16 bg-surface-container-low border-y border-outline-variant relative overflow-hidden">
      <div className="grid-pattern absolute inset-0" />
      <div className="max-w-[1280px] mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold text-on-surface mb-3 tracking-tight">System Architecture</h2>
          <p className="text-sm text-on-surface-variant">A peek under the hood of the stealth execution layer.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4">
          {/* Step 1 — Input */}
          <div className="flex-1 w-full space-y-6">
            <div className="bg-surface border border-outline-variant p-6 rounded relative">
              <div className="absolute -top-3 left-4 bg-on-surface text-surface px-3 py-[2px] font-sys text-[10px] uppercase tracking-tighter">Input Layer</div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary">screen_search_desktop</span>
                <span className="font-sys text-xs tracking-wider">BUFFER SCRAPER</span>
              </div>
              <div className="h-1 bg-outline-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '66%', animation: 'shimmer-w 2s ease-in-out infinite alternate' }} />
              </div>
            </div>
            <p className="text-center font-sys text-xs opacity-60 tracking-wider">RAW DATA COLLECTION</p>
          </div>

          <span className="material-symbols-outlined text-outline-variant hidden md:block">trending_flat</span>

          {/* Step 2 — Core */}
          <div className="flex-1 w-full space-y-6">
            <div className="bg-surface border-2 border-primary p-6 rounded relative shadow-[0_0_20px_rgba(144,77,0,0.1)]">
              <div className="absolute -top-3 left-4 bg-primary text-on-primary px-3 py-[2px] font-sys text-[10px] uppercase tracking-tighter">Core Logic</div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary">memory</span>
                <span className="font-sys text-xs tracking-wider">BIGO INFERENCE ENGINE</span>
              </div>
              <div className="flex justify-between items-end gap-1 h-8">
                <div className="w-full bg-primary h-1/2" />
                <div className="w-full bg-primary h-full" />
                <div className="w-full bg-primary h-2/3" />
                <div className="w-full bg-primary h-5/6" />
              </div>
            </div>
            <p className="text-center font-sys text-xs text-primary font-bold tracking-wider">REAL-TIME ANALYSIS</p>
          </div>

          <span className="material-symbols-outlined text-outline-variant hidden md:block">trending_flat</span>

          {/* Step 3 — Stealth UI */}
          <div className="flex-1 w-full space-y-6">
            <div className="bg-surface border border-outline-variant p-6 rounded relative">
              <div className="absolute -top-3 left-4 bg-tertiary text-on-tertiary px-3 py-[2px] font-sys text-[10px] uppercase tracking-tighter">Stealth UI</div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-tertiary">layers</span>
                <span className="font-sys text-xs tracking-wider">OVERLAY WRITER</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                <div className="h-1 bg-tertiary/20 flex-1 rounded" />
              </div>
            </div>
            <p className="text-center font-sys text-xs opacity-60 tracking-wider">CLIENT-SIDE RENDERING</p>
          </div>
        </div>
      </div>
    </section>
  )
}
