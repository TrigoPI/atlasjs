---
name: run-prettier-before-staging
description: "Prettier: format touched .ts/.tsx before staging (config = .prettierrc). But design docs in docs/ are NOT prettier-maintained — edit them semantic-only, do NOT reformat."
type: feedback
modified: 2026-08-07
---

The repo **has** a `.prettierrc` (verified 2026-08-07): `printWidth: 80`, `tabWidth: 2`, no tabs, semicolons, **double quotes**, `trailingComma: "all"`, `arrowParens: "always"`, `bracketSpacing: true`, **`proseWrap: "preserve"`**, `endOfLine: "lf"`. `.prettierignore` covers node_modules/dist/build/out/coverage/.turbo/**graphify-out**/.superpowers/lockfiles — `docs/` is NOT ignored. Root script: `pnpm format` = `prettier --write "**/*.{ts,tsx,md}"`. (Earlier note said "no config → defaults" — wrong, but the values happen to match the old default list.)

**Why:** the user's editor formats on save. A CODE file whose style doesn't match gets rewritten on their next save — churn + noisy diffs, frustrates them ("jpp le mien reformatte tes fichiers"). Subagent implementers do NOT run prettier, so their raw `.ts/.tsx` output usually deviates.

**How to apply — CODE (`.ts/.tsx`):** before staging touched/generated code, run `pnpm exec prettier --write <the specific files you changed>` then re-`git add`. Do it in the controller pass. **Never run repo-wide `pnpm format`** — it reformats ~98 unrelated pre-existing files (heavy pre-existing drift). Scope to touched files only.

**How to apply — DOCS (`.md` in `docs/`) — DIFFERENT:** the design docs are **NOT prettier-maintained** (verified 2026-08-07: untouched siblings like `camera.md`/`gameplay-redesign.md` FAIL `prettier --check` at HEAD). Because `proseWrap: preserve` leaves prose alone but prettier still **realigns markdown tables and reformats ```code blocks```**, running it on a doc **triples the diff** with formatting noise unrelated to your edit AND makes that doc inconsistent with its unformatted siblings. So for doc **content** edits: **do NOT run prettier — make semantic-only edits** (targeted string replacements) so the commit stays minimal and reviewable. If you already ran it, restore the docs to HEAD and re-apply just the semantic edits. Learned on the gameplay-audit docs chantier (2026-08-07).

If the user says their editor STILL reformats code afterwards, their editor uses a non-project prettier (global `~/.prettierrc` or different version) — point it at the workspace prettier. Relates to [[occluder-ysort-feature]] (where the code case first bit them).
