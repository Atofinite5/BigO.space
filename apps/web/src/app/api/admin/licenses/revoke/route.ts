import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
  const res = await fetch(`${backendUrl}/api/licenses/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({ key }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
