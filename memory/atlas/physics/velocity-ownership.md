---
status: implemented
summary: "Qui possède la vélocité, qui possède les contacts : les deux axes sont indépendants. bump-royal passe en dynamique piloté par la vélocité, dino-brawl reste kinematic + character controller, et le moteur porte les deux."
---
# Propriété de la vélocité — kinematic, dynamique, et qui écrit quoi (v1)

> **Statut : implémenté**, branche `feat/claude/inertial-movement` (5 commits `a818707` → `5d698b3`), **mergée dans `dev` le 2026-09-01, non poussée.** Livré : `Vec2.moveTowards`/`Vec2.lerp` dans `@atlasjs/math`, `onFixedUpdate(dt)` dans `@atlasjs/gameplay`, `lockRotation` de bout en bout (`@atlasjs/inertia` → `@atlasjs/rapier` → composant → bridge), et le modèle de mouvement inertiel de `apps/bump-royal`. Pendant de [[character-controller]], qui a livré l'autre configuration.

## 1. Vue d'ensemble — le vrai axe de décision

La question ne se pose pas comme « corps **kinematic** ou corps **dynamique** ». Elle se pose en deux
questions indépendantes :

1. **Qui possède la vélocité ?** Nous (le script l'écrit) ou le solveur (il l'intègre depuis des forces) ?
2. **Qui possède les contacts ?** Une requête que nous lançons (collide-and-slide) ou le solveur (il résout les pénétrations et échange la quantité de mouvement) ?

Les confondre est **l'erreur que ce document existe pour empêcher**. « Kinematic » n'est pas un
synonyme de « je pilote » et « dynamique » n'est pas un synonyme de « le moteur pilote » : la
configuration retenue ici est précisément *dynamique avec la vélocité écrite à la main*.

```
  @atlasjs/math           @atlasjs/inertia + @atlasjs/rapier     @atlasjs/gameplay (ECS + scripts)
  ┌─────────────────────┐   ┌────────────────────────────────────┐   ┌───────────────────────────────────────┐
  │ Vec2.moveTowards    │   │ RigidBodyDesc.lockRotation         │   │ RigidBody2D.velocity  (Vec2 stable)   │
  │ Vec2.lerp           │   │ RigidBody.setRotationLocked()      │   │ RigidBody2D.lockRotation              │
  │ (Vec2.clamp existe, │   │ RigidBody.isRotationLocked()       │   │ AtlasScript.onFixedUpdate(dt)         │
  │  non appelé ici)    │   │ RapierRigidBody :                  │   │ PhysicsPushSystem  --> écrit le corps │
  │                     │   │   lockRotations() + setAngvel(0)   │   │ PhysicsPullSystem  <-- lit (dynamic)  │
  └─────────────────────┘   └────────────────────────────────────┘   └───────────────────────────────────────┘

  apps/bump-royal : gravité du monde posée à Vec2(0, 0) · PlayerMovementScript porte le modèle
```

## 2. Les trois configurations

| | Vélocité | Contacts |
| --- | --- | --- |
| **(A)** kinematic + `CharacterController2D` | à nous | requête (collide-and-slide) |
| **(B)** dynamique + forces | au solveur | au solveur |
| **(C)** dynamique, vélocité écrite par nous | à nous | au solveur |

**(A) kinematic + `CharacterController2D`.** Ce que fait dino-brawl, et ce qu'il continue de faire
(voir [[character-controller]]). C'est aussi **exactement** ce qu'est le `CharacterController`
intégré d'Unity : il n'a pas d'`AddForce`, sa propriété `velocity` est en **lecture seule** et
rapporte le déplacement réellement obtenu par le dernier `Move()` — l'analogue précis de ce que
notre `CharacterController.move(delta)` renvoie et qu'aucun appelant ne lit. Chez Unity, la
poussée d'un autre corps s'écrit à la main dans `OnControllerColliderHit`. À noter : ce composant
Unity est **3D uniquement**, il n'a pas d'équivalent 2D.

**(B) dynamique + forces.** Écartée. « Lourd mais réactif » ne se règle pas contre un solveur qui a
déjà intégré avant qu'on lise, et un knockback qui doit parcourir **la même distance à chaque fois**
est très difficile à obtenir d'un solveur de forces.

