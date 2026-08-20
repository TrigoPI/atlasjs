# Système d'assets — descripteur sérialisable ↔ handle runtime

> Statut : **implémenté** (Tasks 1–7, branche `claude/feat/asset-manager`). Définit ce qu'est un « asset » dans AtlasJS et le chemin de chargement (`AssetManager` + loaders enregistrés par type). Premier package concerné : `@atlasjs/assets` (contrats + manager, feuille générique). Extensions différées (refcount/eviction/hot-reload, `AssetRef` par id + sérialisation de scènes, audio, éditeur) → `docs/backlog/`.

## Contexte

Le système d'asset actuel est bancal et repose sur une seule tranche minimale posée lors du redesign sprite (`docs/rendering/sprites.md`) :

- `@atlasjs/assets` expose un unique contrat `Asset = { id, kind, dispose() }`.
- `Sprite` (gameplay) implémente ce contrat **mais encapsule une `Texture2D` déjà chargée** (une ressource GPU vivante). Ce n'est donc pas un objet sérialisable : il tient un handle runtime.
- Le chargement est 100 % manuel, au niveau application : `apps/dino-brawl/src/game/EcsScene.ts` fait `new Image()` → `decode()` → `createImageBitmap` → `nebula.createTexture2D(...)` à la main. Aucun manager, aucun cache, aucun dédoublonnage.
- `Texture2D` est une ressource GPU (`__kind`, `width`, `height`, `id`, `destroy()` via `Disposable`). Non sérialisable par nature.

Deux concepts distincts sont aujourd'hui écrasés en un seul objet « asset ». Ce document les sépare proprement avant de faire grossir le système.

## Le problème central : un asset, c'est **deux** choses, pas une

1. **Le descripteur** — un POJO **sérialisable**, sans comportement runtime, qui décrit *quoi charger* : `{ type: "texture", source, format }`. C'est ce qu'un fichier de scène / un prefab / le futur compilateur écriront sur disque.
2. **Le handle chargé** — la ressource vivante en mémoire (le `Texture2D` GPU, un futur buffer audio décodé). Non sérialisable, possède une **durée de vie** → c'est *lui* qui porte `destroy()`.

Le contrat `Asset` actuel (`id + kind + dispose`) décrit en réalité le **handle chargé**, pas le descripteur : `dispose()` n'a aucun sens sur un POJO sérialisable. On nomme donc les deux séparément.

## Objectifs

