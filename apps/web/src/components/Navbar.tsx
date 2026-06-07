'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { isSignedIn } = useAuth()

  return (
    <header className="bg-surface fixed top-0 left-0 w-full z-50 border-b border-outline-variant">
      <div className="flex justify-between items-center px-6 h-16 max-w-[1280px] mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">BigO</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="#features" className="text-on-surface-variant hover:text-primary transition-colors">Features</Link>
          <Link href="#architecture" className="text-on-surface-variant hover:text-primary transition-colors">Architecture</Link>
          {isSignedIn
            ? <Link href="/dashboard" className="text-primary font-bold border-b-2 border-primary">Dashboard</Link>
            : <Link href="#cta" className="text-on-surface-variant hover:text-primary transition-colors">Pricing</Link>}
        </nav>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <Link href="/sign-in" className="text-primary text-sm px-3 py-1 hover:opacity-80 transition-all">Sign In</Link>
              <Link
                href="#cta"
                className="bg-primary-container text-on-primary-container text-sm px-6 py-2 rounded-lg font-bold hover:scale-95 transition-all"
              >
                Get Started
              </Link>
            </>
          )}
          <button className="md:hidden text-on-surface p-1" onClick={() => setOpen(!open)} aria-label="Menu">
            <span className="material-symbols-outlined">{open ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-surface border-b border-outline-variant px-6 py-4 flex flex-col gap-3 text-sm">
          <Link href="#features" onClick={() => setOpen(false)} className="text-on-surface-variant">Features</Link>
          <Link href="#architecture" onClick={() => setOpen(false)} className="text-on-surface-variant">Architecture</Link>
          <Link href="#cta" onClick={() => setOpen(false)} className="text-on-surface-variant">Pricing</Link>
          {!isSignedIn && <Link href="/sign-in" className="text-primary font-bold">Sign In</Link>}
        </div>
      )}
    </header>
  )
}
