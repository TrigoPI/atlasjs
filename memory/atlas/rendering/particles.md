---
status: implemented
summary: "Système de particules CPU livré et vérifié au navigateur ; le rendu à la vitesse réelle de l'effet n'est pas capturable."
---
# Nebula — Particules (simulation CPU, nuage instancié)

> Statut : **implémenté** (livré le 2026-09-04 sur la branche `feat/claude/cpu-particles`, non mergée, non poussée).
> Livré : tout ce que décrit ce document. 12 commits, `215` tests nebula et `598` tests gameplay verts, suite monorepo `27/27`.
> Vérifié navigateur : à 60 fps dans `apps/bump-royal`. Le nuage se monte, se simule et se dessine ; la forme `circle` disperse bien radialement ; le blend additif et la texture d'atlas sortent correctement ; le tri place la poussière au bon endroit. **`simulationSpace: "world"` est confirmé visuellement** — les particules restent en place pendant que le joueur s'éloigne, ce qui valide le rafraîchissement de `worldMatrix` de §6.2. Le déclencheur au bump est confirmé par une sonde source : `pendingEmit` vaut 14 après chaque impact et **jamais 28**, donc le drain par report fonctionne dans l'app.
> Non vérifié : **le rendu de l'effet à sa vitesse réelle.** Une gerbe de 0,22 à 0,4 s n'est pas capturable — le pane retombe à 4 fps dès qu'on le pilote, et l'effet se termine entre deux frames. Toutes les captures ont été prises avec un réglage volontairement exagéré (durée de vie 45 s, émission continue, tailles doublées), reverti aussitôt. Ça prouve le **chemin de rendu**, pas le réglage.
> Non mesuré : aucun chiffre de frame time. Les coûts de §7 sont arithmétiques, comptés dans le code.
> Portée : `@atlasjs/nebula` (nœud + renderer, backend-agnostic) + `@atlasjs/gameplay` (composant + système + plugin). **`@atlasjs/nebula-webgpu` n'est pas touché** — voir §2, c'est le résultat central de ce design.
> Contexte : deuxième brique de VFX du moteur après `memory/atlas/rendering/trails.md`, dont ce document suit le grain — un nouveau `NodeRenderer` branché sur la file de rendu commune, sans nouveau mécanisme de batching. `memory/atlas/rendering/renderer-architecture.md` §7.2 (E3) anticipait explicitement le cas : « un nouveau kind (text, particules) se branche sans toucher la machinerie de dispatch ».
> Décision renversée : la note backlog `GAMEPLAY-109` (`status: vision`, **sortie du backlog à la clôture de ce design**) argumentait **contre** ce chantier et exigeait de mesurer l'économie réelle avant d'écrire quoi que ce soit. Elle a été renversée sur décision de l'opérateur. §1.2 lui répond.

---

## 1. Objectif et périmètre

Offrir un `ParticleEmitter` de la facilité d'emploi de celui d'Unity : on pose le composant sur une entité, on décrit l'effet en données, et le nuage se simule et se dessine tout seul.

### 1.1 Périmètre v1

Émission (`rate`, `bursts` avec `cycles`/`interval`, `maxParticles`, `duration`, `looping`, `prewarm`) · formes d'émission (`point`, `circle` bord ou volume, `cone`, `box`, `edge`) · valeurs de départ en constante **ou** intervalle aléatoire (`startLifetime`, `startSpeed`, `startSize`, `startRotation`, `startColor`, `angularVelocity`) · rampes over-lifetime (`sizeOverLifetime`, `colorOverLifetime`, `velocityOverLifetime`, `angularVelocityOverLifetime`) · `gravity`, `drag` · `simulationSpace` local ou monde · `alignment` fixe ou aligné sur la vélocité · blend, sorting layer et order · animation de feuille de sprites (`overLifetime` avec cycles, ou `randomFrame`) · API `play`/`pause`/`stop`/`restart`/`emit(n)`/`clear` · détachement à la destruction de l'entité.

