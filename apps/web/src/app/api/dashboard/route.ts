import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress

  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })

  // Fetch user license data from BigO backend
  const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
  const res = await fetch(`${backendUrl}/api/licenses/by-email?email=${encodeURIComponent(email)}`, {
    headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '' },
    next: { revalidate: 30 },
  })

  if (!res.ok) {
    return NextResponse.json({
      user: { email, name: user?.fullName },
      license: null,
    })
  }

  const { data: license } = await res.json()

  return NextResponse.json({
    user: { email, name: user?.fullName },
    license,
  })
}
