import type { Metadata } from 'next'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { GetProButton } from '@/components/GetProButton'

export const metadata: Metadata = {
  title: 'Pricing | BigO',
  description: 'Choose a plan that fits your growth trajectory. Free tier and Pro unlimited.',
}

const FREE = ['5 solves / day', 'Community support', 'Basic metrics']
const PRO = [
  { icon: 'bolt', label: 'Unlimited solves', bold: true },
  { icon: 'verified_user', label: 'Priority support', bold: false },
  { icon: 'sync', label: 'Multi-device sync (3 devices)', bold: false },
  { icon: 'monitoring', label: 'Advanced architectural insights', bold: false },
]

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-12 max-w-[1280px] mx-auto grid-pattern min-h-screen">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-low border border-outline-variant mb-6">
            <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
            <span className="font-sys text-xs tracking-wider text-on-surface-variant uppercase">Architecture Optimized</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-3">Scale your insights.</h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Precision engineering for the modern developer. Choose a plan that fits your growth trajectory.
          </p>
        </header>

        {/* Pricing grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-5xl mx-auto mb-16">
          {/* Free */}
          <article className="flex flex-col bg-surface-container-lowest border border-outline-variant p-6">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="text-xl font-semibold mb-1">Free</h2>
                <div className="font-sys text-sm text-on-surface-variant opacity-60">{'pkg.json: { version: "1.0" }'}</div>
              </div>
              <div className="text-3xl font-bold">$0<span className="text-sm font-normal text-on-surface-variant">/mo</span></div>
            </div>
            <div className="flex-grow space-y-6 mb-12">
              {FREE.map((f) => (
                <div key={f} className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
            <a
              href="https://github.com/Atofinite5/BigO.space/releases/latest"
              className="w-full py-6 border border-outline font-sys text-xs uppercase tracking-widest text-center hover:bg-surface-container-low transition-all"
            >
              Download Free
            </a>
          </article>

          {/* Pro */}
          <article className="flex flex-col bg-surface-container-lowest border-2 border-primary-container p-6 relative overflow-hidden glow-orange">
            <div className="absolute top-0 right-0 bg-primary-container text-on-primary-container px-6 py-1 font-sys text-xs uppercase tracking-tighter">
              Recommended
            </div>
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="text-xl font-semibold mb-1">Pro</h2>
                <div className="font-sys text-sm text-primary font-bold">O(1) Efficiency</div>
              </div>
              <div className="text-3xl font-bold">$29<span className="text-sm font-normal text-on-surface-variant">/mo</span></div>
            </div>
            <div className="flex-grow space-y-6 mb-12">
              {PRO.map((p) => (
                <div key={p.label} className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
                  <span className="material-symbols-outlined text-primary-container">{p.icon}</span>
                  <span className={`text-sm ${p.bold ? 'font-bold' : ''}`}>{p.label}</span>
                </div>
              ))}
            </div>
            <GetProButton className="w-full py-6 bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container text-xl font-semibold hover:opacity-90 transition-all flex justify-center items-center gap-3 group">
              Upgrade to Pro
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </GetProButton>
          </article>
        </div>

        {/* Trust row */}
        <section className="mt-16 py-12 border-t border-outline-variant">
          <h3 className="font-sys text-xs uppercase tracking-widest text-center mb-12 opacity-60">Trusted by lead architects at</h3>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            {['NEBULA.IO', 'QUANTUM', 'HEXACODE', 'SYNTH_SYS'].map((n) => (
              <span key={n} className="text-xl font-extrabold tracking-tighter">{n}</span>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
