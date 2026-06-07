'use client'

import { useState } from 'react'

const FAQS = [
  { q: 'Is BigO really invisible to screen sharing?', a: 'Yes. BigO uses macOS content-protection APIs that exclude the window from all screen capture — Zoom, Google Meet, Microsoft Teams, Webex, OBS, and any recorder. Note this may not work on every macOS version; check our compatibility list.' },
  { q: 'What AI models does BigO use?', a: 'OpenAI (GPT-4o), Google Gemini, Anthropic Claude, xAI Grok, and Groq. You bring your own API key — we never see it. Defaults to Gemini Flash for speed.' },
  { q: 'How does the free tier work?', a: '5 solves per day, per device — no account or card needed. When you hit the limit you see the upgrade prompt. The count resets at midnight UTC.' },
  { q: 'What is a license key?', a: 'After buying Pro you get a key by email (BIGO-XXXX-XXXX). Enter it in BigO → Settings → License. One license works on up to 3 devices.' },
  { q: 'Does BigO store my screenshots?', a: 'No. Screenshots are processed by the AI provider you chose, then deleted from disk immediately. We never store your problem content or solutions.' },
  { q: 'Can I cancel anytime?', a: 'Yes, from the dashboard. You keep Pro until the end of your billing period. No questions asked.' },
]

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-ink/8">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4 group">
        <span className="text-sm sm:text-base font-semibold text-ink group-hover:text-accent transition-colors">{q}</span>
        <svg className={`w-4 h-4 text-ink/30 shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </button>
      {open && <p className="pb-5 text-sm text-ink/55 leading-relaxed">{a}</p>}
    </div>
  )
}

export function FAQ() {
  return (
    <section className="px-5 py-24 sm:py-32">
      <div className="max-w-2xl mx-auto">
        <h2 className="display text-4xl sm:text-5xl text-ink text-center mb-12">Questions?</h2>
        <div>{FAQS.map((f) => <Item key={f.q} {...f} />)}</div>
      </div>
    </section>
  )
}
