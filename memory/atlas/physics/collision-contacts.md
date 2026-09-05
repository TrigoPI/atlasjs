---
status: planned
summary: "Le point de contact remonte jusqu'aux scripts : 4e paramètre additif sur CollisionHandler, type Collision distinct côté gameplay, objet unique re-ciblé, disponible sur onCollisionEnter seul."
---
# Point de contact dans les événements de collision — Design (v1)

> **Statut : design tranché, non implémenté.** Ticket : [[PHYSICS-26-collision-contact-point]].
> Portée : `@atlasjs/inertia` (le contrat), `@atlasjs/rapier` (la lecture du manifold),
> `@atlasjs/gameplay` (le type exposé aux scripts). Consommation applicative dans `apps/bump-royal`.

Ce document **tranche**. Il ne compare pas d'options : le problème est posé dans
[[PHYSICS-26-collision-contact-point]], les décisions sont ici, et ce qui reste ouvert est isolé en
§6 sous une forme vérifiable à l'exécution.

---

## 1. Le contrat `@atlasjs/inertia`

Additif : un **quatrième paramètre**, donc aucun handler existant ne casse — `drainCollisions` reçoit
des fonctions à trois paramètres qui continuent de typer et de tourner à l'identique.

```ts
export interface ContactPoint {
  readonly point: Vec2;    // espace monde, unités du jeu (converti depuis les mètres rapier)
  readonly normal: Vec2;   // espace monde
  readonly impulse: number;
}

export type CollisionHandler = (
  a: Collider, b: Collider, started: boolean,
  contact: ContactPoint | null,
) => void;
```

`Vec2` est déjà importé par `inertial-type.ts` — aucune dépendance nouvelle.

## 2. Le contrat `@atlasjs/gameplay`

Un type **`Collision`, distinct de `ContactPoint`**, défini dans `@atlasjs/gameplay`. Ce n'est pas
une duplication gratuite : c'est l'argument central de [[PHYSICS-23-physics-query-script-service]] —
un `AtlasScript` n'a jamais eu à connaître `Collider`, `RigidBody` ni aucune abstraction du backend
physique, et le dispatch de collision est précisément le point où cette frontière tient aujourd'hui.
La faire fuiter pour économiser un type la casserait pour de bon.

Signature exposée :

```ts
onCollisionEnter?(other: GameEntity, collision: Collision | null): void
```

**La normale est retournée pour le second sens du dispatch.** `PhysicsCollisionSystem.update` appelle
`dispatch` deux fois par paire (`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:35-36`) ;
la normale livrée pointe **toujours de `other` vers soi**. Conséquence pour l'auteur de script :
`collision.normal` est directement la direction dans laquelle projeter un effet — reculer, éjecter de
la poussière, orienter un impact — sans avoir à deviner de quel côté de la paire il se trouve.

`onCollisionExit`, `onTriggerEnter` et `onTriggerExit` **gardent leur signature à un seul argument.**
Un second paramètre qui vaudrait `null` à tous les coups serait du bruit dans l'API et dans
l'autocomplétion, et suggérerait un contact récupérable là où il n'y en a jamais.

## 3. La table de vérité

C'est le cœur du document. Le type est nullable **parce que ce tableau existe**, pas par défensive.

| événement | contact disponible | pourquoi |
| --- | --- | --- |
| `onCollisionEnter` | **oui** | le manifold de la paire est interrogeable juste après `world.step` |
| `onCollisionExit` | **non** | la paire n'a plus de manifold au moment où l'événement sort |
| `onTriggerEnter` / `onTriggerExit` | **jamais** | un capteur produit une *intersection*, pas un contact |
| backend sans données de contact (`FakePhysicsWorld`) | `null` | le double ne simule aucun solveur |

La ligne des capteurs n'est **pas un choix d'implémentation, c'est une propriété du moteur
physique** : rapier ne calcule aucun manifold pour une paire dont un membre est un sensor. L'API le
dit dans ses types — `intersectionPair(c1, c2)` rend un `boolean`, là où `contactPair(c1, c2, f)`
rend un `TempContactManifold`
(`node_modules/.pnpm/@dimforge+rapier2d-compat@0.19.3/node_modules/@dimforge/rapier2d-compat/geometry/narrow_phase.d.ts:38-44`).
Aucun travail d'implémentation ne rendra un point de contact à un trigger ; un jeu qui en veut un
doit utiliser un vrai collider.

