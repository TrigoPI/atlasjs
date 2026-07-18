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
- ✅ **Intégration animation** : *implémenté* → [`gameplay/sprite-animation.md`](gameplay/sprite-animation.md) (`Animator` + `AnimatorSystem` dt-driven, swap de `SpriteRender.sprite`). Suites V2 → section [Animation — suites V2](#animation--suites-v2) ci-dessous.
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

| Sévérité | Smell | Notes |
|---|---|---|
| 🟠 Moyen | **Surface publique `__`-préfixée sur `AtlasScript`** | `__props`, `__context`, `__bindContext()`, `__unbindContext()` sont `public` (le runtime les appelle) mais polluent l'autocomplétion de l'auteur de script (pseudo-privé par convention). À nettoyer **avant que l'API se fige** : clés `Symbol`, ou un `ScriptRuntimeHandle` séparé manipulé par le `ScriptManager`, en ne laissant sur `AtlasScript` que le cycle de vie + `getComponent`/`addComponent`/`getService`/… |
| 🟠 Moyen | **Triple duplication des overloads `addComponent`** | Le triplet d'overloads (façade / raw / impl) est recopié verbatim dans `AtlasScript`, `ScriptContext` et `RuntimeScriptContext` → 3 endroits à maintenir en phase. Extraire un type partagé (`AddComponentSignature`). |
| 🟡 Bas | **`getService` ne cache pas la façade** | `RuntimeScriptContext.getService` fait `new type(this.services)` à chaque appel → façade fraîche à chaque `getService`. Le CLAUDE.md affirme un cache « in the façade ctor » qui n'existe pas côté façade (le cache réel est le service backend, pas le wrapper). Écart doc↔code : cacher la façade par (script, token), ou corriger la doc. |
| 🟡 Bas | **`ScriptComponent` reconstruit le cast ctor à chaque `resolve()`** | `this.constructor as unknown as ScriptComponentCtor` est recalculé dans le ctor **et** dans `resolve()` à chaque accès. Micro, mais façades censées être hot-path. |

- Risque déjà listé (voir [Notes transverses](#notes-transverses-risques-acceptés-à-surveiller)) : `getComponent(façade)` mint un wrapper frais à chaque appel ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).

---

## Notes transverses (risques acceptés, à surveiller)

- **Gameplay** ([`gameplay/gameplay-redesign.md`](gameplay/gameplay-redesign.md)) : contrat `setComponent` « muter en place, jamais remplacer » (sinon durcir Nexus pour émettre `onRemove`+`onAdd`) ; téléport d'un `dynamic` avant existence de son body (1ère frame) ; scripts en lane `update` variable mutant un `dynamic` → préférer vélocité/force.
- **Scripting components** ([`gameplay/scripting-components.md`](gameplay/scripting-components.md)) : `getComponent(façade)` mint un wrapper frais à chaque appel (deux appels → deux instances sur la même donnée) ; `addComponent(Façade, ...args)` ignore les args si le composant engine existe déjà (get-or-create).
