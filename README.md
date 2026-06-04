# BigO

> The invisible AI assistant for technical interviews.

## Monorepo Structure

```
BigO/
├── apps/
│   ├── electron/     # Desktop app (macOS) — always-on-top stealth overlay
│   └── web/          # Next.js — landing page, dashboard, admin panel
└── backend/          # Express API — auth, subscriptions, sessions, payments
```

## Tech Stack

| Layer | Stack |
|---|---|
| Desktop | Electron 29 + React 18 + Vite 6 + TypeScript |
| Web | Next.js 15 + Tailwind CSS + Clerk |
| Backend | Express + TypeScript + Prisma + PostgreSQL + Redis |
| Auth | Clerk |
| Payments | Stripe (global) + Razorpay (India) |

## Branch Strategy

```
main      ← production only (protected)
staging   ← pre-prod / QA
dev       ← integration (all feature PRs merge here)
feat/XXX  ← feature branches (from dev)
fix/XXX   ← bug fix branches (from dev)
```

## Getting Started

### 1. Backend

```bash
cd backend
cp .env.example .env    # fill in your keys
docker-compose up -d    # start Postgres + Redis
npm install
npm run prisma:migrate
npm run dev
```

### 2. Web

```bash
cd apps/web
cp .env.example .env.local    # fill in your keys
npm install
npm run dev
```

### 3. Electron

```bash
cd apps/electron
npm install
NODE_ENV=development npx vite    # avoids the dev race condition
```

## Environment Variables

- `backend/.env.example` — all backend keys
- `apps/web/.env.example` — all web keys
- `apps/electron/.env` — user's own AI API key (set via app Settings)
