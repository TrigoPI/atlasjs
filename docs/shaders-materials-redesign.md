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

### Phase 0 — Nettoyage (rapide, sans risque) — ✅ FAIT (partiel)
- ✅ Supprimer `ShapeRenderer` + `shape.wgsl` (code mort, API fantôme, ne compilait pas).
- ✅ Réparer `WebGPURenderState` (imports cassés + champs morts `material`/`objectBindings`) — découvert pendant le nettoyage.
- ✅ Collapse `Material` / `BindingGroup` : les 8 méthodes `setX` remplacées par une seule surface `set(name, value)` + `get`. Le type attendu est dérivé de la définition, validé au runtime (crash tôt). Corrige au passage un bug latent dans `WebGPUMaterial.clone()`.
- ⏳ **Différé** — Ajouter les types manquants `vec3`, `vec4`, `mat3`, `ivec*` : nécessite d'étendre `@atlasjs/math` (n'expose aujourd'hui que `Vec2`/`Mat4`). À faire quand la réflexion (Phase 1) aura précisé les types réellement requis, ou en sous-chantier dédié côté `math`.

> Validé : `tsc --noEmit` sur `nebula` = 0 erreur, `pnpm build` (tsdown) = OK. Les erreurs restantes de l'app `webgpu` sont dans `ecs.ts` (API `nexus`), hors périmètre.

### Phase 1 — Réflexion (le socle)
- Intégrer `wgsl_reflect` dans l'implémentation WebGPU.
- `WebGPUShaderCache` : après compilation, réfléchir → dériver `materialDefinition` / layouts au lieu des `.addXProperty()` manuels. `SpriteRenderer.initShader()` (les 6 `.addProperty`) disparaît.

### Phase 2 — Préludes + chemin facile
- Formaliser l'injection frame (group 0) + object (group 1) — généralise le `global.wgsl` déjà prependé.
- Écrire le pré-processeur `material { }` → WGSL + auto-binding, puis réflexion sur le résultat.

### Phase 3 — Split de package
- Extraire `@atlasjs/nebula-webgpu` ; `nebula` ne garde que `core/` + renderers + scene + graphics.
- Bibliothèque de shaders exposée par le backend (règle le couplage `SpriteRenderer` → WGSL).
- Purger les types `@webgpu/types` du core.

### Phase 4 — Tooling (plus tard)
- Plugin Vite : parse les `.wgsl` et génère des `.d.ts` pour l'autocomplétion / le type-check de `set()`.

---

## 6. Invariants à préserver

- Le `core` de `nebula` reste **backend-agnostique** : aucun import `@webgpu/types`, aucun WGSL.
- La réflexion (calcul d'alignement std140/std430) est **déléguée à la lib**, jamais réécrite à la main.
- Chemin facile et chemin avancé partagent **le même socle** — le facile n'est que du sucre.
- `set()` échoue **tôt et clairement** plutôt que de produire un rendu faux silencieux.
