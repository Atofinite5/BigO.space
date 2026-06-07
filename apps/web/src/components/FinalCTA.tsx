import { GetProButton } from './GetProButton'

export function FinalCTA() {
  return (
    <section id="cta" className="py-16 px-6 max-w-[1280px] mx-auto text-center">
      <div className="bg-inverse-surface p-12 sm:p-16 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[200px]">key</span>
        </div>

        <h2 className="text-4xl sm:text-5xl font-bold text-inverse-on-surface mb-6 relative z-10 tracking-tight">
          Secure Your Career.
        </h2>
        <p className="text-base sm:text-lg text-inverse-on-surface/80 mb-12 max-w-2xl mx-auto relative z-10 leading-relaxed">
          Don&apos;t let a minor performance anxiety derail your professional trajectory. Use the same
          tools industry veterans use to maintain a technical edge.
        </p>

        <div className="flex flex-col items-center gap-6 relative z-10">
          <GetProButton className="bg-primary-container text-on-primary-container px-8 sm:px-12 py-5 rounded-xl font-bold text-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-4">
            Get Pro — BIGO-XXXX key emailed instantly
            <span className="material-symbols-outlined">local_post_office</span>
          </GetProButton>

          {/* Trust row */}
          <div className="flex items-center gap-8 text-inverse-on-surface/50 font-sys text-xs uppercase tracking-widest pt-2">
            <span>5s answers</span>
            <span>·</span>
            <span>5 AI models</span>
            <span>·</span>
            <span>100% invisible</span>
          </div>
        </div>
      </div>
    </section>
  )
}
