import Stripe from 'stripe'

// Lazily construct the client — instantiating at import time crashes the build
// when STRIPE_SECRET_KEY isn't present (e.g. preview deploys).
let _stripe: Stripe | null = null
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2024-04-10',
    })
  }
  return _stripe
}

export const PLANS = {
  pro_monthly: {
    name: 'Pro Monthly',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
    amount: 2000,   // $20.00
    interval: 'month' as const,
  },
  pro_annual: {
    name: 'Pro Annual',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL!,
    amount: 15000,  // $150.00 ($12.50/mo)
    interval: 'year' as const,
  },
} as const

export type PlanKey = keyof typeof PLANS
