---
status: implemented
shipped: 2026-09-05
summary: "Le point de contact remonte jusqu'aux scripts : 4e paramètre additif sur CollisionHandler, type Collision distinct côté gameplay, objet unique re-ciblé, disponible sur onCollisionEnter seul. Livré en entier, y compris la consommation applicative dans bump-royal."
---
# Point de contact dans les événements de collision — Design (v1)

> **Statut : implémenté** (2026-09-05), branche `feat/claude/collision-contact-points`, 6 commits
> `e66dcc4` → `ae7749b`. **Livré en entier, dans la portée annoncée :** `ContactPoint` et le 4ᵉ
> paramètre de `CollisionHandler` dans `@atlasjs/inertia` ; `RapierPhysicsWorld.resolveContact`
> (lecture du manifold, point d'impulsion maximale, conversion d'unités, orientation de la normale)
> dans `@atlasjs/rapier` ; le type `Collision` et `onCollisionEnter?(other, collision)` dans
> `@atlasjs/gameplay` ; et la poussière de bump partant du point d'impact dans `apps/bump-royal`.
> Couverture : 9 specs rapier contre le vrai moteur (`packages/rapier/test/collision-contacts.test.ts`)
> et 6 specs de routage côté gameplay ; vérifié en navigateur. **`PHYSICS-26` — « les événements de
> collision ne transportent aucun point de contact » — est livré par ce chantier et a donc quitté le
> backlog** : ce qu'il décrivait est implémenté, et tout ce qu'il portait (le contrat à élargir, le
> symptôme dans `bump-royal`, les tickets voisins) est repris ici.

Ce document **tranche**. Il ne compare pas d'options : le problème posé — un script sait *qu'il* a
heurté quelqu'un, jamais *où* — est rappelé ci-dessous, les décisions sont ici, et la §6 porte
désormais **ce que l'exécution a effectivement prouvé**, avec la manière dont ça l'a été.

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

**La normale livrée pointe toujours de `other` vers soi.** `PhysicsCollisionSystem.update` appelle
`dispatch` deux fois par paire (`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:35-36`) ;
la normale entrante allant de `a` vers `b`, c'est le **premier** sens (`self = a`) qui la retourne et
le second qui la reprend telle quelle. Conséquence pour l'auteur de script :
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

**Le `readonly` ne protège rien, et c'est établi à l'implémentation.** `ContactPoint` et `Collision`
déclarent bien `readonly point` / `readonly normal`, mais le `readonly` de TypeScript ne porte que
sur la **réassignation du champ** : il n'empêche pas de muter le `Vec2` pointé. Un script qui ferait
`collision.normal.set(…)` — ou `collision.point.add(…)` — corromprait la valeur que le **second sens
du dispatch** va lire dans la même frame, silencieusement et sans qu'aucun type ne bronche. Le
contrat « prêté, pas donné » est donc défendu par **la seule JSDoc**, ce qui rend le point précédent
obligatoire et non cosmétique. Rendre les `Vec2` réellement immuables demanderait un type de vue en
lecture seule dans `@atlasjs/math`, qui n'existe pas et qui est un chantier à part.

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

## 6. Ce que l'exécution a prouvé — et comment

Les deux points que les `.d.ts` ne tranchaient pas sont **tranchés**, contre le vrai moteur, dans
`packages/rapier/test/collision-contacts.test.ts` (9 specs). Ce sont désormais des faits ; ce qui
reste utile ici, c'est la **forme de la preuve**, parce qu'une preuve molle aurait laissé passer les
deux.

1. **`manifold.normal()` est en espace monde.** Prouvé par la spec « reports the normal in world
   space, not in the local frame of the first shape » : une boîte tournée à **45°** (`rotation:
   Math.PI / 4`, rotation verrouillée) percutée latéralement par une petite boîte. La normale rendue
   vaut `(±√½, ±√½)` — la diagonale monde de la face touchée. Une normale exprimée dans le repère
   local du losange aurait donné `(-1, 0)`, valeur que la spec exclut à 4 décimales. La spec
   contrôle en plus que le point tombe **sur le plan de la face tournée**
   (`-x·√½ + y·√½ ≈ 1`), donc point et normale sont vérifiés dans le même repère.
   **La scène tournée est ce qui fait la preuve** : sur deux boîtes alignées sur les axes, une
   normale locale et une normale monde sont numériquement identiques et le test ne discrimine rien.
