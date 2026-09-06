---
status: planned
summary: "Multijoueur en ligne de bump-royal : serveur Node headless autoritaire faisant tourner un vrai Engine Atlas, state sync à 20 Hz sans prédiction. Design cadré, non implémenté."
---
# bump-royal online — serveur autoritaire & state sync (V1)

> Statut : **design cadré, non implémenté.**
> Portée V1 : autorité serveur sur la physique, réplication d'état à 20 Hz, interpolation
> client, événements discrets. **Hors V1 : prédiction, réconciliation, rollback** — le
> protocole est taillé pour les accueillir, il ne les implémente pas.
> Tout vit dans `apps/bump-royal`. Rien n'entre dans `packages/` à ce stade.

---

## 1. Problème

`apps/bump-royal` est un sumo local à deux joueurs. Le knockback n'existe pas en tant que
code : deux disques dynamiques à `restitution: 1` et masses égales s'échangent leur quantité
de mouvement dans le solveur rapier, et `PhysicsPullSystem` relit la vélocité résultante dans
le composant que le script repilote ensuite. C'est la configuration (C) tranchée par
[[velocity-ownership]] §4.

Cette mécanique dicte la topologie réseau avant toute autre considération. **Une autorité
distribuée est impossible ici** : quand A percute B, la vitesse de sortie de B sort d'un
solveur unique. « Chacun simule son personnage et publie sa position » diverge au premier
contact, et le contact *est* le jeu. Il faut une seule autorité sur le monde physique.

Restent trois topologies viables, et une seule survit à l'examen :

| Piste | Pourquoi non |
|---|---|
| Lockstep déterministe P2P | [[scheduling]] établit que la sim **n'est pas bit-exacte** entre machines (clamp `dt` à 0,25 s + `maxSubSteps` qui *jette* du temps). Une divergence d'un ULP fait diverger silencieusement les deux parties. Demande d'abord le chantier déterminisme complet. |
| Host dans le navigateur | Marche, et partage le protocole retenu — mais le host a 0 ping et la partie meurt avec son onglet. Conservé comme repli, pas comme cible. |
| **Serveur Node headless** | **Retenu.** |

## 2. Ce qui rend le serveur headless possible aujourd'hui

Le repo **boote déjà un `Engine` Atlas complet en Node**, dans ses propres tests :
`packages/gameplay/test/helpers/harness.ts` et `packages/gameplay/test/determinism.test.ts`.
Un plugin `Provide` de quinze lignes et un stub de deux propriétés satisfont le
`requires: [NEBULA_RENDERER]` de `GameplayPlugin` :

```ts
const fakeNebula = { createSampler: () => ({}), scene: new SceneGraph() };
```

Le commentaire du test dit pourquoi c'est suffisant : *« The fixed lane never touches the
renderer (SpriteRenderSystem runs in the render lane) »*. `@dimforge/rapier2d-compat` inline
son wasm en base64, donc `RAPIER.init()` passe en Node en ~64 ms sans `fetch`.

Set de plugins headless vérifié par exécution :

```
NexusPlugin
Provide(NEBULA_RENDERER, fakeNebula)
HeadlessInputPlugin                       // provides INPUT + le step input:end-frame
InertialPlugin(new RapierPhysicsWorld({ unitsPerMeter: 100, gravity: Vec2(0, 0) }))
GameplayPlugin
```

