import Link from 'next/link'

export function Footer() {
  return (
    <footer className="px-3 sm:px-5 pb-5">
      {/* CTA band */}
      <div className="relative bg-ink rounded-[32px] sm:rounded-[40px] overflow-hidden px-6 sm:px-12 py-16 sm:py-20 text-center mb-3">
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-24 w-[420px] h-[420px] rounded-full bg-lilac-500/20 blur-3xl" />
        <h2 className="display relative text-white text-4xl sm:text-6xl">Your invisible<br />interview edge</h2>
        <p className="relative mt-5 text-white/50 max-w-md mx-auto text-base">
          Download free and solve your first 5 problems today. Upgrade to Pro for unlimited.
        </p>
        <div className="relative mt-8 flex items-center justify-center gap-3">
          <a href="https://github.com/Atofinite5/BigO.space/releases/latest" className="pill-btn bg-white text-ink px-7 py-3.5 text-sm hover:bg-white/90">
            Download free <span className="w-2 h-2 rounded-full bg-lilac-500" />
          </a>
          <Link href="#pricing" className="pill-btn border border-white/15 text-white/80 px-7 py-3.5 text-sm hover:bg-white/[0.06]">Get Pro</Link>
        </div>
      </div>

      {/* Lilac footer */}
      <div className="bg-lilac-100 rounded-[32px] sm:rounded-[40px] px-6 sm:px-12 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between gap-10">
            {/* Logo + link columns */}
            <div className="flex flex-col sm:flex-row gap-10 sm:gap-16">
              <div>
                <span className="text-2xl font-extrabold text-ink">BigO<span className="text-accent">.</span></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-6 text-sm">
                <div className="flex flex-col gap-3">
                  <p className="text-ink/40 text-xs uppercase tracking-widest font-semibold">Product</p>
                  <Link href="#how-it-works" className="text-ink/70 hover:text-ink">How it works</Link>
                  <Link href="#features" className="text-ink/70 hover:text-ink">Features</Link>
                  <Link href="#pricing" className="text-ink/70 hover:text-ink">Pricing</Link>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-ink/40 text-xs uppercase tracking-widest font-semibold">Account</p>
                  <Link href="/sign-in" className="text-ink/70 hover:text-ink">Sign in</Link>
                  <Link href="/dashboard" className="text-ink/70 hover:text-ink">Dashboard</Link>
                  <a href="https://github.com/Atofinite5/BigO.space/releases/latest" className="text-ink/70 hover:text-ink">Download</a>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-ink/40 text-xs uppercase tracking-widest font-semibold">Legal</p>
                  <Link href="/privacy" className="text-ink/70 hover:text-ink">Privacy</Link>
                  <Link href="/terms" className="text-ink/70 hover:text-ink">Terms</Link>
                  <a href="mailto:support@bigo.space" className="text-ink/70 hover:text-ink">Support</a>
                </div>
              </div>
            </div>

            {/* Subscribe */}
            <div className="max-w-xs">
              <p className="text-sm font-semibold text-ink">Subscribe for updates</p>
              <p className="text-xs text-ink/50 mt-1 mb-3">We won&apos;t share your details with anyone.</p>
              <form className="flex items-center gap-2 bg-white rounded-full p-1.5 pl-4">
                <input type="email" placeholder="Enter your email" className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink/30 focus:outline-none" />
                <button type="submit" className="pill-btn bg-ink text-white px-4 py-2 text-sm">Subscribe</button>
              </form>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-ink/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-ink/45">© {new Date().getFullYear()} BigO — invisible AI for technical interviews.</p>
            <div className="flex items-center gap-5 text-xs text-ink/55">
              <a href="#" className="hover:text-ink">Instagram</a>
              <a href="#" className="hover:text-ink">LinkedIn</a>
              <a href="#" className="hover:text-ink">YouTube</a>
              <a href="#" className="hover:text-ink">Discord</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
