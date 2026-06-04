# AUDIT.md — Append-only change log

> Every meaningful change in this repo gets one entry here.
> Append at the bottom. Do not rewrite history. If you were wrong,
> append a correction entry.
>
> **Format per entry:**
>
> ```
> ## YYYY-MM-DD HH:MM — <session id or agent>
>
> **Goal:** what the user asked for, in one line
> **Files touched:** comma-separated paths
> **Changes:**
> - bullet
> - bullet
> **Errors hit:** what failed and why (if anything)
> **Fix:** how the error was resolved
> **Verification:** exact commands run + their result (errors=N, build=ok/fail, etc.)
> **Artifacts:** what landed on disk (release/*, dist/*, etc.) — sizes if relevant
> **Open issues / follow-ups:** anything not finished
> ```

---

## 2026-04-27 — initial Yen feature build (claude-opus-4-7)

**Goal:** Add a "Memo Mode" feature: capture screenshots, summarize via
LLM into a Topics + Answers + Key Points block, store in one of 5
in-memory buckets (no persistence). Triggered by Cmd+P+0 chord.

**Files touched (new):**
- `electron/MemoHelper.ts`
- `src/components/Memo/MemoView.tsx`

**Files touched (edited):**
- `electron/main.ts` — wired helper into state + deps interfaces
- `electron/shortcuts.ts` — chord state machine for `Cmd+P → 0..5`,
  routed `Cmd+H` / `Cmd+Enter` / `Cmd+Backspace` to memo when capture
  mode is on
- `electron/ipcHandlers.ts` — 8 `memo-*` invoke handlers
- `electron/preload.ts` — `memoX` methods + `onMemoState` /
  `onMemoProcessResult` / `onMemoDisabledHint` listeners
- `electron/ConfigHelper.ts` — `memoModeEnabled: boolean` in schema +
  default + change-emit gate
- `src/types/electron.d.ts` — typed the new bridge methods
- `src/_pages/SubscribedApp.tsx` — mounted `<MemoView />`
- `src/components/Settings/SettingsDialog.tsx` — added enable/disable
  toggle + 2 keybinding rows
- `src/index.css` — `memo-card` + `memo-bucket` styles (always-dark,
  scrollable, Copy + Delete buttons)

**Errors hit:**
- One `@typescript-eslint/no-explicit-any` from `(callback: r) =>` in
  `MemoView.tsx` because the callback param wasn't annotated.
- One `no-explicit-any` and one `ban-ts-comment` from pre-existing
  `shortcuts.ts` block (unrelated, ignored).
- Top-level `npx tsc --noEmit` listed 48 errors — **all pre-existing**
  in `Solutions.tsx`, `Debug.tsx`, `ProcessingHelper.ts`, etc. None
  introduced by this change.

**Fix:**
- Annotated the `onMemoProcessResult` callback parameter with the
  explicit result shape.
- Replaced `(err: any)` in `MemoHelper.processCaptures` with the
  `instanceof Error` narrowing pattern.
- Stopped using `(block as any)?.text` for Anthropic — used the proper
  `block.type === "text"` discriminant.
- Replaced `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` to
  satisfy the eslint `no-undef` rule.

**Verification:**
- `npx tsc -p tsconfig.electron.json --noEmit` → 0 errors
- `npx eslint electron/MemoHelper.ts src/components/Memo/MemoView.tsx`
  → 0 errors
- `npx vite build` → renderer + electron bundles built successfully
- Top-level `npx tsc --noEmit` → 48 errors (same as baseline)

**Artifacts:**
- `dist-electron/MemoHelper.js` produced
- `dist/assets/index-*.js` contains `MemoView`
- `dist/assets/index-*.css` contains `memo-card`, `memo-bucket`

**Open issues:** none for this delivery.

---

## 2026-04-27 — rename Memo → Yen (claude-opus-4-7)

**Goal:** Rebrand the just-shipped feature from "Memo Mode" to "Yen"
end-to-end (files, classes, IPC channels, config field, CSS classes,
UI strings).

