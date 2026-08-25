---
id: GAMEPLAY-64
status: todo
domain: gameplay
source: "[[afterimages]]"
effort: M
verified: 2026-08-24
---

# Arbitrage du déplacement entre scripts concurrents

Plusieurs scripts appellent `character.move()` sur la même entité sans se voir. Sur le joueur de dino-brawl : `PlayerMovementScript` (marche), `PlayerDashScript` (dash) et `HurtReactionScript` (knockback). Le dash a été arbitré à la main — il est injecté en prop dans le mouvement, qui saute sa frame — mais le knockback, lui, **s'ajoute** toujours au déplacement des deux autres, comme il s'ajoutait déjà à la marche avant le dash. Un stun ou une attaque chargée à venir referont le même trou.

**Accroche :** le patron « script injecté en prop » marche à deux scripts et devient quadratique au-delà. Un composant moteur — `MovementLock` ou équivalent — que n'importe quel script réclame pour la frame, avec une priorité, résoudrait le cas général une fois. Ce n'était volontairement pas un passager du dash : c'est une abstraction partagée dans le moteur, elle mérite son propre ticket. Voir [`afterimages.md`](../rendering/afterimages.md) §5 et §9.

**Bloqué par :** rien.
