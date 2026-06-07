import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'BigO | The Invisible AI Assistant',
  description:
    'BigO operates at the system level, providing real-time O(n) analysis and code solutions without ever appearing in screen recordings or window captures.',
  keywords: ['interview', 'coding', 'AI', 'LeetCode', 'technical interview', 'invisible', 'stealth'],
  openGraph: {
    title: 'BigO | The Invisible AI Assistant',
    description: 'Real-time code solutions, invisible to every screen recorder.',
    url: 'https://bigo.space',
    siteName: 'BigO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BigO | The Invisible AI Assistant',
    description: 'Real-time code solutions, invisible to every screen recorder.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          />
        </head>
        <body className="min-h-full flex flex-col bg-surface text-on-surface">{children}</body>
      </html>
    </ClerkProvider>
  )
}
