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

- ✅ **Strokes / contours** _(fait)_ : `ShapeNode.borderWidth` → `params.y` → SDF de contour en WGSL (rect + cercle), taille monde dérivée de la matrice model. Voir [`debug/gizmos.md`](debug/gizmos.md) § 6. Restent : coins arrondis, polygones arbitraires, remplissage gradient/texture, anchor configurable par forme. `params.z/w` restent réservés aux coins arrondis / feather.

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
- 📋 **Events de frame** (le stub existait dans `SpriteAnimation`, retiré au passage dt — point d'accroche à réintroduire).
- ✅ **Events de clip** _(fait)_ : `started`/`finished`/`loop` sur `Animator` (`on`/`off`), détection côté gameplay → [`gameplay/animation-events.md`](gameplay/animation-events.md).
- 📋 **Root motion** ; **vitesse / timescale d'anim par clip**.
- 📋 **Sérialisation d'un asset d'animation**.
- ✅ **Pivot par frame** _(fait)_ : `Frame` porte désormais un `pivot`, et `AnimatorSystem.spriteFor` le thread dans le `Sprite` de frame (`new Sprite(frame.texture, { rect: frame.rect, pivot: frame.pivot })`, `packages/gameplay/src/systems/AnimatorSystem.ts:35`).
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
- 📋 **Signal « entité détruite » + GC autoritatif des scripts** : `NexusWorld` n'émet que des `onRemove` par-composant, pas de signal générique de destruction d'entité. Conséquence (relevée à la review finale du prefab) : les records du `ScriptManager` ne sont nettoyés que via `GameEntity.destroy()` — une entité détruite par une autre route (`world.destroyEntity`/`commands.destroy` direct, ou sous-arbre d'un parent tué hors-script) **fuit ses scripts et continue à recevoir `onUpdate`** ; edge étroit aussi : enfant re-parenté sous `A` après `A.destroy()` mais avant le flush `Sync`. Fix = un `onEntityDestroyed` émis une fois par entité détruite (enfants récursifs inclus) auquel le `ScriptManager` s'abonne → GC keyé sur la vraie destruction monde, et `GameEntity.destroy()` peut abandonner sa marche de sous-arbre au moment de l'appel. Chantier Nexus + gameplay. Voir [`gameplay/prefab.md`](gameplay/prefab.md) (§ revue finale).

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
| C7  | **Scroll sous-pixel fluide + pixels nets (low-res render target)** | 📋     | Rendre le monde dans une RT basse-résolution à échelle entière puis upscaler avec **offset sous-pixel au blit** (technique « pixel-perfect smooth scroll » façon Celeste) → fluidité **et** netteté simultanées, là où le `pixelSnap` seul fait avancer la caméra par pas d'1px. S'appuie sur la brique `Camera2D.pixelSnap` (déjà là) + l'infra render-to-texture (cf. A3). Gros périmètre. |

- **✅ Pixel-snap caméra (implémenté)** : `Camera2D.pixelSnap` (on par défaut) snappe la translation de la matrice de vue sur la grille _device_ `1/(zoom·dpr)` → supprime le jitter sous-pixel des sprites **et** les coutures d'1px entre tuiles (visible surtout à zoom 1 / dpr 1, en nearest sampling). La `position` reste **continue** → `screenToWorld`/`worldToScreen`/`getCameraViewport`/follow inchangés ; le `pixelRatio` remonte de `WebGPUSurface` jusqu'à `camera.update`. Test : `packages/nebula/test/Camera2D.test.ts`. C'est la brique de base de **C7**.
- **Comportements connus (par design, pas des bugs)** : `screenToWorld`/`worldToScreen` lus dans un `onUpdate` reflètent la caméra de la frame précédente (lag d'1 frame — la caméra est un producteur en lane `render`, synchronisé après `update`) ; à la frame 0, `renderer.camera` reste à son défaut tant qu'aucun sync n'a eu lieu.
- **Lien** : la méthode `Camera2D.screenToWorld`/`worldToScreen` débloque partiellement **B2** (réconciliation editor ↔ nebula — « méthodes `Camera2D` manquantes »).

---

## Gameplay — Input scripting

> **Cœur implémenté** : Phase 1 (`ScriptService`/`InputApi`) et Phase 2 (actions nommées `defineActions`/`button()`/`vector2()`/`PlayerInput`/`PlayerInputSystem`). Source unifiée : [`gameplay/input-scripting.md`](gameplay/input-scripting.md). Utilisé dans `apps/dino-brawl`. Ne restent que les **extensions V2** ci-dessous.

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

> **Pivot fait** : le décorateur stage-3 `@Expose()` (+ `Symbol.metadata` + Babel) a été remplacé par un **registre plain-JS** alimenté par `registerScriptMetadata(Ctor, metadata)`, unique source de vérité runtime, aligné sur la vision compilateur custom. Spec unifiée (registre + `GameEntity`) : [`gameplay/exposed-script-variables.md`](gameplay/exposed-script-variables.md).
> Le pivot **résout** : le risque `Symbol()` module-local (plus de symbole partagé writer↔reader) et **câble le warn minimal** de cohérence (`required` sans valeur / clé non exposée). Restent les **extensions V2** ci-dessous.

- 📋 Validation stricte de cohérence `TProps` ↔ metadata **avec throw** + lien automatique (aujourd'hui : double déclaration générique `AtlasScript<{...}>` / `registerScriptMetadata` sans lien, un champ renommé d'un côté reste `undefined` silencieusement). Le warn minimal est fait ; le lien automatique viendra avec le **compilateur custom**.
- 📋 Métadonnées d'éditeur riches dans `ExposeFieldMetadata` (`kind`, `assetKind`, `runtimeType`, tooltip, range, step, category) — **générées par le compilateur** ; le type est déjà ouvert à l'extension.
- 📋 Compilateur TypeScript custom : réécriture `addComponent<T>(a,b)` → `addComponent(T,a,b)`, génération de `registerScriptMetadata`, réintroduction de `@Expose()` comme marqueur compile-time (seul point qui retouchera la syntaxe décorateur).
- 📋 (Dé)sérialisation des valeurs exposées (scène/prefab sur disque).

### Scripting — santé du code (review pré-croissance)

> Relevé lors de la review du système de scripting avant de le faire grossir, par sévérité. Orthogonal au pivot ci-dessus.

| Sévérité | Smell                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟠 Moyen | **Surface publique `__`-préfixée sur `AtlasScript`**                | `__props`, `__bindContext()`, `__unbindContext()` restent `public` (le runtime les appelle) — `__context` est désormais `private` (`packages/gameplay/src/scripting/core/AtlasScript.ts:19`) — mais polluent l'autocomplétion de l'auteur de script (pseudo-privé par convention). À nettoyer **avant que l'API se fige** : clés `Symbol`, ou un `ScriptRuntimeHandle` séparé manipulé par le `ScriptManager`, en ne laissant sur `AtlasScript` que le cycle de vie + `getComponent`/`addComponent`/`getService`/… |
| 🟠 Moyen | **Triple duplication des overloads `addComponent`**                 | Le triplet d'overloads (façade / raw / impl) est recopié verbatim dans `AtlasScript`, `ScriptContext` et `RuntimeScriptContext` → 3 endroits à maintenir en phase. Extraire un type partagé (`AddComponentSignature`).                                                                                                                                                                                                    |
| 🟡 Bas   | **`getService` ne cache pas la façade**                             | `RuntimeScriptContext.getService` fait `new type(this.services)` à chaque appel → façade fraîche à chaque `getService`. Le CLAUDE.md affirme un cache « in the façade ctor » qui n'existe pas côté façade (le cache réel est le service backend, pas le wrapper). Écart doc↔code : cacher la façade par (script, token), ou corriger la doc.                                                                              |

- Risque déjà listé (voir [Notes transverses](#notes-transverses-risques-acceptés-à-surveiller)) : `getComponent(façade)` mint un wrapper frais à chaque appel ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).

---

## Gameplay — Modèle de composants de script (unification — Phase B)

> **Phase A implémentée** (mergée) : frontière principielle **façade ⇔ comportement moteur réel** → une **seule** façade (`Transform`), le reste en composants données pures via aliases propres (`RigidBody`/`SpriteRenderer`) ou bruts (`Animator`/`PlayerInput`), vocabulaire uniforme `addComponent(X)` sans suffixe. Source + roadmap Phase B : [`gameplay/scripting-components.md`](gameplay/scripting-components.md) (§ Roadmap).

- ✅ **B1 — Couche token `defineScriptComponent(engine, create?)`** : vocabulaire uniforme, dispatch collapsé sur un brand, `Transform` migré de classe façade vers token, passthrough = identité (génériques `PlayerInput<T>` préservés). Spec : [`gameplay/scripting-components.md`](gameplay/scripting-components.md) (modèle token).
- 📋 **B2 — Compilateur (volet composants)** : surface `interface` authored → mapping vers composant moteur, inline de la résolution token + `ops` → appels bruts (zéro dispatch runtime). **Même compilateur** que celui listé dans « Gameplay — Variables exposées de script » (réécriture `addComponent<T>`, génération `registerScriptMetadata`). Voir § Roadmap.
- 📋 **B3 — `Transform` = donnée pure via `Changed<T>`** : tuer la dernière façade. **Dépend** du primitif change-detection tick-based listé dans « Core / ECS (Nexus) ». Autorité kinematic/static optimisée par Changed (non-ambigu : le pull n'écrit pas ces Transform). **Dragon** : le téléport d'un `dynamic` ne peut **pas** être une écriture `Transform` brute (clobberée le frame suivant par le pull `dynamic-only`, et `Changed` ne peut pas l'attribuer) → **canal explicite requis** (`rigidBody.teleport()` ou composant-commande `Teleport`). Helpers hiérarchie/world-matrix (`worldPosition`, `setParent`, `getChildren`) → fonctions libres. Voir § Roadmap.

---

## Gameplay — Références d'entités dans les scripts (`GameEntity`)

> **Cœur implémenté** : handle stateless `GameEntity` (`otherEntity.getComponent(...)` / `otherEntity.getScript(SwordScript)`), `ScriptManager.getScript(entityId, type)`, métadonnée en union discriminée `{ type: "field" | "entity" }` + builders `ScriptMetadata.field()`/`.entity()`, injection d'une `Entity` brute → `GameEntity` (typage call-site `AttachProps`), `RuntimeScriptContext` délègue à un `GameEntity` de sa propre entité + `this.getEntity(entity)` pour wrapper une entité runtime. Source : [`gameplay/exposed-script-variables.md`](gameplay/exposed-script-variables.md) (§ hors périmètre). Ne restent que les extensions V2 ci-dessous.

- 📋 **Champs entité optionnels / tableaux** (`sword?: GameEntity`, `GameEntity[]`) : le type conditionnel `AttachProps` ne les substitue pas encore (une union `GameEntity | undefined` ou un tableau ne matche pas `extends GameEntity`) ; à généraliser (`NonNullable`, mapping récursif). Connexe : passer explicitement `{ champ: undefined }` wrappe `undefined` au lieu d'émettre le warn « required manquant » (le warn ne se déclenche que si la clé est **absente**).
- 📋 **(Dé)sérialisation des refs d'entité** (scène/prefab sur disque) : demande des ids d'entité stables cross-session ; à lier au chantier `AssetRef` par id.
- 📋 **Métadonnée éditeur riche sur les refs** (`kind`, contrainte de composant requis façon Unity `[RequireComponent]`, tooltip…) : l'union discriminée `ExposeFieldMetadata` est déjà ouverte à l'extension.
- 📋 **`getScripts(type)` pluriel** (toutes les instances d'un type sur une entité) — `getScript` singulier suffit aujourd'hui.
- **Comportement connu (par design)** : `getScript` peut renvoyer une instance dont `onCreate` n'a pas encore tourné (dépend de l'ordre d'`attach` dans un même flush) → lire l'état d'un autre script en `onUpdate`, pas en `onCreate`.

---

## Gameplay — Prefab

> **Cœur v1 implémenté** : `EntityBuilder.child()` pour les enfants inline et les références internes câblées par capture. Source : [`gameplay/prefab-multi-entity.md`](gameplay/prefab-multi-entity.md). Restent les **extensions V2** ci-dessous.

- **Prefab `child(subPrefab, params)`** — variante de `EntityBuilder.child()` composant un sous-prefab
  réutilisable (en plus du callback inline). Voir `docs/gameplay/prefab-multi-entity.md` §9.
- **Propagation à travers des nœuds de groupe sans transform** — permettre à
  `TransformPropagationSystem` de descendre depuis une racine sans `Transform2D` (aujourd'hui la racine
  d'un groupe porte un `Transform2D` identité). Voir `docs/gameplay/prefab-multi-entity.md` §4.

---

## Debug — Gizmos

> **Cœur v1 implémenté** : `ColliderGizmo`/`PivotGizmo` + switch global, service immediate-mode `Gizmos` sur pool de nœuds recyclés, stroke SDF dans nebula. Source : [`debug/gizmos.md`](debug/gizmos.md) (§ 9 non-objectifs). Restent les **extensions V2** ci-dessous.

- 📋 **Gizmos d'éditeur** : poignées de sélection/déplacement/échelle, contour de l'entité sélectionnée, preview de collider en cours d'édition. Le seam est déjà posé — tout producteur s'insère avec `before: "gizmos:flush"` sans toucher au package. **À croiser avec B2** (réconciliation editor ↔ nebula) : `packages/editor` porte déjà un `Gizmo`/`GizmoTool` mort en lane `update` avec son propre modèle overlay ; la reprise de B2 devrait en faire des producteurs de l'API immediate-mode plutôt qu'un second chemin de rendu. Voir [`debug/gizmos.md`](debug/gizmos.md) § 9.
- 📋 **`Gizmos.drawLine` + pool de `LineNode`** : débloque d'un coup les gizmos de raycast, les vecteurs (direction, vitesse, normales de contact) et les lignes de hiérarchie parent → enfant. Écarté en v1 faute de consommateur réel.
- 📋 **`capsule` / `segment` / `polygon` exacts** : capsule via un 3ᵉ `shapeKind` SDF, segment/polygon via une boucle de `LineNode`. Aujourd'hui : rien dessiné + un warn unique par type (choix assumé — pas d'AABB approximative, un gizmo ne doit pas mentir sur la géométrie).
- 📋 **Épaisseur de contour constante à l'écran** : `borderWidth` est en unités monde, donc le contour s'épaissit visuellement au zoom. Une épaisseur en pixels demanderait le facteur de zoom caméra dans le shader.
- 📋 **Texte à l'écran** (labels d'entité, valeurs numériques) : dépend du rendu de texte (item A2 de la section Rendering).
- 📋 **Contour du sprite / marqueur de sort point** : rect du sprite rendu, et position du `sortPointEntity`.
- 📋 **Surcharge `Collider.getTranslation(out?: Vec2)`** dans `@atlasjs/inertia` : `RapierCollider.getTranslation()` alloue un `Vec2` par appel, soit ~2 allocations par collider par frame **quand le debug est allumé**. Assumé en v1 (outil opt-in) plutôt que de faire changer un contrat de package physique pour un outil de debug.
- 💭 **Passe/batch gizmo dédiée** dans nebula : overlay dessiné après la scène, hors scene-graph. Conceptuellement plus juste (les gizmos ne sont pas du contenu de scène) mais sans effet sur l'API appelante — le `GIZMO_SORTING_LAYER` produit le même résultat visuel aujourd'hui.

---

## Gameplay — TileSet & TileMap

> **Cœur v1 (design validé, non implémenté)** : `TileSet` en asset complet, `Grid` → N `TileMap` enfants (multi-calque), remplissage code-first, rendu instancié via `TileMapNode` dédié + culling, tri par `sortingOrder`. Source : [`gameplay/tilemap.md`](gameplay/tilemap.md) (§2 non-objectifs). Ne restent que les **extensions** ci-dessous.

- 📋 **(Dé)sérialisation JSON d'une tilemap** + schéma de référence de tuile (`tilesetId` + index) = le chantier `AssetRef`-par-id (le `TileSet.id` stable est déjà posé comme ancre). Objectif d'origine du sujet, reporté volontairement.
- 📋 **Multi-tileset par tilemap + `Tile` riche** (modèle B2) : couleur / `colliderType` / tuiles animées par tuile, agrégeables depuis plusieurs sources ; la cellule pointerait un `Tile` plutôt qu'un `int`. Le seam `Tile` est déjà en place.
- ✅ **Sorting layers nommés + order-in-layer** _(fait)_ : implémenté comme feature de rendu transverse via `SortingLayers` + `applySortFields` (`packages/gameplay/src/rendering/`), consommé par `SpriteRenderSystem`/`TileMapRenderSystem`/`OccluderRenderSystem` (`TileMapRenderer.sortingLayer`, `OccluderStrip.sortingLayer`) ; câblé dans `apps/dino-brawl` (`MapBuilder`).
- 📋 **Colliders de tilemap** : composant générant les colliders (via `@atlasjs/rapier`) depuis les cellules pleines ; dépend d'un modèle de collision 2D côté gameplay.
- 📋 **Layouts isométrique / hexagonal + cell swizzle** : la v1 est rectangulaire uniquement ; généraliser la conversion cellule↔monde dans `Grid`.
- 📋 **Palette / éditeur** : authoring visuel des tuiles (peindre dans la grille) ; dépend d'un éditeur.
- 📋 **Optimisations de rendu** : buffer d'instances persistant (static batch, upload une fois au lieu de chaque frame), chunking + culling par chunk. Le cache par `revision` + plage-visible est ✅ **fait** : la reconstruction des instances n'a plus lieu chaque frame — elle est gatée par `(revision, plage-visible)` et, quand elle a lieu, réutilise en place les `TileInstance`/`Vec4` existants (zéro allocation en régime permanent). Restent différés le buffer d'instances persistant (upload once) et le chunking + culling par chunk.
- 📋 **Util de slicing en grille partagé** : `TileSet` refait sa propre boucle (décision A) ; extraire un util commun avec `SpriteSheet.fromGrid`/`fromAutoGrid` (nebula), et/ou exposer un accès `(row,col)`/index dans `SpriteSheet`.
- 📋 **Tile Anchor configurable + scaling *fit-to-cell*** : la v1 ancre la tuile au coin d'origine de la cellule et la dessine à sa taille native ; permettre un ancrage centré (défaut Unity) et un redimensionnement à `cellSize`. (C'est ce qui lèverait la contrainte « `cellSize` = taille native » — sinon trous entre tuiles.)
- 📋 **Durcissements notés à la review finale** (tous Minor, acceptés en v1) : `TileSet` ne valide pas des `columns`/`rows` explicites surdimensionnés vs la texture (uvRect > 1, clampé par `clamp-to-edge` — dégrade sans crash) → warn dev optionnel ; `TileMap.setTile` bumpe `revision` même sur réécriture identique (désormais `revision` gate le cache de rebuild du `TileMapRenderSystem` → une réécriture identique déclenche un rebuild inutile, sans impact de correctness) ; culling vs rendu peuvent diverger sous shear + scale non-uniforme + rotation (cull conservateur → sans artefact, même chemin lossy que `SpriteRenderSystem`).
---

## Audio

Source : [`gameplay/audio.md`](gameplay/audio.md) — nouveau package plugin `@atlasjs/audio`.

- 🔶 **Cœur v1 (design validé, non implémenté)** — **split façon `@atlasjs/input`** : le **backend pur** dans un nouveau package `@atlasjs/audio` (ECS-free) — `AudioClipAsset`/`AudioLoader`/`AudioClip` (moule asset), `AudioEngine` (service, propriétaire de l'audio graph Web Audio + master gain + déblocage autoplay + pause d'onglet), `AudioPlugin` (`requires: [ASSET_MANAGER]`, `provides: [AUDIO_ENGINE]`) ; l'**intégration ECS** dans `@atlasjs/gameplay` — `AudioSource` (composant LEVEL-1) + `AudioSystem` (réconciliation, stage `Late`) + `AudioApi` (façade script `playOneShot`/`masterVolume`/`muted`), câblés par `GameplayPlugin` (comme `PlayerInput`/`PlayerInputSystem`/`InputApi`). SFX one-shots + musique en boucle (`playOnAwake`) + volume par source & master. À implémenter (plan d'implémentation à suivre).
- 📋 **Audio spatial 2D** : pan + atténuation par distance via `Transform2D` + `AudioListener` (caméra/joueur), `PannerNode`. `AudioSource` déjà forward-compat. Ouvre la porte 3D.
- 📋 **Pause/resume par source** : offset tracking + recréation du `AudioBufferSourceNode` (pas de pause native). Le suspend global couvre le besoin v1.
- 📋 **Bus / groupes de mixage** (master → sfx / music / ui) + **ducking** automatique.
- 📋 **Crossfade** entre musiques.
- 📋 **Pooling de voix / cap de concurrence**.
- 📋 **Refcount / eviction** des `AudioClip` (dépend du chantier `AssetManager` V2).
- 📋 **(Dé)sérialisation** des refs de clip (`AssetRef` par id) pour scène/prefab sur disque.

---

## Dette technique

- 📋 **`tsc -b` de `dino-brawl` rouge** : 4 erreurs `noUnusedLocals`/`noUnusedParameters` pré-existantes dans `apps/dino-brawl/src/game/Player.ts` et `Sword.ts` (code legacy hors ECS) — cleanup séparé, sans lien avec un chantier de design.

---

## Notes transverses (risques acceptés, à surveiller)

- **Gameplay** ([`gameplay/gameplay-redesign.md`](gameplay/gameplay-redesign.md)) : contrat `setComponent` « muter en place, jamais remplacer » (sinon durcir Nexus pour émettre `onRemove`+`onAdd`) ; téléport d'un `dynamic` avant existence de son body (1ère frame) ; scripts en lane `update` variable mutant un `dynamic` → préférer vélocité/force.
- **Scripting components** ([`gameplay/scripting-components.md`](gameplay/scripting-components.md)) : `getComponent(façade)` mint un wrapper frais à chaque appel (deux appels → deux instances sur la même donnée) ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).
