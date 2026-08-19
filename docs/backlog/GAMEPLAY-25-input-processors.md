---
id: GAMEPLAY-25
status: todo
domain: gameplay
source: "[[input-scripting]]"
effort: S
verified: 2026-08-19
---

# Processors d'input : deadzone, invert, scale, normalisation diagonale

`Vector2Action` (`packages/input/src/public/actions/Vector2Action.ts:23-31`) calcule des `x`/`y` bruts (±1/0), jamais normalisés, et aucun pipeline de processors n'existe. Reste à introduire les quatre processors courants — deadzone, invert, scale et normalisation des diagonales — au-dessus de cette valeur brute.
