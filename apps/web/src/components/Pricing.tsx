'use client'

import { useState } from 'react'
import { CheckoutButton } from './CheckoutButton'

const FREE_FEATURES = [
  '5 solves per day',
  'All AI providers (your key)',
  'BigO memory buckets',
  'Invisible overlay',
  'macOS app',
]

const PRO_FEATURES = [
  'Unlimited solves',
  'All AI providers (your key)',
  'BigO memory buckets',
  'Invisible overlay',
  'Priority support',
  'License for 3 devices',
  'All future updates',
]

function Check() {
  return (
    <span className="w-5 h-5 rounded-full bg-lilac-100 text-accent flex items-center justify-center shrink-0">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="px-5 py-28 sm:py-36">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center max-w-xl mx-auto">
          <h2 className="display text-4xl sm:text-6xl text-ink">Simple pricing</h2>
          <p className="mt-5 text-ink/50 text-base sm:text-lg">Start free. Upgrade when you&apos;re ready.</p>

          {/* Billing toggle */}
          <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-lilac-50 border border-lilac-100">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm px-4 py-1.5 rounded-full transition-all ${!annual ? 'bg-ink text-white font-medium' : 'text-ink/50 hover:text-ink'}`}
            >Monthly</button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${annual ? 'bg-ink text-white font-medium' : 'text-ink/50 hover:text-ink'}`}
            >
              Annual
              <span className="text-[10px] font-bold text-accent bg-lilac-100 px-1.5 py-0.5 rounded-full">-37%</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-5 mt-14 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-3xl border border-lilac-100 bg-white p-8">
            <p className="text-xs uppercase tracking-widest text-ink/40 font-semibold">Free</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="display text-5xl text-ink">$0</span>
              <span className="text-ink/40 text-sm">/forever</span>
            </div>
            <p className="text-ink/50 text-sm mt-2 mb-6">5 solves a day. No card needed.</p>
            <a
              href="https://github.com/Atofinite5/BigO.space/releases/latest"
              className="pill-btn w-full justify-center border border-ink/15 text-ink py-3 text-sm hover:bg-lilac-50 mb-7"
            >Download free</a>
            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-ink/70"><Check />{f}</li>
              ))}
            </ul>
          </div>

          {/* Pro — dark, featured */}
          <div className="relative rounded-3xl bg-ink text-white p-8 shadow-[0_30px_80px_-20px_rgba(124,77,255,0.45)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-lilac-400 text-ink text-[11px] font-bold uppercase tracking-wide">Most popular</div>
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Pro</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="display text-5xl">${annual ? '12' : '20'}</span>
              <span className="text-white/40 text-sm">/mo</span>
              {annual && <span className="ml-1 text-xs text-white/30 line-through">$20</span>}
            </div>
            <p className="text-white/50 text-sm mt-2 mb-6">
              {annual ? 'Billed $150/year. ' : ''}Unlimited solves. Cancel anytime.
            </p>
            <CheckoutButton annual={annual} />
            <ul className="space-y-3 mt-7">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/80">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-lilac-300 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink/35">
          Secure checkout via Stripe · License key delivered instantly by email
        </p>
      </div>
    </section>
  )
}
