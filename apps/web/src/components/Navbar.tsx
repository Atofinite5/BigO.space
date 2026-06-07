'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { isSignedIn } = useAuth()

  return (
    <header className="absolute top-0 inset-x-0 z-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between text-white">
        {/* Left — nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70 w-1/3">
          <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        </nav>

        {/* Center — wordmark */}
        <Link href="/" className="text-2xl font-extrabold tracking-tight md:w-1/3 text-center">
          BigO<span className="text-lilac-400">.</span>
        </Link>

        {/* Right — CTA + menu */}
        <div className="flex items-center justify-end gap-3 md:w-1/3">
          {isSignedIn ? (
            <>
              <Link href="/dashboard" className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors">
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link
                href="#pricing"
                className="pill-btn bg-white text-ink px-5 py-2 text-sm hover:bg-white/90"
              >
                Get Pro
                <span className="w-1.5 h-1.5 rounded-full bg-lilac-500" />
              </Link>
            </>
          )}
          <button
            className="md:hidden text-white p-1.5"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                : <><line x1="3" y1="7" x2="19" y2="7" strokeLinecap="round" /><line x1="3" y1="13" x2="19" y2="13" strokeLinecap="round" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mx-4 rounded-2xl bg-ink/95 backdrop-blur border border-white/10 px-5 py-4 flex flex-col gap-3 text-sm text-white/80">
          <Link href="#how-it-works" onClick={() => setOpen(false)} className="hover:text-white">How it works</Link>
          <Link href="#features" onClick={() => setOpen(false)} className="hover:text-white">Features</Link>
          <Link href="#pricing" onClick={() => setOpen(false)} className="hover:text-white">Pricing</Link>
          <div className="h-px bg-white/10 my-1" />
          {isSignedIn
            ? <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            : <><Link href="/sign-in" className="hover:text-white">Sign in</Link>
                <Link href="#pricing" onClick={() => setOpen(false)} className="font-semibold text-white">Get Pro →</Link></>}
        </div>
      )}
    </header>
  )
}
