# AtlasJS — Backlog

> Liste unifiée de ce qui reste à faire. Chaque item pointe vers son document de design source.
> Convention de statut : **📋 non implémenté** (design validé, à faire) · **🔶 partiel** (commencé, reste des morceaux) · **💭 vision** (cadré, pas de plan d'exécution).

---

## Rendering

Source : [`rendering/renderer-architecture.md`](rendering/renderer-architecture.md) (§ backlog du refactor renderer).

| #   | Item                                    | Statut | Notes                                                                                                                                                                                                                                                      |
| --- | --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2  | **Text rendering**                      | 📋     | Police bitmap/MSDF comme shader built-in `"text"` + glyph batch. Se branche comme `Batcher` sur le seam `NodeRenderer` (E3). Gros périmètre.                                                                                                               |
| A3  | **Post-processing**                     | 📋     | Stack de passes chaînées (bloom, vignette) sur `RenderTarget` offscreen. Point d'accroche déjà posé (render-to-texture vérifié).                                                                                                                           |
| A4  | **Custom materials sur scene nodes**    | 📋     | Attacher un material custom à un nœud de scène ; unifier le chemin instancié et le chemin générique.                                                                                                                                                       |
| B1  | **Resource lifecycle / eviction**       | 📋     | Les caches grandissent sans eviction (`batchIds`, bind-group/shader/pipeline caches, `instancedPipelines`) ; `destroy()` jamais appelé au teardown → fuites (`defaultSampler`, batches, géométrie `createQuad`). Passe disposal/eviction/refcount.         |
| B2  | **Réconciliation editor ↔ nebula**      | 📋     | `packages/editor` écrit contre une API nebula divergente qui ne compile plus (`RectNode`, `Node.position/scale`, `Node.parent` privé, méthodes `Camera2D` manquantes). Session dédiée.                                                                     |
| B4  | **Depth test 3D**                       | 📋     | `RenderState.depthTest` / `PassDescriptor.depth` inertes mais déjà dans les clés de cache pipeline (piège silencieux) ; besoin d'une depth texture, `depthStencil` sur les pipelines, zIndex → z clip-space. Gros, basse priorité tant qu'on est 2D-first. |
| —   | Extractions `WebGPURenderer`            | 🔶     | Encore ~540 lignes ; `ResourceFactory` (14 `create*`) et le chemin draw/culling sont des candidats d'extraction. Voir appendice refactor.                                                                                                                  |
| —   | Canal `topology` dans `PipelineKeySpec` | 🔶     | Inerte aujourd'hui (tout est `triangle-list`) ; à câbler si un appelant fait varier la topologie.                                                                                                                                                          |

### Shapes — suites naturelles

Source : [`rendering/shapes.md`](rendering/shapes.md) (hors périmètre v1).

- Strokes / contours (fill uniquement aujourd'hui), coins arrondis, polygones arbitraires, remplissage gradient/texture, anchor configurable par forme. `params.y/z/w` sont réservés pour coins arrondis / feather.

---

## Sprites & Assets

Source : [`rendering/sprites.md`](rendering/sprites.md) (non-objectifs v1).

- ✅ **Système d'assets** : _implémenté_ → [`assets/asset-system.md`](assets/asset-system.md) (`Asset`/`Resource` + `AssetManager` + loaders par type ; `TextureAsset`/`SpriteAsset`). Reste V2 : refcount/eviction (B1), `AssetRef` par id + sérialisation, audio, éditeur, sources non-path. Durcissement noté à la review finale : guard `destroy()` pendant un `load` in-flight (un load qui résout après teardown ré-ajoute une resource jamais libérée) ; clé de cache `id`-only (le `type` n'est pas vérifié — sûr aujourd'hui car ids préfixés `texture:`/`sprite:`).
- ✅ **Intégration animation** : _implémenté_ → [`gameplay/sprite-animation.md`](gameplay/sprite-animation.md) (`Animator` + `AnimatorSystem` dt-driven, swap de `SpriteRender.sprite`). Suites V2 → section [Animation — suites V2](#animation--suites-v2) ci-dessous.
- 📋 **Blend mode configurable** sur le sprite.
- 📋 **Sampler / filtrage configurable**.
- 📋 **`sprite` nullable** sur le renderer.

### Animation — suites V2

Source : [`gameplay/sprite-animation.md`](gameplay/sprite-animation.md) (§10 non-objectifs) + review de branche `claude/feat/animator`.

- 📋 **State machine / transitions** ; **blend trees**.
- 📋 **Events de frame** (le stub existait dans `SpriteAnimation`, retiré au passage dt — point d'accroche à réintroduire) + **events de fin d'anim** (`onComplete`).
- 📋 **Root motion** ; **vitesse / timescale d'anim par clip**.
- 📋 **Sérialisation d'un asset d'animation**.
- 📋 **Pivot par frame** : `AnimatorSystem` crée les `Sprite` de frame sans pivot → défaut centre `(0.5, 0.5)`. Un sprite seedé avec un pivot non-centré « saute » au démarrage de l'anim (`resolveNode` ré-`setAnchor`). `Frame` ne porte pas de pivot : le threader via `Frame`/`Animator`, ou hériter du `SpriteRender.sprite.pivot` courant dans `spriteFor`.
- 📋 **Re-trigger d'un clip one-shot déjà actif** : `Animator.play(name)` est no-op si le clip est actif (hérité de `AnimationPlayer.play`) → impossible de rejouer un one-shot terminé sans switcher de clip. Ajouter un paramètre `restart` / une méthode `replay()`.
- 💭 **Eviction du cache `Map<Frame, Sprite>`** de l'`AnimatorSystem` : borné aujourd'hui (une entrée par `Frame` distincte), mais pas d'eviction si des sheets sont déchargées en cours de session — à lier à l'`AssetManager`.

---

## Shaders & Materials

Source : [`rendering/shaders-materials.md`](rendering/shaders-materials.md) (pistes futures).

- 📋 **Plugin Vite de codegen `.d.ts`** : typage compile-time de `set()` par parsing des `.wgsl` (Phase 4 tooling).
- 📋 **Branchement `Sprite.material`** : effets custom directement sur les sprites.
- 📋 **Support `ivec*`** (vecteurs d'entiers) : nécessite un type `IVec*` dans `@atlasjs/math`, à réévaluer sur besoin concret.

### Material graph

Source : [`rendering/material-graph.md`](rendering/material-graph.md) — 💭 **vision complète, rien d'implémenté**.

- Tier 1 dans `@atlasjs/nebula` : `MaterialData` (POJO) + `materialize`/`dematerialize` + interfaces resolver + champ `version`.
- Nouveau package `@atlasjs/material-graph` : modèle nœud/edge, registry de nœuds, walker de compilation vers source easy-path, builder code-first, sérialisation versionnée.
- Librairie de nœuds WGSL built-in (inputs, math, sampling, master).
- Plus tard : DSL fluide (`sample(tex, uv).mul(tint)`), câblage de l'éditeur, pipeline de migration de format.
- Questions de design ouvertes (cf. § 8 du doc) : système de types de ports & conversions, nommage/défauts des property-nodes, granularité de la lib v1, validation du graphe (cycles, ports non connectés, mismatch de types).

---

## Core

### ECS (Nexus)

Source : [`core/nexus-ecs.md`](core/nexus-ecs.md).

- 📋 **Backend de stockage archetype / SoA** : le seam `IComponentStore` swappable existe pour rendre la migration indolore, mais l'implémentation n'est pas faite (sparse-set aujourd'hui).
- 📋 **Primitive de change-detection tick-based** (style Bevy `Changed<T>`) : pour remplacer tout diff manuel résiduel.
- 💭 Registry par nom pour des ids stables cross-process/versions (cas sérialisation) — noté pour ne pas se bloquer, pas planifié.

### Scheduling

Source : [`core/scheduling.md`](core/scheduling.md).

- 🔶 **Phase 3 — Physics dt** : `PhysicsWorld.step(dt)` + `world.timestep = dt`. **Seule phase non faite** du refactor scheduling.
- 💭 Driver rollback/netcode via le seam `advanceFixed` (l'archi est « rollback-ready » mais la sim n'est pas bit-exact sous le driver RAF) — non-objectif aujourd'hui.

---

## Gameplay — Entity hierarchy V2

Source : [`gameplay/entity-hierarchy.md`](gameplay/entity-hierarchy.md) (§9, hors périmètre V1).

| #   | Item                                                | Statut | Notes                                                                                                                                                                                                    |
| --- | ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Passe physique de hiérarchie sans latence**       | 📋     | Propagation dédiée dans la lane `fixed`, avant `PhysicsRequest`, pour que les bodies kinematic/static enfants lisent un `WorldTransform2D` frais (élimine la latence d'1 frame actuelle). Voir §5.4.   |
| H2  | **Rendu exact du shear**                             | 📋     | Seam matrice-monde sur le `Node` nebula (ex. `Node.setLocalMatrix`) pour éviter la décomposition TRS lossy quand un parent a une échelle non-uniforme + rotation imbriquée. Voir §5.5.                 |
| H3  | **Dirty-tracking par sous-arbre**                    | 📋     | `TransformPropagationSystem` recalcule tout l'arbre chaque frame (V1) ; ajouter un dirty-flag par sous-arbre comme `Node` nebula. Voir §5.2.                                                            |
| H4  | **Composition de transform pour bodies dynamic**     | 📋     | Un dynamic ignore aujourd'hui la composition parent (autorité physique) ; recalculer local = monde − parent pour le composer proprement. Voir §9.                                                     |
| H5  | **Destruction orpheline (option)**                   | 📋     | Alternative à la destruction récursive par défaut : reparenter les enfants à la racine au lieu de les détruire en cascade. Voir §3.3.                                                                  |
| H6  | **Signal éditeur `onReparent` dédié**                | 📋     | `world.onAdd(Parent)`/`world.onRemove(Parent)` suffisent en combinaison aujourd'hui ; un signal unique simplifierait un futur éditeur. Voir §7.                                                        |
| H7  | **Relations génériques typées (flecs-style)**        | 📋     | Aller au-delà du seul parent/enfant vers des relations typées arbitraires entre entités. Voir §9.                                                                                                      |

---

## Gameplay — Caméra

> **Cœur implémenté** : caméra gameplay (entité Nexus) pilotant la caméra de rendu nebula, `screenToWorld`/`worldToScreen`, une caméra active unique switchable via `CameraManager`. Source : [`gameplay/camera.md`](gameplay/camera.md) (§14 non-objectifs). Ne restent que les **extensions V2** ci-dessous.

| #   | Item                                                         | Statut | Notes                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Rendu simultané multi-caméras**                            | 📋     | Split-screen / minimap / render-to-texture : une `RenderPass` par caméra avec viewport rects distincts. Nécessite une refonte du `SceneRenderer` (aujourd'hui mono-caméra, une passe). Le `CameraManager` est déjà le seam d'autorité pour l'étendre. |
| C2  | **Rotation de caméra**                                       | 📋     | `Camera2D.view` n'applique que scale+translate ; une rotation exigerait `Mat4.invert` pour le screen↔world (le modèle analytique actuel s'annule sans rotation).                                                                 |
| C3  | **`clearColor` / viewport rect / `renderTarget` par caméra** | 📋     | Données de rendu par caméra au-delà de `zoom` ; prérequis du multi-caméra (C1).                                                                                                                                                 |
| C4  | **Couches de rendu / culling mask par caméra**               | 📋     | Filtrer ce que chaque caméra dessine (UI vs monde, calques).                                                                                                                                                                    |
| C5  | **Mode edit↔play formel**                                    | 📋     | Aujourd'hui l'éditeur et la caméra gameplay écrivent tous deux dans `renderer.camera` sans arbitrage explicite (en pratique : pas de caméra active gameplay en edit mode). Un système de « mode » trancherait l'autorité.        |
| C6  | **Projection non-ortho (perspective)**                       | 📋     | Ouverture 3D ; l'interface `Camera` (`viewProjection: Mat4`) le permet déjà côté contrat, seul `Camera2D` est ortho.                                                                                                            |

- **Comportements connus (par design, pas des bugs)** : `screenToWorld`/`worldToScreen` lus dans un `onUpdate` reflètent la caméra de la frame précédente (lag d'1 frame — la caméra est un producteur en lane `render`, synchronisé après `update`) ; à la frame 0, `renderer.camera` reste à son défaut tant qu'aucun sync n'a eu lieu.
- **Lien** : la méthode `Camera2D.screenToWorld`/`worldToScreen` débloque partiellement **B2** (réconciliation editor ↔ nebula — « méthodes `Camera2D` manquantes »).

---

## Gameplay — Input scripting

> **Cœur implémenté** : Phase 1 (`ScriptService`/`InputApi`, sources [`gameplay/input-scripting.md`](gameplay/input-scripting.md)) et Phase 2 (actions nommées `defineActions`/`button()`/`vector2()`/`PlayerInput`/`PlayerInputSystem`, source [`gameplay/input-actions.md`](gameplay/input-actions.md)). Utilisé dans `apps/sandbox`. Ne restent que les **extensions V2** ci-dessous.

- 📋 Events / callbacks (aujourd'hui polling seulement).
- 📋 Interactions (hold / tap / multi-tap).
- 📋 Processors : deadzone, invert, scale, **normalisation des diagonales** (aujourd'hui non normalisées).
- 📋 Gamepad / axes analogiques ; mouse-as-Vector2 comme source.
- 📋 Control schemes / device assignment ; rebinding runtime.
- 📋 (Dé)sérialisation d'asset d'actions + éditeur.
- 📋 Sampling en lane `fixed` déterministe (aujourd'hui `update` seulement — bloquant pour le netcode).
- Risques notés à surveiller : `mousePosition`/`mouseDelta` et `Vector2Action.readValue()` renvoient un `Vec2` backend vivant (mutable) ; `getService`/`getComponent` mintent un wrapper frais à chaque appel.

---

## Gameplay — Variables exposées de script (`@Expose` → `registerScriptMetadata`)

> **Pivot en cours** : le décorateur stage-3 `@Expose()` (+ `Symbol.metadata` + Babel) est remplacé par un **registre plain-JS** alimenté par `registerScriptMetadata(Ctor, metadata)`, unique source de vérité runtime, aligné sur la vision compilateur custom. Spec : [`gameplay/script-metadata-registry.md`](gameplay/script-metadata-registry.md). Source d'origine (implémentation `@Expose` remplacée) : [`gameplay/exposed-script-variables.md`](gameplay/exposed-script-variables.md).
> Le pivot **résout** : le risque `Symbol()` module-local (plus de symbole partagé writer↔reader) et **câble le warn minimal** de cohérence (`required` sans valeur / clé non exposée). Restent les **extensions V2** ci-dessous.

- 📋 Validation stricte de cohérence `TProps` ↔ metadata **avec throw** + lien automatique (aujourd'hui : double déclaration générique `AtlasScript<{...}>` / `registerScriptMetadata` sans lien, un champ renommé d'un côté reste `undefined` silencieusement). Le warn minimal est fait ; le lien automatique viendra avec le **compilateur custom**.
- 📋 Métadonnées d'éditeur riches dans `ExposeFieldMetadata` (`kind`, `assetKind`, `runtimeType`, tooltip, range, step, category) — **générées par le compilateur** ; le type est déjà ouvert à l'extension.
- 📋 Compilateur TypeScript custom : réécriture `addComponent<T>(a,b)` → `addComponent(T,a,b)`, génération de `registerScriptMetadata`, réintroduction de `@Expose()` comme marqueur compile-time (seul point qui retouchera la syntaxe décorateur).
- 📋 (Dé)sérialisation des valeurs exposées (scène/prefab sur disque).

### Scripting — santé du code (review pré-croissance)

> Relevé lors de la review du système de scripting avant de le faire grossir, par sévérité. Orthogonal au pivot ci-dessus.

| Sévérité | Smell                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟠 Moyen | **Surface publique `__`-préfixée sur `AtlasScript`**                | `__props`, `__context`, `__bindContext()`, `__unbindContext()` sont `public` (le runtime les appelle) mais polluent l'autocomplétion de l'auteur de script (pseudo-privé par convention). À nettoyer **avant que l'API se fige** : clés `Symbol`, ou un `ScriptRuntimeHandle` séparé manipulé par le `ScriptManager`, en ne laissant sur `AtlasScript` que le cycle de vie + `getComponent`/`addComponent`/`getService`/… |
| 🟠 Moyen | **Triple duplication des overloads `addComponent`**                 | Le triplet d'overloads (façade / raw / impl) est recopié verbatim dans `AtlasScript`, `ScriptContext` et `RuntimeScriptContext` → 3 endroits à maintenir en phase. Extraire un type partagé (`AddComponentSignature`).                                                                                                                                                                                                    |
| 🟡 Bas   | **`getService` ne cache pas la façade**                             | `RuntimeScriptContext.getService` fait `new type(this.services)` à chaque appel → façade fraîche à chaque `getService`. Le CLAUDE.md affirme un cache « in the façade ctor » qui n'existe pas côté façade (le cache réel est le service backend, pas le wrapper). Écart doc↔code : cacher la façade par (script, token), ou corriger la doc.                                                                              |
| 🟡 Bas   | **`ScriptComponent` reconstruit le cast ctor à chaque `resolve()`** | `this.constructor as unknown as ScriptComponentCtor` est recalculé dans le ctor **et** dans `resolve()` à chaque accès. Micro, mais façades censées être hot-path.                                                                                                                                                                                                                                                        |

- Risque déjà listé (voir [Notes transverses](#notes-transverses-risques-acceptés-à-surveiller)) : `getComponent(façade)` mint un wrapper frais à chaque appel ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).

---

## Gameplay — Modèle de composants de script (unification — Phase B)

> **Phase A implémentée** (mergée) : frontière principielle **façade ⇔ comportement moteur réel** → une **seule** façade (`Transform`), le reste en composants données pures via aliases propres (`RigidBody`/`SpriteRenderer`) ou bruts (`Animator`/`PlayerInput`), vocabulaire uniforme `addComponent(X)` sans suffixe. Source + roadmap Phase B : [`gameplay/scripting-component-unification.md`](gameplay/scripting-component-unification.md) (§5).

- ✅ **B1 — Couche token `defineScriptComponent(engine, create?)`** : vocabulaire uniforme, dispatch collapsé sur un brand, `Transform` migré de classe façade vers token, passthrough = identité (génériques `PlayerInput<T>` préservés). Spec : [`gameplay/scripting-component-token-b1.md`](gameplay/scripting-component-token-b1.md).
- 📋 **B2 — Compilateur (volet composants)** : surface `interface` authored → mapping vers composant moteur, inline de la résolution token + `ops` → appels bruts (zéro dispatch runtime). **Même compilateur** que celui listé dans « Gameplay — Variables exposées de script » (réécriture `addComponent<T>`, génération `registerScriptMetadata`). Voir §5.2.
- 📋 **B3 — `Transform` = donnée pure via `Changed<T>`** : tuer la dernière façade. **Dépend** du primitif change-detection tick-based listé dans « Core / ECS (Nexus) ». Autorité kinematic/static optimisée par Changed (non-ambigu : le pull n'écrit pas ces Transform). **Dragon** : le téléport d'un `dynamic` ne peut **pas** être une écriture `Transform` brute (clobberée le frame suivant par le pull `dynamic-only`, et `Changed` ne peut pas l'attribuer) → **canal explicite requis** (`rigidBody.teleport()` ou composant-commande `Teleport`). Helpers hiérarchie/world-matrix (`worldPosition`, `setParent`, `getChildren`) → fonctions libres. Voir §5.3.
- 💭 Polish doc non-bloquant (relevé à la review finale Phase A) : bullet CLAUDE.md « `ScriptComponent<TEngine>` subclasses only » à préciser (le barrel réexporte aussi 2 aliases non-subclasses) ; le corps de `scripting-components.md` décrit encore les 3 anciennes façades (doc historique, note pointeur déjà en tête).

---

## Gameplay — Références d'entités dans les scripts (`GameEntity`)

> **Cœur implémenté** : handle stateless `GameEntity` (`otherEntity.getComponent(...)` / `otherEntity.getScript(SwordScript)`), `ScriptManager.getScript(entityId, type)`, métadonnée en union discriminée `{ type: "field" | "entity" }` + builders `ScriptMetadata.field()`/`.entity()`, injection d'une `Entity` brute → `GameEntity` (typage call-site `AttachProps`), `RuntimeScriptContext` délègue à un `GameEntity` de sa propre entité + `this.getEntity(entity)` pour wrapper une entité runtime. Source : [`gameplay/script-entity-references.md`](gameplay/script-entity-references.md) (§5 non-objectifs). Ne restent que les extensions V2 ci-dessous.

- 📋 **Champs entité optionnels / tableaux** (`sword?: GameEntity`, `GameEntity[]`) : le type conditionnel `AttachProps` ne les substitue pas encore (une union `GameEntity | undefined` ou un tableau ne matche pas `extends GameEntity`) ; à généraliser (`NonNullable`, mapping récursif). Connexe : passer explicitement `{ champ: undefined }` wrappe `undefined` au lieu d'émettre le warn « required manquant » (le warn ne se déclenche que si la clé est **absente**).
- 📋 **(Dé)sérialisation des refs d'entité** (scène/prefab sur disque) : demande des ids d'entité stables cross-session ; à lier au chantier `AssetRef` par id.
- 📋 **Métadonnée éditeur riche sur les refs** (`kind`, contrainte de composant requis façon Unity `[RequireComponent]`, tooltip…) : l'union discriminée `ExposeFieldMetadata` est déjà ouverte à l'extension.
- 📋 **`getScripts(type)` pluriel** (toutes les instances d'un type sur une entité) — `getScript` singulier suffit aujourd'hui.
- **Comportement connu (par design)** : `getScript` peut renvoyer une instance dont `onCreate` n'a pas encore tourné (dépend de l'ordre d'`attach` dans un même flush) → lire l'état d'un autre script en `onUpdate`, pas en `onCreate`.

---

## Gameplay — TileSet & TileMap

> **Cœur v1 (design validé, non implémenté)** : `TileSet` en asset complet, `Grid` → N `TileMap` enfants (multi-calque), remplissage code-first, rendu instancié via `TileMapNode` dédié + culling, tri par `sortingOrder`. Source : [`gameplay/tilemap.md`](gameplay/tilemap.md) (§2 non-objectifs). Ne restent que les **extensions** ci-dessous.

- 📋 **(Dé)sérialisation JSON d'une tilemap** + schéma de référence de tuile (`tilesetId` + index) = le chantier `AssetRef`-par-id (le `TileSet.id` stable est déjà posé comme ancre). Objectif d'origine du sujet, reporté volontairement.
- 📋 **Multi-tileset par tilemap + `Tile` riche** (modèle B2) : couleur / `colliderType` / tuiles animées par tuile, agrégeables depuis plusieurs sources ; la cellule pointerait un `Tile` plutôt qu'un `int`. Le seam `Tile` est déjà en place.
- 📋 **Sorting layers nommés + order-in-layer** : feature de rendu **transverse** (touche `SpriteRender` *et* `TileMapRenderer` *et* le sort key de `NodeRendererBase.computeSortKey` — bits libres disponibles). À designer à part, pas propre au tilemap.
- 📋 **Colliders de tilemap** : composant générant les colliders (via `@atlasjs/rapier`) depuis les cellules pleines ; dépend d'un modèle de collision 2D côté gameplay.
- 📋 **Layouts isométrique / hexagonal + cell swizzle** : la v1 est rectangulaire uniquement ; généraliser la conversion cellule↔monde dans `Grid`.
- 📋 **Palette / éditeur** : authoring visuel des tuiles (peindre dans la grille) ; dépend d'un éditeur.
- 📋 **Optimisations de rendu** : buffer d'instances persistant (static batch, upload une fois au lieu de chaque frame), cache par `revision` + plage-visible, chunking + culling par chunk. La v1 reconstruit les instances visibles chaque frame.
- 📋 **Util de slicing en grille partagé** : `TileSet` refait sa propre boucle (décision A) ; extraire un util commun avec `SpriteSheet.fromGrid`/`fromAutoGrid` (nebula), et/ou exposer un accès `(row,col)`/index dans `SpriteSheet`.
- 📋 **Tile Anchor configurable + scaling *fit-to-cell*** : la v1 ancre la tuile au coin d'origine de la cellule et la dessine à sa taille native ; permettre un ancrage centré (défaut Unity) et un redimensionnement à `cellSize`.

---

## Notes transverses (risques acceptés, à surveiller)

- **Gameplay** ([`gameplay/gameplay-redesign.md`](gameplay/gameplay-redesign.md)) : contrat `setComponent` « muter en place, jamais remplacer » (sinon durcir Nexus pour émettre `onRemove`+`onAdd`) ; téléport d'un `dynamic` avant existence de son body (1ère frame) ; scripts en lane `update` variable mutant un `dynamic` → préférer vélocité/force.
- **Scripting components** ([`gameplay/scripting-components.md`](gameplay/scripting-components.md)) : `getComponent(façade)` mint un wrapper frais à chaque appel (deux appels → deux instances sur la même donnée) ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).