**(C) dynamique, vélocité écrite par nous.** Ce que fait bump-royal désormais, et ce que font en
pratique les jeux Unity **2D**, puisque `Rigidbody2D` y est le seul outil : on écrit `velocity` à
chaque `FixedUpdate`, plus `linearDamping`, `gravityScale = 0` et `FreezeRotation`.

## 3. Pourquoi (A) ne peut pas porter un jeu de bump

Les corps kinematic de rapier **ne sont jamais poussés**. Deux joueurs kinematic se **bloquent**
l'un l'autre — le character controller sweepe contre le collider de l'autre — mais **aucun ne
transfère de quantité de mouvement** : A glisse le long de B, et B ne bouge pas d'un pixel.

Le bump devient donc un no-op qu'il faut écrire à la main, et un échange de quantité de mouvement
écrit à la main **se trompe dès que trois corps sont dans un tas**. Dans un jeu dont le nom *est* la
mécanique, c'est la mauvaise moitié à posséder.

## 4. Pourquoi (C) marche sans toucher au chemin de la vélocité

C'est le détail mécanique porteur de tout le reste. Le pont ECS ↔ physique fait déjà l'aller-retour :

```
  lane fixe, un pas :

  ScriptFixed (150)      script.onFixedUpdate(dt)
                             écrit RigidBody2D.velocity
          |
          v
  PhysicsRequest (200)   PhysicsPushSystem
                             body.setLinearVelocity(velocity.x, velocity.y)
          |
          v
  PhysicsStep (300)      InertialPlugin.world.step()
                             le solveur résout les contacts
                             et échange la quantité de mouvement
          |
          v
  PhysicsWriteback (400) PhysicsPullSystem
                             RigidBody2D.velocity.copyFrom(body.getLinearVelocity())
                             ^ corps dynamic SEULEMENT
```

`PhysicsPushSystem` écrit `RigidBody2D.velocity` dans le corps **à chaque pas fixe**, et
`PhysicsPullSystem` relit `body.getLinearVelocity()` dans le composant — **mais uniquement pour les
corps `dynamic`** (`packages/gameplay/src/systems/PhysicsPullSystem.ts:10` : un `return` précoce dès
que `rigidBody.type !== "dynamic"`). **L'aller-retour est ce qui fait porter au composant la vérité
d'après-collision**, et **passer le joueur en dynamique est ce qui allume la lecture.** Aucun
changement moteur n'a été nécessaire sur ce chemin.

Le pull utilise `copyFrom`, donc **l'identité du `Vec2` est stable** : le script peut garder la
référence obtenue une fois et la muter en place, ce qu'il fait (`velocity.moveTowards(...)`).

### 4.1 Le corollaire : on ne téléporte pas un corps dynamique par son `Transform2D`

L'aller-retour n'est **pas symétrique sur la pose**. `PhysicsPushSystem` ne pousse une translation
vers le corps que pour les types `kinematic` et `static`
(`packages/gameplay/src/systems/PhysicsPushSystem.ts`, branche
`rigidBody.type === "kinematic" || rigidBody.type === "static"`) : pour un dynamique, le corps est
placé **une seule fois**, à sa création, depuis le `Transform2D` du moment. Écrire
`Transform2D.position` ensuite ne déplace donc rien — le pull réécrit le composant depuis le corps au
pas suivant, et la valeur écrite disparaît sans erreur.

Repositionner un joueur (respawn, retour au centre) passe par `PhysicsBodyRef.body.setTranslation()`.
Trouvé en livrant la sortie d'arène de `apps/bump-royal`, où il faut **en plus** écrire
`Transform2D.position` dans la même foulée : sinon l'update suivant relit l'ancienne position, avant
que le pull n'ait eu lieu, et redéclenche la chute qu'on vient de terminer. Aucune API publique
n'exprime « téléporte ce corps » aujourd'hui — un script doit atteindre le composant du pont
([[PHYSICS-25-teleport-dynamic-body]]).

L'autre moitié du pont est en revanche bien re-synchronisée : `PhysicsColliderRef.sync(col)` tourne
sur chaque `(Collider2D, PhysicsColliderRef)` à chaque tour, et pousse tout champ modifié (`isSensor`,
`layer`, `collidesWith`, friction, restitution, densité). Muter `Collider2D` depuis un script marche
donc, et c'est ainsi qu'un joueur en train de tomber cesse de bloquer les autres
(`collidesWith = 0`).

