const FEATURES = [
  {
    icon: '👁️',
    title: 'Invisible to screen sharing',
    description:
      'Uses macOS content protection APIs. The window is excluded from all screen capture software — Zoom, Google Meet, Teams, OBS, everything.',
  },
  {
    icon: '⚡',
    title: 'Under 5 second answers',
    description:
      'Powered by GPT-4o, Gemini Flash, Claude, or Groq. Bring your own API key or use ours. Streaming responses start immediately.',
  },
  {
    icon: '🎯',
    title: 'Solves coding + MCQs',
    description:
      'Full coding solutions with optimal complexity. Multiple choice with reasoning. System design outlines. Any format your interview throws at you.',
  },
  {
    icon: '🪄',
    title: '5 memory buckets (BigO mode)',
    description:
      'Store up to 5 problems with solutions in-session. Jump between them with ⌘P + 1-5. Perfect for multi-round interviews.',
  },
  {
    icon: '🔒',
    title: 'No data stored',
    description:
      'Screenshots are processed and deleted immediately. We never store your problem content, solutions, or interview data on our servers.',
  },
  {
    icon: '🌍',
    title: 'All providers, your key',
    description:
      'Use OpenAI, Gemini, Anthropic, xAI, or Groq. Switch models per interview. You keep full control of your API spend.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 px-4 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for real interviews
          </h2>
          <p className="mt-3 text-white/40 text-base max-w-lg mx-auto">
            Every feature exists because an engineer asked for it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
              <p className="text-white/45 text-xs leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
