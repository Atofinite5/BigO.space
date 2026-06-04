import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AdminClient } from './AdminClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
    redirect('/dashboard')
  }

  // Fetch all licenses + stats from backend
  let stats = { totalLicenses: 0, activeLicenses: 0, totalDevices: 0 }
  let licenses: any[] = []

  try {
    const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
    const res = await fetch(`${backendUrl}/api/licenses/admin/list`, {
      headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '' },
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json()
      licenses = json.data?.licenses ?? []
      stats = json.data?.stats ?? stats
    }
  } catch {
    // backend offline
  }

  return <AdminClient licenses={licenses} stats={stats} adminEmail={email} />
}
