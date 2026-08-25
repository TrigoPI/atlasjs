---
id: PHYSICS-16
status: todo
domain: physics
effort: S
verified: 2026-08-25
---

# `CharacterController.move()` renvoie un scratch partagé et additionne un delta monde à une position locale

Deux défauts distincts au même endroit, `packages/gameplay/src/scripting/components/CharacterController.ts:38-48`.

(a) `computeMovement` retourne `this.scratch`, un `Vec2` **réutilisé** par le contrôleur (`packages/rapier/src/RapierCharacterController.ts:10` pour le champ, `:37-38` pour le retour — `vecToWorldInto` mute et renvoie l'instance reçue), et `move()` le relaie tel quel à l'utilisateur (`:48`) : un script qui garde la référence verra sa valeur muter au prochain `move()`. Aucun appelant de production n'exploite le retour aujourd'hui — les trois usages de dino-brawl l'ignorent, et le seul lecteur est `packages/gameplay/test/character-controller-token.test.ts:38`, qui assert immédiatement sur un faux contrôleur. C'est un piège latent, pas un bug actif.

(b) `moved` est en espace **monde** mais est additionné à `transform.position` (`:43-46`), qui est **local** depuis la refonte hiérarchie : le résultat est faux dès que le parent porte une rotation ou une échelle. Le contrat d'autorité du pont n'est pas concerné — le character controller écrit `Transform2D` directement, hors du chemin push/pull.

**Accroche :** (a) copier dans un `Vec2` détenu par le proxy, ou marquer le type de retour comme éphémère. (b) transformer le delta par l'inverse de la matrice monde du parent (`WorldTransform2D` du parent, `Mat3.invert` existe), ou refuser explicitement un `CharacterController2D` sur une entité parentée.
