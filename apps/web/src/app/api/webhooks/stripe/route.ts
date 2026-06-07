import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { sendLicenseEmail } from '@/lib/email'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
        break
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription)
        break
      }
    }
  } catch (err) {
    console.error('[Stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || session.payment_status !== 'paid') return

  const email = session.customer_details?.email
  if (!email) {
    console.error('[Stripe webhook] no customer email in session:', session.id)
    return
  }

  const planKey = session.metadata?.plan ?? 'pro_monthly'
  const isAnnual = planKey.includes('annual')

  // 1. Create license key in backend
  const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
  const res = await fetch(`${backendUrl}/api/licenses/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({
      email,
      plan: 'PRO',
      paymentId: (session.payment_intent as string) ?? session.id,
      stripeSubscriptionId: session.subscription as string,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend license create failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  const licenseKey: string = data.data?.licenseKey ?? data.licenseKey
  console.log(`[Stripe webhook] license created: ${licenseKey} for ${email}`)

  // 2. Email the license key to the buyer
  await sendLicenseEmail({ to: email, licenseKey, plan: 'Pro', annual: isAnnual })
  console.log(`[Stripe webhook] license email sent to ${email}`)
}

async function handleSubscriptionCancelled(sub: Stripe.Subscription) {
  // Find license by stripeSubscriptionId and deactivate it
  const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
  await fetch(`${backendUrl}/api/licenses/deactivate-by-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({ stripeSubscriptionId: sub.id }),
  }).catch((err) => console.error('[Stripe webhook] deactivate failed:', err))
}
