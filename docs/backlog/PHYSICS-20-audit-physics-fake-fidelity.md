---
id: PHYSICS-20
status: partial
domain: physics
effort: M
verified: 2026-08-25
---

# Fidélité du faux moteur physique à rapier — carte des écarts restants

`packages/gameplay/test/helpers/fake-physics.ts` est le double sur lequel repose toute la couverture du pont physique. **Quatre fois pendant le chantier d'août 2026, un bug réel s'est révélé intestable tant que le double n'avait pas été corrigé** — le double était plus permissif que le backend, donc le test aurait été vert des deux côtés : `3e7dcb2` (cascade de destruction absente), `b33950e` (position de collider locale au lieu de monde), `876165c` (`Vec2` neuf au lieu du scratch partagé), `edf4ffa` (propagation immédiate au lieu d'attendre le step).

Chaque écart de fidélité est un **angle mort en forme de bug**. Cette note porte l'audit méthode par méthode qui en cherche les suivants, mené le 2026-08-25 contre `packages/rapier/src/`, chaque écart sondé sur le vrai backend.

## Ce qui est réglé

**Le recyclage de handles n'était pas un danger — et la justification écrite était fausse.** Les commits `3e7dcb2`, `dbe53cb` et la version précédente de cette note affirmaient qu'un handle recyclé par l'arène rapier passerait la garde de `destroyCollider` et supprimerait le mauvais objet. Sondé sur rapier 0.19.3, deux fois indépendamment : les handles sont **générationnels**, encodés `(generation << 32) | index` et relus en `f64`. Un index recyclé repart avec une génération incrémentée, donc le `number` change, et `RapierPhysicsWorld` indexe par le handle **complet**. Un wrapper périmé donne `has() === false` — sortie anticipée, jamais un faux positif. Vérifié y compris sur le scénario adverse exact (ordre inversé **plus** un collider créé entre les deux, qui recycle l'index 0) : rien n'est supprimé à tort.

La prémisse n'est vraie que pour `RAPIER.World.getCollider(handle)`, qui ignore la génération — un chemin que le wrapper n'emprunte jamais. **L'ordre de retrait actuel reste préférable**, mais pour une raison plus simple : il ne présente jamais de référence périmée. Modéliser le recyclage dans le double ne ferait tomber aucun test et outillerait un danger inexistant.

**La garde manquante de `destroyRigidBody`** — trouvée en sondant ce qui précède — est corrigée par `f4d7fca` : un double appel paniquait le module wasm de façon irrécupérable.

## Ce qui reste, par priorité

**1. Le collider du faux ignore la rotation du body.** `FakeCollider.getTranslation` additionne simplement `bodyTranslation + offset`, et `getRotation()` renvoie la valeur locale figée au constructeur ; `RapierCollider` lit la pose **monde** composée par le solveur. Body en (100,50) rot=π/2, offset local (5,−3) : rapier donne `(103, 55)` et `1.8208`, le faux `(105, 47)` et `0.25`. C'est la suite directe de `b33950e`, qui n'avait corrigé le local/monde qu'en translation pure. Masque deux sites : `ColliderGizmoSystem` consomme précisément ces deux accesseurs, et `FakeCharacterController.computeMovement` calcule sa distance au mur depuis `getTranslation()` — donc les specs de `character-controller-hierarchy.test.ts` valident une géométrie qui n'est pas celle du vrai moteur dès qu'un parent tourne. Coût ~10 lignes. Prédiction : **0 test tombé** (tous les tests actuels sont à rotation 0), la valeur est de débloquer l'écriture de specs sur les entités tournées.

**2. Le `clear()` du faux ne détruit rien.** C'est un `Set.clear()`, là où celui de rapier repasse par ses propres méthodes de destruction. Les `afterEach(() => h.physics.clear())` de `collision-bridge.test.ts` et `physics-body-type-change.test.ts` n'exercent donc aucun chemin de destruction. À rendre fidèle **sans faire lever** : depuis `f4d7fca` le vrai backend est idempotent, donc faire lever le double verrouillerait un contrat que rapier ne tient pas.

**3. `FakeRigidBody.getTranslation()` rend l'état interne vivant** ; `RapierRigidBody` recopie dans un scratch. Écrire dans le vecteur retourné **déplace le body dans le faux** et est un no-op silencieux chez rapier. Aucun site ne le fait aujourd'hui — c'est un piège armé, pas un bug actif — mais c'est la troisième occurrence de la famille « identité d'objet » et elle coûte 4 lignes.

**4. Le `step()` du faux intègre tout le monde** : statiques, kinématiques, désactivés, et rien ne dort jamais (`isSleeping()` en dur à `false`, damping et `gravityScale` non modélisés). Sondé : rapier laisse un statique, un désactivé et un kinématique position-based à `x = 0` là où le faux les amène à 10, et endort un dynamique posé après ~200 pas. Le dégât est contenu — `PhysicsPullSystem` ne recopie que pour `dynamic` — mais le sommeil mord : `PhysicsPushSystem` écrit les vélocités chaque frame, ce qui réveille chez rapier, donc **ça marche par accident et rien ne protège cet accident**. Les gardes `type`/`enabled` coûtent ~6 lignes sans risque ; le sommeil est un modèle à part entière.

