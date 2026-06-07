import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress

  if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

  // Look up Stripe customer by email
  const customers = await getStripe().customers.list({ email, limit: 1 })
  if (!customers.data.length) {
    return NextResponse.json({ error: 'No billing account found. Purchase a plan first.' }, { status: 404 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
