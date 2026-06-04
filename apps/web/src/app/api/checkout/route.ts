import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'
import { auth, currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { annual } = await req.json()
    const planKey = annual ? 'pro_annual' : 'pro_monthly'
    const plan = PLANS[planKey]

    if (!plan.priceId) {
      return NextResponse.json({ error: 'Price not configured. Set NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY / _ANNUAL in env.' }, { status: 500 })
    }

    // Get user if signed in (optional — guest checkout also works)
    const { userId } = await auth()
    let customerEmail: string | undefined

    if (userId) {
      const user = await currentUser()
      customerEmail = user?.primaryEmailAddress?.emailAddress
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      customer_email: customerEmail,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
      metadata: {
        userId: userId ?? '',
        plan: planKey,
      },
      subscription_data: {
        metadata: {
          userId: userId ?? '',
          plan: planKey,
        },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Checkout] error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