Ni `AssetPlugin`, ni `AUDIO_ENGINE` (`AudioSystem` résout son moteur **paresseusement**, à la
première commande d'un `AudioSource`), ni gizmos, ni caméra.

Coût mesuré des trois lanes à 8 joueurs : **0,02 ms par frame** sur un budget de 16,67 ms,
dont 0,0006 ms pour la lane render qui tourne à vide sur le stub. Il n'y a rien à optimiser.

## 3. Décisions verrouillées

| Décision | Raison |
|---|---|
| Autorité **serveur Node headless** | Le bump est le solveur ; une seule autorité possible (§1) |
| Le serveur vit **dans `apps/bump-royal`**, pas en app sœur | Il importe les *mêmes* scripts que le client par chemin relatif. Une app sœur imposerait une dépendance app→app ou une fuite de logique de jeu dans `packages/` |
| **Une seule app**, mode local conservé + mode online | Le mode local devient la garde anti-régression de tout le refactor |
| **Rien dans `packages/`** en V1 | On n'abstrait pas avant d'avoir compris. `@atlasjs/net` s'extraira de ce qui aura survécu à une V1 jouable |
| **State sync, sans prédiction** | Trois fois moins de code, et une base honnête sur laquelle brancher la prédiction |
| **`tsx`** pour lancer le serveur | Un build `tsc` émet des specifiers ESM sans extension → `ERR_MODULE_NOT_FOUND`. `tsx` est zéro-emit et résout comme Vite |
| **JSON** sur le fil en V1, derrière un codec | 8 joueurs × 20 Hz ≈ 5 ko/s : le binaire n'achète rien de mesurable, et une trame lisible dans les devtools vaut plus que 60 % de compression pendant qu'on debug |

### Le coût assumé de « pas de prédiction »

Le joueur local est rendu depuis le flux serveur, donc avec **~100 ms de délai de rendu +
RTT/2**, y compris en localhost. Le dash part un dixième de seconde après l'appui.

Ne **pas** compenser en rendant le joueur local sans délai : sa position se désynchroniserait
de celles avec lesquelles il entre en collision, et les bumps se déclencheraient visiblement
au mauvais endroit. Le remède est la prédiction, et c'est pourquoi le protocole transporte
`t` et `ack` dès la V1. `RENDER_DELAY_TICKS` est une constante, réglable au playtest.

---

## 4. Architecture — la coupe simulation / présentation

```
src/game/sim/   ← Node-safe. Simulation pure. N'importe JAMAIS view/.
src/game/view/  ← client. Sprites, audio, particules. Peut importer sim/.
src/net/        ← protocole, codec, buffer. Pur, sans import moteur, testable en node.
src/server/     ← moteur headless, transport, room.
src/app/        ← shell React, inchangé.
```

Le garde-fou n'est pas une convention mais le compilateur : `tsconfig.server.json` déclare
`"lib": ["ES2022"]` **sans `"DOM"`** et `"types": ["node"]`, sur `include: ["src/server",
"src/game/sim"]`. Tout ce qui touche `window`, `document`, `AudioContext` ou un import
`@assets/*` sous `src/game/sim/**` **ne type-checke pas**. Pureté garantie gratuitement.

### 4.1 Les cinq scripts

| Script | Verdict |
|---|---|
| `PlayerMovementScript` | **sim** — cesse de lire `PlayerInput` |
| `PlayerFallScript` | **scindé** — la règle d'élimination et le masque de collider sont de la sim ; le scale-to-zero et le SFX sont de la présentation |
| `PlayerCollisionScript` | présentation — squish et poussière |
| `PlayerSoundScript` | présentation — sa formule de vitesse d'impact est extraite pour que le serveur calcule le même nombre |
| `PlayerEyesScript` | présentation — **et il requiert lui aussi `PlayerInput`**. Sur un client distant il n'a pas l'input des autres, donc il lit `PlayerStatus.facing` |

### 4.2 Les prefabs : deux builders, trois prefabs

`definePrefab` ne sait pas inclure un sous-prefab ([[GAMEPLAY-40-prefab-child-subprefab]]),
donc l'unité partagée est la fonction `build` elle-même.

| Prefab | Composition |
|---|---|
| `PlayerPrefab` (local) | `buildPlayerSim` + `buildPlayerView` + `PlayerInput` — le seul survivant de `PlayerInput` |
| `PlayerSimPrefab` (serveur) | `buildPlayerSim` seul |
| `PlayerViewPrefab` (client online) | `Transform2D` + `NetView` + `PlayerStatus` + `buildPlayerView`, **aucun rigidbody** |

---

## 5. Architecture — les deux seams

### 5.1 `MoveIntent` : un composant, pas une interface

Une interface demanderait un objet par implémentation attaché par entité, plus une stratégie
de résolution. Un composant est déjà par entité, déjà interrogeable, et — surtout — c'est
*la chose que l'applicateur de snapshot pourra écrire* quand la prédiction arrivera.

```ts
export class MoveIntent {
  public readonly direction: Vec2 = new Vec2(0, 0);
  public dash: boolean = false;          // front de CE tick, effacé par le consommateur
  public dashLatched: boolean = false;   // latch lane update, jamais lu par la simulation
  public tick: number = 0;
}
```

Un seul producteur par contexte, et jamais un script — l'ordre d'exécution dans `ScriptFixed`
est l'ordre d'attachement, une garantie qui n'existe pas. On passe par le scheduler, seule
autorité d'ordonnancement du moteur :

- offline : `LocalIntentSampler` en `update`/`Early` après `gameplay:player-input`, puis
  `commitIntents` en `fixed`/`PreSim` (100), strictement avant `ScriptFixed` (150) ;
- serveur : `applyNetIntents` en `fixed`/`PreSim`, depuis l'inbox.

Ces deux-là doivent être des **steps de scheduler bruts** et non des `NexusSystem` :
`registerSystem` ne transmet que `{ world, dt }`, jamais `ctx.tick`.

**Ce que ça fait à [[GAMEPLAY-29-input-fixed-lane-sampling]].** L'ambiguïté des fronts
n'existe que là où un consommateur de la lane `fixed` interroge un périphérique vivant. Le
serveur n'a pas de périphérique : il lit une valeur horodatée par le client, pas un front.
L'ambiguïté est structurellement absente, et la simulation devient une fonction pure de
`(tick, fixedDelta, MoveIntent)` — l'invariant que `packages/core/CLAUDE.md` réclame, satisfait
pour la première fois. Offline, l'ambiguïté demeure, mais tient désormais dans un seul fichier
de douze lignes au lieu d'être étalée sur deux `onUpdate`. L'item n'est pas clos ; il a
maintenant **un seul site d'appel** à remplacer.

**Ce que le déplacement n'est pas : identique au bit près.** `facing` était calculé dans
`onUpdate`, il l'est maintenant dans `onFixedUpdate` depuis l'intent. Les deux coïncident tant
que chaque frame porte au moins un tick fixe (≤ 60 fps). Au-delà, une frame peut n'en porter
aucun, et deux écarts d'une frame deviennent atteignables : une direction tenue une seule frame
puis relâchée laisse `facing` d'un échantillon en retard ; et un appui dash émis pendant une
chute, dans une frame sans tick fixe juste avant le respawn, est désormais latché alors qu'il ne
l'était pas (l'ancien `onUpdate` sortait tôt sur la chute, le sampler ignore la chute — et il le
doit, le serveur ne peut pas la connaître). Les deux cas demandent un appui-relâchement d'une
seule frame au-dessus de 60 fps. C'est le résidu assumé de
[[GAMEPLAY-29-input-fixed-lane-sampling]], que ce design contourne sans le clore.

