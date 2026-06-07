'use client'

import { useState } from 'react'

interface Props {
  annual: boolean
}

export function CheckoutButton({ annual }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annual }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Could not start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full py-3.5 rounded-full bg-white text-ink font-semibold text-sm
        hover:bg-white/90 transition-all active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Redirecting…' : `Get Pro${annual ? ' — $150/yr' : ' — $20/mo'}`}
    </button>
  )
}
