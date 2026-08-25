---
id: GAMEPLAY-27
status: vision
domain: gameplay
source: "[[input-scripting]]"
effort: M
verified: 2026-08-19
---

# Control schemes / device assignment ; rebinding runtime

`packages/input/src/public/` n'a aucune notion de scheme ou de device : les bindings sont figés à la création de l'`InputActionMap`. Introduire des control schemes assignables par device et un rebinding à chaud reste à concevoir.