## 5. Le modèle de mouvement

Par pas fixe, dans `apps/bump-royal/src/game/script/player/PlayerMovementScript.ts` :

```
target = dir̂ × maxSpeed
rate   = |velocity| > maxSpeed        ? overspeedDeceleration
       : |target|   >= |velocity|     ? acceleration
       :                                deceleration
velocity.moveTowards(target, rate × dt)
```

Trois propriétés sont **délibérées**. Un lecteur ne doit pas les « corriger ».

- **`maxSpeed` est la magnitude de la cible, jamais un clamp sur la vélocité.** Un knockback
  au-delà de `maxSpeed` serait effacé dès la frame suivante. `Vec2.clamp(max)` **existe**
  (`packages/math/src/Vec2.ts:64`) : il n'est pas appelé ici, et c'est le choix.
- **Le taux est choisi en comparant les magnitudes**, pas en demandant s'il y a de l'input. Le naïf
  `hasInput ? accel : decel` **inverse le ressenti après un bump** : tenir le stick dans le sens de
  son propre knockback sélectionne `acceleration`, qui étant le plus grand des deux vous arrête
  *plus vite* que de lâcher.
- **Pas d'epsilon.** `Vec2.moveTowards` atterrit **exactement** sur la cible quand la distance
  restante tient dans le pas (`if (dist <= maxDelta) { this.x = target.x; ... }`), donc la vélocité
  atteint exactement zéro et y reste.

La décélération **linéaire** a été choisie contre l'exponentielle pour la même famille de raisons :
elle donne un **temps d'arrêt fini** et une **distance de knockback calculable**, `v₀²/(2·decel)` —
une quantité qu'on peut concevoir sur le papier, ce qu'une courbe asymptotique n'a pas. Avec le
réglage actuel du prefab (`maxSpeed: 300`, `acceleration: 600`, `deceleration: 300`) : 0,5 s pour
atteindre la vitesse, 1 s pour s'arrêter, 150 unités de glisse.

## 6. La lane

Le modèle tourne dans `onFixedUpdate(dt)`, qui porte désormais le `fixedDelta` **brut, non mis à
l'échelle**. Le stage `ScriptFixed` (anchor 150) tourne **avant** `PhysicsRequest` (200)
(`packages/core/src/public/engine/Stages.ts`), donc une vélocité écrite là atteint le corps **dans le
même pas** — aucune latence à rattraper.

L'input reste échantillonné dans `onUpdate`, conformément à l'invariant de
`packages/gameplay/CLAUDE.md` : les edges sont vidés **par frame d'update**, et la lane fixe peut
tourner zéro, une ou deux fois par frame. D'où la forme du script : `onUpdate` normalise la
direction dans un `Vec2` membre, `onFixedUpdate` la consomme. Un sampling déterministe en lane
fixe reste ouvert : [[GAMEPLAY-29-input-fixed-lane-sampling]].

Choisir la lane fixe est aussi ce qui **garde possible un futur driver de rollback**
([[CORE-04-rollback-driver]]) : un modèle de mouvement posé sur la lane `update` le referme par
construction.

## 7. Ce que (C) a forcé à ouvrir

Un commit par brique.

- **`a818707` — `Vec2.moveTowards` et `Vec2.lerp`** (`@atlasjs/math`), que la classe n'avait
  simplement pas. Specs : `packages/math/test/vec2-move-towards.test.ts`,
  `packages/math/test/vec2-lerp.test.ts`. Le `lerp` porte un avertissement de framerate-dépendance
  en commentaire de doc, il n'est pas dans le chemin du modèle.
- **`e7cd093` — `onFixedUpdate(dt)`**, brut et non mis à l'échelle. Le raisonnement est consigné
  dans `packages/gameplay/CLAUDE.md` et **épinglé** par
  `packages/gameplay/test/script-fixed-dt.test.ts` (7 cas : le dt vaut `fixedDelta` à chaque pas ;
  une `TimeScale` d'entité ou héritée ne le change pas, même à 0 ; l'échelle **globale** change la
  *fréquence* de la lane, jamais la taille du pas). Voir [[scoped-time-and-timers]] : les timers de
  script restent sur la lane `update` uniquement.
