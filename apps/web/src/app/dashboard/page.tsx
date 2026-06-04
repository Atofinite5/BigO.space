import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  // Fetch license from backend (server-side for fresh data)
  let license = null
  try {
    const backendUrl = process.env.BIGO_API_URL || 'http://localhost:3000'
    const res = await fetch(
      `${backendUrl}/api/licenses/by-email?email=${encodeURIComponent(email)}`,
      {
        headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '' },
        cache: 'no-store',
      }
    )
    if (res.ok) {
      const json = await res.json()
      license = json.data ?? null
    }
  } catch {
    // backend offline — show degraded dashboard
  }

  return (
    <DashboardClient
      user={{ email, name: user?.fullName ?? email }}
      license={license}
    />
  )
}
