---
id: GAMEPLAY-23
status: todo
domain: gameplay
source: "[[input-scripting]]"
effort: M
verified: 2026-08-19
---

# Events / callbacks sur les actions d'input

`ButtonAction` (`packages/input/src/public/actions/ButtonAction.ts:24-34`) n'expose que du polling (`isDown`/`isPressed`/`isReleased`), aucun émetteur d'événement. Reste à ajouter une API d'events/callbacks au-dessus de ce socle.