### 5.2 `PlayerStatus` : l'état répliquable en un composant

Trois scripts se couplent aujourd'hui par `getScript(PlayerFallScript)`. Une référence de
script ne se réplique pas.

```ts
export class PlayerStatus {
  public falling: boolean = false;
  public fallElapsed: number = 0;
  public readonly facing: Vec2 = new Vec2(1, 0);
  public dashRemaining: number = 0;      // hors fil en V1 ; requis par la prédiction
  public cooldownRemaining: number = 0;  // idem
  public fallCount: number = 0;          // fronts, pour la moitié présentation
  public respawnCount: number = 0;
}
```

`fallCount` / `respawnCount` sont des **compteurs monotones, pas des détecteurs de
transition** sur `falling` : à 20 Hz une chute suivie d'un respawn peut boucler entièrement
entre deux snapshots, et un détecteur de front ne verrait rien. Même offline, une frame
portant vingt-et-un ticks fixes avalerait le front.

Sortir `facing`, `dashRemaining` et `cooldownRemaining` des champs privés de
`PlayerMovementScript` **maintenant** est le seul changement qui fera de la réconciliation
une écriture de composant plutôt qu'un second refactor de scripts. On le livre non répliqué.

---

## 6. Le protocole

- Tick serveur **60 Hz**. Snapshots **20 Hz** (`SNAPSHOT_INTERVAL_TICKS = 3`) : à 60 Hz on
  triplerait le nombre de paquets pour livrer un état que le client va de toute façon
  interpoler, pour une différence visible nulle à 100 ms de délai de rendu.
- Inputs produits à 60 Hz, envoyés à chaque frame client, portant les **trois dernières
  frames**. TCP transforme la perte en délai, pas en trou : cette redondance n'est pas contre
  la perte, elle est contre l'**onglet en arrière-plan** qui produit par rafales — et elle est
  ce dont un futur passage à WebTransport aurait besoin gratuitement.
