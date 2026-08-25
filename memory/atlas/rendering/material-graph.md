---
status: planned
summary: "Sérialisation et éditeur de graphe de materials : design cadré, non implémenté, document de vision."
---
# Materials — Sérialisation & éditeur de graphe (vision long terme)

> Statut : **design cadré, non implémenté.** Document de vision.
> Objectif : préparer le système de material à (1) la sérialisation load/save, (2) un éditeur de graphe type Unity Shader Graph / Unreal Material Editor — le tout **code-first d'abord**, l'éditeur n'étant qu'une UI qui se branche sur la lib.

---

## 1. Principes directeurs

- **Code-first d'abord.** Tout (instancier un material, construire un graphe, sérialiser, désérialiser) se fait en code, sans éditeur. L'éditeur ne fait que manipuler les mêmes modèles de données et appeler les mêmes fonctions.
- **L'éditeur se branche, il n'est pas privilégié.** Il lit le registre de nœuds (palette), lit/écrit le graphe (JSON), appelle `compile`. Aucune logique spécifique éditeur ne vit dans la lib.
- **Réutilise le pipeline existant.** Un graphe compile vers du **WGSL** (source `material { }` + fragment), qui repart par le `createShader` + réflexion déjà en place (voir `memory/atlas/rendering/shaders-materials.md`). Le graphe est une couche d'authoring AU-DESSUS ; rien en dessous ne change.
- **Modularité.** Le core reste agnostique ; le graphe (qui émet du WGSL) vit dans son propre package optionnel.

---

## 2. Architecture en deux tiers

Deux artefacts distincts, sérialisables indépendamment (comme Unity : `.shadergraph` vs `.mat`) :

```
Tier 2 — GRAPHE / TEMPLATE  (réseau de nœuds)     →  compile vers un Shader (WGSL)
                                                        ▲ réutilisable
Tier 1 — MATERIAL INSTANCE  (réf shader + valeurs) ─────┘  N instances varient les paramètres
```

- **Tier 1 (instance)** est indépendant du graphe : il marche aussi pour un shader WGSL écrit à la main. C'est la fondation, à faire en premier.
- **Tier 2 (graphe)** est la couche d'authoring visuel ; il produit un shader que des instances référencent.

---

## 3. Tier 1 — Material instance (fondation)

### Modèle sérialisable (`MaterialData`, POJO)

```jsonc
{
  "version": 1,
  "shader": "atlas.shader.fire",          // id → résolu via un registre
  "values": {
    "tint":      [1.0, 0.4, 0.4, 1.0],    // vec4/color → tableau
    "intensity": 2.0,                      // float → nombre
    "uNoise":    { "texture": "noise_01" },// TextureHandle (asset), jamais l'objet GPU
    "uSampler":  { "sampler": { "minFilter": "nearest", "magFilter": "nearest" } }
  }
}
```

