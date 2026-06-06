import Link from 'next/link'

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
        <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">You&apos;re on Pro 🎉</h1>
      <p className="text-white/50 text-sm max-w-sm mb-8">
        Your license key has been sent to your email. Open BigO → Settings → License and paste it in.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
        >
          View dashboard →
        </Link>
        <a
          href="https://github.com/Atofinite5/BigO.space/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2.5 rounded-xl border border-white/[0.12] text-white/70 text-sm hover:bg-white/[0.05] hover:text-white transition-all"
        >
          Download BigO
        </a>
      </div>

      <p className="mt-8 text-xs text-white/25">
        Didn&apos;t get the email? Check spam or{' '}
        <a href="mailto:support@bigo.space" className="underline hover:text-white/50">
          contact support
        </a>
      </p>
    </div>
  )
}
