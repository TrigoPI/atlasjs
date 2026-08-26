---
name: verify-against-committed-head
description: "User edits code at commit time, so committed state can diverge from a reviewed/subagent diff — re-verify against HEAD"
type: feedback
---

In subagent-driven work, this user often tweaks/refactors files at commit time (their established habit), so the committed code can differ from what a subagent produced or what was reviewed.

Concrete case: in the gameplay-camera feature, Task 5's `CameraSyncSystem` was implemented and reviewed with the correct strict order (`zoom` set → `getCameraViewport()` read → `position`), tests green. The user reordered those two lines when committing, which broke the zoom-dependent viewport read — the camera-sync tests were silently red on the committed branch until caught two tasks later.

**Why:** a per-task review that trusts the implementer's report + the pre-commit diff (without re-running against the committed HEAD) will miss regressions the user introduces at commit time.

**How to apply:** after the user commits a task, record the new base from the actual committed HEAD and, for anything non-trivial, re-run that task's tests against the committed state before building the next task on top. If tests fail on code that passed review, diff the committed file against the reviewed diff before assuming a fresh bug. Relates to [[execution-cadence-preference]].
