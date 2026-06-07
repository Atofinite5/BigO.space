import Link from 'next/link'

const PILLARS = [
  {
    title: 'Invisible by design',
    body: 'Built on macOS content-protection APIs. The overlay is excluded from Zoom, Meet, Teams, OBS — every screen-sharing and recording tool. Only you see it.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3"/></svg>
    ),
  },
  {
    title: 'Answers in seconds',
    body: 'Powered by GPT-4o, Gemini, Claude, Grok, or Groq. Screenshot the problem, press a key, and the optimal solution streams in with complexity analysis.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
  {
    title: 'Solves anything',
    body: 'Full coding solutions with optimal Big-O, multiple-choice with reasoning, and system-design outlines. Any format your interviewer throws at you.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" strokeLinejoin="round"/><path d="M14 2v6h6M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
]

export function Features() {
  return (
    <section id="features" className="relative px-5 py-28 sm:py-36">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="display text-4xl sm:text-6xl text-ink">Insights for the win</h2>
          <p className="mt-5 text-ink/50 text-base sm:text-lg leading-relaxed">
            Real-time, screen-aware answers that turn any technical interview into a
            problem you&apos;ve already solved.
          </p>
          <Link
            href="#pricing"
            className="pill-btn bg-lilac-100 text-accent px-6 py-2.5 text-sm mt-7 hover:bg-lilac-200"
          >
            Get BigO
            <span className="w-1.5 h-1.5 rounded-full bg-lilac-500" />
          </Link>
        </div>

        {/* Pillars */}
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8 mt-16 sm:mt-20">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <div className="w-11 h-11 rounded-xl bg-lilac-100 text-accent flex items-center justify-center mb-5">
                <span className="w-5 h-5">{p.icon}</span>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2.5">{p.title}</h3>
              <p className="text-ink/50 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
