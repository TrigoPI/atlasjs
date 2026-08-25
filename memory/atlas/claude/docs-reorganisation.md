---
name: docs-reorganisation
description: "docs/ reorganisation shipped 2026-08-19 — atomic Obsidian backlog, three hooks, /atlas-done; nine design docs were found declaring a status the code contradicted"
type: project
modified: 2026-08-20
---

Shipped on 2026-08-19 (branch `chore/claude/docs-reorganisation`, 20 tasks, subagent-driven). `docs/` went from 21 232 to 9 199 lines. Spec: `docs/2026-08-19-docs-reorganisation-design.md`.

What changed, beyond what `CLAUDE.md` already records:

- The monolithic `docs/backlog.md` became **103 atomic notes** in `docs/backlog/` (85 from the old file, 18 more the final review found missing), each with `status` (`todo`/`partial`/`vision` — deliberately **no** `done`), `domain`, `effort`, and a `verified` date. `pnpm docs:index` regenerates `docs/README.md` and `docs/backlog/_index.md`; never hand-edit either.
- Ten executed `*-plan.md` files were deleted (−11 800 lines) after extracting their surviving pitfalls into hooks, a skill and `CLAUDE.md` files.
- `/atlas-done` closes a feature out. Its **step 2 (extract the plan's pitfalls before deleting it)** was added after review caught that the command would otherwise destroy exactly what this chantier spent five tasks saving.

**Why:** the root cause was the hand-maintained doc index inside `CLAUDE.md` — 19 docs had silently become orphans. The index now lives beside the files and is generated.

**How to apply:** **never trust a status line in `docs/`.** Eleven documents declared a status the code contradicted — audio, canvas-resize, character-controller, collision-layer, scheduling phase 3 (wrong in *three* places at once), audio-variation, sorting-layers, sort-point-anchor, and all three `apps/dino-brawl/docs/` designs. Check the code, then stamp `verified`. Related: [[verify-against-committed-head]], [[execution-cadence-preference]].

One trap this left behind: `legacyId` values were **section-scoped** in the old backlog (a `B2` in rendering is not the `B2` in gameplay) while the field is now flat — a reference to a bare letter ID is ambiguous. This already bit once: `canvas-resize.md` self-labels "(B3)" from the old numbering, while today's `B3` is an unrelated gameplay item.

The Obsidian vault is `docs/`; `docs/backlog/backlog.base` gives a table view by status and by domain, confirmed working by the user.

**The gap the final review caught, worth remembering:** the migration took `docs/backlog.md` as its only source and was faithful to it — but that file never had a `physics` section, so `character-controller.md` §11 and `collision-layer.md` §9 promised "→ backlog" against a domain that did not exist. Meanwhile `CLAUDE.md` now tells every agent "anything left to do lives in `docs/backlog/`". The backlog had been made **authoritative without being complete**. When a doc says its follow-ups live in the backlog, check that they actually do — a "no orphan docs" check does not catch a broken promise.
