---
id: GAMEPLAY-24
status: todo
domain: gameplay
source: "[[input-scripting]]"
effort: M
verified: 2026-08-19
---

# Interactions hold / tap / multi-tap

`ButtonAction.sample()` ne garde que `current`/`previous`, sans machine à état temporelle pour distinguer hold, tap ou multi-tap. Reste à la construire.

**Accroche :** `dt` est déjà threadé jusqu'à `sample(input, dt)`, prêt à porter cette logique temporelle.
