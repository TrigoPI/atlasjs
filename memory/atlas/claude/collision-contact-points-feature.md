---
name: collision-contact-points-feature
description: "Le point de contact d'une collision remonte jusqu'aux scripts — livré sur feat/claude/collision-contact-points ; deux conventions de normale à ne pas confondre, objet prêté, et deux pièges de vérification réutilisables."
type: project
modified: 2026-09-05
---

Le 2026-09-05, livré **le point de contact des collisions jusqu'aux scripts** : branche
`feat/claude/collision-contact-points`, **6 commits `e66dcc4` → `ae7749b`**, non mergée. Design :
[[collision-contacts]] (`status: implemented`) — le lire avant de toucher à cette chaîne, il porte les
caveats, pas seulement le résultat.

**Où vit quoi**, de bas en haut :

- `@atlasjs/inertia` — type `ContactPoint` (`point` / `normal` / `impulse`) et **4ᵉ paramètre
  additif** `contact: ContactPoint | null` sur `CollisionHandler`
  (`packages/inertia/src/inertial-type.ts`). Additif : aucun handler à 3 paramètres ne casse.
- `@atlasjs/rapier` — `RapierPhysicsWorld.resolveContact` (privé, `RapierPhysicsWorld.ts:107-176`) :
  lit le manifold via `World.contactPair`, retient le point de `contactImpulse(i)` **maximale**,
  reconstruit la position monde depuis `localContactPoint1` + pose du collider propriétaire, convertit
  via `vecToWorldInto`. 9 specs contre le vrai moteur
  (`packages/rapier/test/collision-contacts.test.ts`).
- `@atlasjs/gameplay` — type `Collision` **distinct**, exposé aux scripts
  (`packages/gameplay/src/scripting/core/Collision.ts`), et
  `onCollisionEnter?(other, collision: Collision | null)`. 6 specs de routage. Le type est distinct
  exprès : un `AtlasScript` n'a jamais eu à connaître `Collider` ni `RigidBody`.
- `apps/bump-royal` — la poussière de bump part du point d'impact, via une **entité enfant**
  repositionnée avant l'émission (`PlayerCollisionScript.placeDust`).

**Les deux conventions de normale, à ne pas confondre** — c'est le seul piège d'API de la feature :

- `ContactPoint.normal` (moteur) va **de `a` vers `b`**, `a`/`b` étant les deux premiers arguments
  reçus par le handler ;
- `Collision.normal` (script) va **de `other` vers soi**. `PhysicsCollisionSystem` appelle `dispatch`
  deux fois par paire ; c'est le **premier** sens (`self = a`) qui retourne la normale, le second la
  reprend telle quelle. Un auteur de script n'a donc jamais à deviner de quel côté de la paire il est.

**Contrat d'objet prêté, des deux côtés.** Une instance `ContactPoint` détenue par
`RapierPhysicsWorld`, une instance `Collision` détenue par `PhysicsCollisionSystem`, re-ciblées avant
chaque dispatch : **zéro allocation par contact**, parce que ce chemin est déjà le plus alloueur du
moteur ([[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]], `createGameEntity` à 16 %).
L'objet **ne survit pas au callback** — pour le garder il faut copier `point` et `normal`. Et le
`readonly` du type **ne protège rien** : il interdit de réassigner le champ, pas de muter le `Vec2`
pointé, donc un `collision.normal.set(…)` dans un script corromprait silencieusement ce que le second
sens du dispatch va lire. Seule la JSDoc défend le contrat.

**Deux leçons réutilisables, bien au-delà de cette feature :**

1. **Un build tsdown vert ne prouve rien sur les types.** `tsdown` ne type-checke pas les corps de
   fonctions : `pnpm --filter rapier build` est passé au vert avec un `TS2554` dedans, et la
   régression n'est sortie qu'au `tsc --noEmit`. Corollaire trouvé dans la foulée : le
   `tsconfig.json` d'un package a souvent `"include": ["src"]`, donc **`test/` n'est pas type-checké**
   — `packages/gameplay` a un `tsconfig.test.json` séparé câblé sur son script `typecheck`, et c'est
   lui qui a révélé une erreur que le tsconfig principal ignorait. `packages/rapier`, lui, **n'a
   aucun script `typecheck`** : le lancer à la main. Écrit dans le `CLAUDE.md` racine.
2. **Une spec de conversion d'unités écrite sur une scène centrée à l'origine ne discrimine rien.**
   À l'origine, mètres et unités monde sont numériquement confondus — `0 × 100 = 0` — donc une
   conversion **absente** passe le test. Il a fallu décaler la scène à **5 m / 500 unités**
   (`SCENE_CENTRE_METERS` dans le fichier de spec) pour que le test morde. Même famille de piège pour
   les repères : une géométrie **alignée sur les axes** ne distingue pas une normale locale d'une
   normale monde ; la spec a dû tourner une boîte à **45°**, où une normale locale aurait donné
   `(-1, 0)` au lieu de la diagonale. **Généraliser : une assertion sur un changement de repère ou
   d'échelle doit tourner sur une configuration où l'identité et la vraie réponse divergent.**

Trois choses laissées ouvertes, à ne pas re-découvrir : `impulse` n'est **pas converti** (aucune
convention de masse dans le dépôt — seuil d'intensité au sein d'un même monde, jamais une amplitude
absolue) ; `flipped` n'a **jamais été observé à `true`** en production, sa branche n'est tenue que par
une spec en appel direct à `resolveContact` ; et l'ancre enfant de `bump-royal` ne tient que grâce à
**l'ordre des lanes** (`onCollisionEnter` en `fixed`, propagation en `update:Late`, émission en
`render:PreRender`, `emit()` différé). Tickets ouverts au passage :
[[GAMEPLAY-120-particle-emit-origin]], [[RENDER-33-particle-zero-radius-zero-speed]],
[[APP-26-dust-anchor-follows-player-squish]].