- **`7f222d1` — `lockRotation`** de bout en bout : contrat (`inertia/RigidBody.ts`,
  `inertial-type.ts`), backend (`RapierRigidBody.setRotationLocked`, `map-rigid-body-desc.ts`),
  double (`packages/gameplay/test/helpers/fake-physics.ts`), composant (`RigidBody2D.lockRotation`) et bridge
  (`PhysicsPushSystem`).

  **La trouvaille rapier appartient à ce document** : `lockRotations()` met l'inertie inverse à
  zéro, donc il empêche une vitesse angulaire d'être **créée** mais **n'annule pas une valeur déjà
  présente** — un corps tournant à angvel 2 continuait de tourner indéfiniment après l'appel. Le
  chemin du desc et le setter auraient alors voulu dire **deux choses différentes pour un seul
  flag** ; les deux mettent désormais la vitesse angulaire à zéro quand ils verrouillent
  (`rapierBody.setAngvel(0, true)` dans le setter, `rb.setAngvel(0)` dans le mapper).

  Second piège, côté bridge : `PhysicsPushSystem` écrivait `setAngularVelocity` **inconditionnellement
  à chaque frame**, ce qui **réarmait un corps verrouillé** pendant que `isRotationLocked()`
  répondait `true`. L'écriture est maintenant sautée sous le verrou (`if (!rigidBody.lockRotation)`),
  le verrou étant l'intention la plus explicite des deux. Prouvé des deux côtés :
  `packages/rapier/test/rotation-lock.test.ts` (9 cas sur le vrai backend, dont « ne tourne pas
  quand un autre corps dynamique le frappe hors centre ») et
  `packages/gameplay/test/physics-rotation-lock.test.ts` (11 cas sur le bridge).
- **Gravité de monde nulle dans l'app** : `RapierPhysicsWorld` **défaut à la gravité terrestre sur
  Y** (`packages/rapier/src/RapierPhysicsWorld.ts:56-62`, `EARTH_GRAVITY` quand aucune gravité n'est
  passée), donc un top-down dynamique tombe sans arrêt. `apps/bump-royal/src/app/GameCanvas.tsx:50`
  construit le monde avec `gravity: new Vec2(0, 0)`. dino-brawl n'avait jamais eu à s'en soucier :
  son joueur est kinematic.

## 8. Décisions verrouillées

| # | Décision | Choix |
| --- | --- | --- |
| 1 | Axe de décision | **Qui possède la vélocité × qui possède les contacts**, pas « kinematic vs dynamique ». Les deux axes sont indépendants |
| 2 | Configuration bump-royal | **(C)** — corps `dynamic`, vélocité écrite par le script à chaque pas fixe, contacts au solveur |
| 3 | Configuration dino-brawl | **(A)** inchangée — kinematic + `CharacterController2D`, autorité `Transform2D` |
| 4 | `maxSpeed` | **Magnitude de la cible**, jamais un clamp sur la vélocité. Pas d'appel à `Vec2.clamp` dans ce chemin |
| 5 | Choix du taux | **Comparaison de magnitudes** — magnitude de la cible ≥ magnitude de la vélocité — jamais « y a-t-il de l'input ? » |
| 6 | Forme de la décélération | **Linéaire** — temps d'arrêt fini et distance de knockback `v₀²/(2·decel)` calculable. Pas d'exponentielle, pas d'epsilon |
| 7 | Lane | **`onFixedUpdate(dt)`** (stage `ScriptFixed` 150, avant `PhysicsRequest` 200) ; input toujours lu en `onUpdate` |
| 8 | `dt` de la lane fixe | **`fixedDelta` brut**, ni échelle globale ni `TimeScale` d'entité |
| 9 | Taux de virage séparé | **Refusé** — voir §12 |
| 10 | Rotation du joueur | **`RigidBody2D.lockRotation = true`**, le verrou remettant la vitesse angulaire à zéro |
| 11 | Décélération au-dessus de `maxSpeed` | **`overspeedDeceleration`**, troisième voie de la règle de taux, prioritaire. Sous-ensemble strict de l'ancienne branche `deceleration` — la marche est intouchée. Voir §13 |