2. **La paire est encore interrogeable au moment du drain.** `drainCollisions` tourne après
   `world.step`, et `World.contactPair` y rend bien un manifold non vide : toutes les specs de
   contact passent par ce chemin exact (`runUntilEvents` fait `step` puis `drainCollisions`) et
   assertent un `contact` non nul avec `impulse > 0`. La table de vérité de la §3 est vérifiée du
   même coup : `null` sur un sensor, `null` sur l'événement de fin.

**Une troisième preuve n'était pas prévue et a mordu : la conversion d'unités.** La spec « returns
the contact point in world units, not in metres » tourne à `unitsPerMeter = 100`, et surtout sur une
scène **décentrée**, dont le centre est à `5 m` / `500 unités` (`SCENE_CENTRE_METERS`). C'est
indispensable : sur une scène centrée à l'origine, mètres et unités monde sont **numériquement
confondus** — `0 × 100 = 0` — et une conversion absente passe le test. C'est le décalage qui rend la
spec discriminante, pas l'échelle.

**Ce que les specs ne prouvent pas, faute d'occurrence : `flipped` n'a jamais été observé à `true`
dans le chemin de production.** `drainCollisionEvents` livre les handles dans l'ordre interne de la
paire, donc le manifold arrive systématiquement non retourné. La gestion du cas existe bien — point
conservé, normale mirroir — et elle **est** testée, mais par **appel direct à `resolveContact`** avec
les colliders inversés (spec « keeps the point and mirrors the normal when rapier flips the
manifold »). Sans cette spec écrite exprès, casser la branche `flipped` serait resté **invisible** :
aucun scénario de bout en bout ne l'emprunte aujourd'hui. À traiter comme un contrat défendu par un
seul test, pas comme du code exercé.

L'outillage a suivi ce que [[PHYSICS-20-audit-physics-fake-fidelity]] appelait de ses vœux :
`packages/rapier` a déjà vitest (`packages/rapier/vitest.config.ts`, dossier `packages/rapier/test/`,
Node pur), et ces 9 specs sont exactement la **« suite rapier-only »** pour ce qui demande un vrai
solveur — le faux, lui, rend `null` par construction (§3).

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

**`impulse` non plus n'est pas converti — et c'est un trou assumé, pas un oubli.** L'impulsion sort
du solveur en unités rapier (kg·m/s) et est recopiée brute. Aucune conversion correcte n'est
disponible : `PhysicsUnitConverter` ne porte **qu'une échelle de longueur** (`unitsPerMeter`), le
dépôt n'a **aucune convention de masse** entre le monde du jeu et le monde physique, et une impulsion
mêle les deux. Conséquence à connaître avant de s'en servir : **à `unitsPerMeter ≠ 1`, l'impulsion
n'est comparable qu'au sein d'un même monde.** C'est un **seuil d'intensité local** utilisable tel
quel — « ce choc est-il plus fort que celui-là », doser une poussière, un son, un hitstop — jamais
une amplitude absolue transposable d'un monde d'échelle à un autre. La convention de masse manquante
est ce qu'il faudrait trancher avant de promettre plus.

## 8. Consommation applicative

`apps/bump-royal` doit **émettre depuis une autre entité que le joueur** pour jouer sa poussière au
point de contact. C'est la seule voie disponible : `ParticleEmitterConfig`
(`packages/nebula/src/graphics/particle-types.ts:66-90`) n'a **ni `offset` ni `origin`**, et
`emit(count)` est la seule signature d'émission
(`packages/gameplay/src/components/ParticleEmitter.ts:61`) — émettre ailleurs qu'au transform de
l'entité porteuse réclame donc une autre entité.

