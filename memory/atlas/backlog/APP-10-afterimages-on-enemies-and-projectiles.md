---
id: APP-10
status: todo
domain: app
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# Rémanence sur les ennemis et les projectiles

`AfterimageRenderer` est générique : il n'exige qu'un `WorldTransform2D` et un `SpriteRender`, et il sait déjà survivre à la mort de son émetteur (chemin détaché). Seul le câblage manque pour en équiper autre chose que le joueur — un ennemi qui charge, un projectile rapide.

**Accroche :** un `entity.add(AfterimageRenderer, { … })` dans le prefab concerné suffit, plus ce qui bascule `emitting`. Le chemin détaché n'a par ailleurs **jamais été exercé en jeu** : dino-brawl n'a aujourd'hui aucun émetteur éphémère, donc il n'est couvert que par ses tests unitaires. Un projectile serait sa première validation réelle.
