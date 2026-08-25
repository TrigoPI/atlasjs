---
id: GAMEPLAY-03
status: vision
domain: gameplay
source: "[[sprite-animation]]"
effort: L
verified: 2026-08-19
---

# State machine / transitions / blend trees pour l'Animator

`Animator` et `AnimationPlayer` n'ont aucune notion d'état ou de transition : une seule anim active à la fois, pilotée par `play(name)`/`stop()`. Il reste à concevoir un modèle de state machine avec transitions (conditions, durée de blend) au-dessus de ce socle à clip unique, sujet qui reste entièrement à défricher côté conception.
