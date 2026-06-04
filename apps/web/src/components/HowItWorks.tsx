const STEPS = [
  {
    step: '01',
    title: 'Download BigO',
    description:
      'Install the macOS app. It hides itself from Mission Control, the Dock, and all screen-sharing software.',
  },
  {
    step: '02',
    title: 'Screenshot your problem',
    description:
      'Press ⌘H to capture your screen. BigO works on any coding platform — LeetCode, HackerRank, CoderPad, whatever your interviewer uses.',
  },
  {
    step: '03',
    title: 'Get the answer instantly',
    description:
      'Press ⌘Enter. The AI reads the problem, picks the optimal algorithm, writes the full solution with complexity analysis, and shows it in a floating card only you can see.',
  },
  {
    step: '04',
    title: 'Copy and pass',
    description:
      'One click copies the code. Toggle visibility with ⌘B. The window is 100% transparent to screen recording.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How it works
          </h2>
          <p className="mt-3 text-white/40 text-base max-w-lg mx-auto">
            From problem to solution in under 10 seconds.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {STEPS.map(({ step, title, description }) => (
            <div
              key={step}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-4xl font-bold text-white/10 mb-4 font-mono">{step}</div>
              <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