- État répliqué par joueur : `x, y, vx, vy, a` et un bitfield `f` (`Falling`, `Dashing`).

| Champ | Répliqué | Justification |
|---|---|---|
| `x, y` | oui | non dérivable |
| `vx, vy` | oui | paie sa place trois fois : extrapolation sur paquet en retard, continuité de mouvement pour l'`AfterimageRenderer`, état de base pour la réconciliation |
| `a` (facing) | oui | **non dérivable de la vélocité** : après un bump la vélocité pointe où on t'a poussé, le facing où tu diriges. Le dériver ferait loucher tous les knockbacks |
| `f & Falling` | oui | autoritaire. La position *interpolée* du client peut encore être dans l'arène quand le serveur a déjà éliminé |
| `dashRemaining`, `cooldownRemaining` | non | rien ne les consomme en V1. Ils vivent dans `PlayerStatus`, donc la prédiction ajoutera deux champs de fil, pas un refactor |
| score, vies, manche | **rien n'existe** | [[APP-25-bump-royal-no-round-rules]] |

État complet, pas de delta : à 8 × 7 nombres la charge fait 250 octets, et le delta demanderait
une baseline par client plus une boucle d'ack fiable.

### 6.1 Pourquoi le bump est un événement serveur et non dérivé du client

Le contre-argument est réel et mérite d'être tué explicitement : pour deux cercles égaux le
point de contact **est** exactement `pa + r · normalize(pb − pa)`. Un client qui a les deux
positions peut le calculer. Le point est dérivable.

**Mais l'instant ne l'est pas.** Le client voit des positions à 20 Hz. Un bump de dash à
`dashSpeed = 700` se referme et se rouvre en deux ou trois ticks, soit **33 à 50 ms — moins
d'un intervalle de snapshot**. La collision tient donc entièrement entre deux snapshots, les
positions interpolées ne se recouvrent jamais, et un test client `distance < 2r` déclencherait
**zéro fois** sur le coup signature du jeu — tout en déclenchant à faux pendant les
extrapolations. Le serveur, lui, a déjà `collision.point` et `collision.impulse` : la feature
[[collision-contacts]], livrée le 2026-09-05, sert directement ici.

Les événements voyagent **dans** le snapshot (`e[]`), horodatés au tick, et le client les
**diffère jusqu'à son horloge de rendu** — le snapshot a 100 ms d'avance sur l'écran, appliquer
un bump à l'arrivée ferait partir le squish avant que les sprites se touchent.

