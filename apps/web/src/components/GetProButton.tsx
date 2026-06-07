'use client'

import { useState } from 'react'

export function GetProButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)

  async function go() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annual: false }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      alert('Could not start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={go} disabled={loading} className={className}>
      {loading ? 'Redirecting…' : children}
    </button>
  )
}
