import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BigO — Invisible AI for Technical Interviews',
  description:
    'BigO is an always-on-top, screen-capture-invisible AI overlay that solves coding problems and MCQs in real time. Used by engineers at top companies.',
  keywords: ['interview', 'coding', 'AI', 'LeetCode', 'technical interview', 'invisible'],
  openGraph: {
    title: 'BigO — Invisible AI for Technical Interviews',
    description: 'Solve any coding problem invisibly during your interview.',
    url: 'https://getbigo.app',
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
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-black text-white">{children}</body>
      </html>
    </ClerkProvider>
  )
}
