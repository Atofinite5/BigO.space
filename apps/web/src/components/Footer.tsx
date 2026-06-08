import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-surface-container-low w-full py-16 px-6 border-t border-outline-variant">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1280px] mx-auto">
        <div>
          <span className="text-xl font-bold text-primary mb-3 block">BigO</span>
          <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
            The invisible companion for technical interviews. Operating at the boundary of hardware and software.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <p className="font-bold font-sys text-xs uppercase tracking-wider text-on-surface">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="text-on-surface-variant hover:text-primary transition-all">Features</Link></li>
              <li><Link href="/pricing" className="text-on-surface-variant hover:text-primary transition-all">Pricing</Link></li>
              <li><a href="https://github.com/Atofinite5/BigO.space/releases/latest" className="text-on-surface-variant hover:text-primary transition-all">Download</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="font-bold font-sys text-xs uppercase tracking-wider text-on-surface">Legal</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="text-on-surface-variant hover:text-primary transition-all">Privacy</Link></li>
              <li><Link href="/terms" className="text-on-surface-variant hover:text-primary transition-all">Terms</Link></li>
              <li><a href="mailto:support@bigo.space" className="text-on-surface-variant hover:text-primary transition-all">Support</a></li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-1 space-y-3">
            <p className="font-bold font-sys text-xs uppercase tracking-wider text-on-surface">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="text-on-surface-variant hover:text-primary transition-all">Sign in</Link></li>
              <li><Link href="/dashboard" className="text-on-surface-variant hover:text-primary transition-all">Dashboard</Link></li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-2 pt-12 border-t border-outline-variant/30 mt-12">
          <p className="text-sm text-on-surface-variant text-center md:text-left">
            © {new Date().getFullYear()} BigO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
