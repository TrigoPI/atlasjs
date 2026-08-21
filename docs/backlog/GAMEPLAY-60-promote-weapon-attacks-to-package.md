---
id: GAMEPLAY-60
status: vision
domain: gameplay
source: "[[weapon-attack-cues]]"
effort: L
verified: 2026-08-21
---

# Remonter le système d'attaques vers un package

`AttackTimeline`, `AttackPhase`/`AttackCue`, `TimelineAttack`, `AttackChain` et `MeleeHitResolver` vivent dans `apps/dino-brawl`. Le noyau est pourtant générique : une timeline de phases à canaux reportés, un canal d'événements, et une résolution de touche par fenêtre re-armable ne dépendent d'aucune spécificité du jeu.

**Accroche :** `AttackTimeline` est déjà une fonction pure sans dépendance au monde ECS, et `MeleeHitResolver` ne connaît ses cibles qu'à travers l'interface `MeleeTargetSource`. Ce qui reste couplé au jeu, c'est `SwordScript` (input, caméra, visée) et les cinq attaques de contenu — la frontière naturelle passe entre les deux.