La chute est un **état** (un client qui rejoint en cours de chute doit la rendre sans avoir
reçu l'événement) ; le respawn est un **événement**, parce que c'est une téléportation :
interpoler de hors-arène au point de spawn traînerait un fantôme rétrécissant en diagonale
sur toute la dalle.

---

## 7. Le client online

Aucun rigidbody, pas même pour le joueur local. `InertialPlugin` **reste installé** avec un
monde vide : `GameplayPlugin` le requiert, et un `NullPhysicsWorld` serait dix-huit méthodes
no-op qui dériveraient du contrat. Garder `gravity: Vec2(0, 0)` identique au serveur, pour que
le jour où la prédiction ajoute des corps le monde soit déjà configuré pareil — une gravité
divergente serait une divergence *silencieuse*.

`renderTick = baseTick + écoulé × 60 − RENDER_DELAY_TICKS`, avec `RENDER_DELAY_TICKS = 6`
(100 ms) : un intervalle pour toujours disposer d'un échantillon futur, un second de marge de
gigue. Extrapolation sur `vx/vy` plafonnée à neuf ticks puis **gel** — un fantôme qui s'envole
hors de l'arène se lit bien plus mal qu'un fantôme figé, et 150 ms à `dashSpeed` font déjà
105 unités sur une dalle large de 660.

---

## 8. Pièges vérifiés par exécution

1. **`new Engine()` throw en Node nu.** `@atlasjs/utils` référence `__DEV__`,
   `__CONSOLE_TRANSPORT__` et `__WEBSOCKET_TRANSPORT__` comme globales nues ; Vite les fournit
   par `define`, vitest aussi, Node non. Le serveur doit les installer **avant** de charger le
   moindre module Atlas.
2. **`ScriptManager` avale les exceptions de `onCreate`**, désactive le script et log. Combiné
   à `ServiceRegistry.get` qui throw, le bug le plus probable du projet est : un script sim
   appelle `getService(AudioApi)` → serveur sans audio → throw → script désactivé → **plus
   personne ne tombe de l'arène**, et le serveur continue de diffuser sereinement des joueurs
   qui glissent dans le vide. Aucun script sim n'appelle `getService`, et un test le vérifie.
3. **`@atlasjs/nebula-webgpu` échoue à l'import même en Node.** Il ne doit jamais entrer dans
   le graphe serveur. Tous les autres packages s'importent proprement.
4. **Une caméra crashe le stub** — `CameraSyncSystem` déréférence `renderer.camera`. Le serveur
   n'en spawne pas.
5. **Le dash est bufferisé, et [[velocity-ownership]] §13 affirmait le contraire.**
   `dashRequested` n'est remis à `false` que quand le dash part : appuyer pendant le cooldown le
   déclenche à la fin du cooldown. Faire de `MoveIntent.dash` un front consommé directement
   **supprimerait silencieusement ce buffer**. Le buffer reste dans `PlayerMovementScript` ;
   le doc a été corrigé.
6. **`Entity` encode une génération et les index sont recyclés** — jamais une identité réseau.
   `NetId` est un compteur serveur monotone, porté par un composant `NetPlayer`, avec une
   `Map<NetId, Entity>` des deux côtés.
7. **`maxSubSteps` laisse la dette dans l'accumulateur** : une pause GC de 200 ms laisse douze
   ticks de retard, rattrapés à cinq par frame pendant que les horloges clients divergent. Le
   champ moteur étant privé, on clampe le `dt` à `maxSubSteps × fixedDelta` **dans la loop
   factory de l'app**.
8. **`onCollisionEnter` part deux fois par paire**, à chaque sous-step. Le dédoublonnage
   réutilise `this.entityId > other.id`, la règle qu'emploie déjà `PlayerSoundScript`.
9. **L'objet `Collision` est prêté** ([[collision-contacts]] §4) : le collecteur lit
   `point.x/y` en nombres immédiatement. Le stocker mettrait N événements sur le dernier
   contact de la frame.
10. **Deux disques `restitution: 1` au même point explosent** à vitesse absurde. Le spawn est
    un round-robin sur huit points inscrits dans l'octogone, sautant tout slot à moins de
    `2 × COLLIDER_RADIUS` d'un joueur vivant.
11. **`tsx` n'honore de son `--tsconfig` que les `paths`.** Mesuré dans les deux sens sur
    tsx 4.23.13 : `target` et `useDefineForClassFields` sont **ignorés** — tsx épingle esbuild
    sur le Node courant et émet toujours la sémantique `define`. Ça coïncide avec le
    `useDefineForClassFields: true` de `tsconfig.app.json`, donc client et serveur s'accordent
    aujourd'hui **par coïncidence, pas par configuration** : si l'app repassait un jour à
    `false`, Vite changerait d'émission et tsx non, et les champs des `AtlasScript` divergeraient
    silencieusement entre les deux runtimes. Le garde-fou réel serait un test de non-régression,
    pas le flag. Le `--tsconfig` reste néanmoins load-bearing : il empêche tsx de découvrir un
    tsconfig porteur de `paths`, et `tsconfig.server.json` n'en déclare aucun — de sorte qu'un
    import `@assets/*` échoue **et** au typecheck **et** au runtime, au lieu d'un seul des deux.
12. **`pnpm --filter bump-royal server` ne lance pas le script** : `server` est une sous-commande
    native de pnpm et gagne. Toujours écrire `pnpm --filter bump-royal run server`.

### Passer la chute en lane fixed corrige trois choses d'un coup

`PlayerFallScript` tourne aujourd'hui en `onUpdate`. En lane fixed : la position lue est celle
que `PhysicsPullSystem` vient d'écrire ce tick (au lieu de ce qu'a laissé le dernier sous-step) ;
la durée de chute cesse de dépendre du framerate ; et `velocity.set(0, 0)` est écrit cinquante
points d'ancrage avant le push qui le consomme, au lieu de marcher par chance d'ordre de stages.

