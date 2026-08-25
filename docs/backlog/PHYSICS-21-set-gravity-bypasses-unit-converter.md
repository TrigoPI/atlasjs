---
id: PHYSICS-21
status: todo
domain: physics
effort: S
verified: 2026-08-25
---

# `setGravity` court-circuite le convertisseur d'unités

`packages/rapier/src/RapierPhysicsWorld.ts` — `setGravity` écrit directement dans `world.gravity`, **sans passer par `PhysicsUnitConverter`**, alors que les translations et les vélocités sont converties partout ailleurs dans la même classe.

Sondé : avec `unitsPerMeter: 100`, un `setGravity(0, -980)` se relit `-980`. La gravité est donc exprimée en **unités physiques** quand tout le reste de l'interface parle en **unités monde**. Deux repères dans le même objet, sans que rien ne le signale.

Aujourd'hui inoffensif — toutes les applications du dépôt tournent au défaut `unitsPerMeter: 1`, où les deux repères coïncident. C'est un piège armé pour le premier jeu qui changera l'échelle : sa gravité sera fausse d'un facteur `unitsPerMeter`, et le symptôme (« tout tombe cent fois trop lentement ») ne pointera pas vers `setGravity`.

Relevé pendant l'audit de fidélité du faux moteur ([[PHYSICS-20-audit-physics-fake-fidelity]]), mais ce n'est **pas** un écart du double : c'est un bug côté `packages/rapier`, que le faux ne modélise simplement pas.

Point d'attention plus large que le correctif lui-même : le chemin `PhysicsUnitConverter` n'est couvert que par **un seul fichier de test** dans tout le dépôt. Ce n'est pas assez pour une conversion qui traverse chaque translation, chaque vélocité et chaque requête — et c'est probablement pour ça que cet oubli a survécu.

**Accroche :** `RapierPhysicsWorld.setGravity` — la correction est une ligne, mais écris d'abord la spec qui échoue avec `unitsPerMeter` différent de 1, puis regarde si d'autres méthodes du fichier ont le même oubli.
