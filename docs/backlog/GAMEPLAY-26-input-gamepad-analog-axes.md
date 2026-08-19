---
id: GAMEPLAY-26
status: vision
domain: gameplay
source: "[[input-scripting]]"
effort: L
verified: 2026-08-19
---

# Gamepad / axes analogiques ; mouse-as-Vector2

`BackendInput` (`packages/input/src/private/BackendInput.ts:1-35`) ne compose que `BackendKeyboard` + `BackendPointer` : aucun backend gamepad. Ajouter le gamepad (axes analogiques) et la souris comme source `Vector2` reste une vision non conçue, sans backend dédié aujourd'hui.
