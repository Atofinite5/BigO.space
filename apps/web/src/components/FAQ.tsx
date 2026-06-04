'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'Is BigO really invisible to screen sharing?',
    a: 'Yes. BigO uses macOS content protection APIs that mark the window as excluded from all screen capture. It is not visible in Zoom, Google Meet, Microsoft Teams, Webex, OBS, or any screen recording software. Note: this may not work on all macOS versions — check our compatibility list.',
  },
  {
    q: 'What AI models does BigO use?',
    a: 'BigO supports OpenAI (GPT-4o, GPT-4o mini), Google Gemini (2.0 Flash, Pro), Anthropic Claude, xAI Grok, and Groq. You bring your own API key — we never see it. By default it uses Gemini Flash for speed.',
  },
  {
    q: 'How does the free tier work?',
    a: 'The free tier gives you 5 solves per day, per device. No account or credit card needed. When you hit the limit, you\'ll see the upgrade prompt. Your count resets at midnight UTC.',
  },
  {
    q: 'What is a "license key"?',
    a: 'After purchasing Pro, you\'ll receive a license key by email (e.g. BIGO-XXXX-XXXX-XXXX). Enter it in the BigO app → Settings → License. One license works on up to 3 devices.',
  },
  {
    q: 'Does BigO store my screenshots or solutions?',
    a: 'No. Screenshots are taken locally, sent to the AI provider you chose, and deleted from disk immediately after processing. We do not store your problem content or solutions.',
  },
  {
    q: 'Can I use BigO on Windows or Linux?',
    a: 'Currently macOS only. The invisible overlay relies on macOS-specific APIs (content protection, mission control exclusion). Windows and Linux support is on the roadmap.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, anytime from the dashboard. You keep Pro access until the end of your billing period. No questions asked.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
          {q}
        </span>
        <svg
          className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${open ? 'rotate-45' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <p className="pb-5 text-sm text-white/45 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export function FAQ() {
  return (
    <section className="py-24 px-4 border-t border-white/[0.06]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white tracking-tight">FAQ</h2>
        </div>
        <div>
          {FAQS.map(({ q, a }) => (
            <FAQItem key={q} q={q} a={a} />
          ))}
        </div>
      </div>
    </section>
  )
}
