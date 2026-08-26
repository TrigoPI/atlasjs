---
id: GAMEPLAY-07
status: todo
domain: gameplay
source: "[[sprite-animation]]"
effort: S
verified: 2026-08-19
---

# Re-trigger d'un clip one-shot déjà actif

`AnimationPlayer.play(name, restart)` supporte déjà le restart côté nebula, mais la façade `Animator.play(name)` n'expose aucun paramètre `restart` et appelle toujours `this.player.play(name)` sans le forwarder. Il reste à ajouter ce paramètre sur `Animator.play` et à le transmettre — c'est du câblage, pas une nouvelle mécanique.

**Accroche :** `AnimationPlayer.play(name, restart = false)` (`packages/nebula/src/animations/AnimationPlayer.ts:49-73`) supporte déjà le restart ; il ne manque que le forward depuis `Animator.play` (`packages/gameplay/src/components/Animator.ts:27-39`).
