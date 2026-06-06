'use client'

import { useState } from 'react'
import { CheckoutButton } from './CheckoutButton'

const FREE_FEATURES = [
  '5 solves per day',
  'All AI providers (your API key)',
  'BigO memory buckets',
  'Invisible overlay',
  'macOS app',
]

const PRO_FEATURES = [
  'Unlimited solves',
  'All AI providers (your API key)',
  'BigO memory buckets',
  'Invisible overlay',
  'macOS app',
  'Priority support',
  'License key for 3 devices',
  'All future updates',
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-24 px-4 border-t border-white/[0.06]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Simple pricing
          </h2>
          <p className="mt-3 text-white/40 text-base">
            Start free. Upgrade when you&apos;re ready.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/[0.1] bg-white/[0.03]">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm px-3 py-1 rounded-full transition-all ${
                !annual ? 'bg-white text-black font-medium' : 'text-white/40 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                annual ? 'bg-white text-black font-medium' : 'text-white/40 hover:text-white'
              }`}
            >
              Annual
              <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                -37%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Free tier */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
            <div className="mb-5">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-white/30 text-sm">/forever</span>
              </div>
              <p className="text-white/40 text-xs mt-2">5 solves per day, no card needed.</p>
            </div>

            <a
              href="https://github.com/Atofinite5/BigO.space/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl border border-white/[0.12] text-white/70 text-sm font-medium text-center hover:bg-white/[0.05] hover:text-white transition-all mb-6"
            >
              Download free
            </a>

            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/50">
                  <svg className="w-4 h-4 text-white/30 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="relative rounded-2xl border border-white/20 bg-white/[0.04] p-7 shadow-[0_0_60px_rgba(255,255,255,0.04)]">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-wide">
              Most popular
            </div>

            <div className="mb-5">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Pro</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${annual ? '12' : '20'}
                </span>
                <span className="text-white/30 text-sm">/mo</span>
                {annual && (
                  <span className="ml-1 text-xs text-white/30 line-through">$20</span>
                )}
              </div>
              {annual && (
                <p className="text-white/40 text-xs mt-1">Billed $150/year</p>
              )}
              <p className="text-white/40 text-xs mt-2">Unlimited solves. Cancel anytime.</p>
            </div>

            <CheckoutButton annual={annual} />

            <ul className="space-y-3 mt-6">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-white/25">
          Secure checkout via Stripe · License key delivered instantly to your email
        </p>
      </div>
    </section>
  )
}
