# Nebula — Refonte Shader / Material

> Statut : **design validé, implémentation à venir**
> Portée : package `@atlasjs/nebula` (interfaces) + implémentation WebGPU
> Objectif : rendre l'authoring de shaders/materials simple, sûr, et sans double déclaration.

---

## 1. Le problème

Aujourd'hui, créer un shader impose de **déclarer deux fois** la même information, sans aucun cross-check :

```wgsl
// texture.wgsl — déclaration #1 : groupes, bindings, structs, alignements à la main
struct ObjectUniforms { model: mat4x4<f32>, sourceRect: vec4<f32> };
@group(1) @binding(0) var<uniform> uObject: ObjectUniforms;
@group(2) @binding(1) var uTexture: texture_2d<f32>;   // binding(1), PAS 0
```

```ts
// SpriteRenderer.ts — déclaration #2 : doit matcher au poil près
.addObjectProperty({ type: "mat4", name: "model" })
.addObjectProperty({ type: "buffer", name: "sourceRect", size: 16 }) // taille manuelle
.addMaterialProperty({ type: "texture2D", name: "uTexture" })
```

Si un nom, un `@group`, un ordre de champ ou un alignement diverge → **erreur GPU silencieuse ou rendu faux**.

### Défauts constatés

| # | Constat | Fichier |
|---|---------|---------|
| 1 | Double source de vérité WGSL ↔ TS, aucun cross-check | `SpriteRenderer.ts` / `texture.wgsl` |
| 2 | `binding(1)` sans `binding(0)` : trou de binding invisible (le groupe material n'a pas d'uniform buffer mais les ressources démarrent à `uniformBinding+1`) | `WebGPUMaterialLayout.ts` |
| 3 | Système de types uniformes pauvre : pas de `vec3`/`vec4`/`mat3`/arrays → fallback `buffer` + packing manuel (`sourceRect`) | `core-types.ts`, `core-const.ts` |
| 4 | `ShapeRenderer` + `shape.wgsl` = **code mort** (API fantôme : `createObjectBindings`, `bindMat4At`, `material.bindColor`, `BINDING_LOCATION_*`) | `ShapeRenderer.ts` |
| 5 | Le core « agnostique » leak `@webgpu/types` (`type TextureFormat = GPUTextureFormat`) | `core-types.ts` |
| 6 | `Material` ≈ `BindingGroup` : mêmes 8 méthodes `setX` dupliquées | `Material.ts`, `BindingGroup.ts` |
| 7 | Les renderers « agnostiques » importent le WGSL WebGPU (`import { WebGPUShaders } from "../webgpu"`) | `SpriteRenderer.ts` |
| 8 | Séparation interfaces/implémentation non appliquée : `webgpu/` vit dans `nebula` et est ré-exporté du même barrel | `nebula/src/index.ts` |

---

## 2. Décisions de design

| Décision | Choix retenu |
|----------|--------------|
| Source de vérité des bindings | **Le WGSL**, réfléchi au runtime |
| Réflexion | **Lib existante** (`wgsl_reflect`), isolée dans le package d'implémentation |
| Forme de l'API | **En niveaux** : un chemin facile construit au-dessus d'un chemin avancé |
| Identification des groupes | **Injection = connu par construction** — index fixes `0`=frame, `1`=objet, `2+`=material |
| Chemin facile | **Auto-binding** : bloc `material { }` sans numéros → expansé → réfléchi |
| Typage | **Runtime d'abord** (validation + messages clairs), codegen `.d.ts` plus tard |
| Portée v1 | **Ergonomie shader/material + split de package** |

---

## 3. Design cible

### 3.1 Les trois tiers de bind groups

```
group 0   → FRAME     (viewProjection, time, resolution…)   MOTEUR   — injecté, rempli chaque frame
group 1   → OBJECT    (model, sourceRect…)                  RENDERER — injecté par SpriteRenderer & co
group 2+  → MATERIAL  (uniforms + textures utilisateur)     USER     — réfléchi
```

