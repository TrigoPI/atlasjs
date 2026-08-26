---
name: pnpm-test-skips-repo-scripts
description: "`pnpm test` is `turbo run test` over `apps/*` and `packages/*` only — it has never executed `scripts/*.test.mjs` or `.claude/hooks/*.test.mjs`, so a green run proves nothing about them."
type: reference
modified: 2026-08-25
---

`pnpm test` runs `turbo run test`, and `pnpm-workspace.yaml` declares exactly two globs: `apps/*` and `packages/*`. Anything at the repo root that carries tests — `scripts/check-vault-links.test.mjs`, `.claude/hooks/claude-memory.test.mjs` — is outside the workspace and therefore outside turbo's graph. Turbo happily reports `27 successful, 27 total` (often `FULL TURBO`, straight from cache) without having loaded a single line of them.

The root-level suites are run by hand, file by file:

```bash
node --test scripts/check-vault-links.test.mjs .claude/hooks/claude-memory.test.mjs
```

The directory form does not work here — see [[node-test-directory-arg]].

**Why:** the vault reorganisation (2026-08-25) deleted `scripts/backlog-index.mjs`, `scripts/backlog-index.test.mjs` and `scripts/lib/frontmatter.*`. A green `pnpm test` before and after would have "proved" the deletion was safe while being completely blind to it. The check that actually mattered was the manual `node --test` run on those files *before* removing them, to confirm nothing red was being swept under the rug.

**How to apply:** when a change touches `scripts/` or `.claude/hooks/`, `pnpm test` is not the verification. Run the root suites explicitly and report both results — and never quote a turbo summary as evidence for code turbo never saw.
