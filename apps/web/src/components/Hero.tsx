import Link from 'next/link'

const STATS = [
  { value: '5s', sup: '', label: 'Answer time' },
  { value: '5', sup: '+', label: 'AI models' },
  { value: '100', sup: '%', label: 'Invisible' },
  { value: '24/7', sup: '', label: 'Available' },
]

export function Hero() {
  return (
    <section className="relative px-3 sm:px-5 pt-3">
      {/* Ambient page glow */}
      <div className="page-glow absolute inset-0 -z-10" />

      {/* Dark hero panel */}
      <div className="relative bg-ink rounded-[28px] sm:rounded-[40px] overflow-hidden">
        {/* soft glass shards top-left (decorative) */}
        <div className="pointer-events-none absolute -left-16 top-10 w-72 h-72 rounded-[40px] rotate-12 bg-gradient-to-br from-sky-300/30 to-lilac-400/20 blur-2xl" />
        <div className="pointer-events-none absolute right-10 top-0 w-64 h-64 rounded-full bg-lilac-500/15 blur-3xl" />

        <div className="relative px-5 sm:px-10 pt-28 sm:pt-36 pb-20 sm:pb-28 text-center">
          {/* Headline with floating pills */}
          <div className="relative inline-block">
            <h1 className="display text-white text-[15vw] leading-[0.92] sm:text-7xl md:text-8xl lg:text-[8.5rem]">
              <span className="relative inline-block">
                {/* Strategic-style pill, left */}
                <span className="hidden sm:flex tag-pill bg-lilac-200 text-ink absolute -left-28 top-6 before:bg-lilac-200 before:-bottom-1.5 before:left-6">
                  Undetectable
                </span>
                Invisible
              </span>
              <br />
              <span className="relative inline-block">
                Interview&nbsp;AI
                {/* Faster-style pill, right */}
                <span className="hidden sm:flex tag-pill bg-pink text-white absolute -right-20 top-3 before:bg-pink before:-top-1.5 before:right-6">
                  Instant
                </span>
              </span>
            </h1>
          </div>

          {/* Subtext */}
          <p className="mx-auto mt-8 max-w-xl text-white/55 text-base sm:text-lg leading-relaxed">
            An always-on-top AI overlay that reads your screen and solves coding
            problems, MCQs, and system design in real time — completely invisible
            to Zoom, Meet, and every screen-sharing tool.
          </p>

          {/* CTA */}
          <div className="mt-10 flex items-center justify-center gap-3">
            <a
              href="https://github.com/Atofinite5/BigO.space/releases/latest"
              className="pill-btn bg-white text-ink px-7 py-3.5 text-sm hover:bg-white/90"
            >
              Download free
              <span className="w-2 h-2 rounded-full bg-lilac-500" />
            </a>
            <Link
              href="#pricing"
              className="pill-btn border border-white/15 text-white/80 px-7 py-3.5 text-sm hover:bg-white/[0.06]"
            >
              Get Pro
            </Link>
          </div>

          {/* Glass accent orb */}
          <div className="mt-14 flex justify-center">
            <div className="animate-floaty relative w-28 h-32">
              <div className="absolute inset-0 rounded-[40px_40px_40px_40px/48px_48px_60px_60px] bg-gradient-to-b from-white/40 via-lilac-300/50 to-lilac-500/40 backdrop-blur-xl border border-white/30 shadow-[0_20px_60px_-10px_rgba(124,77,255,0.5)]" />
              <div className="absolute inset-3 rounded-[34px] bg-gradient-to-b from-white/30 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards — overlapping the dark/white boundary */}
      <div className="relative -mt-10 sm:-mt-14 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 px-1">
        {STATS.map((s) => (
          <div key={s.label} className="glass rounded-3xl p-5 sm:p-7">
            <div className="flex items-start">
              <span className="display text-4xl sm:text-5xl text-ink">{s.value}</span>
              {s.sup && <span className="text-xl sm:text-2xl text-ink/40 font-bold ml-0.5">{s.sup}</span>}
            </div>
            <p className="mt-6 sm:mt-10 text-[11px] sm:text-xs uppercase tracking-widest text-ink/45 font-semibold">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