## 9. La divergence entre les deux apps, dite clairement

**dino-brawl reste sur (A)** — sa marche, son dash et son knockback sont tous construits sur
`character.move()` avec `Transform2D` pour autorité, et ce sont ses **trois seuls** appelants :
`apps/dino-brawl/src/game/scripts/player/PlayerMovementScript.ts:56`,
`apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts:176`,
`apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts:111`. (Le hitstop, lui, ne passe pas
par `move()` : il vit sur l'échelle de temps — cf. [[scoped-time-and-timers]] — et son canal
`HitInfo.hitstop` reste d'ailleurs inerte par défaut, [[APP-22-hitinfo-hitstop-channel-is-write-only]].)
**bump-royal est sur (C).**

**Le moteur porte les deux et ne choisit pas.** C'est le résultat voulu, pas une dette. Les briques
sont dans les packages (`Vec2.moveTowards`, `onFixedUpdate(dt)`, `lockRotation`, l'aller-retour
push/pull), la politique est dans l'app.

## 10. (C) dissout largement `GAMEPLAY-64`

[[GAMEPLAY-64-movement-arbitration]] décrit l'arbitrage du déplacement entre scripts concurrents :
plusieurs scripts appellent `move()` sur la même entité sans se voir, et chacun **ajoute** son
déplacement.

Avec une **vélocité partagée que les scripts *orientent*** au lieu d'un déplacement que chaque
script *ajoute*, le trou se referme largement : un knockback devient `velocity += impulse`, et le
pilotage se contente de ramener la vélocité vers sa cible. Les scripts cessent de s'écraser les uns
les autres — ils écrivent tous dans le même état, dont la valeur courante est déjà la somme de ce
qui s'est passé.

**Dissous pour le modèle de bump-royal, pas pour celui de dino-brawl**, qui additionne toujours des
déplacements. Le ticket reste donc ouvert, et sa portée réelle est désormais « (A) uniquement ».

## 11. Mesuré, mais non vérifié

Deux choses sont livrées sans preuve, et il faut le savoir :

- **Le ressenti.** Le panneau de preview de bump-royal tourne à **4 fps**, ce qui étrangle
  l'accumulateur fixe. La **glisse est prouvée** (on relâche, le joueur continue et s'arrête), le
  **réglage** `0,5 s / 1 s / 150 unités` ne l'est pas. Voir [[sandbox-browser-verify-gotchas]].
- **La branche `|velocity| > maxSpeed`.** ~~Rien dans la scène ne peut la déclencher~~ — **plus vrai
  depuis le dash** (§13), qui pose la vélocité au-delà de `maxSpeed` et emprunte donc cette branche à
  chaque sortie de fenêtre. Elle est **couverte par une spec depuis le 2026-09-06** (cf.
  [[state-sync]]), et un knockback du solveur l'empruntera aussi
  ([[PHYSICS-24-momentum-exchange-on-bump]]).

## 12. Non-objectifs / backlog

- **Taux de virage séparé : décidé contre.** Un arc de virage large **est** le ressenti lourd ;
  ajouter un `turnRate` reviendrait à régler deux fois la même sensation, avec deux paramètres qui
  se contredisent. `moveTowards` sur le vecteur complet produit déjà l'arc.
- **Le bump lui-même n'existe pas** → [[PHYSICS-24-momentum-exchange-on-bump]] (restitution du
  solveur *ou* impulsion conçue, façon formule de knockback de Smash ; classes de poids atteignables
  dès aujourd'hui, cf. [[PHYSICS-22-rigidbody-mass-semantics]]).
