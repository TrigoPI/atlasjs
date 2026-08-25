---
name: execution-cadence-preference
description: How this user likes multi-task implementation runs driven (AtlasJS)
type: feedback
---

For plan execution the user wants **subagent-driven development, strictly one task at a time**: dispatch the implementer, review, then STOP and let them review & commit each task themselves before the next is dispatched (they say "go" to continue). Do NOT auto-commit and do NOT run tasks back-to-back without pausing — this overrides the skill's default "continuous execution."

**Why:** they keep tight control over git history and want to inspect each step. Confirmed across the full sprite-renderer redesign (8 tasks).

**How to apply:** implementers implement + test but never commit; controller pauses after each task's review for the human to commit. Reply in French for superpowers-driven sessions (session started in French). See root [[CLAUDE.md]] rule "don't commit automatically" — this is the cadence that goes with it.

**But offer the hand-over on long runs.** On the 10-task weapon-attack-cues plan (2026-08-21) the user ran the default cadence for tasks 1-4, then chose "enchaîne et commite toi-même" for 5-10 when offered the choice explicitly. Their "continue" messages ("tu peux continuer", "vas-y je suis chaud") lean toward momentum. So: start with the strict cadence, and once several tasks have gone through cleanly, offer the switch as a real option rather than either assuming it or silently stopping ten times. Ambiguous "go" messages are worth one clarifying question when the answer changes git history — theirs meant "take over the commits", not "keep pausing".

**Scoping a commit means explicit file paths, never a directory.** With their in-progress work sitting dirty in the same tree, `git add apps/<app>/src` staged 21 files instead of the task's 6 (caught immediately, `git reset` then explicit paths). List every path, and check `git diff --cached --stat` before committing. When a task's own edits land inside a file they already had dirty, say so plainly — that change is not separable from theirs and will ride along.
