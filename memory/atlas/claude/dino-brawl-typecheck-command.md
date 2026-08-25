---
name: dino-brawl-typecheck-command
description: "Typechecking apps/dino-brawl requires `-p tsconfig.app.json` — a bare `tsc --noEmit` in that folder checks NOTHING and always looks green."
type: reference
modified: 2026-08-18
---

`apps/dino-brawl/tsconfig.json` is a solution file: `{ "files": [], "references": [tsconfig.app.json, tsconfig.node.json] }`. So `cd apps/dino-brawl && npx tsc --noEmit` typechecks **zero files** and exits 0 — it is not a check, it is a no-op that looks like a pass.

The real command is:

```bash
cd apps/dino-brawl && npx tsc --noEmit -p tsconfig.app.json
```

Both parts matter: the `-p` flag AND being in the app directory (from the repo root, `-p tsconfig.app.json` resolves to a nonexistent path and the error count reads as 1).

`tsconfig.app.json` sets `verbatimModuleSyntax`, `noUnusedLocals` and `noUnusedParameters`, so the real check catches things vitest never will — notably TS1484 on type-only imports (see [[vite-type-only-imports]]) and dead imports left behind by commented-out code. `apps/dino-brawl/package.json` runs `tsc -b && vite build`, so anything the real check flags breaks `pnpm build` even though `vite dev` and the test suite stay green.

**Why:** across a whole session I reported "APP TSC OK" many times on the strength of the bare command. A code reviewer running the correct one found a TS1484 that would have broken the build, plus 12 pre-existing errors I had never seen. The bare command had been silently vacuous the entire time.

**How to apply:** never claim the dino-brawl app typechecks without `-p tsconfig.app.json`. Record the current error count as a baseline before starting (pre-existing errors are common in this repo's WIP branches) and compare after, rather than expecting zero.
