---
id: PHYSICS-26
status: partial
domain: physics
source: "[[collision-contacts]]"
effort: M
verified: 2026-09-04
---

# Les événements de collision ne transportent aucun point de contact

Un script sait **qu'il a heurté quelqu'un**, jamais **où**. Le contrat s'arrête à l'identité de
l'autre entité, donc aucun effet ne peut être joué au point d'impact.

Le contrat, dans l'ordre de la chaîne :

- `CollisionHandler` (`packages/inertia/src/inertial-type.ts:96-100`) est
  `(a: Collider, b: Collider, started: boolean) => void`. Trois arguments, rien d'autre ne transite —
  c'est le goulot d'étranglement de toute la feature.
- `PhysicsCollisionSystem.update` (`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:23-39`)
  draine exactement ces trois arguments, résout les deux entités via `getUserData<Entity>()` (`:26-27`)
  et appelle `dispatch` dans les deux sens (`:35-36`). `dispatch` (`:41-72`) n'appelle
  `onCollisionEnter?(handle)` / `onTriggerEnter?(handle)` (`:60`, `:66`) qu'avec un `GameEntity` —
  **la seule information qu'un script reçoive d'un contact est l'identité de l'autre.**

**L'information existe déjà côté rapier et n'est jamais lue.**
`RapierPhysicsWorld.drainCollisions` (`packages/rapier/src/RapierPhysicsWorld.ts:79-92`) ne fait que
remapper `h1`/`h2` vers les wrappers `RapierCollider` de `this.colliders` et rappeler le handler.
Or `RAPIER.World.contactPair(c1, c2, (manifold, flipped) => …)` rend un `TempContactManifold` qui
expose `normal()`, `numContacts()`, `localContactPoint1(i)`, `contactImpulse(i)`,
`numSolverContacts()` et `solverContactPoint(i)` — typings dans
`node_modules/.pnpm/@dimforge+rapier2d-compat@0.19.3/node_modules/@dimforge/rapier2d-compat/geometry/narrow_phase.d.ts:46-69`.
Le wrapper garde bien le collider brut sous `RapierCollider.rapierCollider`
(`packages/rapier/src/RapierCollider.ts:10`), qui est ce que `World.contactPair` réclame — la pièce
manquante est un appel, pas une plomberie.

**Le symptôme dans le jeu.** `PlayerCollisionScript.onCollisionEnter`
(`apps/bump-royal/src/game/script/player/PlayerCollisionScript.ts:70-83`) fait
`this.dust.emit(this.dustBurst)` (`:82`) sur un `ParticleEmitter` qui est un composant **du joueur
lui-même** (`apps/bump-royal/src/game/prefabs/PlayerPrefab.ts:99`). La poussière part donc du centre
du joueur, jamais de l'endroit où les deux joueurs se touchent — et comme les deux sens du dispatch
tirent, on obtient deux bouffées centrées sur deux corps plutôt qu'une au point de choc.

**Et rien ne permet de contourner par l'émetteur.** `ParticleEmitterConfig`
(`packages/nebula/src/graphics/particle-types.ts:66-90`) n'a ni `offset` ni `origin` : la seule
géométrie d'émission est `shape`, centrée sur le transform de l'entité porteuse. `emit(count)` est la
seule signature d'émission (`packages/gameplay/src/components/ParticleEmitter.ts:61`,
`packages/nebula/src/graphics/CPUParticleNode.ts:329`) — aucun `emitAt` nulle part dans `packages/`.
Émettre ailleurs qu'au transform de l'entité réclame **aujourd'hui une autre entité**.

**Accroche :** `packages/inertia/src/inertial-type.ts:96-100` — le contrat à élargir, et le seul
point du dépôt qui décide de ce qu'un contact a le droit de transporter. Le design est tranché dans
[[collision-contacts]] : quatrième paramètre additif, objet unique re-ciblé, contact disponible sur
`onCollisionEnter` seul.

**À rapprocher de :** [[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]] — le dispatch est
déjà le chemin le plus alloueur du moteur (`createGameEntity` à 16 % des allocations du chemin
collision), ce qui interdit d'y ajouter deux `Vec2` frais par contact et par sens : c'est de là que
vient le choix d'une vue réutilisée.
[[PHYSICS-23-physics-query-script-service]] — exactement la même asymétrie, dans le même voisinage :
le mapping physique existe côté backend et ne remonte pas jusqu'aux scripts ; c'est aussi elle qui
porte l'argument de ne pas faire fuiter une abstraction physique dans du code de gameplay.
[[PHYSICS-20-audit-physics-fake-fidelity]] — `FakePhysicsWorld` appartient à la moitié
« administrative » du contrat et ne peut produire aucun manifold : son `emitCollision(a, b, started)`
(`packages/gameplay/test/helpers/fake-physics.ts:487`) rendra toujours un contact absent, ce que le
design doit assumer plutôt que corriger.
[[GAMEPLAY-116-particle-collision]] — lien réel mais **inverse**, à ne pas confondre : elle fait
réagir des particules déjà vivantes au monde ; ici il s'agit de savoir **où** les faire naître. Rien
de commun en implémentation.
