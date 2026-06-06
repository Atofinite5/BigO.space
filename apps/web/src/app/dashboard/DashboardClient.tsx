'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

interface License {
  key: string
  plan: string
  isActive: boolean
  expiresAt: string | null
  activatedDevices: string[]
  maxDevices: number
  dailySolveCount: number
  lastSolveDate: string | null
  createdAt: string
}

interface Props {
  user: { email: string; name: string | null }
  license: License | null
}

export function DashboardClient({ user, license }: Props) {
  const [copied, setCopied] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  function copyKey() {
    if (!license?.key) return
    navigator.clipboard.writeText(license.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  const planLabel = license?.plan
    ? license.plan.charAt(0).toUpperCase() + license.plan.slice(1).toLowerCase()
    : 'Free'

  const solvesToday = license?.dailySolveCount ?? 0
  const lastSolve = license?.lastSolveDate ? new Date(license.lastSolveDate) : null
  const solveIsToday = lastSolve
    ? lastSolve.toDateString() === new Date().toDateString()
    : false
  const displaySolves = solveIsToday ? solvesToday : 0

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <header className="border-b border-white/[0.06] px-4 sm:px-6 h-14 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-bold text-white text-base">BigO</Link>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-sm hidden sm:block">{user.email}</span>
          <UserButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Plan card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Plan</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">{planLabel}</span>
              {license?.isActive && (
                <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            {license?.expiresAt && (
              <p className="text-white/30 text-xs mt-1">
                Renews {new Date(license.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Solves today */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Solves today</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">{displaySolves}</span>
              {(!license || license.plan === 'FREE') && (
                <span className="text-white/30 text-sm">/ 5</span>
              )}
              {license && license.plan !== 'FREE' && (
                <span className="text-white/30 text-sm">unlimited</span>
              )}
            </div>
          </div>

          {/* Devices */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Devices activated</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">
                {license?.activatedDevices?.length ?? 0}
              </span>
              <span className="text-white/30 text-sm">/ {license?.maxDevices ?? 3}</span>
            </div>
          </div>
        </div>

        {/* License key section */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">License Key</h2>
            {license && (
              <button
                onClick={copyKey}
                className="text-xs text-white/40 hover:text-white border border-white/[0.1] px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>

          {license ? (
            <div>
              <p className="font-mono text-lg font-semibold text-white tracking-widest mb-3">
                {license.key}
              </p>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-xs text-white/40 space-y-1">
                <p>1. Open BigO on your Mac</p>
                <p>2. Press <kbd className="bg-white/[0.06] px-1.5 py-0.5 rounded text-white/50">⌘,</kbd> to open Settings</p>
                <p>3. Go to the <strong className="text-white/60">License</strong> tab</p>
                <p>4. Paste your key and click Activate</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-white/60 text-sm">You&apos;re on the free tier.</p>
                <p className="text-white/30 text-xs mt-0.5">5 solves/day — upgrade for unlimited.</p>
              </div>
              <Link
                href="/#pricing"
                className="shrink-0 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
              >
                Upgrade to Pro →
              </Link>
            </div>
          )}
        </div>

        {/* Billing */}
        {license && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white mb-0.5">Billing</h2>
                <p className="text-white/30 text-xs">Manage subscription, invoices, cancel</p>
              </div>
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="shrink-0 px-4 py-2 rounded-xl border border-white/[0.12] text-white/60 text-sm hover:bg-white/[0.05] hover:text-white transition-all disabled:opacity-40"
              >
                {portalLoading ? 'Opening…' : 'Manage billing →'}
              </button>
            </div>
          </div>
        )}

        {/* Download */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-0.5">Download BigO</h2>
              <p className="text-white/30 text-xs">macOS · Always-on-top · Invisible overlay</p>
            </div>
            <a
              href="https://github.com/Atofinite5/BigO.space/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 rounded-xl border border-white/[0.12] text-white/60 text-sm hover:bg-white/[0.05] hover:text-white transition-all"
            >
              Download .dmg →
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