**Ce qui a été livré est une « ancre enfant »**, plutôt qu'un prefab one-shot : l'émetteur est
déplacé sur une **entité enfant** du joueur, que `PlayerCollisionScript` repositionne sur le point de
contact juste avant `emit()` (`apps/bump-royal/src/game/script/player/PlayerCollisionScript.ts`,
`placeDust`). Moins cher qu'une instanciation par choc, et ça réutilise la hiérarchie déjà livrée.
Deux propriétés du moteur le rendent possible, et **aucune des deux n'est un détail** :

- **L'approche ne tient que grâce à l'ordre des lanes.** `onCollisionEnter` part de la lane
  **`fixed`** (`PhysicsCollisionSystem`, stage `PhysicsWriteback`), `TransformPropagationSystem`
  tourne en **`update` / `Late`**, `ParticleEmitterSystem` en **`render` / `PreRender`**, et
  `ParticleEmitter.emit()` est **différé** — il n'incrémente qu'un `pendingEmit` que le système
  draine plus tard. La séquence effective dans une même frame est donc : ancre repositionnée →
  transform propagé → émission. **Si le dispatch de collision avait tourné dans la lane `update`
  après la propagation, l'approche ne marchait pas** : l'émission serait partie de la position de la
  frame précédente. C'est une dépendance à l'ordonnancement, pas une propriété de l'API — la
  redécouvrir coûte une session, et un déplacement de stage la casse silencieusement.
- **Le transform d'une entité enfant est local, échelle du parent comprise.** L'offset monde
  `contact − centre du joueur` ne peut pas être posé tel quel : il doit être **divisé par l'échelle
  du parent** avant d'être écrit dans le transform de l'enfant. Une simple translation donne une
  ancre décalée d'un facteur égal à l'échelle (3.5 chez `bump-royal`). Voir
  [[APP-26-dust-anchor-follows-player-squish]] pour la limite restante de cette division.

**L'alternative moteur est hors périmètre de cette feature.** Un `emitAt(count, x, y)`, ou un
décalage d'origine dans `ParticleEmitterConfig`, est un **ticket séparé** : il touche `@atlasjs/nebula`
et le composant `ParticleEmitter`, il a ses propres questions (interaction avec
`simulationSpace: "local"`, avec `shape`, avec le prewarm) et il n'a pas à être tranché pour que le
point de contact remonte jusqu'aux scripts. Le livrer ici mélangerait deux paquets de décisions
indépendants. Ticket ouvert : [[GAMEPLAY-120-particle-emit-origin]] — l'ancre enfant ci-dessus est
un contournement applicatif, pas la réponse moteur.

Un défaut de rendu croisé pendant la vérification navigateur et laissé de côté :
[[RENDER-33-particle-zero-radius-zero-speed]].

## 9. Décisions verrouillées

1. Quatrième paramètre **additif** sur `CollisionHandler` — aucun handler existant ne casse.
2. Type `Collision` **distinct** de `ContactPoint`, défini dans `@atlasjs/gameplay`.
3. Normale orientée **de `other` vers soi** : retournée au premier sens du dispatch, brute au second.
4. Contact sur **`onCollisionEnter` seul** ; les trois autres callbacks gardent un argument.
5. **Un objet unique re-ciblé**, valide pour la durée du callback, JSDoc obligatoire.
6. Point de **`contactImpulse(i)` maximal**, repli sur l'indice 0.
7. **`vecToWorldInto`** pour le point ; **pas de conversion** pour la normale, **ni pour l'impulsion**
   (§7 : aucune convention de masse n'existe).
8. L'origine d'émission de `ParticleEmitter` est un **ticket séparé**
   ([[GAMEPLAY-120-particle-emit-origin]]).

## 10. Non-objectifs

- Faire remonter un contact sur les triggers — impossible par construction (§3).
- Faire remonter un contact sur `onCollisionExit`.
- Exposer le manifold complet (tous les points, les impulsions tangentielles, les distances) : un
  seul point couvre le besoin constaté, et une API riche se conçoit sur un usage réel.
- Rendre `FakePhysicsWorld` capable de produire des contacts — cf.
  [[PHYSICS-20-audit-physics-fake-fidelity]].
- Ajouter une origine ou un décalage d'émission aux particules (§8).