La dernière ligne est acquise et à assumer plutôt qu'à corriger :
`FakePhysicsWorld.emitCollision(a, b, started)`
(`packages/gameplay/test/helpers/fake-physics.ts:487`) appartient à la moitié « administrative » du
contrat, la seule qu'un double puisse tenir — cf. [[PHYSICS-20-audit-physics-fake-fidelity]], « la
limite dure ». Le faux passera `null`, et la couverture des données de contact appartient à la suite
rapier-only.

`null` a donc **un sens précis et énumérable** : « ce backend, ou cet événement, ne peut pas produire
de contact ». Il ne signifie jamais « ça a échoué ».

## 4. Durée de vie — le point le plus important

**Un unique objet, détenu par le système, re-ciblé avant chaque dispatch. Zéro allocation par
contact.** Le même arrangement des deux côtés de la frontière : une instance `ContactPoint` détenue
par `RapierPhysicsWorld`, une instance `Collision` détenue par `PhysicsCollisionSystem`, chacune
avec ses deux `Vec2` internes réécrits sur place.

**Le `Collision` reçu est valide pendant la durée du callback uniquement.** Un script qui veut le
conserver au-delà doit **copier** le point et la normale (`vec.clone()` ou `copyFrom` dans un `Vec2`
qu'il possède). Le modèle mental est un **event DOM poolé** : l'objet est prêté, pas donné.

Pourquoi ce choix et pas deux `Vec2` frais par contact, ce qui serait plus sûr :
[[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]] a **mesuré** que `createGameEntity` est
déjà la ligne la plus lourde du chemin collision, à **16 % des allocations** de la scène de mesure —
parce que le dispatch tourne **deux fois par paire de contact, à chaque sous-pas fixe**. Ajouter deux
`Vec2` frais par contact **et par sens** sur cette ligne exacte aggraverait la seule allocation que le
dépôt a déjà nommée comme problème. Le choix est fait en connaissance de la mesure, pas par réflexe.

**Le prix, nommé.** Ce contrat est **plus facile à violer** qu'un objet frais : rien dans le type ne
retient un script de stocker la référence, et la faute est silencieuse — la valeur change au contact
suivant, pas au moment de la faute. Deux conséquences obligatoires :

- la règle doit vivre **en JSDoc sur `Collision` et sur le paramètre de `onCollisionEnter`**, pas
  seulement dans ce document — c'est là que l'auteur de script la lira ;
- c'est la même réserve que GAMEPLAY-89 formule pour le handle réutilisé. Si les deux réutilisations
  sont adoptées, elles doivent être documentées **ensemble et de la même façon** : « ce que
  `onCollisionEnter` reçoit ne survit pas au callback ».

## 5. Quel point, quand le manifold en porte plusieurs

Une boîte contre une boîte en porte **2**. Le point retenu est celui de **`contactImpulse(i)`
maximal** — le point qui a réellement encaissé le choc, donc le plus juste visuellement pour un
impact, une poussière ou une décalque. Repli sur **l'indice 0** si aucune impulsion n'est disponible
(toutes nulles, ou `numContacts()` sans impulsions renseignées).

**Le piège d'indexation à vérifier à l'implémentation.** Le manifold expose deux espaces d'indices
distincts :

- `contactImpulse(i)` et `localContactPoint1(i)` s'indexent sur **`numContacts()`** ;
- `solverContactPoint(i)` s'indexe sur **`numSolverContacts()`**.

**Ce ne sont pas les mêmes espaces d'indices.** On ne peut pas lire une impulsion à `i` puis un point
solveur au même `i` : rien ne garantit qu'ils désignent le même contact, ni même que `i` soit valide
des deux côtés. Choisir un espace et y rester.

À noter aussi, deux détails de typage à traiter et non à supposer : `localContactPoint1(i)` rend
`Vector | null`, et `World.contactPair(collider1, collider2, f)` prend des **objets `Collider`
rapier**, pas des handles (c'est `NarrowPhase.contactPair` qui prend des handles). Le wrapper garde
le collider brut sous `RapierCollider.rapierCollider` (`packages/rapier/src/RapierCollider.ts:10`),
donc `drainCollisions` (`packages/rapier/src/RapierPhysicsWorld.ts:79-92`) a bien de quoi appeler
`World.contactPair` sans plomberie nouvelle.

## 6. Ce qui reste à vérifier à l'exécution, pas à supposer

Deux points que les `.d.ts` **ne tranchent pas** et sur lesquels aucune lecture de typings ne fera
office de preuve :

1. **`manifold.normal()` est-il en espace monde**, ou dans le repère local de la première forme ?
   Le voisinage immédiat de la méthode expose aussi `localNormal1()` et `localNormal2()`, ce qui
   *suggère* que `normal()` est la version monde, mais ne le prouve pas.
2. **La paire de contact est-elle encore interrogeable** au moment où l'événement `started` est
   drainé ? `drainCollisions` tourne après `world.step` ; que la narrow-phase ait conservé le
   manifold de la paire à cet instant est une hypothèse, pas une garantie documentée.

**La preuve attendue est une spec rapier réelle**, pas une relecture des typings : deux corps
dynamiques qui se percutent, et l'assertion que le point rendu **tombe sur le segment qui sépare les
deux centres**. C'est le test qui invalide les deux hypothèses d'un coup — une normale locale ou un
manifold vide produiraient un point manifestement hors segment.

L'outillage existe : `packages/rapier` a déjà vitest (`packages/rapier/vitest.config.ts`, dossier
`packages/rapier/test/`, sept specs qui tournent en Node pur). C'est aussi exactement la « suite
rapier-only » que [[PHYSICS-20-audit-physics-fake-fidelity]] appelle de ses vœux pour tout ce qui
demande un vrai solveur.

## 7. Conversion d'unités

Le point sort de rapier **en mètres** et doit repasser en unités monde via `PhysicsUnitConverter`
(`packages/rapier/src/PhysicsUnitConverter.ts`) — méthodes `vecToWorld` (`:24-28`) et
`vecToWorldInto` (`:30-35`). **Utiliser `vecToWorldInto`** : elle écrit sur place et rend le même
`Vec2`, elle existe précisément pour ne pas allouer, et c'est la seule compatible avec l'objet unique
de §4. `vecToWorld` alloue un `Vec2` neuf et réintroduirait exactement le coût qu'on refuse.

**La normale ne se convertit pas.** C'est une direction sans dimension : lui appliquer
`unitsPerMeter` la dénormaliserait. Elle est recopiée telle quelle. (Le seul défaut du dépôt étant
`unitsPerMeter = 1`, une conversion fautive de la normale serait **invisible dans toutes les apps
actuelles** — raison de plus pour l'écrire ici.)

## 8. Consommation applicative

`apps/bump-royal` devra **instancier un prefab one-shot au point de contact** pour y jouer sa
poussière. C'est la seule voie disponible : `ParticleEmitterConfig`
(`packages/nebula/src/graphics/particle-types.ts:66-90`) n'a **ni `offset` ni `origin`**, et
`emit(count)` est la seule signature d'émission
(`packages/gameplay/src/components/ParticleEmitter.ts:61`) — émettre ailleurs qu'au transform de
l'entité porteuse réclame donc une autre entité. La machinerie de prefabs est livrée, donc rien ne
bloque.

**L'alternative moteur est hors périmètre de cette feature.** Un `emitAt(count, x, y)`, ou un
décalage d'origine dans `ParticleEmitterConfig`, est un **ticket séparé** : il touche `@atlasjs/nebula`
et le composant `ParticleEmitter`, il a ses propres questions (interaction avec
`simulationSpace: "local"`, avec `shape`, avec le prewarm) et il n'a pas à être tranché pour que le
point de contact remonte jusqu'aux scripts. Le livrer ici mélangerait deux paquets de décisions
indépendants.

## 9. Décisions verrouillées

1. Quatrième paramètre **additif** sur `CollisionHandler` — aucun handler existant ne casse.
2. Type `Collision` **distinct** de `ContactPoint`, défini dans `@atlasjs/gameplay`.
3. Normale **retournée pour le second sens** : elle pointe toujours de `other` vers soi.
4. Contact sur **`onCollisionEnter` seul** ; les trois autres callbacks gardent un argument.
5. **Un objet unique re-ciblé**, valide pour la durée du callback, JSDoc obligatoire.
6. Point de **`contactImpulse(i)` maximal**, repli sur l'indice 0.
7. **`vecToWorldInto`** pour le point ; **pas de conversion** pour la normale.
8. L'origine d'émission de `ParticleEmitter` est un **ticket séparé**.

## 10. Non-objectifs

- Faire remonter un contact sur les triggers — impossible par construction (§3).
- Faire remonter un contact sur `onCollisionExit`.
- Exposer le manifold complet (tous les points, les impulsions tangentielles, les distances) : un
  seul point couvre le besoin constaté, et une API riche se conçoit sur un usage réel.
- Rendre `FakePhysicsWorld` capable de produire des contacts — cf.
  [[PHYSICS-20-audit-physics-fake-fidelity]].
- Ajouter une origine ou un décalage d'émission aux particules (§8).