Hors périmètre, versé au backlog en §10 : noise, attracteurs, collision, sous-émetteurs, `emitOverDistance`, `inheritVelocity`, `limitVelocity`, backend GPU.

### 1.2 Réponse à `GAMEPLAY-109` (sortie du backlog) : ce qu'on économise réellement

L'étalon exigé par la note était `apps/dino-brawl/src/game/prefabs/fx/RunningParticlePrefab.ts:35-49`, où **une particule est une entité ECS complète**.

Le compte, par particule :

| | Avant (une entité par particule) | Après (SoA dans un nœud) |
|---|---|---|
| Entités | 1 `createEntity` + destruction symétrique | 0 |
| Composants | 4 insertions de store (`Animator`, `AudioSource`, `SpriteRender`, `Transform2D`) | 0 |
| Script | 1 instance + `ScriptHost` + `ScriptInstanceRecord` | 0 |
| Allocations | `PrefabEntityBuilder` + `GameEntity` handle + les composants eux-mêmes | **0** |
| État | réparti sur 4 stores | **56 octets** contigus (14 `Float32Array`, 4 o chacun) |
| Draw calls | 1 par particule sur un layer `ySorted` (les sprites s'intercalent par leur Y et ne fusionnent pas) | **1 par émetteur** |

L'économie est donc **structurelle, pas marginale** : le cycle create/destroy par particule disparaît entièrement, ainsi que le passage dans le lifecycle des scripts. C'est ce qui fait passer le plafond praticable de la dizaine de particules par seconde à quelques milliers simultanées.

**Ce compte reste arithmétique.** Il est lu dans le code, pas mesuré. La note demandait de compter, et c'est fait ; elle ne demandait pas un benchmark, et il n'y en a pas. Voir §7 pour ce qui n'est pas mesuré et [`RENDER-27`](../backlog/RENDER-27-pack-storage-array-buffer-reuse.md) pour le coût qui domine réellement.

---

## 2. Insight central : le nuage de particules est déjà un batch de sprites

`SpriteBatch.add(model, uvRect, tint)` prend **déjà une teinte par instance**, `WebGPUSpriteBatch` stocke déjà trois tableaux parallèles, et `sprite_instanced.wgsl` déclare déjà `struct Instance { model: mat4x4<f32>, uvRect: vec4<f32>, tint: vec4<f32> }`.

Et `TileMapBatcher` prouve déjà qu'**une seule `DrawCommand` peut porter N instances de sprite** (`models[] / uvRects[] / count`).

Il en résulte que les particules obtiennent un `kind` de draw command à elles — donc un draw call par émetteur, un culling propre et un tri propre — **sans une ligne de changement dans `@atlasjs/nebula-webgpu`** : pas de WGSL, pas de classe `WebGPU*Batch`, pas de méthode sur `ResourceFactory`, pas d'entrée dans `WebGPUBuiltinShaders`. Tout le code ajouté est du TypeScript pur, donc entièrement couvert par vitest.

C'est la propriété qui a dicté tout le reste du design, et c'est elle qu'il faut protéger : la struct d'instance allégée de [`RENDER-26`](../backlog/RENDER-26-particle-lean-instance-struct.md) l'abandonne délibérément, et ne doit être ouverte qu'une fois le gain mesuré — d'autant que le gain réel est plus modeste que la première estimation, voir §10.

### 2.1 Pourquoi CPU et pas GPU

Rien de ce qu'il faudrait n'existe : **aucune abstraction de compute** dans `nebula`/`nebula-webgpu` (zéro `@compute`, zéro `dispatchWorkgroups`), `WebGPUPipelineFactory.getStorageLayout` code en dur `visibility: VERTEX` + `read-only-storage`, et `WebGPUInstanceBufferPool` est un pool de scratch **remis à zéro à chaque `beginFrame`**, pas de l'état persistant. Une sim GPU demanderait un nouveau type de ressource **et** un nouveau type de passe dans le cœur backend-agnostique, plus un cycle de vie de buffers persistants.

Le facteur décisif est ailleurs : **une sim GPU n'est pas testable en vitest**, alors que chaque feature de ce dépôt est épinglée par des tests Node. Et le CPU garde les particules lisibles par le gameplay, ce qui met à portée trois features que le GPU rend difficiles — collision, attracteurs, sous-émetteurs. « À portée » et non « triviales » : l'accès aux données est acquis, mais **il n'existe aucune collision tilemap au niveau moteur** (`TileMap` n'a pas de notion de tuile solide, et `CollisionLayers` est un système de masques de filtrage, pas une grille), donc la collision reste un vrai chantier. Voir [`RENDER-31`](../backlog/RENDER-31-gpu-particle-simulation.md).

