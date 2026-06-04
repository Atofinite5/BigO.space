# CLAUDE.md — Project Context for AI Agents

> **Read this file FIRST before doing any work in this repo.**
> It exists so AI agents don't re-discover the architecture, hallucinate
> pre-existing structure, or repeat the same mistakes. Pair this with
> `docs/AGENT.md` (operational rules) and `docs/AUDIT.md` (change log).

---

## 1. App identity

- **Display name (current):** **BigO**  (`build.productName` in `package.json`)
- **Internal package name:** `interview-coder-v1` (legacy from upstream — do
  not rename; userData paths and electron-builder appId depend on it).
- **Bundle id:** `com.chunginlee.interviewcoder` (legacy)
- **Origin:** Fork of `interview-coder-withoupaywall-opensource` — an
  always-on-top, content-protected Electron panel that reads screenshots of
  coding/MCQ problems and writes the answer into a small frosted-glass card.
- **Previous brand names found in the codebase:** "InterviewCoder" (userData
  dir), "QuQ" (CSS comments), "Huang" (former productName). These are
  cosmetic leftovers — ignore unless explicitly asked to clean them up.

## 2. Tech stack

- Electron 29 + React 18 + Vite 6 + TypeScript (strict). Build with
  `vite-plugin-electron` (bundles `electron/main.ts` + `electron/preload.ts`)
  and `tsc -p tsconfig.electron.json` (emits unbundled .js to
  `dist-electron/`, used by some flows).
- LLM providers: OpenAI, Google Gemini, Anthropic Claude, xAI Grok, Groq.
  All vision-capable. Provider auto-detected from API key prefix.
- Optional pgvector memory store (Postgres) — see `electron/MemoryHelper.ts`.
  This is the **legacy semantic memory** for retrieving similar past
  problems. **It is unrelated to the Yen feature.** Don't conflate them.
- Tailwind for styling; custom CSS in `src/index.css` for the glass card.
- ESLint + TS strict, but lots of pre-existing `any` warnings and
  `@ts-ignore` comments. Don't try to fix them all — only fix what you
  introduced.

## 3. Repo layout

```
electron/                     # main process
  main.ts                     # window, app lifecycle, helper wiring
  preload.ts                  # contextBridge → window.electronAPI
  ipcHandlers.ts              # all ipcMain.handle / ipcMain.on
  shortcuts.ts                # globalShortcut registrations + Yen chord
  ConfigHelper.ts             # config.json on disk + EventEmitter
  ScreenshotHelper.ts         # screencap → 2 disk queues
  ProcessingHelper.ts         # LLM calls (extraction + solution + debug)
  MemoryHelper.ts             # pgvector — UNRELATED to Yen
  YenHelper.ts                # Yen buckets (in-memory, 5 slots)
  autoUpdater.ts              # electron-updater glue

src/
  App.tsx                     # root, Toast/QueryClient providers, theme
  _pages/
    SubscribedApp.tsx         # routes Queue / Solutions, mounts <YenView />
    Queue.tsx                 # screenshot capture view
    Solutions.tsx             # answer card after process
    Debug.tsx                 # debug refinement view
  components/
    Yen/YenView.tsx           # the Yen black-box panel + bucket UI
    Settings/SettingsDialog.tsx
    Queue/, Solutions/, Header/, ui/, shared/
  contexts/toast.tsx
  types/electron.d.ts         # window.electronAPI ambient type
  index.css                   # frosted glass + Yen styles
  env.d.ts                    # vite client + duplicate ElectronAPI shape

build/, assets/, scripts/, dist/, dist-electron/, release/
package.json                  # scripts + electron-builder config
vite.config.ts                # vite-plugin-electron entries
tsconfig.json                 # renderer TS
tsconfig.electron.json        # electron TS (separate build)
```

## 4. The Yen feature (in-memory bucket mode)

Capture screenshots → press Cmd+Enter → LLM summarizes them into a single
plain-text block (Topics + Answers + Key Points) → stored in one of 5
in-memory buckets. **No persistence.** Buckets vanish on app quit.
Deleting a bucket wipes it permanently.

### Activation
1. Settings (Cmd+,) → "Yen" toggle ON. Persists in
   `config.yenModeEnabled`.
2. Cmd+P chord prefix:
   - **Cmd+P alone** (no follow-up within 500 ms) → toggles theme
     (light ⇄ dark glass). Pre-existing behavior.
   - **Cmd+P → 0** → toggles the Yen panel (and capture mode).
   - **Cmd+P → 1..5** → opens that bucket.
3. While capture mode is on:
   - **Cmd+H** → captures, adds to Yen queue (instead of regular queue).
   - **Cmd+Enter** → summarize captures into the active (or first empty)
     bucket.
   - **Cmd+Backspace** → drop last Yen capture.

### Why the chord works the way it does
Electron `globalShortcut` does **not** support chord sequences natively. The
implementation in `electron/shortcuts.ts`:
- Registers `Cmd+P` as a global shortcut. When pressed, it starts a 500 ms
  chord window — theme toggle is **delayed** during that window.
- During the window, it temporarily **registers `Cmd+0`–`Cmd+5`** as
  global shortcuts. `Cmd+0` is normally zoom-reset, so we unregister/replace
  it for the window duration and restore afterward.
- If the window expires with no digit pressed → fire the deferred theme
  toggle.
- If a digit is pressed → consume the chord, do the Yen action, restore
  Cmd+0 zoom-reset.

### IPC contract (Yen)

