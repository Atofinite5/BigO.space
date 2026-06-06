# BigO — System Design

> Invisible AI assistant for technical interviews. Three deployable components, one monorepo.

## 1. Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                            USER'S MAC                                   │
│   ┌────────────────────────────────────────────────────────────┐      │
│   │  apps/electron  —  BigO desktop app                          │      │
│   │  • Always-on-top, screen-capture-invisible overlay          │      │
│   │  • Screenshots → LLM → answer card                          │      │
│   │  • License key auth + daily free-tier quota                 │      │
│   └───────────────┬────────────────────────────────────────────┘      │
└───────────────────┼────────────────────────────────────────────────────┘
                    │  HTTPS  (validate license, track solves)
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  api.bigo.space  →  backend  (Express + Prisma)        [Render]        │
│  • POST /api/licenses/validate      (device + key check)              │
│  • POST /api/licenses/track-solve   (quota enforcement)              │
│  • POST /api/licenses/create        (internal — from web webhook)   │
│  • Postgres (licenses, usage, subscriptions)  +  Redis (locks)      │
└───────────────────▲───────────────────────────▲───────────────────────┘
                    │ internal secret            │ Prisma
                    │                            ▼
┌───────────────────┴──────────┐      ┌──────────────────────────────┐
│  bigo.space  →  web  [Vercel]│      │  PostgreSQL + Redis  [Render]│
│  • Landing + pricing         │      └──────────────────────────────┘
│  • Stripe checkout           │
│  • Dashboard (license/usage) │      Auth: Clerk   Email: Resend
│  • Admin panel               │      Pay:  Stripe (+ Razorpay)
│  • Stripe webhook → license  │
└──────────────────────────────┘
```

| Component | Path | Stack | Deploy target |
|---|---|---|---|
| Desktop | `apps/electron` | Electron 29 + React 18 + Vite | GitHub Releases (DMG) |
| Web | `apps/web` | Next.js 16 + Clerk + Tailwind | Vercel (`bigo.space`) |
| Backend | `backend` | Express + Prisma + Postgres + Redis | Render (`api.bigo.space`) |

## 2. Key flows

### License purchase → activation
```
User clicks "Get Pro" on bigo.space
  → POST /api/checkout (web)  → Stripe Checkout
  → payment succeeds          → Stripe webhook → web /api/webhooks/stripe
  → POST api.bigo.space/api/licenses/create  (X-Internal-Secret)
  → license row created (BIGO-XXXX key)
  → Resend emails the key to the buyer
  → user pastes key in desktop app → Settings → License → Activate
```

### Solve quota (the paywall)
```
User presses Cmd+Enter in desktop app
  → AuthHelper.canSolve()  → POST /api/licenses/track-solve
      • free tier:  5 solves/day/device  → blocked when exhausted
      • pro tier:   unlimited
  → if blocked → app shows the upgrade/paywall screen
```

## 3. Trust boundaries

- **Desktop ↔ backend**: public license endpoints (no Clerk auth — runs before the user has an account). Device fingerprint + license key gate usage.
- **Web ↔ backend**: internal endpoints (`/create`, `/revoke`, `/admin/*`) protected by a shared `INTERNAL_API_SECRET` header.
- **Secrets**: never committed. `.env` / `.env.local` are gitignored; production secrets live in Vercel + Render env settings.

## 4. Environments

| Env | Branch | Web | Backend |
|---|---|---|---|
| Production | `main` | bigo.space | api.bigo.space |
| Staging | `staging` | staging preview | (shared/staging DB) |
| Preview | `dev` + PRs | per-PR preview URL | local / dev DB |

See **[WORKFLOW.md](./WORKFLOW.md)** for the branching + release pipeline.
