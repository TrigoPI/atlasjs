---
id: GAMEPLAY-29
status: todo
domain: gameplay
source: "[[input-scripting]]"
effort: M
verified: 2026-08-19
---

# Sampling d'input en lane `fixed` déterministe

`PlayerInputSystem` n'est enregistré qu'en lane `update` (`GameplayPlugin.ts:261`), jamais sur `fixed`. Reste à permettre un sampling déterministe en `fixed`, prérequis pour un futur netcode.