- Valeurs scalaires/vecteurs/couleurs/matrices → nombres / tableaux (JSON trivial).
- Textures → `{ texture: TextureHandle }` (le `TextureHandle` d'`@atlasjs/assets`).
- Samplers → `{ sampler: SamplerDescriptor }` (objet valeur, sérialisable tel quel).
- Shader → **id** vers un asset séparé (normalisé : un shader → N materials).

### Résolution : `materialize` / `dematerialize`

Le POJO ⇄ JSON est trivial. La reconstruction d'un `Material` vivant passe par des **resolvers injectés** (aucun global caché) :

```ts
interface ShaderResolver  { resolve(id: string): Shader; }
interface TextureResolver { resolve(handle: TextureHandle): Texture2D; } // GPU texture

function materialize(data: MaterialData, r: { shader: ShaderResolver; texture: TextureResolver }): Material;
function dematerialize(material: Material): MaterialData;
```

- `materialize` : résout l'id de shader → `Shader`, chaque `TextureHandle` → texture GPU (via `AssetManager` + `renderer.createTexture2D`), applique les valeurs via `material.set(...)`.
- `dematerialize` : lit `shader.id` + les valeurs du binding group du material, ré-encode textures→handle.
- L'app fournit les resolvers ; l'éditeur/asset-system fournit les siens. Testable en isolation.

### Emplacement

`@atlasjs/nebula` (core) — c'est l'abstraction `Material`, data pure + interfaces de resolvers. Agnostique, aucune dépendance WebGPU.

---

## 4. Tier 2 — Material graph

### Portée

Le graphe produit la **surface/fragment** sur le pipeline 2D standard (le vertex standard est injecté, cf. chemin facile Phase 2). Ses nœuds « property » deviennent le bloc `material { }` ; le **master node** sort une couleur (`vec4`). Le WGSL complet reste le chemin avancé, hors graphe.

### Modèle de données

Un DAG sérialisable :

```jsonc
{
  "version": 1,
  "id": "atlas.shader.fire",
  "nodes": [
    { "id": "n1", "type": "property.texture", "props": { "name": "uNoise" } },
    { "id": "n2", "type": "input.uv" },
    { "id": "n3", "type": "sampleTexture" },
    { "id": "n4", "type": "property.color", "props": { "name": "tint" } },
    { "id": "n5", "type": "multiply" },
    { "id": "out", "type": "master.color" }
  ],
  "edges": [
    { "from": "n1.texture", "to": "n3.texture" },
    { "from": "n2.uv",      "to": "n3.uv" },
    { "from": "n3.rgba",    "to": "n5.a" },
    { "from": "n4.value",   "to": "n5.b" },
    { "from": "n5.result",  "to": "out.color" }
  ]
}
```

### Registre de types de nœuds (extensible)

Chaque type de nœud = un **descripteur** : id, catégorie, nom d'affichage, ports d'entrée/sortie typés, et une règle de **codegen** (souvent un template d'expression WGSL, une fonction pour les cas complexes).

```ts
registerNode({
  type: "multiply",
  category: "math",
  inputs:  [{ name: "a", type: "float|vec2|vec3|vec4" }, { name: "b", type: "..." }],
  outputs: [{ name: "result", type: "..." }],
  emit: (i) => `(${i.a} * ${i.b})`,        // template WGSL
});
```

- Built-ins enregistrés par la lib ; plugins/utilisateurs enregistrent leurs propres types.
- **L'éditeur lit ce même registre** pour sa palette et la validation de ports → une seule source de vérité pour code + éditeur.
- Nœuds « property » : déclarent une entrée du bloc `material { }` (uniform ou texture/sampler) + exposent un port de sortie.

### Compilation → WGSL

Un walker générique fait un tri topologique du DAG depuis le master node, appelle le template de chaque nœud pour émettre les expressions WGSL, collecte les property nodes en `material { }`, et assemble la source easy-path (Phase 2) :

```
graphe → { materialBlock, fragmentBody } → source `material { } + @fragment` → createShader (réflexion Phase 1)
```

La source générée est hashée → réutilise le cache de shaders (Phase 1). Un graphe inchangé → même id de shader → 0 recompilation.

### API code-first (fondation)

Builder impératif mappant 1:1 le modèle nœud/lien (donc **le même artefact que l'éditeur**) :

```ts
const g = new MaterialGraph();
const uv   = g.node("input.uv");
const tex  = g.node("property.texture", { name: "uNoise" });
const tint = g.node("property.color",   { name: "tint" });
const samp = g.node("sampleTexture");
const mul  = g.node("multiply");

g.connect(tex.out("texture"), samp.in("texture"));
g.connect(uv.out("uv"),       samp.in("uv"));
g.connect(samp.out("rgba"),   mul.in("a"));
g.connect(tint.out("value"),  mul.in("b"));
g.setOutput(mul.out("result"));

const shader = g.compile(renderer);   // → Shader (via WGSL + createShader)
```

Un DSL fluide (`sample(tex, uv).mul(tint)`) pourra venir plus tard en **sucre au-dessus** du builder, pas à sa place.

### Emplacement

Nouveau package **`@atlasjs/material-graph`** : modèle de graphe, registre de nœuds, bibliothèque de nœuds WGSL built-in, walker de compilation, sérialisation. Dépend de `@atlasjs/nebula` (types/`Material`) et produit du WGSL qui repart par le backend. Optionnel, plugin-friendly (le core n'en dépend pas).

> Note multi-backend : le modèle nœud/lien est neutre, mais les templates de nœuds sont aujourd'hui du WGSL. Si un backend GLSL arrive, les descripteurs porteront des templates par cible. Pas de sur-ingénierie tant que le moteur est WGSL-only.

---

## 5. Versioning du format

Chaque artefact sérialisé (instance ET graphe) porte un champ `version`. Au load, un **pipeline de migrations** (`v1 → v2 → …`) upgrade l'ancien vers le format courant. À poser léger dès le départ (réserver le champ + un seam `migrate(data): data`), migrations écrites au fur et à mesure. Objectif : ne jamais casser les assets déjà sauvegardés.

---

## 6. Le seam éditeur

L'éditeur (hors de cette lib, se branche dessus) n'a besoin que de :
1. **Lire le registre de nœuds** → construire la palette + valider les connexions (compat de types de ports).
2. **Lire/écrire le graphe JSON** → charger/sauver un `.material-graph`.
3. **Appeler `compile`** → obtenir le shader pour la preview.
4. **Manipuler les instances** via `materialize`/`dematerialize` pour l'aperçu des paramètres.

Rien de spécifique éditeur ne vit dans la lib : c'est un pur consommateur des mêmes modèles/registre/fonctions que le code-first.

---

## 7. Ordre de mise en œuvre suggéré

1. **Tier 1 dans `@atlasjs/nebula`** : `MaterialData` + `materialize`/`dematerialize` + interfaces resolvers + champ `version`. (Fondation, indépendante du graphe.)
2. **`@atlasjs/material-graph`** : modèle nœud/lien + registre + walker de compilation vers la source easy-path + builder code-first + sérialisation versionnée.
3. **Bibliothèque de nœuds WGSL** built-in (inputs, math, sampling, master).
4. (Plus tard) DSL fluide ; branchement éditeur.

---

## 8. Détails de design ouverts (à trancher à l'implémentation)

- Système de types de ports exact (float/vecN/color/texture/sampler) et conversions (splat float→vecN implicite ou nœuds de conversion explicites — pencher pour explicite d'abord).
- Nommage/défauts des property nodes → membres `material { }`.
- Granularité de la bibliothèque de nœuds v1.
- Validation du graphe (cycles interdits, ports non connectés, types incompatibles) au build.