- Poser un couple de contrats de base **`Asset` (descripteur) ↔ `Resource` (handle)**.
- Fournir un **`AssetManager`** : `register` / `load` (async, cache + dédup par `id`) / `get` (sync), qui délègue le `descripteur → handle` à des **loaders enregistrés par type** (point d'extension plugin).
- Faire **composer** le chargement : charger un `SpriteAsset` charge d'abord sa dépendance `TextureAsset`.
- Migrer les paires concrètes v1 : `TextureAsset → Texture2D` (nebula), `SpriteAsset → Sprite` (gameplay).
- Tuer le `loadTexture` manuel de `dino-brawl`.
- **Compagnon** : lever la collision de nom `Sprite` en renommant les nodes du scene-graph nebula en `*Node` (voir §7).

## Non-objectifs (hors périmètre v1 → backlog)

- **Refcount / eviction / hot-reload** (lié au backlog B1 « Resource lifecycle / eviction »).
- **`AssetRef` (référence par id)** + (dé)sérialisation de scènes/prefabs. La v1 référence les dépendances **par valeur** (composition) ; les refs par id viendront avec l'ère compilateur/éditeur.
- **Assets audio** (nécessitera un package audio qui enregistrera son propre loader).
- **Éditeur / base d'assets** (asset database, GUID stables cross-version).
- **Sources non-path** (bytes bruts, textures procédurales, render targets). `source: string` (path/url) en v1, le contrat reste ouvert à l'extension.

## Décisions

| # | Décision | Raison |
|---|----------|--------|
| Deux couches | `Asset` (descripteur sérialisable, `type` + `id`, **sans** `dispose`) ↔ `Resource` (handle runtime, `id` + `destroy()`) | `dispose()` n'appartient qu'à la ressource vivante |
| Nommage | `Asset` = descripteur, `Resource` = handle | Colle au sens « un asset est un objet sérialisable » ; `Resource` s'aligne sur `nebula/core/resources/` où `Texture2D` vit déjà |
| Méthode de vie | `Resource.destroy()` (pas `dispose()`) | Aligné sur le `Disposable` de nebula (`destroy()`) ; le `dispose()` de l'`Asset` actuel était l'exception |
| Références | **Par valeur** (composition) : `SpriteAsset` contient un `TextureAsset` | Ergonomie code-first identique à aujourd'hui, dédup par `id` dérivé ; `AssetRef` par id différé |
| Placement | Descripteurs + loaders **près de leur domaine** : `TextureAsset`/`TextureLoader` dans nebula, `SpriteAsset`/`SpriteLoader` dans gameplay | `@atlasjs/assets` reste une feuille 100 % générique (core indépendant des systèmes optionnels) |
| Loaders | Un `AssetLoader<A, R>` par `type`, enregistré dans le manager par le plugin du domaine | Point d'extension plugin ; le manager ne dépend d'aucun backend |
| Dédup | `load(asset)` d'un même `id` renvoie la **même** instance de `Resource` (cache par la Promise) | Une texture partagée par N sprites = 1 seul `Texture2D` GPU |
| Lifetime v1 | Le manager retient les resources chargées et les `destroy()` toutes au teardown. **Pas de refcount.** | Refcount/eviction = backlog B1, hors périmètre |
| Nommage scene-graph | Les primitives renderables de nebula adoptent le suffixe `*Node` (`SpriteNode`, `RectNode`, `ShapeNode`, `CircleNode`, `LineNode`) | Lève la collision `Sprite` (node) ↔ `Sprite` (asset) à la source (fin de l'alias d'import) et auto-documente le scene-graph ; s'alignait aussi sur l'ancien `packages/editor`, supprimé depuis |

## Architecture

```
Asset (contrat descripteur)      @atlasjs/assets   ← générique, sérialisable, sans backend
Resource (contrat handle)        @atlasjs/assets   ← générique, id + destroy()
AssetLoader<A, R> (seam)         @atlasjs/assets   ← point d'extension plugin
AssetManager                     @atlasjs/assets   ← orchestrateur (register/load/get)
AssetPlugin + token ASSET_MANAGER @atlasjs/assets

TextureAsset (Asset)             @atlasjs/nebula   ← { source, format? }
TextureLoader (AssetLoader)      @atlasjs/nebula   ← Image → bitmap → createTexture2D
Texture2D                        @atlasjs/nebula   ← devient un Resource (a déjà id + destroy)

SpriteAsset (Asset)              @atlasjs/gameplay ← { texture: TextureAsset, rect?, pivot? }
SpriteLoader (AssetLoader)       @atlasjs/gameplay ← ctx.load(texture) puis new Sprite(...)
Sprite                           @atlasjs/gameplay ← devient un Resource (handle, no-op destroy)
```

Dépendances : `assets` reste une feuille (dépend de `core`, `utils`). `nebula` et `gameplay` dépendent de `assets`. Aucun cycle (`assets` n'importe jamais un backend).

### 1. Contrats (`@atlasjs/assets`)

```ts
export interface Asset {
  readonly type: string;
  readonly id: string;
}

export interface Resource {
  readonly id: string;
  destroy(): void;
}

export interface LoadContext {
  load<R extends Resource>(asset: Asset): Promise<R>;
}

export interface AssetLoader<A extends Asset, R extends Resource> {
  readonly type: string;
  load(asset: A, ctx: LoadContext): Promise<R>;
}
```

- `Asset` : `type` = discriminant (choisit le loader), `id` = identité stable / clé de cache. **Aucun** `dispose`.
- `Resource` : `id` (= l'id de l'`Asset` dont il provient) + `destroy()`. Structurellement compatible avec le `Disposable` de nebula, sans le référencer (pas de dépendance `assets → nebula`).
- `LoadContext` : passé aux loaders pour charger leurs dépendances **via le même manager** (donc cachées/dédupées elles aussi). Interface volontairement minimale, extensible (progress/cancel plus tard).
- `AssetLoader<A, R>` : un par `type`. C'est le seul endroit qui connaît le « comment charger ».

### 2. `AssetManager` (`@atlasjs/assets`)

```ts
export class AssetManager implements LoadContext {
  public register<A extends Asset, R extends Resource>(loader: AssetLoader<A, R>): void;
  public load<R extends Resource>(asset: Asset): Promise<R>;
  public get<R extends Resource>(id: string): R | undefined;
  public destroy(): void;
}
```

Comportement :

- `register(loader)` : indexe le loader par `loader.type`. Deux loaders pour le même `type` → erreur explicite.
- `load(asset)` :
  1. Si `asset.id` est déjà en cours/chargé → renvoie la **Promise en cache** (dédup, y compris les chargements concurrents).
  2. Sinon, résout le loader par `asset.type` (absent → erreur claire), l'appelle avec `this` comme `LoadContext`, met la Promise en cache, et enregistre la `Resource` résolue dans une map `id → Resource` à la résolution.
- `get(id)` : renvoie la `Resource` déjà résolue, ou `undefined` (accès sync, pas de chargement).
- `destroy()` : `destroy()` toutes les resources retenues et vide les caches (teardown du plugin). Pas de refcount en v1.

Erreurs : `type` sans loader enregistré, loader qui throw → remontées telles quelles (Promise rejetée), avec un message identifiant l'`asset.id`/`type`.

### 3. `AssetPlugin` + token (`@atlasjs/assets`)

```ts
export const ASSET_MANAGER: ServiceToken<AssetManager> =
  ServiceRegistry.createToken("ASSET_MANAGER");

export class AssetPlugin extends Plugin {
  public constructor() {
    super("asset-plugin", { provides: [ASSET_MANAGER] });
  }
  public async install(engine: Engine): Promise<void> {
    engine.services.provide(ASSET_MANAGER, new AssetManager());
    this.deferred.resolve();
  }
  public async uninstall(): Promise<void> {
    // manager.destroy() au teardown
  }
}
```

Convention identique à `SCRIPT_MANAGER` / `NEBULA_RENDERER`.

### 4. `TextureAsset` + `TextureLoader` + `Texture2D → Resource` (`@atlasjs/nebula`)

```ts
export interface TextureAssetOptions {
  readonly id?: string;
  readonly format?: TextureFormat;
}

export class TextureAsset implements Asset {
  public readonly type: string = "texture";
  public readonly id: string;
  public readonly source: string;
  public readonly format?: TextureFormat;
  public constructor(source: string, options?: TextureAssetOptions);
  // id par défaut : `texture:${source}`
}

export class TextureLoader implements AssetLoader<TextureAsset, Texture2D> {
  public readonly type: string = "texture";
  public constructor(private readonly nebula: NebulaRenderer);
  public async load(asset: TextureAsset): Promise<Texture2D> {
    // corps de l'actuel EcsScene.loadTexture :
    // new Image() → image.src = asset.source → await image.decode()
    // → createImageBitmap(image, { imageOrientation: "flipY" })
    // → this.nebula.createTexture2D({ source, width, height, format: asset.format })
  }
}
```

- `Texture2D` (contrat nebula) devient un `Resource` : il a déjà `id` + `destroy()`. On rend la conformité explicite (`interface Texture2D extends Resource`), le `Disposable` restant compatible (même signature `destroy()`).
- La logique DOM (`Image`/`createImageBitmap`) vit dans le loader, encapsulée — nebula reste browser-first, cohérent avec WebGPU.

### 5. `SpriteAsset` + `SpriteLoader` + `Sprite → Resource` (`@atlasjs/gameplay`)

```ts
export interface SpriteAssetOptions {
  readonly rect?: Bound;
  readonly pivot?: Vec2;
  readonly id?: string;
}

export class SpriteAsset implements Asset {
  public readonly type: string = "sprite";
  public readonly id: string;
  public readonly texture: TextureAsset;
  public readonly rect?: Bound;
  public readonly pivot?: Vec2;
  public constructor(texture: TextureAsset, options?: SpriteAssetOptions);
  // id par défaut : `sprite:${texture.id}:${rect?}:${pivot?}` (même logique que l'actuel Sprite.id)
}

export class SpriteLoader implements AssetLoader<SpriteAsset, Sprite> {
  public readonly type: string = "sprite";
  public async load(asset: SpriteAsset, ctx: LoadContext): Promise<Sprite> {
    const texture: Texture2D = await ctx.load<Texture2D>(asset.texture);
    return new Sprite(texture, { rect: asset.rect, pivot: asset.pivot, id: asset.id });
  }
}
```

- `Sprite` (handle, `packages/gameplay/src/assets/Sprite.ts`) passe de `implements Asset` à `implements Resource` : `dispose()` → `destroy()` (reste un no-op, `Sprite` ne possède pas la texture), on retire `kind` (le discriminant `type` vit sur le descripteur).
- Le constructeur `new Sprite(texture, options)` est conservé (appelé par le loader).
- Grâce au renommage §7, `Sprite` désigne désormais **sans ambiguïté** ce handle d'asset (le node nebula devient `SpriteNode`). Le `import { Sprite as SpriteNode }` du `SpriteRenderSystem` disparaît au profit d'un import direct de `SpriteNode`.
- `SpriteRender` (L1) et `SpriteRendererComponent` (L2) sont **inchangés** : ils tiennent toujours un `Sprite` (handle). Seule la façon de *l'obtenir* change (via `assets.load(spriteAsset)`).

### 6. Câblage plugins (`requires` / `provides`)

- `AssetPlugin` : `provides: [ASSET_MANAGER]`.
- `NebulaPlugin` : ajoute `requires: [ASSET_MANAGER]` ; dans `install`, `const assets = await engine.services.wait(ASSET_MANAGER); assets.register(new TextureLoader(renderer));`.
- `GameplayPlugin` : ajoute `ASSET_MANAGER` à `requires` ; dans `install`, `assets.register(new SpriteLoader())`.

> **Couplage assumé** : `NebulaPlugin` requiert désormais `AssetPlugin` (on ne peut plus booter Nebula sans le système d'asset). C'est le prix de la déclaration plugin (pas de « requires optionnel »), et le chargement de texture est assez central pour le justifier. Alternative écartée pour v1 : un plugin-pont dédié qui enregistre le `TextureLoader` — sur-ingénierie tant qu'il n'y a qu'un loader par domaine.

### 7. Renommage scene-graph → convention `*Node` (`@atlasjs/nebula`)

Décision compagnon de ce redesign : toutes les primitives renderables du scene-graph de nebula adoptent le suffixe `*Node`. Motivation directe : lever la collision `Sprite` (node) ↔ `Sprite` (asset) **à la source** (fin de l'alias d'import), et auto-documenter le rôle « nœud de scène » (l'ancien `packages/editor`, supprimé depuis, attendait déjà `RectNode`).

| Avant | Après |
|---|---|
| `Sprite` | `SpriteNode` |
| `Shape` | `ShapeNode` |
| `Rect` | `RectNode` |
| `Circle` | `CircleNode` |
| `Line` | `LineNode` |

- `Node` (base) et `Transformable` gardent leur nom (déjà sans ambiguïté).
- Étape **mécanique et isolée** (aucun changement de logique) : peut atterrir en premier, avant le travail d'asset.
- Hiérarchie interne mise à jour : `RectNode`/`CircleNode`/`LineNode extends ShapeNode`, `SpriteNode extends Node`.
- Consommateurs : `AnimationPlayer.updateAndApply(sprite: SpriteNode, …)`, `SpriteRenderSystem` (import direct de `SpriteNode`), la démo `apps/webgpu` (`RectNode`/`CircleNode`/`LineNode`), plus les renderers internes (`SceneRenderer`/`SpriteRenderer`) si références de type.

## Flux de données

```
Auteur / futur compilateur :
  const tex    = new TextureAsset(BlueDino);           // descripteur (sérialisable)
  const sprite = new SpriteAsset(tex, { rect, pivot }); // descripteur, réf par valeur
              ↓ assets.load(sprite)
  AssetManager : dédup par id → SpriteLoader.load(sprite, ctx)
              ↓ ctx.load(sprite.texture)
  AssetManager : dédup par id → TextureLoader.load(tex) → Texture2D (Resource)
              ↓
  new Sprite(texture, ...) → Sprite (Resource, handle)
              ↓
  world.addComponent(entity, SpriteRender, sprite)
```

## Fichiers touchés

**`@atlasjs/assets`**
- `src/Asset.ts` : remplacer le contrat actuel par `Asset` (descripteur, sans `dispose`).
- `src/Resource.ts` (nouveau) : contrat handle.
- `src/AssetLoader.ts` + `src/LoadContext.ts` (nouveaux).
- `src/AssetManager.ts` (nouveau).
- `src/AssetPlugin.ts` + `src/tokens.ts` (nouveaux : `ASSET_MANAGER`).
- `src/index.ts` : re-exports. `package.json` : dépendance `@atlasjs/core` (déjà présente).

**`@atlasjs/nebula`**
- `src/assets/TextureAsset.ts` + `src/assets/TextureLoader.ts` (nouveaux).
- `src/core/resources/Texture2D.ts` : `extends Resource`.
- `NebulaPlugin` : `requires: [ASSET_MANAGER]` + enregistrement du loader.
- `package.json` : dépendance `@atlasjs/assets`.
- **Renommage `*Node` (§7)** : `graphics/{Sprite,Shape,Rect,Circle,Line}.ts` → `{SpriteNode,ShapeNode,RectNode,CircleNode,LineNode}.ts` (classe + fichier) ; `graphics/index.ts` (exports) ; `extends` internes ; `animations/AnimationPlayer.ts` ; `systems`/`renderers` référençant ces types.

**`@atlasjs/gameplay`**
- `src/assets/SpriteAsset.ts` + `src/assets/SpriteLoader.ts` (nouveaux).
- `src/assets/Sprite.ts` : `implements Resource`, `dispose` → `destroy`, retrait de `kind`.
- `GameplayPlugin` : `ASSET_MANAGER` dans `requires` + enregistrement du `SpriteLoader`.
- `src/assets/index.ts` + `src/index.ts` : re-exports (`SpriteAsset`, `Sprite`…).

**`apps/dino-brawl`**
- `src/game/EcsScene.ts` : supprimer `loadTexture` ; `const tex = await assets.load(new TextureAsset(BlueDino))` (pour le `SpriteSheet`) et/ou `assets.load(new SpriteAsset(...))`. Récupérer le manager via `ctx.services.get(ASSET_MANAGER)`.

**`apps/webgpu`** (démo)
- `src/index.ts` : `Rect`/`Circle`/`Line` → `RectNode`/`CircleNode`/`LineNode` (renommage §7).

**Racine**
- `docs/backlog/` + index docs du `CLAUDE.md` : référencer ce document.

## Tests

- **`AssetManager`** : `load` appelle le bon loader par `type` ; dédup (deux `load` du même `id` → même instance, une seule invocation du loader) ; dédup concurrent (deux `load` simultanés → une Promise) ; `get(id)` renvoie la resource résolue puis `undefined` pour un id inconnu ; `type` sans loader → rejet clair ; loader qui throw → rejet propagé ; `destroy()` appelle `destroy()` sur toutes les resources.
- **Composition** : charger un `SpriteAsset` déclenche exactement un chargement de sa `TextureAsset` (via un `TextureLoader` stub) ; deux sprites partageant la même texture → une seule texture chargée.
- **`TextureAsset` / `SpriteAsset`** : `id` par défaut dérivé ; surcharge via option.
- **`Sprite`** : `destroy()` no-op ; conforme à `Resource`.
- Harness existant `packages/gameplay/test/helpers/harness.ts` (boot d'un vrai `Engine`) pour l'intégration plugin.

## Risques assumés / renvois backlog

- **Pas de refcount v1** : une resource partagée n'est jamais libérée avant le teardown global. Acceptable tant que les scènes ne se déchargent pas dynamiquement → durci avec le backlog B1 (lifecycle/eviction).
- **`source: string` uniquement** : pas de bytes bruts / procédural / render target en v1. Le contrat reste ouvert (union possible plus tard) sans casser l'existant.
- **Références par valeur** : pas de sérialisation de scène tant que `AssetRef` (par id) n'existe pas. C'est un ajout additif prévu pour l'ère compilateur/éditeur.
- **Couplage `NebulaPlugin → AssetPlugin`** (voir §6).

## Checklist d'implémentation

- [x] **Renommage `*Node`** (§7, mécanique, peut atterrir en premier) : nebula `graphics` + `AnimationPlayer` + `SpriteRenderSystem` + `apps/webgpu` ; `tsc --noEmit` vert partout.
- [x] `@atlasjs/assets` : contrats `Asset` / `Resource` / `AssetLoader` / `LoadContext`.
- [x] `@atlasjs/assets` : `AssetManager` (register/load/get/destroy + dédup + erreurs).
- [x] `@atlasjs/assets` : `AssetPlugin` + token `ASSET_MANAGER` + re-exports.
- [x] `@atlasjs/nebula` : `TextureAsset` + `TextureLoader` ; `Texture2D extends Resource` ; `NebulaPlugin` requires + register ; dépendance `@atlasjs/assets`.
- [x] `@atlasjs/gameplay` : `SpriteAsset` + `SpriteLoader` ; `Sprite implements Resource` (`destroy`) ; `GameplayPlugin` requires + register ; re-exports.
- [x] `apps/dino-brawl` : migration `EcsScene` (mort au `loadTexture` manuel).
- [x] Tests (`@atlasjs/assets` + intégration gameplay).
- [x] `tsc --noEmit` sur les packages touchés + rebuild des `dist` dépendants (`assets`, `nebula`).
- [x] `docs/backlog/` + index `CLAUDE.md` : référencer ce doc.