Le moteur **écrit lui-même** le texte WGSL des groupes 0 et 1 : il en connaît donc le layout par construction, sans devinette. La réflexion (`wgsl_reflect`) ne sert qu'à **dériver le layout des groupes 2+** (offsets, tailles, alignements calculés par la lib — plus jamais à la main).

### 3.2 Chemin facile — ce que l'utilisateur écrit

```wgsl
// fire.material.wgsl
material {
  tint: vec4<f32>,
  threshold: f32,
  uNoise: texture_2d<f32>,
  uSampler: sampler,
}

@fragment
fn fragment(in: FragmentInput) -> @location(0) vec4<f32> {
  let base = sampleSprite(in.uv);            // helper injecté (texture du sprite)
  let n = textureSample(uNoise, uSampler, in.uv).r;
  if (n < material.threshold) { discard; }
  return base * material.tint;
}
```

Le pré-processeur transforme `material { … }` en WGSL valide et **assigne les bindings automatiquement** :

```wgsl
struct Material { tint: vec4<f32>, threshold: f32 };
@group(2) @binding(0) var<uniform> material: Material;
@group(2) @binding(1) var uNoise: texture_2d<f32>;
@group(2) @binding(2) var uSampler: sampler;
```

…puis préfixe les préludes `frame` (group 0), `object` (group 1), la struct `FragmentInput`, un `vs_main` 2D standard et les helpers. **L'utilisateur n'écrit jamais un `@group`, un `@binding`, ni ne calcule une taille.**

### 3.3 Côté TS — une seule méthode `set`

La réflexion connaît le type de chaque champ → plus besoin de `setColor` / `setVec4` / `setMat4` séparés. Les 8 méthodes `setX` sont **collapsées en une** :

```ts
const mat = renderer.createMaterial(shader)
  .set("tint", Color.white)     // runtime : valide que "tint" existe ET est bien un vec4
  .set("threshold", 0.5)
  .set("uNoise", noiseTexture)
  .set("uSampler", sampler);
```

Une seule déclaration (le WGSL), zéro packing manuel, `set()` qui **crash tôt avec un message clair** en cas de mauvais nom ou de mauvais type.

### 3.4 Chemin avancé

WGSL complet, `@group`/`@binding` explicites, `wgsl_reflect` réfléchit **tout**. Le chemin facile n'est qu'un sucre syntaxique construit au-dessus (pré-processeur + préludes). Rien de magique en dessous : les deux niveaux partagent le même socle de réflexion.

---

## 4. Le split de package

Cible : `nebula` = interfaces pures + logique agnostique ; `@atlasjs/nebula-webgpu` = implémentation.

Deux obstacles concrets à traiter :

1. **Les renderers importent le WGSL WebGPU.** Un `SpriteRenderer` « agnostique » qui embarque du WGSL est incohérent — le WGSL *est* WebGPU.
   → Le backend expose une **bibliothèque de shaders standards** (`renderer.shaders.sprite`, `.shape`). Les renderers demandent leur shader au backend au lieu de l'importer. Le WGSL vit dans `nebula-webgpu`, le renderer reste neutre.

2. **Le core leak `@webgpu/types`** (`type TextureFormat = GPUTextureFormat`).
   → Définir des unions maison dans le core (`type TextureFormat = "rgba8unorm" | …`) ; le mapper WebGPU traduit.

---

## 5. Plan par phases

Chaque phase doit compiler et tourner.

### Phase 0 — Nettoyage — ✅ TERMINÉE
- ✅ Supprimer `ShapeRenderer` + `shape.wgsl` (code mort, API fantôme, ne compilait pas).
- ✅ Réparer `WebGPURenderState` (imports cassés + champs morts `material`/`objectBindings`) — découvert pendant le nettoyage.
- ✅ Collapse `Material` / `BindingGroup` : les 8 méthodes `setX` remplacées par une seule surface `set(name, value)` + `get`. Le type attendu est dérivé de la définition, validé au runtime (crash tôt). Corrige au passage un bug latent dans `WebGPUMaterial.clone()`.
- ✅ Types manquants ajoutés :
  - `@atlasjs/math` : nouvelles classes `Vec3`, `Vec4`, `Mat3` (column-major).
  - `nebula` : types `vec3`/`vec4`/`mat3` câblés dans `BindingGroupProperty`, `BindingValue`, `SHADER_PROPERTY_SIZES`/`_LAYOUTS` (alignements WGSL corrects : `vec3` align 16, `mat3x3` stride 48 colonnes paddées), le packing (`BindingGroupLayoutHelper`), les type-guards, et le mapper de format de sommet.
  - Démonstration : `SpriteRenderer.sourceRect` migré de `buffer` + packing manuel `Float32Array` → `vec4` propre.
