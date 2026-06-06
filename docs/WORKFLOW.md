# BigO — Branching & Release Pipeline

## Branch model

```
feat/* ──PR──▶ dev ──PR──▶ staging ──PR──▶ main
fix/*          (integration)  (pre-prod)     (production)
chore/*
```

| Branch | Purpose | Protected | Deploys to |
|---|---|---|---|
| `main` | Production. Always releasable. | ✅ PR-only | bigo.space + api.bigo.space |
| `staging` | Pre-production QA. Mirrors prod. | ✅ PR-only | staging preview |
| `dev` | Integration. All features land here first. | ✅ PR-only | dev preview |
| `feat/*` | New features (branch off `dev`) | — | per-PR preview |
| `fix/*` | Bug fixes (branch off `dev`) | — | per-PR preview |
| `chore/*` | Tooling, deps, docs (branch off `dev`) | — | per-PR preview |

All three long-lived branches are protected by rulesets: **PR required, no force-push, no deletion.** Direct pushes are blocked.

## The flow

### 1. Start a feature
```bash
git checkout dev && git pull origin dev
git checkout -b feat/short-description
```

### 2. Work, commit, push
```bash
git add -A
git commit -m "feat(scope): what changed"
git push -u origin feat/short-description
```

### 3. Open a PR into `dev`
```bash
gh pr create --base dev --head feat/short-description \
  --title "feat: ..." --body "..."
```
CI runs (backend type-check, web build, electron type-check). Merge when green.

### 4. Promote dev → staging → main
```bash
# dev → staging
gh pr create --base staging --head dev --title "promote: dev → staging"
# staging → main (production)
gh pr create --base main --head staging --title "promote: staging → main"
```
Or use the **Promote** GitHub Action (`Actions → Promote staging → main → Run workflow`).

## Commit convention

`type(scope): description`

- **type**: `feat` `fix` `chore` `docs` `refactor` `perf` `test` `ci` `build`
- **scope**: `electron` `web` `backend` `infra` (optional)

Examples: `feat(web): add annual pricing toggle` · `fix(backend): null-check license expiry`

## CI/CD pipeline

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR / push to main·staging·dev | Type-check backend, build web, type-check electron |
| `release.yml` | push tag `v*.*.*` | Build macOS DMG → attach to GitHub Release |
| `promote.yml` | manual dispatch | Merge staging → main |

**Deploys are platform-native** (not GitHub Actions):
- **Vercel** auto-deploys `apps/web` on every push (production = `main`, previews = PRs)
- **Render** auto-deploys `backend` on every push to its tracked branch (`main`)

## Release a desktop version
```bash
cd apps/electron && npm version patch     # 1.0.22 → 1.0.23
git commit -am "chore(electron): bump to v1.0.23"
git tag v1.0.23 && git push origin v1.0.23   # → triggers release.yml → DMG
```

## Hotfix (rare)
For a production-critical fix, branch `fix/*` off `main`, PR back into `main`, then back-merge `main` → `dev` to keep them in sync.
