import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-14 px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03] blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-indigo-500/[0.04] blur-3xl" />
      </div>

      {/* Badge */}
      <div className="mb-6 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] text-xs text-white/50">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Invisible to screen sharing · works on macOS
      </div>

      {/* Headline */}
      <h1 className="max-w-3xl text-center text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white">
        Solve any coding problem
        <br />
        <span className="text-white/40">without anyone seeing.</span>
      </h1>

      {/* Subheadline */}
      <p className="mt-6 max-w-xl text-center text-base sm:text-lg text-white/50 leading-relaxed">
        BigO is an always-on-top AI overlay that reads your screen, solves LeetCode problems,
        MCQs, and system design questions in real time — completely invisible to interviewers
        and screen-sharing software.
      </p>

      {/* CTA buttons */}
      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="#pricing"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          Get Pro — $20/mo
        </Link>
        <Link
          href="#how-it-works"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/[0.12] text-white/70 font-medium text-sm hover:bg-white/[0.05] hover:text-white transition-all"
        >
          See how it works →
        </Link>
      </div>

      {/* Social proof */}
      <p className="mt-8 text-xs text-white/25 text-center">
        Free tier available · No credit card required · macOS only
      </p>

      {/* App preview mockup */}
      <div className="mt-20 w-full max-w-2xl mx-auto">
        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur overflow-hidden shadow-2xl">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="ml-auto text-[10px] text-white/20 font-mono">BigO — invisible mode</span>
          </div>
          {/* Fake content */}
          <div className="p-6 font-mono text-xs space-y-3">
            <div className="text-white/30"># Topic</div>
            <div className="text-white/70">Two Sum — Hash Map O(n)</div>
            <div className="mt-4 text-white/30"># Answer</div>
            <div className="text-green-400/80 leading-6">
              {`def two_sum(nums, target):`}<br />
              {`    seen = {}`}<br />
              {`    for i, n in enumerate(nums):`}<br />
              {`        if target - n in seen:`}<br />
              {`            return [seen[target-n], i]`}<br />
              {`        seen[n] = i`}
            </div>
            <div className="mt-4 text-white/30"># Key Points</div>
            <div className="text-white/50">· O(n) time, O(n) space</div>
            <div className="text-white/50">· Single pass — no nested loop</div>
            <div className="text-white/50">· Edge: duplicate values handled by checking before insert</div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/20">
          The overlay is hidden from screen recording — only you can see it
        </p>
      </div>
    </section>
  )
}
