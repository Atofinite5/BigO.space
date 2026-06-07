import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

// Plus Jakarta Sans — the rounded, geometric bold used throughout the design.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BigO — Invisible AI for Technical Interviews',
  description:
    'BigO is an always-on-top, screen-capture-invisible AI overlay that solves coding problems and MCQs in real time. Used by engineers at top companies.',
  keywords: ['interview', 'coding', 'AI', 'LeetCode', 'technical interview', 'invisible'],
  openGraph: {
    title: 'BigO — Invisible AI for Technical Interviews',
    description: 'Solve any coding problem invisibly during your interview.',
    url: 'https://bigo.space',
    siteName: 'BigO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BigO — Invisible AI for Technical Interviews',
    description: 'Solve any coding problem invisibly during your interview.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-white text-[#0b0b0f]">{children}</body>
      </html>
    </ClerkProvider>
  )
}