- ~~**Aucune infra de test dans `apps/bump-royal`**~~ → **livré le 2026-09-06**, cf. [[state-sync]].
- **Le seam de test unitaire ne pilote pas la lane fixe** → [[GAMEPLAY-112-script-harness-cannot-drive-fixed-lane]], ce qui rend le modèle intestable là où un auteur de jeu testerait.
- **Les specs de `packages/math` ne sont pas type-checkées** → [[CORE-09-math-specs-not-typechecked]], trou trouvé en ajoutant `moveTowards`.
- Hors périmètre pour l'instant : `linearDamping`/`angularDamping` exposés sur `RigidBody2D`
  (aucun des deux n'est nécessaire tant que la décélération est explicite), `gravityScale` par
  corps (la gravité est nulle au niveau du monde), arbitrage générique du mouvement pour (A)
  ([[GAMEPLAY-64-movement-arbitration]]), et sampling d'input en lane fixe
  ([[GAMEPLAY-29-input-fixed-lane-sampling]]).

## 13. Le dash, et la troisième voie de la règle de taux

Le dash de `apps/bump-royal` est une **fenêtre sans contrôle** : au front de touche la vélocité est
**posée** à `facing × dashSpeed` (au-dessus de `maxSpeed`), et pendant `dashDuration` le script **ne
pilote pas du tout** — il rend la main. Le solveur garde donc la vitesse pleine sur toute la fenêtre,
ce qui donne deux propriétés : l'impact transfère la **totalité** de la quantité de mouvement, et un
bump reçu en pleine fenêtre **compose** au lieu d'être écrasé.

Le press est **latché dans `onUpdate`** et consommé dans `onFixedUpdate` — `isPressed()` est une arête
valable une frame d'update, donc la lire depuis la lane fixe la raterait ou la doublerait. Le latch
n'est effacé **que quand le dash part réellement** (`if (this.dashRequested && this.canDash())`), pas
à chaque passage : une lane fixe tournant deux fois dans la frame ne peut pas double-déclencher, le
press reste vivant si elle ne tourne pas du tout, **et un press émis pendant le cooldown est mis en
tampon jusqu'à l'expiration de celui-ci**. Cette troisième propriété est du feeling, pas un accident :
faire de la demande de dash une arête consommée à chaque tick la supprimerait silencieusement (voir
[[state-sync]] §8). La fenêtre et le cooldown sont comptés en **nombres bruts sur le `dt` fixe**, pas avec
`this.countdown(...)` : les timers de script n'avancent que sur la lane `update`, et une fenêtre
comptée là dériverait de la lane où le modèle tourne.

**Ce que la fenêtre ne borne pas, c'est la queue.** À sa fermeture la vélocité vaut encore
`dashSpeed`, et l'ancienne règle à deux voies la ramenait à `deceleration` — réglée pour la glisse de
marche. Le dash traînait alors `dashSpeed²/(2·deceleration)`, soit plus que la largeur du viewport
(~1270 unités) : caméra fixe, aucun mur, le joueur sortait de l'écran et paraissait partir à l'infini.

D'où la troisième voie. Mesuré, `dashSpeed = 700` et `overspeedDeceleration = 3000` : 8 pas fixes à
3000 amènent 650 → 300 en 0,133 s et 58 unités, puis `deceleration = 300` reprend en dessous de
`maxSpeed`, et la vélocité atteint **exactement 0** — repos à 350,8 unités, dans l'écran. La distance
de knockback reste calculable, en **deux segments** :
`(v₀² − maxSpeed²)/(2·overspeedDecel)` puis `maxSpeed²/(2·decel)`.

**Le caveat à assumer.** Cette voie est aussi celle qu'emprunte un knockback, et `3000` le fait
décroître **dix fois plus vite** que `deceleration` vers `maxSpeed`. C'est une version douce de
l'effacement de knockback que la décision #4 refuse à un clamp — moins brutale, mais de même nature.
Le jour où le bump devient une impulsion conçue ([[PHYSICS-24-momentum-exchange-on-bump]]), il faudra
soit assumer ce réglage, soit distinguer « je dashe » de « je me suis fait bumper » pour leur donner
deux taux.

Non borné par la règle de taux : **le cumul**. Deux dashs consécutifs dans la même direction sortent
encore du viewport. Ce que ça réclamait n'était pas un quatrième taux mais une **arène finie** —
livré le 2026-09-04, mais **par élimination plutôt que par des murs** : la sortie d'arène de
`apps/bump-royal` (`PlayerFallScript`) teste la position contre la forme de la dalle et fait tomber
puis respawner le joueur dès que son disque entier a franchi le bord. Le joueur ne part donc plus à
l'infini, et les quatre `Collider2D` sans body restent écartés — un mur rendrait le bord infranchissable,
ce qui retirerait au jeu son unique condition de défaite.