**Files renamed:**
- `electron/MemoHelper.ts` → `electron/YenHelper.ts`
- `src/components/Memo/MemoView.tsx` → `src/components/Yen/YenView.tsx`

**Identifiers renamed:**
- Class `MemoHelper` → `YenHelper`
- Constant `MEMO_BUCKET_COUNT` → `YEN_BUCKET_COUNT`
- Types `MemoBucket` / `MemoState` → `YenBucket` / `YenState`
- Field `state.memoHelper` → `state.yenHelper`
- Config field `memoModeEnabled` → `yenModeEnabled`
- All 8 IPC channels `memo-*` → `yen-*`
- All 8 preload methods `memoX` → `yenX`
- 3 broadcast events `memo-state` / `memo-process-result` /
  `memo-disabled-hint` → `yen-*`
- React component `MemoView` → `YenView`
- CSS classes `memo-card`, `memo-bucket` → `yen-card`, `yen-bucket`
- All user-facing strings ("Memo Mode" → "Yen", toast titles, etc.)

**Files edited (in addition to the renames above):**
- `electron/ConfigHelper.ts`, `electron/main.ts`,
  `electron/shortcuts.ts`, `electron/ipcHandlers.ts`,
  `electron/preload.ts`, `src/types/electron.d.ts`,
  `src/_pages/SubscribedApp.tsx`,
  `src/components/Settings/SettingsDialog.tsx`,
  `src/index.css`
- Removed stale `dist-electron/MemoHelper.js` from prior tsc emit.

**Errors hit:** none introduced by this change.

**Verification:**
- `npx tsc -p tsconfig.electron.json --noEmit` → 0 errors
- `npx eslint electron/YenHelper.ts src/components/Yen/YenView.tsx`
  → 0 errors
- Clean `vite build` + `tsc -p tsconfig.electron.json` succeeded
- `grep -rn "MemoHelper\|memoHelper\|MemoView\|memoMode\|memo-card\|memo-bucket"`
  in `electron/` and `src/` → no hits
- Remaining `Memo*` strings in `dist/assets/*.js` are React internals
  (`MemoizedMaskedChildContext`, `memoizedState`) and the unrelated
  pgvector "Memory" subsystem — not Yen leftovers

**Artifacts:**
- `dist-electron/YenHelper.js` shipped
- `yen-card` / `yen-bucket` styles in `dist/assets/*.css`
- `YenView` reachable from `dist/assets/*.js`

**Open issues:** none for the rename itself.

---

## 2026-04-27 — dev server smoke test (claude-opus-4-7)

**Goal:** Verify Yen wiring loads in a running window.

**Action:** Ran `NODE_ENV=development npx vite` in background.

**Errors hit (pre-existing, not from Yen):**
1. **macOS SingletonLock collision** when running `npm run dev` — the
   pre-existing `dev` script has a race: `vite-plugin-electron`
   auto-launches one Electron, and the explicit
   `wait-on && electron ./dist-electron/main.js` chain launches
   another. They collide on the SingletonLock and one of them tries to
   load `dist/index.html` which is empty (because `npm run clean`
   wiped it).
2. **`cross-env NODE_ENV=development` doesn't propagate** through
   `concurrently`'s child shells reliably — symptom: the second
   electron prints "Auto-updater initialized in production mode".

**Fix:** Skipped the buggy script entirely — launched directly via
`NODE_ENV=development npx vite`. The plugin auto-spawns one electron,
no race.

**Verification:** Log shows `Window finished loading`, `[Memory]
pgvector memory initialized`, `Loading from development server`. The
DevTools `Autofill.enable` warning is harmless protocol chatter.

**Open issues / follow-ups:**
- The `dev` and `start` scripts in `package.json` still have the race
  condition. Recommend removing the `wait-on && electron ...` step
  from both, since `vite-plugin-electron` already handles launch.
  **Not yet applied — needs user sign-off.**

---

## 2026-04-27 — package-mac attempt #1 — FAILED (claude-opus-4-7)