Corollaire : la double écriture de respawn de [[PHYSICS-25-teleport-dynamic-body]] devient
prouvablement morte sur la lane fixed — `PhysicsPullSystem` la réécrit dans le même tick. **On
la garde quand même**, avec un commentaire disant exactement cela : l'ordre des scripts dans
`ScriptFixed` est l'ordre d'attachement, et tout autre script fixe lisant la position entre 150
et 400 lirait la valeur d'avant le respawn.

---

## 9. Vérification

- **vitest dans `apps/bump-royal`**, qui n'en avait aucun ([[APP-24-bump-royal-no-test-infra]]
  est clos par la première tâche). Le bloc `define` du `vitest.config.ts` n'est pas du
  boilerplate : c'est le piège n°1 ci-dessus.
- La spec que [[APP-24-bump-royal-no-test-infra]] réclamait — le choix du taux après un bump —
  ne peut pas s'écrire au seam publié ([[GAMEPLAY-112-script-harness-cannot-drive-fixed-lane]]
  n'appelle jamais `onFixedUpdate`) : elle pilote un vrai `Engine`.
- **Spec de forme de prefab** : `PlayerSimPrefab` a les bons composants, n'a pas les composants
  de rendu, **et aucun script attaché n'est désactivé après 60 ticks** — le canari du piège n°2.
- **Test e2e node** avec un vrai client `ws` : `welcome`, `snap`, l'input fait avancer, un
  second client apparaît, sa fermeture produit un `leave`, cadence mesurée à 20 ± 2 Hz.
- **Navigateur, deux onglets** sur `?online=1`. Piège : `InputPlugin` cible le canvas, chaque
  onglet doit être cliqué avant que les touches répondent.
- Le **mode local sans query param est la garde anti-régression de toute la série**.

## 10. Séquencement

Dix commits. Les cinq premiers sont des refactors **sous le jeu local, qui reste jouable à
chaque commit** ; les suivants ajoutent du code serveur puis du code client derrière un flag.

1. Infra de test + suppression de l'alias `@bump-royal/*` — clôt [[APP-24-bump-royal-no-test-infra]]
2. Toolchain serveur : `tsx`, `tsconfig.server.json` sans DOM, les trois globales
3. `MoveIntent` — couper `PlayerMovementScript` de `PlayerInput`
4. `PlayerStatus` + scission du script de chute, passage en lane fixed
5. `buildPlayerSim` / `buildPlayerView`, les trois prefabs, l'arborescence `sim/` + `view/`
6. Moteur headless + boucle corrigée en dérive
7. Protocole + codec
8. Transport serveur, join/leave, snapshots
9. Client online : buffer, interpolation, spawn/despawn
10. Événements discrets : bump, chute, respawn

## 11. Hors périmètre

- **Prédiction et réconciliation** — la V2. Le protocole porte déjà `t` et `ack`, et
  `PlayerStatus` porte déjà l'état de dash qu'elle réclamera. Note : un client prédictif devra
  reproduire le passage de `collidesWith` à `0` pendant une chute, sinon il prédira des bumps
  que le serveur n'a pas eus et se réconciliera d'une secousse visible à **chaque** chute.
- **Driver de rollback** ([[CORE-04-rollback-driver]]) — reste une vision moteur. La V1 ne
  l'approche pas ; la V2 en aurait besoin.
- **Ids de composants stables** ([[CORE-03-component-registry-by-name]]) — non requis : l'état
  répliqué est écrit à la main, il n'y a pas de snapshot ECS générique. Le resterait pour
  [[GAMEPLAY-90-prefab-serialization]].
- **Sampling d'input déterministe en lane fixed** ([[GAMEPLAY-29-input-fixed-lane-sampling]]) —
  contourné, pas clos (§5.1).
- **Règles de manche** ([[APP-25-bump-royal-no-round-rules]]) — ne bloque pas, mais retire le
  chemin facile : sans manche, il n'existe aucun moment naturel pour ajouter ou retirer un
  joueur, donc join et leave doivent tous deux être traités **en pleine simulation**.
- **Encodage binaire, deltas de snapshot, reconnexion, mode replay** — après une V1 jouable.
- **Extraction d'un `@atlasjs/net`** — délibérément repoussée jusqu'à ce qu'on sache ce qui a
  survécu. C'est aussi pourquoi rien n'entre dans `packages/` ici.