- ⏳ **Différé** — `ivec*` (vecteurs d'entiers) : peu prioritaire, pas de type `IVec*` dans `math`. À réévaluer si un besoin concret apparaît.

> Validé : `tsc --noEmit` sur `nebula` = 0 erreur, `pnpm build` (math + nebula) = OK. Packing `vec3`/`vec4`/`mat3` vérifié contre le code réel (offsets, padding colonne, longueur, throw sur mauvais type). Les erreurs restantes de l'app `webgpu` sont dans `ecs.ts` (API `nexus`), hors périmètre.

> ⚠️ Bug pré-existant repéré (hors périmètre, tâche de fond créée) : le court-circuit par référence dans `BindingGroup.set()` ne bumpe pas `version` pour une instance mutée en place → un sprite en mouvement se figerait à sa transform de la 1ère frame (masqué car les démos sont statiques).

### Phase 1 — Réflexion (le socle) — ✅ TERMINÉE

Livré :
- Module `webgpu/reflect/WebGPUReflection` (basé sur `wgsl_reflect` v1.5.0) : `reflect(code)` → entry points + 3 groupes (`uniformBinding`/`uniformSize`/`uniformProperties`[offset,size]/`resourceProperties`[binding]/`properties`).
- `WebGPUBindingGroupDefinition` construite depuis un groupe réfléchi (porte le layout) ; `WebGPUBindingGroupLayout` **lit** ces données au lieu de recalculer ; suppression du calcul d'alignement maison (`alignTo`/`getTypeLayoutInfo`/`isResourceType`).
- `WebGPUShaderCache` : réflexion du code final (prélude + user), entry points auto-détectés, `id` = hash si absent. `WebGPUShader` reconstruit ses 3 définitions depuis la réflexion (plus de builder).
- Interfaces core nettoyées : `Shader` sans `addXProperty`, `BindingGroupDefinition` sans `add`, `ShaderDescriptor` avec `id`/entry points optionnels.
- `WebGPURenderer.init` : `globalBindings` dérivé en réfléchissant `global.wgsl` (fini le `.add(viewProjection/time)` hardcodé). `SpriteRenderer.initShader()` = `createShader({ source })`, les 6 `.addProperty` supprimés.
- Mapping types : connus→typés, inconnus→octets bruts (offset/size réfléchis) ; un slot `vec4<f32>` accepte `Vec4` ou `Color`.

> Validé end-to-end : `tsc` 0 erreur, `pnpm build` (math + nebula) OK, **app WebGPU réelle** lancée dans le navigateur → sprite texturé correctement, aucune validation error GPU. Chemin complet réflexion → pipeline → draw (packing model + sourceRect vec4 + textures) exercé.

> Note packaging : `wgsl_reflect` expose son ESM via le champ `module` (le `main` est du CJS). Vite/bundlers prennent le bon build ; en import bare sous node pur, l'export nommé n'est pas résolu (sans impact sur l'app).

Décisions verrouillées :
- **Autorité layout = réflexion.** Les offsets/tailles/bindings viennent de `wgsl_reflect` (v1.5.0). On supprime le calcul d'alignement maison (`BindingGroupLayoutHelper.getUniformProperties`/`getResourceProperties`/`alignTo`) ; on garde uniquement `packUniformBuffer`/`writeUniformValue` (valeur→octets aux offsets fournis).
- **3 groupes dérivés.** On réfléchit le shader final (prélude global injecté + code). Les définitions global(0)/object(1)/material(2) sont toutes dérivées. Disparaissent : les `.addXProperty()` de `SpriteRenderer.initShader()` ET le `globalBindingsDefinition.add(...)` de `WebGPURenderer.init` (le global sera dérivé en réfléchissant `global.wgsl`).
- **API `Shader` nettoyée.** Suppression de `addMaterialProperty`/`addObjectProperty`/`addGlobalProperty` ; les `*Definition` deviennent read-only dérivées. Entry points auto-détectés (`@vertex`/`@fragment`) → optionnels ; `id` optionnel (hash de la source). Cible : `createShader({ source })`.
- **Mapping types.** Connus (`f32`→float, `vecN`→vecN, `mat3x3`/`mat4x4`→mat3/mat4, `i32`→int, `texture_2d`→texture2D, `sampler`→sampler) → packing typé. Inconnus (`array`, struct imbriqué, `mat2x2`, `u32`, `f16`) → slot octets bruts (ArrayBufferView écrit à l'offset/size réfléchis, plus aucune taille manuelle). Un slot `vec4<f32>` accepte `Vec4` **ou** `Color`.

API `wgsl_reflect` utilisée : `new WgslReflect(code)` → `.getBindGroups()` (array[group] d'array[binding] de `VariableInfo` : `.name`/`.binding`/`.resourceType`/`.type.name`/`.size`/`.members[{name,type,offset,size}]`) + `.entry.vertex`/`.entry.fragment` (`.name`).

### Phase 2 — Préludes + chemin facile — ✅ TERMINÉE (authoring)

Décidé au grill : format = **une source WGSL avec bloc `material { }`** (pas de descriptor TS) ; périmètre = **authoring seul** (le branchement `Sprite.material` reste une phase d'intégration scene/gameplay ultérieure).

Livré : `webgpu/authoring/MaterialShaderBuilder`
- `defineMaterial(source): ShaderDescriptor` — l'utilisateur écrit **uniquement** un bloc `material { name: type, ... }` (sans `@group`/`@binding`) + une fonction `@fragment` (via `FragmentInput` injecté).
- Le builder assemble : prélude object (group 1, `model`) + vertex 2D standard (`VertexInput`/`FragmentInput`/`vs_main`) + group material expansé (struct `Material` + `@group(2)` auto-bindés, uniforms d'abord puis ressources, **sans trou de binding**) + le code utilisateur. Le prélude global (group 0) est préfixé par le `WebGPUShaderCache` existant.
- Convention : uniforms via `material.<nom>`, ressources par leur nom nu. Le résultat passe par le pipeline `createShader` normal → réflexion Phase 1 → aucune logique parallèle.
- Exemple : `apps/webgpu/src/easy-material.ts`.

> Validé end-to-end : `tsc` 0 erreur, `pnpm build` OK, **app WebGPU réelle** → quad texturé + teinté via un material easy-path (`material.set("tint", Vec4)` visible), 0 validation error. La sortie WGSL générée a été inspectée (bindings 0/1/2 auto-assignés corrects).

### Phase 3 — Split de package

Mené en deux temps (décidé au grill) : **3a découplage in-place**, puis **3b extraction physique**.

#### Phase 3a — Découplage in-place — ✅ TERMINÉE
- Seam backend : `ResourceFactory.createSpriteShader(): Shader`. `WebGPURenderer` l'implémente (`createShader(WebGPUShaders.Texture2D)`) ; `SpriteRenderer` l'appelle au lieu d'importer `WebGPUShaders`. Plus aucun fichier hors `webgpu/` n'importe l'implémentation.
- Purge `@webgpu/types` du core : `TextureFormat`/`Topology` deviennent des unions maison (valeurs = littéraux GPU valides, donc assignables côté backend). Le core n'importe plus aucun type WebGPU.

> Validé : `tsc` 0 erreur, `pnpm build` OK, **app WebGPU réelle** → sprite rendu identique, 0 validation error. `grep` confirme : `core`/`renderers`/`scene`/`graphics` totalement découplés de `webgpu/`.

> Note : le backend `@atlasjs/pixi` (`PixiRenderer`) est **périmé** (n'implémente ni `createShader`/`createMaterial`/`createPipeline`, donc pas le `ResourceFactory` actuel) — hors périmètre, laissé tel quel.

#### Phase 3b — Extraction physique — ✅ TERMINÉE
- Nouveau package **`@atlasjs/nebula-webgpu`** (`git mv` de `src/webgpu/**` → `nebula-webgpu/src`, historique préservé). Contient l'implémentation, les `.wgsl`, la réflexion, l'authoring (`defineMaterial`).
- Deps migrées : `wgsl_reflect` + `@webgpu/types` retirées de `nebula`, ajoutées à `nebula-webgpu` (qui dépend de `@atlasjs/nebula`/`math`/`utils`). Imports internes `../core` → `@atlasjs/nebula`.
- `nebula` : barrel sans `./webgpu`, plus aucune dépendance WebGPU, tsconfig sans `types: ["@webgpu/types"]`. Le core est désormais un package d'interfaces + logique agnostique.
- `apps/webgpu` : `WebGPURenderer`/`defineMaterial` importés depuis `@atlasjs/nebula-webgpu`, les interfaces depuis `@atlasjs/nebula`.

> Validé : `tsc` 0 erreur sur `nebula` ET `nebula-webgpu`, `turbo build` (ordre `nebula` → `nebula-webgpu`) OK, **app WebGPU réelle** → sprite rendu identique, 0 validation error. Blast radius confirmé minimal : seul `apps/webgpu` consommait un symbole WebGPU depuis `nebula` ; `sandbox`/`gameplay`/`editor` n'utilisent que les interfaces.

---

## Bilan

Les 4 phases sont livrées et vérifiées end-to-end. La douleur initiale (double déclaration WGSL ↔ TS, packing manuel, groupes fragiles) est éliminée : le WGSL est l'unique source de vérité, la réflexion dérive tout, le chemin facile (`defineMaterial`) réduit un material à un bloc `material { }` + un fragment, et l'architecture est proprement séparée (`@atlasjs/nebula` interfaces / `@atlasjs/nebula-webgpu` implémentation).

### Correctif — Versioning des binding groups — ✅ FAIT

Bug repéré en Phase 0 : `WebGPUBindingGroup.set()` court-circuitait sur `values.get(name) === value`, donc ne bumpait pas `version` quand on repassait une **même instance mutée en place** (ex. la matrice `model` réutilisée chaque frame par `SpriteRenderer`). Résultat : un sprite en mouvement se figeait à sa transform de la 1ère frame.

Fix (dans `@atlasjs/nebula-webgpu`) :
- Suppression du court-circuit par référence : tout `set()` marque le groupe dirty.
- Versioning dédoublé : `version` (tout changement → re-upload du buffer uniforme) vs `resourceVersion` (changement de texture/sampler → reconstruction du bind group). `WebGPUCompiledBindingGroup.update()` gate les deux séparément, donc un sprite animé re-upload ses uniformes chaque frame **sans** reconstruire son bind group inutilement.

> Validé : sprite animé (translation par frame) → mouvement visible à l'écran (avant : figé), 0 validation error.

### Pistes futures (hors périmètre)
- Plugin Vite de codegen `.d.ts` (typage compile-time de `set()`).
- Branchement `Sprite.material` (effets custom directement sur les sprites).

### Phase 4 — Tooling (plus tard)
- Plugin Vite : parse les `.wgsl` et génère des `.d.ts` pour l'autocomplétion / le type-check de `set()`.

---

## 6. Invariants à préserver

- Le `core` de `nebula` reste **backend-agnostique** : aucun import `@webgpu/types`, aucun WGSL.
- La réflexion (calcul d'alignement std140/std430) est **déléguée à la lib**, jamais réécrite à la main.
- Chemin facile et chemin avancé partagent **le même socle** — le facile n'est que du sucre.
- `set()` échoue **tôt et clairement** plutôt que de produire un rendu faux silencieux.