| Channel                | Direction | Purpose                              |
|------------------------|-----------|--------------------------------------|
| `yen-get-state`        | invoke    | Snapshot of current YenState         |
| `yen-toggle-panel`     | invoke    | Toggle panelOpen + capture mode      |
| `yen-close-panel`      | invoke    | Close + clear queue                  |
| `yen-open-bucket`      | invoke    | Open panel, set activeBucket         |
| `yen-process-captures` | invoke    | Send captures to LLM, store in bucket|
| `yen-delete-bucket`    | invoke    | Permanently wipe one bucket          |
| `yen-clear-all`        | invoke    | Wipe all 5 buckets                   |
| `yen-clear-captures`   | invoke    | Drop pending captures                |
| `yen-state`            | broadcast | New state after every mutation       |
| `yen-process-result`   | broadcast | Cmd+Enter result `{ok, error?, ...}` |
| `yen-disabled-hint`    | broadcast | User pressed chord with feature off  |

Everything is exposed in `electron/preload.ts` as `window.electronAPI.yen*`
and typed in `src/types/electron.d.ts`.

## 5. Existing global shortcuts (don't collide)

| Shortcut                | Action                                 |
|-------------------------|----------------------------------------|
| Cmd+H                   | Take screenshot                        |
| Cmd+Enter               | Process screenshots (or save Yen)      |
| Cmd+Shift+X / Cmd+Shift+R | Reset / cancel                       |
| Cmd+B                   | Toggle window visibility               |
| Cmd+P                   | Theme toggle (or Yen chord prefix)     |
| Cmd+P → 0..5            | Yen panel / bucket N                   |
| Cmd+,                   | Settings                               |
| Cmd+L / R / U / D       | Move window                            |
| Cmd+[ / ]               | Opacity −/+                            |
| Cmd+- / 0 / =           | Zoom out / reset / in                  |
| Cmd+Backspace           | Delete last screenshot (or Yen capture)|
| Cmd+Shift+I             | Click-through (ghost) mode             |
| Cmd+Q                   | Quit                                   |

## 6. Dev workflow gotchas

### `npm run dev` has a pre-existing race condition
The script runs three concurrent processes:
1. `tsc -w -p tsconfig.electron.json` (watches electron TS)
2. `vite` (dev server + `vite-plugin-electron` which **also auto-launches
   electron** when bundles are ready)
3. `wait-on http://localhost:54321 && electron ./dist-electron/main.js`

Both #2 and #3 spawn an Electron process. They collide on the macOS
`SingletonLock`. Symptoms:
- `Failed to create .../SingletonLock: File exists (17)`
- One electron loads dev server (good), the other loads "production build"
  and fails because dist/ is empty.
- `cross-env NODE_ENV=development` in the wrapping `&&` chain doesn't
  reliably propagate to `concurrently`'s child shells, so the second
  electron sees `NODE_ENV=production`.

**Workaround:** start with just `NODE_ENV=development npx vite` — the
plugin auto-launches one electron from the dev server, no race.

**Permanent fix (not yet applied — ask before changing):** drop the
`wait-on && electron` step from the `dev` script.

### Stale singleton locks
If electron crashes hard, leftover SingletonLocks block the next launch.
Clean with:
```sh
rm -f "$HOME/Library/Application Support/InterviewCoder/SingletonLock" \
      "$HOME/Library/Application Support/interview-coder-v1/SingletonLock" \
      "$HOME/Library/Application Support/Electron/SingletonLock"
```

## 7. Production build / release

```sh
# Build only
npm run build       # vite build (renderer + electron bundles) + tsc emit

# Build + DMG/ZIP for macOS → release/
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package-mac

# Windows installer
npm run package-win
```

`package.json > build` is the electron-builder config. For local unsigned
builds keep:
- `mac.identity: null`
- `mac.notarize: false`
- `mac.hardenedRuntime: false`
- Env: `CSC_IDENTITY_AUTO_DISCOVERY=false`

If you re-enable signing for distribution, restore
`build/entitlements.mac.plist` (the `entitlements` keys) and set a real
Developer ID identity.

Output location: `release/`
- `release/Yen.dmg` (arm64 — last write wins between archs unless you
  template `${arch}` into `artifactName`)
- `release/Yen.zip`
- `release/mac/`, `release/mac-arm64/` — unpacked .app bundles

## 8. Verification commands (run these before claiming done)

```sh
# Electron-side TS — must be clean
npx tsc -p tsconfig.electron.json --noEmit

# Renderer-side TS — has many pre-existing errors. Only fail on your new ones.
npx tsc --noEmit

# Lint just the files you changed; the repo at large has pre-existing issues.
npx eslint <your files>

# Production build sanity
rm -rf dist dist-electron && npx vite build && npx tsc -p tsconfig.electron.json
```

## 9. Things that look broken but aren't

- **Pre-existing TS errors in `Solutions.tsx` (`Cannot find name 'dracula'`),
  `Debug.tsx` (implicit any), `ProcessingHelper.ts` (multiple), and
  `autoUpdater.ts`** — all upstream, predate any session work here. Ignore.
- **Hundreds of `Memo`/`memoiz` strings in `dist/assets/*.js`** — those are
  React internals (`MemoizedMaskedChildContext`, `memoizedState`, etc.) and
  the unrelated pgvector "Memory" system. They are **not** stale Yen
  references.
- **`vite exited with code 0` during `npm run dev`** — a side effect of the
  race condition above, not a build failure.

## 10. Things that ARE broken / known issues

- The dev script race (see §6).
- `${productName: BigO.${ext}" — both
  arch DMGs overwrite each other in `release/`. Use `Yen-${arch}.${ext}`
  if you need both.
- No tests. Don't pretend tests passed.
