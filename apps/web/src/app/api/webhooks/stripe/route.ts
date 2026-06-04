import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

// This route receives raw body — Next.js App Router handles it natively.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionCancelled(sub)
        break
      }
      default:
        // Acknowledge but ignore other events
        break
    }
  } catch (err) {
    console.error('[Stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return
  if (session.payment_status !== 'paid') return

  const email = session.customer_details?.email
  const plan = (session.metadata?.plan ?? 'pro_monthly').includes('annual') ? 'PRO' : 'PRO'

  if (!email) {
    console.error('[Stripe webhook] no customer email in session:', session.id)
    return
  }

  // Call the BigO backend to create a license key
  const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
  const res = await fetch(`${backendUrl}/api/licenses/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({
      email,
      plan,
      paymentId: session.payment_intent as string ?? session.id,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend license create failed: ${res.status} ${text}`)
  }

  const { licenseKey } = await res.json()
  console.log(`[Stripe webhook] license created: ${licenseKey} for ${email}`)

  // TODO: Send license key email to customer (use Resend / SendGrid in next PR)
}

async function handleSubscriptionCancelled(sub: Stripe.Subscription) {
  // TODO: deactivate license tied to this subscription in next PR
  console.log('[Stripe webhook] subscription cancelled:', sub.id)
}