---

## 3. Le descripteur : données pures, sérialisables

`packages/nebula/src/graphics/particle-types.ts`. `ParticleEmitterConfig` a **tous ses champs optionnels** et ne contient **aucune fonction** : les easings sont des noms (`EasingName`) résolus dans le nœud, pas des callbacks. C'est ce qui permet à un futur backend GPU de consommer le même objet sans migration du modèle de données.

Sémantique Unity retenue : **une rampe over-lifetime multiplie la valeur de départ tirée au hasard**, elle ne la remplace pas. C'est pour ça que seules les valeurs initiales sont stockées par particule (`size = size0 × sizeRamp(t)`).

Les **ressources** (`texture`, `sampler`, table de rects UV) vivent **sur le nœud**, pas dans le descripteur — même ligne que `TileMapNode.texture` qui est hors de `TileMapNode.instances`. C'est cette séparation qui garde le descripteur sérialisable.

---

## 4. Couche nœud (`@atlasjs/nebula`, `graphics/`)

`CPUParticleNode extends Node`, calqué sur `TrailNode`. **La simulation vit dans le nœud** (`advance(dt)`), pas dans le système. Quatre raisons, par poids décroissant :

1. **Le chemin détaché devient gratuit.** Le mounted record du système ne copie **aucun réglage**, là où `MountedAfterimages` duplique sept champs parce que son chemin détaché n'a plus de composant à lire.
2. **La partie la plus mathématique est testable sans ECS ni renderer** — `new CPUParticleNode(config); node.advance(1/60);` puis on assert.
3. Les 14 `Float32Array` restent privés au nœud plutôt qu'exposés à travers une frontière de package.
4. Le renderer lit le nœud par accesseurs indexés, exactement comme `TrailNodeRenderer` lit `getPointX/getPointY/getPointAge`.

### 4.1 Disposition mémoire et recyclage

14 `Float32Array` de longueur `capacity` — `xs ys vxs vys ages lifetimes size0s rotations angularVelocities r0s g0s b0s a0s frames` — soit **56 octets par particule**, alloués une fois.

**Recyclage : swap-with-last.** Une particule morte à `i` est écrasée par celle en `aliveCount - 1`, puis `aliveCount--` et **`i` est re-testé sans être incrémenté** — sauter la particule échangée est le bug classique de ce schéma. Les tableaux restent denses, donc la boucle de rendu est un `for (i < aliveCount)` serré.

Contrepartie assumée : **l'ordre de dessin dans un émetteur n'est pas l'ordre de naissance.** Invisible en `additive`, négligeable pour un nuage à sprite unique avec une seule rampe d'alpha. Le correctif et son coût sont dans [`RENDER-29`](../backlog/RENDER-29-particle-stable-draw-order.md).

> **Piège.** Les tableaux SoA sont référencés à **cinq** endroits qui doivent rester d'accord : déclarations, allocation du constructeur, `setCapacity` (les `resize`), `kill` (les copies du swap), et l'écriture au spawn. Ajouter un tableau et l'oublier dans `kill` donne à une particule recyclée la valeur de la précédente — un scintillement aléatoire, pas une erreur. Un test doit échouer **indépendamment** pour chaque omission ; celui de `setCapacity` doit faire **grandir** la capacité puis spawner au-delà de l'ancienne borne, car les écritures hors bornes d'un `Float32Array` sont silencieusement ignorées et un test de shrink seul ne détecte rien.