**5. `createCharacterController` ignore ses options.** `offset` et `slide` sont transmis par `PhysicsPushSystem` depuis `CharacterController2D` et jetés par le double. Sondé, le vrai backend en fait quelque chose de très visible : même mouvement diagonal contre un mur, `slide:true` → `(148.99, 100)`, `slide:false` → `(148.99, 37.25)`. Ces deux champs du composant ne sont couverts par rien — on peut les câbler à l'envers sans qu'un test bronche. Enregistrer les options pour permettre une assertion coûte ~5 lignes ; reproduire le vrai slide est hors de portée du double.

**6. `getLocalTranslation()` n'existe que dans le faux.** Absente de l'interface `Collider` et de `RapierCollider`. `collision-bridge.test.ts` assert dessus : l'intention est bonne (vérifier que `buildColliderDesc` passe l'offset local quand il y a un body) mais l'assertion passe par un accesseur que le vrai backend n'expose pas — elle vérifie le double, pas le pont. Les deux lignes suivantes, sur `getTranslation()`, couvrent déjà le fait observable.

**7. Tolérance aux objets étrangers** : rapier lève `Invalid RigidBody`, le faux fait un `Set.delete` muet. Réel mais improbable, il faudrait mélanger deux backends.

## Écarts vérifiés et jugés sans conséquence — ne pas ticketer

La précision f32 est **correctement modélisée** (`Math.fround` sur `friction`/`restitution`/`density`, sondé identique des deux côtés) : `PHYSICS-13` est bien refermé. Les groupes de collision par défaut correspondent. Les colliders sans body sont fidèles. La cascade `destroyRigidBody` → colliders est fidèle depuis `3e7dcb2`. `FakeCollider.getTranslation()` rend un scratch là où rapier alloue — le faux est *plus strict*, il ne peut produire qu'un faux rouge. `unitsPerMeter` n'est pas modélisé, mais toutes les applications tournent au défaut 1 ; le vrai risque est que le chemin `PhysicsUnitConverter` n'est couvert que par un seul fichier de test.

## La limite dure, à connaître avant d'investir

Le contrat `PhysicsWorld` a deux moitiés de nature différente. Une moitié **administrative** — créer, détruire, attacher, propager les poses, convertir — déterministe et entièrement spécifiable : c'est là que vivent les quatre bugs déjà payés et les sept points ci-dessus, et le double peut y être fidèle à 100 %. Une moitié **solveur** — `step`, `drainCollisions`, `computeMovement` en collide-and-slide, `query` : un double fidèle ici *est* un moteur physique.

`FakePhysicsWorld` tranche déjà honnêtement en faveur de la première (`query()` lève explicitement, les collisions passent par `emitCollision`). **C'est le bon choix, à ne pas renverser** — mais il a un prix qu'il faut nommer : `emitCollision` **ne fait pas partie du contrat**. Un test qui l'appelle affirme « supposons que le moteur signale ce contact », et cette supposition n'est validée nulle part. Sondé : les deux specs de dispatch de `collision-bridge.test.ts` construisent deux entités **sans `RigidBody2D`**, une configuration pour laquelle rapier **n'émet rien du tout**. Elles valident le routage, ce qui est réel et utile, mais un jeu où deux décors sans body sont censés se déclencher serait muet avec 100 % des specs vertes. Aucune fidélité ajoutée au double ne corrigera ça, par construction.

## La forme cible : deux suites, pas une

La suite de conformité évoquée dans la version précédente de cette note **est réaliste**, et `edf4ffa` l'a démontrée en miniature sans le savoir. `packages/rapier/test` tourne en Node pur, sans jsdom ni contexte graphique, en ~400 ms. Et `character-controller.test.ts` teste **le contrat `PhysicsWorld`**, pas rapier : il n'appelle que des méthodes de l'interface, `RapierPhysicsWorld` n'apparaissant que dans son helper `makeWorld()`. **C'est déjà structurellement une suite paramétrable** — extraire `makeWorld` en paramètre suffirait à l'exécuter contre les deux implémentations.

- **Noyau de conformité partagé**, exécuté contre le faux *et* rapier : cycle de vie et idempotence, composition de repères (translation **et rotation**), moment de la propagation, identité d'objet des getters, aller-retour f32.
- **Suite rapier-only** pour tout ce qui demande un vrai solveur : trajectoires, damping, sommeil, résolution de contacts, collide-and-slide, raycasts. Le faux ne peut pas les produire et ne devrait pas essayer. Y écrire aussi la **table de vérité des événements** par configuration de body — le tableau sondé pendant l'audit s'y transpose tel quel, et c'est ce qui refermerait le trou décrit ci-dessus.

**Accroche :** commencer par le point 1 (rotation du collider) — écart prouvé, sur un chemin de production réel, prédit sans casse. Puis le point 2 (`clear()`), qui conditionne la valeur de tous les `afterEach` existants.

**À rapprocher de :** [[GAMEPLAY-84-test-suite-hygiene]] — même sujet vu sous l'angle de l'outillage de test.
