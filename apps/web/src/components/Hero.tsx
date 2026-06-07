import { GetProButton } from './GetProButton'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-12 px-6 max-w-[1280px] mx-auto">
      <div className="grid-pattern absolute inset-0 -z-10" />
      <div className="grid lg:grid-cols-2 gap-6 items-center">
        {/* Left — copy */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-tertiary-container/10 border border-tertiary rounded-full">
            <span className="material-symbols-outlined text-tertiary text-[18px]">verified_user</span>
            <span className="font-sys text-xs tracking-wider text-tertiary uppercase">Kernel-level stealth enabled</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-on-surface">
            The invisible AI assistant for your <span className="text-primary">technical interview.</span>
          </h1>

          <p className="text-base sm:text-lg text-on-surface-variant max-w-[540px] leading-relaxed">
            BigO operates at the system level, providing real-time O(n) analysis and code
            solutions without ever appearing in screen recordings or window captures.
          </p>

          <div className="flex flex-wrap gap-2 pt-3">
            <GetProButton className="bg-primary-container text-on-primary-container px-8 py-4 rounded-lg font-bold text-base flex items-center gap-2 active:scale-95 transition-all">
              Get Pro - BIGO-XXXX key
              <span className="material-symbols-outlined">arrow_forward</span>
            </GetProButton>
            <a
              href="https://github.com/Atofinite5/BigO.space"
              className="bg-surface border-2 border-on-surface text-on-surface px-8 py-4 rounded-lg font-bold text-base hover:bg-surface-container-low transition-all"
            >
              View Documentation
            </a>
          </div>

          <p className="font-sys text-xs text-on-surface-variant italic">* Key emailed instantly upon checkout.</p>
        </div>

        {/* Right — macOS overlay viz */}
        <div className="relative lg:h-[500px] flex items-center justify-center">
          {/* Blurred background code window */}
          <div className="w-full h-full bg-surface-container-high rounded-xl border border-outline-variant overflow-hidden blur-[2px] opacity-60 mac-shadow">
            <div className="h-8 bg-surface-variant border-b border-outline-variant flex items-center px-3 gap-1">
              <div className="w-3 h-3 rounded-full bg-error/40" />
              <div className="w-3 h-3 rounded-full bg-secondary-container/40" />
              <div className="w-3 h-3 rounded-full bg-tertiary-container/40" />
            </div>
            <div className="p-6 space-y-3">
              {['3/4', '1/2', '2/3', 'full', '5/6'].map((w, i) => (
                <div key={i} className={`h-4 bg-outline-variant/30 rounded ${w === 'full' ? 'w-full' : w === '5/6' ? 'w-5/6' : w === '3/4' ? 'w-3/4' : w === '2/3' ? 'w-2/3' : 'w-1/2'}`} />
              ))}
            </div>
          </div>

          {/* Sharp AI analyzer card */}
          <div className="absolute top-1/4 right-0 md:-right-8 w-80 bg-surface border-2 border-primary rounded-lg mac-shadow z-10 overflow-hidden">
            <div className="bg-primary-container/10 p-3 border-b border-primary flex justify-between items-center">
              <span className="font-sys text-xs text-primary font-bold tracking-wider">BIGO SYSTEM ANALYZER</span>
              <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <div className="p-6 space-y-2">
              <div className="flex items-center gap-1">
                <span className="font-sys text-xs bg-tertiary/10 text-tertiary border border-tertiary px-1 py-[2px] rounded">O(log n)</span>
                <span className="font-sys text-xs text-on-surface-variant">OPTIMAL SOLUTION FOUND</span>
              </div>
              <pre className="font-sys text-sm leading-relaxed bg-surface-container-low p-3 rounded border border-outline-variant overflow-x-auto"><span className="text-primary">while</span> (low {'<='} high) {'{'}
  <span className="text-primary">let</span> mid = Math.floor...
  <span className="text-tertiary">{'// Solution generated'}</span>
{'}'}</pre>
              <div className="flex justify-between items-center pt-1 border-t border-outline-variant">
                <span className="font-sys text-xs text-on-surface-variant">Response: 42ms</span>
                <span className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
              </div>
            </div>
          </div>

          {/* Invisible indicator */}
          <div className="absolute -bottom-4 left-0 bg-inverse-surface text-inverse-on-surface px-6 py-3 rounded-lg flex items-center gap-3 z-20">
            <span className="material-symbols-outlined text-tertiary-fixed">visibility_off</span>
            <span className="font-sys text-xs uppercase tracking-widest">Recording: Nothing Detected</span>
          </div>
        </div>
      </div>
    </section>
  )
}
