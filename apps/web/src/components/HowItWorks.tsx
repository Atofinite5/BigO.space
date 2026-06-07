const STEPS = [
  { n: '01', title: 'Download BigO', body: 'Install the macOS app. It hides from Mission Control, the Dock, and every screen-recording tool the moment it launches.' },
  { n: '02', title: 'Screenshot the problem', body: 'Press ⌘H to capture your screen. Works on LeetCode, HackerRank, CoderPad — any platform your interviewer uses.' },
  { n: '03', title: 'Get the answer', body: 'Press ⌘Enter. The AI reads the problem, picks the optimal algorithm, and writes a full solution with complexity analysis.' },
  { n: '04', title: 'Copy and pass', body: 'One click copies the code. Toggle visibility with ⌘B. The window stays 100% transparent to screen capture.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-5 py-24 sm:py-32 bg-gradient-to-b from-lilac-50 to-white rounded-[40px] mx-3 sm:mx-5">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-widest text-accent font-semibold">How it works</span>
          <h2 className="display text-4xl sm:text-6xl text-ink mt-4">
            From problem to<br />solution in seconds
          </h2>
          <p className="mt-5 text-ink/50 text-base sm:text-lg leading-relaxed">
            Four steps, under ten seconds. No setup rituals, no tells — just the answer
            on a card only you can see.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-14">
          {STEPS.map((s) => (
            <div key={s.n} className="glass rounded-3xl p-6 hover:-translate-y-1 transition-transform">
              <span className="text-sm font-bold text-accent">{s.n}</span>
              <h3 className="text-lg font-bold text-ink mt-4 mb-2">{s.title}</h3>
              <p className="text-ink/50 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