### 4.2 `simulationSpace`

- **`world`** — l'offset échantillonné dans la forme est transformé par `worldMatrix` **au spawn** et la position **monde** est stockée. Déplacer l'émetteur ensuite ne traîne pas les particules déjà nées.
- **`local`** — l'offset local est stocké tel quel ; c'est le renderer qui composera avec `worldMatrix`.

Le système mirroir le TRS du nœud dans **les deux** espaces : en `world` la `worldMatrix` ne sert plus au rendu, mais elle reste **nécessaire au spawn**.

### 4.3 `applyConfig` et le seed

`applyConfig(config)` porte **tous** les défauts et le constructeur y délègue, pour que les valeurs par défaut n'existent qu'à un seul endroit — et surtout ne soient pas dupliquées de l'autre côté d'une frontière de package où elles dériveraient. Prix payé : les champs pilotés par la config sont en definite-assignment (`public duration!: number`), motif déjà établi dans le dépôt (`NebulaRenderer.scene!`, `WebGPURenderer.device!`, `Deferred.resolve!`).

Trois pièges dedans : `maxParticles` passe par son **setter** (qui redimensionne les pools), `gravity` est un `readonly Vec2` donc muté en place, et `bursts` passe par son setter à **garde d'égalité de référence** — d'où l'exigence que le composant ne clone jamais son config, sinon les bursts se réarment à chaque frame.

**`seed` est délibérément ignoré** : `rng` est semé à la construction, et réensemencer un émetteur en vol ferait sauter son flux aléatoire. Changer de seed exige un nouveau nœud. Voir [`GAMEPLAY-119`](../backlog/GAMEPLAY-119-particle-live-reseed.md).

### 4.4 Animation de feuille

La frame d'une particule est une **fonction pure de son âge normalisé**, calculée depuis `ages`/`lifetimes` — donc aucun objet d'animation par particule. Le descripteur ne porte que le **mode** (`overLifetime` avec `cycles`, ou `randomFrame`) ; la table plate de rects UV normalisés vit sur le nœud, parce qu'elle dérive des dimensions de la texture.

`SpriteAnimation` et `AnimationPlayer` ne sont **pas** réutilisés : ce sont des objets à état par instance (playhead, `elapsedMs`), et un par particule ferait des milliers d'allocations. `SpriteSheet` reste l'entrée d'**autorat** au niveau gameplay et n'atteint jamais le nœud.

Le mapping `overLifetime` **borne le pas avant le modulo**, pour que la dernière frame tienne au lieu de revenir à la première juste avant la disparition — un `floor(t × count × cycles) % count` naïf produit un aller-retour visible en fin de vie.

> **Contrainte d'ordre.** `setFrameRects` doit être appelé **avant** `play()`. En `randomFrame` la frame est tirée au spawn en lisant la taille de la table ; changer la table après coup ne redistribue pas les frames déjà tirées, et si elle rétrécit, ces particules retombent sur le rect plein.

---

## 5. Couche render (`@atlasjs/nebula`, `renderers/`)

`ParticleDrawCommand` (kind `"particle"`, `kindOrder = 4`) porte `models: ReadonlyArray<Mat4>`, `uvRects`, `tints` et `count`. Seule différence avec `TileMapDrawCommand` : la teinte est **par instance**.

`ParticleBatcher` se construit sur `renderer.createSpriteBatch()` et boucle `batch.add(models[i], uvRects[i], tints[i])`. `CPUParticleNodeRenderer` est enregistré en **fin** du tableau de `SceneRenderer` : `collect` s'arrête au premier `matches(node)`, et `CPUParticleNode` étend `Node` directement, donc aucun `instanceof` existant ne peut l'attraper.