**Goal:** Build a distributable macOS app to `release/`, branded "Yen".

**Action:** Updated `package.json` `build`:
- `productName`: "Huang" → "Yen"
- `mac.artifactName`: "Huang.${ext}" → "Yen.${ext}"
- Disabled signing for unsigned local build:
  - `mac.identity: "Developer ID Application"` → `null`
  - `mac.notarize: true` → `false`
  - `mac.hardenedRuntime: true` → `false`
  - Removed `mac.entitlements` / `entitlementsInherit` keys
- Set env `CSC_IDENTITY_AUTO_DISCOVERY=false`
- Ran `npm run package-mac`

**Errors hit:**
- `Error: hdiutil process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`
  (×2)
- `Error: app-builder_arm64 process failed
  ERR_ELECTRON_BUILDER_CANNOT_EXECUTE` (×2)
- `⨯ open release/Yen.zip: no such file or directory`

**Root cause:** Both x64 and arm64 builds were configured to write the
same output filenames (`release/Yen.dmg` and `release/Yen.zip`). They
ran in parallel, the first arch wrote+moved the file, the second arch
couldn't find it, both failed.

**Fix:** Changed `mac.artifactName` from `Yen.${ext}` to
`Yen-${arch}.${ext}` so each arch produces a distinct filename.

**Verification:** N/A — build was abandoned and restarted.

**Artifacts:** Partial `release/Yen.zip` (6.3 MB) was deleted before retry.

---

## 2026-04-27 — package-mac attempt #2 — SUCCEEDED (claude-opus-4-7)

**Goal:** Same as attempt #1, with the `${arch}` template fix applied.

**Action:** `rm -rf release dist dist-electron` then re-ran
`CSC_IDENTITY_AUTO_DISCOVERY=false npm run package-mac` in background.

**Errors hit:** none.

**Verification:** background task exited with code 0.

**Artifacts in `release/`:**
| File                       | Size    |
|----------------------------|---------|
| `Yen-arm64.dmg`            | 157 MB  |
| `Yen-arm64.dmg.blockmap`   | 165 KB  |
| `Yen-arm64.zip`            | 111 MB  |
| `Yen-x64.dmg`              | 161 MB  |
| `Yen-x64.dmg.blockmap`     | 168 KB  |
| `Yen-x64.zip`              | 117 MB  |
| `mac/` (unpacked .app)     | dir     |
| `mac-arm64/` (unpacked)    | dir     |

App is unsigned (intentional, for local distribution). On macOS the
user will need to right-click → Open the first time, or run
`xattr -dr com.apple.quarantine /Applications/Yen.app` after dragging
into Applications.

**Open issues / follow-ups:**
- App is unsigned — fine for personal use, **not** for general
  distribution. Restore signing config if shipping publicly.
- The build still uses `compression: "maximum"` which is slow
  (~3 min). Switch to `"normal"` if iteration speed matters more
  than file size.

---

## 2026-04-27 — documentation pass (claude-opus-4-7)

**Goal:** Future-proof the repo against agent hallucination by writing
project context, operational rules, and an audit trail.

**Files added:**
- `CLAUDE.md` (project root) — architecture, IPC contracts, dev/build
  gotchas, known issues, verification commands.
- `docs/AGENT.md` — pre-flight checklist, "truth over politeness"
  rules, list of things not to change without permission, post-change
  hygiene.
- `docs/AUDIT.md` — this file. Append-only.

**Errors hit:** none.

**Verification:** files exist; readable; cross-reference correctly.

**Open issues:** none.

---

## 2026-04-27 — Yen UX overhaul + x64 build (claude-opus-4-7)

**Goal:** Polish the Yen feature based on user feedback and ship a
single-arch (x64) DMG.

User asks (paraphrased):
1. `Cmd+P → 0 → 1..5` should be a 3-key chord that opens bucket N
   (not just `Cmd+P → 1..5`).
2. Buckets should be displayed as horizontal scrollable cards (not
   tiny chips).
3. Coding screenshots should produce: question + exact runnable code +
   explanation below.
