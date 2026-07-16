# AtlasJS — Backlog

> Liste unifiée de ce qui reste à faire. Chaque item pointe vers son document de design source.
> Convention de statut : **📋 non implémenté** (design validé, à faire) · **🔶 partiel** (commencé, reste des morceaux) · **💭 vision** (cadré, pas de plan d'exécution).

---

## Rendering

Source : [`rendering/renderer-architecture.md`](rendering/renderer-architecture.md) (§ backlog du refactor renderer).

| # | Item | Statut | Notes |
|---|------|--------|-------|
| A2 | **Text rendering** | 📋 | Police bitmap/MSDF comme shader built-in `"text"` + glyph batch. Se branche comme `Batcher` sur le seam `NodeRenderer` (E3). Gros périmètre. |
| A3 | **Post-processing** | 📋 | Stack de passes chaînées (bloom, vignette) sur `RenderTarget` offscreen. Point d'accroche déjà posé (render-to-texture vérifié). |
| A4 | **Custom materials sur scene nodes** | 📋 | Attacher un material custom à un nœud de scène ; unifier le chemin instancié et le chemin générique. |
| B1 | **Resource lifecycle / eviction** | 📋 | Les caches grandissent sans eviction (`batchIds`, bind-group/shader/pipeline caches, `instancedPipelines`) ; `destroy()` jamais appelé au teardown → fuites (`defaultSampler`, batches, géométrie `createQuad`). Passe disposal/eviction/refcount. |
| B2 | **Réconciliation editor ↔ nebula** | 📋 | `packages/editor` écrit contre une API nebula divergente qui ne compile plus (`RectNode`, `Node.position/scale`, `Node.parent` privé, méthodes `Camera2D` manquantes). Session dédiée. |
| B4 | **Depth test 3D** | 📋 | `RenderState.depthTest` / `PassDescriptor.depth` inertes mais déjà dans les clés de cache pipeline (piège silencieux) ; besoin d'une depth texture, `depthStencil` sur les pipelines, zIndex → z clip-space. Gros, basse priorité tant qu'on est 2D-first. |
| — | Extractions `WebGPURenderer` | 🔶 | Encore ~540 lignes ; `ResourceFactory` (14 `create*`) et le chemin draw/culling sont des candidats d'extraction. Voir appendice refactor. |
| — | Canal `topology` dans `PipelineKeySpec` | 🔶 | Inerte aujourd'hui (tout est `triangle-list`) ; à câbler si un appelant fait varier la topologie. |

### Shapes — suites naturelles

Source : [`rendering/shapes.md`](rendering/shapes.md) (hors périmètre v1).

- Strokes / contours (fill uniquement aujourd'hui), coins arrondis, polygones arbitraires, remplissage gradient/texture, anchor configurable par forme. `params.y/z/w` sont réservés pour coins arrondis / feather.

---

## Sprites & Assets

Source : [`rendering/sprites.md`](rendering/sprites.md) (non-objectifs v1).

- 📋 **`AssetManager`** : chargement async, cache/dedup, lifetime, hot-reload. Le contrat `Asset` (`id` + `dispose`) est la fondation prévue ; conformité formelle de `Texture2D` au contrat à finaliser à ce moment-là.
- 📋 **Intégration animation** : `AnimationPlayer` / `SpriteSheet` → `SpriteRender` (swap de `spriteRenderer.sprite`).
- 📋 **Blend mode configurable** sur le sprite.
- 📋 **Sampler / filtrage configurable**.
- 📋 **`sprite` nullable** sur le renderer.

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

## Gameplay — Input scripting

Feature en deux phases, **aucune implémentée**.

### Phase 1 — Service `InputApi`

Source : [`gameplay/input-scripting.md`](gameplay/input-scripting.md) — 📋.

- Introduit le mécanisme générique `ScriptService<TService>` (déclare un `static token`), symétrique de `ScriptComponent`.
- Livre la façade `InputApi` (polling clavier/souris global dans les scripts).
- 5 checkpoints : dépendance + base, `getService` dans le contexte, façade `InputApi`, exports publics + re-export `Key`, intégration sandbox.
- Risques notés : `mousePosition`/`mouseDelta` renvoient le `Vec2` backend vivant (mutable) ; `getService` mint un wrapper frais à chaque appel ; caveat edge-read en `onFixedUpdate` ; double point d'export `Key` (gameplay + input).

### Phase 2 — Actions nommées

Source : [`gameplay/input-actions.md`](gameplay/input-actions.md) — 📋.

- Abstraction haut-niveau façon Unity Input System (`jump.isPressed()`, `move.readValue()`) au-dessus de la Phase 1.
- Moteur d'actions device-agnostique (`defineActions`, builders, `InputActionMap`, actions Button/Value/Vector2) pur dans `@atlasjs/input` ; intégration ECS (`PlayerInput` + `PlayerInputSystem`, sampling au stage `Early`) dans `@atlasjs/gameplay`.
- 4 checkpoints : modèle de données/authoring, runtime map + actions, `PlayerInput` + système, exports + sandbox.
- Backlog V1 explicite (Phase 2+) : pas d'events/callbacks, pas d'interactions (hold/tap), pas de processors (donc diagonales non normalisées, pas de deadzone/invert/scale), pas de gamepad/axes analogiques, pas de mouse-as-Vector2, pas de control schemes / device assignment, pas de rebinding runtime, pas d'asset (dé)sérialisation/éditeur, sampling en lane `update` seulement (pas de `fixed` déterministe pour le netcode).

---

## Notes transverses (risques acceptés, à surveiller)

- **Gameplay** ([`gameplay/gameplay-redesign.md`](gameplay/gameplay-redesign.md)) : contrat `setComponent` « muter en place, jamais remplacer » (sinon durcir Nexus pour émettre `onRemove`+`onAdd`) ; téléport d'un `dynamic` avant existence de son body (1ère frame) ; scripts en lane `update` variable mutant un `dynamic` → préférer vélocité/force.
- **Scripting components** ([`gameplay/scripting-components.md`](gameplay/scripting-components.md)) : `getComponent(façade)` mint un wrapper frais à chaque appel (deux appels → deux instances sur la même donnée) ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).