`collect` fait **deux passes** : un bound bon marché sur les seules positions (avec marge dérivée de la plus grande taille, et pour l'espace local une transformation des **quatre coins** par `worldMatrix`, pas une par particule), puis la construction des instances.

Deux points sur lesquels se tromper coûte cher :

- **La matrice de base dépend de `simulationSpace`.** En `local` c'est `node.worldMatrix` ; en `world` ce **doit** être l'identité, puisque le spawn a déjà placé la particule en coordonnées monde — composer à nouveau appliquerait la transformée de l'émetteur **deux fois**, ce qui ne se voit que lorsque l'émetteur s'éloigne de l'origine.
- **Les pools d'instances ne sont jamais tronqués.** `count` est autoritatif et ni `ParticleBatcher` ni `RenderQueue` ne lisent la longueur des tableaux. `TileMapNodeRenderer` tronque parce que le nombre de tuiles est stable ; un nuage a un `aliveCount` qui oscille à chaque frame, donc tronquer réallouerait les `Mat4` jetés dès la remontée suivante. Les pools restent au high-water mark.

Le rect UV est assigné **par référence** (`data.uvRects[i] = node.getFrameRect(i)`), comme le fait `TileMapNodeRenderer` : zéro allocation, et il devient **structurellement impossible** qu'un index recyclé garde le rect de la particule précédente.

---

## 6. Couche gameplay (`@atlasjs/gameplay`)

### 6.1 Composant `ParticleEmitter`

LEVEL 1, dans `components/`, sans suffixe. **Aucune entrée dans `scripting/components/`** : rien d'autorité à router, pas de hiérarchie, pas d'état dérivé — un token behavioral serait la façade passe-plat que le vault a déjà consigné comme supprimée. Et pas d'alias identité non plus, puisque les alias existants (`RigidBody`→`RigidBody2D`, `SpriteRenderer`→`SpriteRender`) n'existent que pour blanchir un suffixe ; `ParticleEmitter` est déjà le nom propre, donc il suit `Animator` et `PlayerInput`.

**L'intention voyage sur trois canaux, pas un `command` unique** — un seul slot perd de l'information dès qu'un script agit deux fois dans la même frame :

- `play`/`pause`/`stop`/`restart` sont des **états** → `state`, idempotent, dernier gagne.
- `emit(n)` est **cumulatif** → `pendingEmit += n`. Deux `emit` dans une frame doivent s'additionner.
- `clear()` est un **one-shot** → le canal `command`, à l'identique de `TrailRenderer`.

`restart` existe parce que `state` est idempotent : sans lui, `play()` sur un émetteur déjà en lecture ne pouvait pas exprimer un re-déclenchement, alors que `CPUParticleNode.play()` sait très bien redémarrer.

`emit` **rejette un `count` non fini**. Sur un compteur cumulatif, un clamp `Math.max(0, x)` laisserait un seul `emit(NaN)` empoisonner `pendingEmit` **définitivement** (tous les `+=` suivants restent `NaN`, plus aucun burst, sans erreur) — et `Infinity` ferait boucler à l'infini un drain à boucle comptée. Le cas dangereux est l'inverse de celui qu'on anticipe.

`config` et `frames` sont stockés **par référence, jamais clonés** — cf. la garde de `bursts` en §4.3.

### 6.2 Système `ParticleEmitterSystem`

Squelette de `TrailRenderSystem` : `SparseSet` de nœuds montés, montage paresseux dans la scène nebula, `DetachedPool` pour qu'un émetteur détruit laisse ses particules finir. `detach` fait `node.stop()` — **pas** `clear()` : on coupe l'émission et on laisse mourir.

`DetachedPool` et `applySortFields` sont importés **par chemin relatif** : ils ne sont pas dans le barrel `rendering/`, et les deux autres render systems font pareil.

Deux détails d'ordonnancement portent l'étape :

- **`node.updateWorldMatrix()` avant `advance`.** Le nœud lit sa `worldMatrix` au spawn, mais `SceneGraph.updateWorldMatrices()` tourne dans `SceneRenderer.render()` au stage `Main`, **après** le step `PreRender` de ce système. Sans ce rafraîchissement, les particules naissent sur la transformée de la **frame précédente** : invisible sur un émetteur immobile, décalage net sur un émetteur rapide. Fragilité connue en cas de reparentage : [`RENDER-32`](../backlog/RENDER-32-particle-node-reparenting.md).
- **L'état s'applique sur transition seulement.** `node.play()` remet l'horloge à zéro, réarme les bursts et rejoue le prewarm. Le traduire naïvement à chaque frame collerait l'horloge à zéro : le prewarm boucle, et surtout **un burst à `time: 0` repart 60 fois par seconde**. Le mounted record garde donc le dernier état vu.

`pendingEmit` est drainé **avec report** (`floor` puis soustraction), pas remis à zéro, pour ne pas perdre les émissions fractionnaires.

Les `frames` sont validés comme partageant **une seule texture**, avec une erreur nommée et actionnable : le nœud n'en porte qu'une, et un tableau mixte dessinerait toutes les frames après la première depuis le mauvais atlas.

### 6.3 Échelle de temps par entité : oui

Le système multiplie `dt` par `timeScaleManager.scaleOf(entity)`, comme `AnimatorSystem` et **contrairement** à `TrailRenderSystem`/`AfterimageRenderSystem` qui utilisent le `dt` brut. Une gerbe d'impact qui continue de filer alors que son propriétaire est gelé par un hitstop se lit comme un bug. Le coût est d'un `scaleOf` mémoïsé **par émetteur** et par frame, court-circuité à `1` quand aucun `TimeScale` n'existe.

**Asymétrie assumée** : le pool détaché avance sur le `dt` brut, puisqu'une entité détruite n'a plus d'échelle à lire (`scaleOf` renvoie `1` pour une entité inexistante de toute façon). Donc *geler l'émetteur → les particules s'arrêtent ; détruire l'émetteur → elles reprennent à pleine vitesse*. Épinglé par un test pour que ça se lise comme une décision.

### 6.4 Câblage plugin

Sept points de contact dans `GameplayPlugin`, ceux que trail et afterimage occupent déjà : les deux imports, le champ privé, la construction dans `install`, `defineComponents`, le hook `onRemove` → `detach`, le step du scheduler (`render`/`PreRender`, `after: "gameplay:afterimage-render"`), et le `clear()` dans `uninstall`. **Le champ privé et le `clear()` comptent autant que le reste** : sans eux, chaque nœud détaché fuit à la réinstallation du plugin.

---

## 7. Performance

Par particule et par frame, **zéro allocation** :

- **simulation** : ~12 accès à des typed arrays, ~20 flops, 0 à 4 appels de rampe.
- **rendu** : un `Mat4.copy().translate().rotateZ().scale()` sur une `Mat4` préallouée — dont **deux appels transcendantaux** (`sin`/`cos`) — plus deux écritures de `Vec4`.
- **upload** : **96 octets** (`mat4` 64 + `uvRect` 16 + `tint` 16).
- **draw calls** : un par run `(kind, texture, sampler, blend)`, donc un par émetteur sur un layer `ySorted`.

**Le vrai point noir n'est aucun de ceux-là.** `BindingGroupLayoutHelper.packStorageArray` alloue un `ArrayBuffer(stride × count)` **neuf à chaque appel**, soit une fois par batch instancié et par frame. À 5 000 particules : 480 ko/frame, ~29 Mo/s de déchets. C'est [`RENDER-27`](../backlog/RENDER-27-pack-storage-array-buffer-reuse.md), et c'est la **première** optimisation à sortir — avant toute idée de GPU. Elle bénéficierait d'ailleurs aussi aux sprites, shapes, tilemaps et trails.

Deux allocations résiduelles subsistent dans `collect` : la clé matériau construite en template string par nœud et par frame ([`RENDER-30`](../backlog/RENDER-30-batch-key-string-per-frame.md), dette héritée de `TileMapNodeRenderer` — `SpriteRenderer` passe par un `createMaterialKey` privé, et `ShapeRenderer`/`TrailNodeRenderer` n'appellent pas `getBatchId` du tout), et la croissance des pools tant que le high-water mark n'est pas atteint.

**Plafond estimé : ~5 000 particules comme cible de design, ~20 000 là où ça casse visiblement.** Ces nombres sont **arithmétiques, jamais mesurés dans ce dépôt** — c'est la limite honnête de ce document. À surveiller aussi : `WebGPUInstanceBufferPool` ne rétrécit jamais ([[RENDER-22-instance-buffer-pool-shrink]]), donc un burst unique de 20 000 particules épingle ~1,9 Mo de buffer GPU définitivement.

### 7.1 Tri : limite structurelle

Une `ParticleDrawCommand` par émetteur ⇒ **le nuage entier se trie comme un bloc**, à un seul `(layer, primary, secondary)`, c'est-à-dire au Y de l'émetteur sous un layer `ySorted`. Les particules ne s'intercalent ni entre elles ni avec les sprites *à l'intérieur* du nuage.

Les rubans ont la **même forme structurelle** — `TrailRenderSystem` passe aussi `position.y` à `applySortFields` — mais attention, ce n'est **pas** ce que `trails.md` §7 consigne : ce paragraphe-là observe l'inverse, que les trails s'intercalent bien avec les sprites par leur Y et ne fusionnent donc quasi jamais en un seul draw. C'est une remarque sur les draw calls, pas sur la justesse du tri. La limite « un ruban se trie comme un bloc » n'est écrite nulle part et devrait être ajoutée là-bas.

La conduite pratique est de mettre les FX sur un layer **manuel**. Le vrai correctif est [`RENDER-28`](../backlog/RENDER-28-particle-ysort-bucketing.md).

---

## 8. Tests et validation

`215` tests dans `@atlasjs/nebula` (dont `CPUParticleNode`, `CPUParticleNodeRenderer`, `CPUParticleSheet`, `CPUParticleNodeApplyConfig`), `598` dans `@atlasjs/gameplay` (composant, système, câblage plugin). Suite monorepo `27/27`.

Les tests des render systems tournent **sans `Engine`** : `NexusWorld` nu, vrai `SceneGraph`, `NebulaRenderer` stub casté — motif de `trail-render-system.test.ts`.

Chaque étape a été **mutation-testée** : la correction est cassée dans la source, le test attendu doit tomber, puis restauration vérifiée bit-identique (`diff -q`). Ce qui a été validé ainsi : la troncature des pools, le clamp de fin de vie de la feuille, `frames` dans `kill` et dans `setCapacity`, `updateWorldMatrix`, la détection de front sur l'état, `gravity.set`, le report fractionnaire, le seeding du blend, `restart`, et l'enregistrement du step.

> **Deux pièges de test rencontrés, à ne pas rejouer.**
> 1. **Un test plugin doit importer depuis `../src/`, pas depuis `@atlasjs/gameplay`.** Le harness construit `GameplayPlugin` depuis les sources ; passer par le nom du package donne une **seconde identité de classe** pour le même composant, donc `defineComponent` enregistre un objet et le test en passe un autre aux systèmes — aucune requête ne matche, sans la moindre erreur. `occluder-plugin.test.ts` importe depuis le package **et passe**, parce qu'il ne vérifie qu'un `typeof` et un `addComponent` qui ne throw pas : un test peut donc passer pour la mauvaise raison.
> 2. **Un test de shrink ne prouve pas qu'un tableau SoA est redimensionné** — voir l'encadré de §4.1.

**Ce qui n'est pas validé** : tout ce qui passe par un GPU. Aucune image n'a été produite. Le blend, l'atlas et les rects UV normalisés ne sont vérifiés que contre un stub casté.

---

## 9. Découpage de livraison

Un commit par étape, sur `feat/claude/cpu-particles`.

| # | Commit | Contenu |
|---|---|---|
| 0 | `chore(nebula): typecheck the test directory` | `tsconfig.test.json` — le dossier `test/` de nebula n'était typechecké nulle part |
| 1 | `feat(nebula): simulate particles on the CPU in a scene node` | `CPUParticleNode` + `particle-types` |
| 2 | `feat(nebula): draw a particle cloud through the sprite batch` | le kind `particle` |
| 3 | `feat(nebula): play a sprite sheet over a particle's lifetime` | animation de feuille |
| 4 | `feat(gameplay): add a ParticleEmitter component` | le composant |
| 5a | `feat(nebula): apply a config to a live particle node` | `applyConfig` |
| 5b | `feat(gameplay): mount and drive particle emitters` | le système |
| 6 | `feat(gameplay): register the particle emitter system` | câblage plugin |
| 7 | `feat(bump-royal): puff dust when two players bump` | démo + vérification navigateur |

L'étape 7 a été livrée après que l'opérateur ait commité son travail en cours sur les cinq fichiers qu'elle touche.

> **Piège rencontré à la vérification.** La première tentative réutilisait `shadow.png` comme sprite de poussière : **rien ne s'affichait**, ce qui ressemble trait pour trait à un chemin de rendu cassé. Un sprite quasi vide n'ajoute presque rien en blend additif. Le diagnostic tient à une seule manipulation : remplacer la texture par une dont la visibilité est certaine, sans rien changer d'autre. Les particules sont apparues immédiatement, ce qui a déplacé le soupçon du pipeline vers l'asset. Un `dust.png` généré (dégradé radial blanc 16×16, 246 o) a réglé le cas.

---

## 10. Suites naturelles (hors périmètre)

Rendu :

- [`RENDER-26`](../backlog/RENDER-26-particle-lean-instance-struct.md) — struct d'instance allégée, quad composé en VS. Attention au chiffre : un `{pos, size, rotation, uvRect, tint}` naïf tombe à **64 o** sous l'alignement WGSL (`vec4` s'aligne sur 16, d'où 12 o de padding après `rotation`), pas 48. Les 48 o exigent un regroupement explicite et une teinte packée en `unorm8x4`.
- [`RENDER-27`](../backlog/RENDER-27-pack-storage-array-buffer-reuse.md) — réutiliser le buffer de `packStorageArray`. **La première à sortir.**
- [`RENDER-28`](../backlog/RENDER-28-particle-ysort-bucketing.md) — découper un nuage en *k* commandes Y-bucketées.
- [`RENDER-29`](../backlog/RENDER-29-particle-stable-draw-order.md) — ordre de dessin stable dans un émetteur.
- [`RENDER-30`](../backlog/RENDER-30-batch-key-string-per-frame.md) — la clé de batch allouée par frame.
- [`RENDER-31`](../backlog/RENDER-31-gpu-particle-simulation.md) — simulation GPU et l'abstraction compute manquante.
- [`RENDER-32`](../backlog/RENDER-32-particle-node-reparenting.md) — fragilité du pré-calcul de `worldMatrix` au reparentage.

Gameplay :

- [`GAMEPLAY-114`](../backlog/GAMEPLAY-114-particle-noise.md) — noise / turbulence.
- [`GAMEPLAY-115`](../backlog/GAMEPLAY-115-particle-attractors.md) — attracteurs et champs de force.
- [`GAMEPLAY-116`](../backlog/GAMEPLAY-116-particle-collision.md) — collision tilemap et rapier.
- [`GAMEPLAY-117`](../backlog/GAMEPLAY-117-particle-sub-emitters.md) — sous-émetteurs.
- [`GAMEPLAY-118`](../backlog/GAMEPLAY-118-particle-emission-modules.md) — `emitOverDistance`, `inheritVelocity`, `limitVelocity`.
- [`GAMEPLAY-119`](../backlog/GAMEPLAY-119-particle-live-reseed.md) — réensemencer un émetteur vivant.

Et, indépendamment de ce design : **mesurer**. Tant que §7 reste arithmétique, le plafond réel est inconnu, et c'est exactement ce que `GAMEPLAY-109` reprochait par avance à ce chantier.