4. A fixed gear icon in the top-right corner should always open
   Settings (API / shortcuts / language).
5. Build only x64 DMG.
6. Verify bucket delete is permanent (no DB persistence).
7. Remove the 1/2/3/4/5 numbered chips that show captured-screenshot
   count.

**Files touched:**
- `electron/shortcuts.ts` — `consumeChord(0)` now toggles the panel
  AND re-extends the chord window so a follow-up digit (1..5) opens
  that bucket. `consumeChord(N>=1)` still works directly via
  `Cmd+P → N`.
- `electron/YenHelper.ts` — new prompt with two explicit templates
  (Template A = CODING with runnable code + explanation + key points;
  Template B = NON-CODING). Forces the LLM to pick one and produce a
  predictable structure.
- `src/components/Yen/YenView.tsx` — rebuilt as a horizontal scroll
  rail of 5 full-size bucket cards. Empty buckets render a dashed
  placeholder you can click to set as active. Filled buckets render
  Copy / Copy code / Delete buttons inline. The active bucket is
  scrolled into view automatically when the panel state changes.
- `src/index.css` — removed old chip styles; added `.yen-card__rail`
  (horizontal scroll w/ snap), `.yen-bucket--empty` placeholder
  styling, `.yen-bucket__btn` row that wraps if narrow, and a pulse
  animation for the capture indicator. Also added
  `.yen-corner-gear` for the new fixed settings button.
- `src/App.tsx` — added a `<button class="yen-corner-gear">` in the
  top-right corner that opens the Settings dialog. Hidden until
  `isInitialized && hasApiKey` so the gear doesn't appear on the
  welcome screen.
- `src/components/Queue/ScreenshotQueue.tsx` — replaced the numbered
  pills (1, 2, 3, 4, 5) with a single small green pulsing dot. Click
  to drop the most recent capture. Native tooltip shows the count.
- `src/components/Settings/SettingsDialog.tsx` — keybinding hint row
  updated to `"Cmd+P then 0 then 1–5"` to match the new chord.
- `package.json > build.mac.target` — collapsed to a single `dmg` /
  `x64` target. arm64 + zip targets removed for this build. The
  user can re-add them by editing this block.

**Errors hit:**
1. `rm -rf release` failed during the first retry with
   `rm: release: Directory not empty`. Cause: the `release/` folder
   contained only `.DS_Store` (a macOS Finder file) and the zsh glob
   `release/*` doesn't match dotfiles by default, so `rm -rf release/*`
   matched nothing and `rmdir release` then failed.
   **Fix:** `rm -rf release` (no glob) cleared it cleanly.
2. None from the renamed/refactored UI code itself.

**Verification:**
- `npx tsc -p tsconfig.electron.json --noEmit` → 0 errors
- `npx eslint electron/YenHelper.ts electron/shortcuts.ts
  src/components/Yen/YenView.tsx src/components/Queue/ScreenshotQueue.tsx`
  → only 3 pre-existing `@ts-ignore` warnings in the click-through
  toggle (unrelated)
- Yen bucket persistence: confirmed — `YenHelper.deleteBucket()` sets
  `state.buckets[idx] = null` and broadcasts; no disk write, no DB
  insert, so deletion is permanent for the session and the buckets
  vanish entirely on app quit (the desired in-memory behavior).

**Artifacts:** x64 DMG build (task `bcwvaeb23`) **completed exit 0**.

| File                       | Size    |
|----------------------------|---------|
| `release/Yen-x64.dmg`      | 161 MB  |
| `release/Yen-x64.dmg.blockmap` | 168 KB |
| `release/latest-mac.yml`   | 320 B   |
| `release/mac/Yen.app`      | unpacked |

**Open issues / follow-ups:**
- Pre-existing `@ts-ignore` block in `electron/shortcuts.ts` lines
  340-345 (click-through toggle). Not touching unless asked.
- Pre-existing global TS errors (Solutions/Debug/ProcessingHelper)
  remain at the same baseline (~48). Not touching.
