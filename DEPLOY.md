# BigO — Deployment Guide

## Architecture

```
bigo.space        → Vercel        (apps/web — Next.js)
api.bigo.space    → Railway       (backend — Express)
BigO.dmg           → GitHub Releases (apps/electron — Electron)
```

---

## 1. Accounts to create (do once)

| Service | URL | Purpose |
|---|---|---|
| Clerk | clerk.com | Auth (sign-in/sign-up) |
| Stripe | stripe.com | Payments (global) |
| Resend | resend.com | Transactional email |
| Railway | railway.app | Backend hosting |
| Vercel | vercel.com | Web hosting |

---

## 2. Clerk setup

1. Create project → **Next.js**
2. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
3. Add allowed redirect URLs: `https://bigo.space`, `http://localhost:3001`

---

## 3. Stripe setup

1. Create two products:
   - **BigO Pro Monthly** → $20.00 / month → copy `price_xxx` → `NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`
   - **BigO Pro Annual** → $150.00 / year → copy `price_xxx` → `NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL`
2. Enable **Customer Portal** → Stripe Dashboard → Billing → Customer portal → Activate
3. Copy API keys: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Set up webhook (after deploy):
   - Endpoint: `https://bigo.space/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
   - Copy `STRIPE_WEBHOOK_SECRET`

---

## 4. Resend setup

1. Create account at resend.com
2. Add domain → verify `bigo.space` DNS records
3. Copy `RESEND_API_KEY`

---

## 5. Generate secrets

```bash
# INTERNAL_API_SECRET (must be same in both web + backend)
openssl rand -hex 32
```

---

## 6. Deploy backend → Railway

1. Go to railway.app → New Project → Deploy from GitHub → `Atofinite5/BigO.space`
2. Set **Root Directory** to `backend`
3. Railway auto-detects `railway.toml` and runs `npm run build` + migrations
4. Add a **PostgreSQL** service (Railway Marketplace) — copy `DATABASE_URL`
5. Add a **Redis** service (Railway Marketplace) — copy `REDIS_URL`
6. Set all env vars from `backend/.env.example`:

```
NODE_ENV=production
DATABASE_URL=<from Railway Postgres>
REDIS_URL=<from Railway Redis>
CLERK_SECRET_KEY=sk_live_xxx
CLERK_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
INTERNAL_API_SECRET=<generated above>
```

7. Set custom domain: `api.bigo.space` → point to Railway service

---

## 7. Deploy web → Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel@latest

# Link project (run from repo root)
cd apps/web
vercel link
# Select: Atofinite5 / BigO.space / apps/web

# Set root directory in Vercel Dashboard → Settings → General → Root Directory = apps/web
```

Or via Vercel Dashboard:
1. New Project → Import `Atofinite5/BigO.space`
2. **Root Directory**: `apps/web`
3. Framework: Next.js (auto-detected)
4. Add all env vars from `apps/web/.env.example`:

```
NEXT_PUBLIC_APP_URL=https://bigo.space
BIGO_API_URL=https://api.bigo.space
INTERNAL_API_SECRET=<same as backend>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_xxx
RESEND_API_KEY=re_xxx
ADMIN_EMAILS=bhargavkalambhe3@gmail.com
```

5. Set custom domain: `bigo.space`

### Branch → environment mapping in Vercel

| Branch | Vercel env |
|---|---|
| `main` | Production (`bigo.space`) |
| `staging` | Preview (`staging-bigo.vercel.app`) |
| `dev` | Preview (`dev-bigo.vercel.app`) |

---

## 8. Release Electron DMG

```bash
# From apps/electron directory — bump version
npm version patch   # 1.0.22 → 1.0.23

# Commit the version bump
git add apps/electron/package.json
git commit -m "chore: bump electron version to $(node -p "require('./apps/electron/package.json').version")"

# Push a version tag — this triggers the GitHub Actions release workflow
git tag v1.0.23
git push origin v1.0.23
```

GitHub Actions (`release.yml`) will:
1. Build the DMG on macOS runner
2. Create a GitHub Release
3. Attach `BigO-arm64.dmg` and `BigO-arm64.zip`

The auto-updater in the app reads GitHub releases — users get prompted to update automatically.

---

## 9. Post-deploy checklist

- [ ] `https://bigo.space` loads landing page
- [ ] `https://api.bigo.space/health` returns `{"status":"ok"}`
- [ ] Sign-up flow works (Clerk)
- [ ] Stripe test checkout completes (use card `4242 4242 4242 4242`)
- [ ] License key email arrives in inbox
- [ ] `/dashboard` shows the license key
- [ ] BigO.dmg installs and runs on macOS
- [ ] Enter license key in app → activates to Pro
- [ ] `/admin` is accessible (add `ADMIN_EMAILS` env var)

---

## 10. Day-2 operations

### Add a coupon
Stripe Dashboard → Products → Coupons → Create

### Manually issue a license
```bash
curl -X POST https://api.bigo.space/api/licenses/create \
  -H "X-Internal-Secret: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","plan":"PRO","paymentId":"manual"}'
```

### Revoke a license
Use `/admin` panel → Revoke button, or:
```bash
curl -X POST https://api.bigo.space/api/licenses/revoke \
  -H "X-Internal-Secret: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"key":"BIGO-XXXX-XXXX-XXXX"}'
```

### Promote staging → production
GitHub → Actions → "Promote staging → main" → Run workflow → type `promote`
