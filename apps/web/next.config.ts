import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Route the Stripe webhook through with raw body intact
  // (Next.js App Router handles this natively — no bodyParser override needed)

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // Redirect bare /admin to dashboard if user is not admin
  // (handled in middleware — listed here for clarity)

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },
}

export default nextConfig
