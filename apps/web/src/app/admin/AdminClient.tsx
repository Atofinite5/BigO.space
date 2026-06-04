'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

interface License {
  id: string
  key: string
  email: string | null
  plan: string
  isActive: boolean
  activatedDevices: string[]
  maxDevices: number
  dailySolveCount: number
  createdAt: string
  expiresAt: string | null
}

interface Stats {
  totalLicenses: number
  activeLicenses: number
  totalDevices: number
}

interface Props {
  licenses: License[]
  stats: Stats
  adminEmail: string
}

export function AdminClient({ licenses, stats, adminEmail }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [revoking, setRevoking] = useState<string | null>(null)

  const filtered = licenses.filter((l) => {
    const matchSearch =
      !search ||
      l.key.toLowerCase().includes(search.toLowerCase()) ||
      (l.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && l.isActive) ||
      (filter === 'inactive' && !l.isActive)
    return matchSearch && matchFilter
  })

  async function revokeLicense(key: string) {
    if (!confirm(`Revoke license ${key}? This will block the user immediately.`)) return
    setRevoking(key)
    try {
      const res = await fetch('/api/admin/licenses/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) throw new Error('Failed')
      window.location.reload()
    } catch {
      alert('Could not revoke license. Try again.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <header className="border-b border-white/[0.06] px-4 sm:px-6 h-14 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-white">BigO</Link>
          <span className="text-white/20 text-xs px-2 py-0.5 border border-white/[0.1] rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-sm hidden sm:block">{adminEmail}</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-8">Admin Panel</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total licenses', value: stats.totalLicenses },
            { label: 'Active licenses', value: stats.activeLicenses },
            { label: 'Activated devices', value: stats.totalDevices },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="Search by email or key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
          <div className="flex gap-2">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-xl text-sm capitalize transition-all ${
                  filter === f
                    ? 'bg-white text-black font-medium'
                    : 'border border-white/[0.1] text-white/50 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_80px_80px_90px_80px] gap-4 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] text-xs text-white/30 uppercase tracking-widest">
            <span>Email</span>
            <span>Key</span>
            <span>Plan</span>
            <span>Devices</span>
            <span>Status</span>
            <span></span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-white/20 text-sm">
              {licenses.length === 0 ? 'No licenses yet. Sales will appear here.' : 'No results.'}
            </div>
          ) : (
            filtered.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_1fr_80px_80px_90px_80px] gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.01] transition-colors"
              >
                <span className="text-sm text-white/70 truncate">{l.email ?? '—'}</span>
                <span className="font-mono text-xs text-white/50 truncate">{l.key}</span>
                <span className="text-xs text-white/60 capitalize">{l.plan.toLowerCase()}</span>
                <span className="text-xs text-white/60">
                  {l.activatedDevices.length}/{l.maxDevices}
                </span>
                <span>
                  {l.isActive ? (
                    <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">
                      Revoked
                    </span>
                  )}
                </span>
                <div>
                  {l.isActive && (
                    <button
                      onClick={() => revokeLicense(l.key)}
                      disabled={revoking === l.key}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {revoking === l.key ? '…' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-white/20 text-right">{filtered.length} licenses shown</p>
      </main>
    </div>
  )
}
