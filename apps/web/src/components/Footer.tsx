import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">BigO</span>
          <span className="text-white/20 text-xs">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex items-center gap-5 text-xs text-white/40">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <a href="mailto:support@bigo.space" className="hover:text-white transition-colors">Support</a>
        </nav>
      </div>
    </footer>
  )
}
