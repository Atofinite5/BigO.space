'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { isSignedIn } = useAuth()

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="text-white">BigO</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
          <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block"
              >
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block"
              >
                Sign in
              </Link>
              <Link
                href="#pricing"
                className="text-sm font-medium bg-white text-black px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
              >
                Get Pro
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white/60 p-1"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-black px-4 py-4 flex flex-col gap-4 text-sm">
          <Link href="#how-it-works" onClick={() => setOpen(false)} className="text-white/60 hover:text-white">How it works</Link>
          <Link href="#features" onClick={() => setOpen(false)} className="text-white/60 hover:text-white">Features</Link>
          <Link href="#pricing" onClick={() => setOpen(false)} className="text-white/60 hover:text-white">Pricing</Link>
          {isSignedIn ? (
            <Link href="/dashboard" className="text-white/60 hover:text-white">Dashboard</Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-white/60 hover:text-white">Sign in</Link>
              <Link href="#pricing" onClick={() => setOpen(false)} className="font-medium text-white">Get Pro →</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
