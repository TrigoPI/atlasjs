---
id: PHYSICS-24
status: todo
domain: physics
source: "[[velocity-ownership]]"
effort: M
verified: 2026-09-01
---

# Le bump lui-même n'existe pas — reste à trancher restitution du solveur ou impulsion conçue

`apps/bump-royal` a bien un joueur en corps `dynamic` piloté par la vélocité, mais la scène
(`apps/bump-royal/src/game/MainScene.ts`) ne contient **qu'un joueur et aucun autre collider** :
`spawnCamera` + `spawnPlayer`, rien d'autre. **Rien n'a donc jamais poussé quoi que ce soit.** Le
mécanisme central du jeu est intégralement devant nous.

Ce qui est **déjà en place** :

- Les contacts appartiennent au solveur — c'est tout l'intérêt du passage en dynamique
  ([[velocity-ownership]] §4) : l'échange de quantité de mouvement est gratuit, et
  `PhysicsPullSystem` rapatrie la vélocité d'après-collision dans le composant.
- `Collider2D` porte déjà `restitution` (défaut 0), `friction` (défaut 0.5) et `density`
  (défaut **0**) — `packages/gameplay/src/components/Collider2D.ts`.
- `RigidBody2D.mass` est **autoritatif** tant que `density` reste à 0, ce qui est le défaut du
  dépôt (mesure du 2026-09-01 dans [[PHYSICS-22-rigidbody-mass-semantics]]) : les **classes de
  poids sont atteignables aujourd'hui**, sans trancher d'abord la sémantique de `mass`.

Ce qui reste à **décider** : un bump est-il

- **la restitution du solveur** — gratuit, physique, chaotique ; deux `restitution` et deux `mass`
  suffisent à obtenir quelque chose qui marche ; ou
- **une impulsion *conçue***, sur le modèle de la formule de knockback de Smash (dégâts, poids,
  knockback de base, croissance → une vitesse et un angle de lancement). C'est cette seconde forme
  qui rend un bump **apprenable à la frame**, donc compétitif.

À noter : le modèle de mouvement a été **construit pour accepter l'un ou l'autre** — aucun clamp sur
la vélocité (`maxSpeed` n'est que la magnitude de la cible), et un taux choisi par comparaison de
magnitudes précisément pour que **tenir le stick dans son knockback ne le raccourcisse pas**.

**Accroche :** la sonde la plus économique est **un second corps dans la scène** — un mur statique
ou un second joueur — avant toute décision de design : la branche `|velocity| > maxSpeed` du modèle
n'a **jamais** été exercée, et c'est elle qui dira si l'aller-retour push/pull rend bien la vélocité
d'après-collision.

**À rapprocher de :** [[APP-24-bump-royal-no-test-infra]] — la branche en question ne sera pas
couverte par une spec tant que l'app n'a pas de suite de tests.
