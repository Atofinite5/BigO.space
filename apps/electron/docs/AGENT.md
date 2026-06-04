# AGENT.md — Rules for AI agents working on this repo

> **You must read `CLAUDE.md` (project root) before this file.** Then read
> `docs/AUDIT.md` to see what's already been done. This file says how to
> behave when working — what to verify, what not to break, how to leave
> the repo in a good state.

---

## 1. Mandatory pre-flight (before writing any code)

1. Read `CLAUDE.md` — top-to-bottom, no skimming.
2. Read the **last 10 entries** of `docs/AUDIT.md`. Recent state matters
   more than old state.
3. If you're touching the **Yen feature**, search for both `Yen` and
   `yen` (CSS classes are lowercase). If you're touching anything else,
   search for both casings of that thing.
4. Run `npx tsc -p tsconfig.electron.json --noEmit` — note the **current**
   error count. That's your baseline. Anything you introduce on top is
   regression.

## 2. Truth over politeness

- **Never claim "tests passed" when there are no tests.** This repo has
  zero unit/integration tests. The `npm run test` script is a stub
  (`echo "No tests defined" && exit 0`).
- **Never claim a build "succeeded" without listing the actual artifacts
  that landed on disk.** Run `ls release/` (or `ls dist-electron/`) and
  show what's there.
- **Never claim a feature "works" without exercising it.** For UI code in
  this Electron app you cannot easily exercise it from the agent — say
  so out loud: "I have not exercised this in a running window. The
  TypeScript compiles and the IPC channels are wired."
- If you don't know, write "unknown" — don't fabricate.

## 3. Don't conflate the two memory systems

This repo has **two unrelated subsystems** with similar-sounding names:

| Subsystem  | File                        | Purpose                                                        |
|------------|-----------------------------|----------------------------------------------------------------|
| Memory     | `electron/MemoryHelper.ts`  | pgvector / Postgres similarity search for past coding problems |
| Yen        | `electron/YenHelper.ts`     | In-memory 5-bucket store for ad-hoc study notes (no DB)        |

A task that mentions "memory" is **almost always Memory** (pgvector). A
task that mentions "buckets" or "Cmd+P+0" is **always Yen**.

When you grep for `memo`, you'll get hits inside React internals
(`memoizedState`, `MemoizedMaskedChildContext`), the Memory subsystem,
and an algorithm-detection regex (`memoiz`). None of these are leftover
from the old "Memo Mode" rename — those have already been cleaned up.

## 4. Before claiming a task is done

```sh
# 1. Electron-side TS — must be 0 errors. If broken, fix before merging.
npx tsc -p tsconfig.electron.json --noEmit

# 2. Renderer-side TS — pre-existing errors are tolerated. Only fix yours.
npx tsc --noEmit | grep -v <known-noisy-files>   # pragmatic

# 3. Lint your touched files. Don't try to fix the whole repo.
npx eslint <list of files you edited>

# 4. If you changed renderer code — run a clean prod build.
rm -rf dist dist-electron && npx vite build && npx tsc -p tsconfig.electron.json
ls dist/ dist-electron/

# 5. If you changed packaging — run package-mac and verify release/.
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package-mac
ls -la release/
```

If a step you ran fails, **say so**. Don't wave it away.

## 5. Don't change without permission

These are easy to break and need a human eye:

- `package.json > build` (electron-builder config). The current shape
  produces unsigned local builds. Don't re-enable `notarize`,
  `hardenedRuntime`, or a real `identity` unless asked.
- `electron/main.ts` window flags (`alwaysOnTop`, `setContentProtection`,
  `setHiddenInMissionControl`, transparent panel). They're tuned for a
  stealth panel on macOS. Changing them breaks the UX in surprising
  ways.
- `electron/shortcuts.ts > registerChordKeys / unregisterChordKeys` —
  the chord temporarily replaces `Cmd+0` (zoom-reset). If you tear out
  or reorder this code without restoring `Cmd+0`, zoom-reset stops
  working app-wide.
- `vite.config.ts` `electronMainExternals` list. Anything that uses
  native `.node` binaries or dynamic `require` must stay external,
  otherwise the runtime breaks (sharp, pg, onnxruntime-node, etc.).
- `tsconfig.electron.json` — separate from `tsconfig.json`. Both must
  compile.

## 6. Long-running commands — etiquette

- Use `Bash run_in_background` for `npm run dev`, `package-mac`, etc.
  They never exit on their own.
- If you start a background process, **mention the task ID** to the user
  in your message so they can stop it.
- If you spawn Electron during dev, watch for stale `SingletonLock`
  files (see `CLAUDE.md` §6).
- Do not `sleep` for more than ~270 s — the prompt cache TTL is 5 min.
  Use `Monitor` with `tail -f | grep --line-buffered` to receive events,
  or `ScheduleWakeup` for genuinely idle waits.

## 7. After every meaningful change

Append an entry to `docs/AUDIT.md`. Format is in that file. The audit
log is append-only — do not rewrite history. If a previous entry was
wrong, add a new entry that corrects it.

## 8. When in doubt

Stop and ask the user. The cost of a clarifying question is low. The
cost of a confidently wrong rename / refactor / package change can take
hours to undo because there are no tests to catch the regression.
