# SpriteRenderer redesign — Sprite asset + façade Unity-style

> Statut : **implémenté**. Refonte du système de rendu de sprite du package `@atlasjs/gameplay`, avec introduction d'une couche d'asset minimale dans `@atlasjs/assets`. Le plan d'exécution détaillé (anciennement `sprite-renderer-implementation-plan.md`) a été fusionné ici une fois livré. Extensions différées (AssetManager, animation, blend/sampler configurables) → `docs/backlog.md`.

## Contexte

Le rendu de sprite actuel est bancal :

- `SpriteRenderSystem` **ne nettoie jamais** : quand une entité ou son `SpriteRender` disparaît, le `Sprite` backend reste dans le scene-graph (fuite mémoire). Il manque un `world.onRemove(SpriteRender, …)`.
- La `texture` n'est lue **qu'à la création** du node backend : la changer ensuite n'a aucun effet.
- Seuls position/rotation/scale/visible sont propagés — **ni tint, ni flip, ni sourceRect, ni anchor**.
- Le façade `SpriteRendererComponent` est quasi vide (`texture` + `isVisible`).

Par ailleurs, `SpriteRender` reçoit aujourd'hui une `Texture2D` GPU brute (`nebula.createTexture2D(...)`), sans aucune notion d'« asset ». Le package `@atlasjs/assets` existant est un premier jet mort (importé nulle part) et est traité comme jetable.

Le `Sprite` backend de nebula (`graphics/Sprite.ts`) sait déjà faire `setTint`, `flipX/flipY`, `setSourceRect`, `setFrame`, `setAnchor`, `setVisible`, `zIndex` : l'essentiel du travail consiste à **router proprement** cette capacité depuis une API scripting propre, et à corriger le cycle de vie.

## Objectifs

- Passer un **`Sprite` asset** (texture + région + pivot) au renderer, au lieu d'une `Texture2D` brute — modèle Unity (`Sprite` = asset, `SpriteRenderer` = composant).
- Exposer une API scripting Unity-like : `spriteRenderer.sprite`, `.color`, `.flipX`, `.flipY`, `.visible`, `.sortingOrder`.
- Corriger le cycle de vie (nettoyage du node backend) et la propagation complète des propriétés.
- Poser une **fondation d'asset minimale et extensible** (contrat `Asset`) sans construire l'usine (pas d'`AssetManager` en v1).

## Non-objectifs (hors périmètre v1)

- `AssetManager` (chargement async, cache/dedup, lifetime, hot-reload) → sa propre spec, plus tard.
- Intégration animation (`AnimationPlayer`/`SpriteSheet` → `SpriteRender`) → chantier à part.
- Blend mode configurable, filtrage (sampler) configurable, `sprite` nullable.

## Décisions

| # | Décision |
|---|----------|
| Sprite asset | `texture + région (rect) + pivot`, immuable → atlas natif |
| Couche asset | Tranche minimale : contrat `Asset` seul + implémentation `Sprite` (la texture asset = `Texture2D` nebula réutilisée) |
| Emplacements | Contrat `Asset` générique dans `@atlasjs/assets` ; `Sprite` asset dans `@atlasjs/gameplay` (seul consommateur) |
| AssetManager | Différé. Le contrat `Asset` (`id` + `dispose`) est la fondation ; le manager s'y branchera sans refonte |
| Flip | Booléen façon Unity (`flipX: boolean`) ; le système calcule `scale_effective = transform.scale × signe(flip)`, **jamais** via `SpriteNode.flipX()` (qui écraserait la scale pilotée par `Transform2D`) |
| Animation | Hors périmètre ; le `Sprite` asset est conçu pour qu'un composant d'anim puisse plus tard swap `spriteRenderer.sprite` sans refonte |

## Architecture

```
Asset (contrat)          @atlasjs/assets      ← générique, sans backend
   ▲ implements
Sprite (asset)           @atlasjs/gameplay    ← texture + rect + pivot (immuable)
   │ référencé par
SpriteRender (L1)        @atlasjs/gameplay    ← SOURCE DE VÉRITÉ
   ▲ façade
SpriteRendererComponent (L2)                  ← proxy stateless, API scripting
   │ projeté par
SpriteRenderSystem  →  nebula Sprite (node)   ← miroir en aval, jamais une source
```

Cohérent avec la taxonomie L1/L2 (`docs/gameplay/scripting-components.md`) et le principe « source unique dans Nexus, backend en aval » (`docs/gameplay/gameplay-redesign.md`).

### 1. Contrat `Asset` (`@atlasjs/assets`)

Le package est vidé de son contenu mort (`AssetManager`, `Texture2D`, `TextureHandle`, `AssetPlugin`, `Tokens`) et remplacé par :

```ts
export interface Asset {
  readonly id: string;
  readonly kind: string;
  dispose(): void;
}
```

- `id` + `dispose()` = les crochets qu'un futur `AssetManager` attendra (clé de cache + lifetime).
- Reste une **feuille** (aucune dépendance backend). C'est le point de convergence des futurs types d'asset (audio, material…), qui vivront chacun près de leur domaine et implémenteront ce contrat.
- La **texture asset = la `Texture2D` GPU de nebula réutilisée telle quelle** (elle porte déjà `id`, `__kind`, `dispose`). Aucun nouveau type. La conformité formelle de `Texture2D` au contrat `Asset` est repoussée à l'arrivée de l'`AssetManager`.

### 2. `Sprite` asset (`@atlasjs/gameplay/src/assets/Sprite.ts`)

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import { Texture2D } from "@atlasjs/nebula";
import { Asset } from "@atlasjs/assets";

export interface SpriteOptions {
  rect?: Bound;
  pivot?: Vec2;
  id?: string;
}

export class Sprite implements Asset {
  public readonly id: string;
  public readonly kind: string = "sprite";
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  public constructor(texture: Texture2D, options?: SpriteOptions);

  public dispose(): void;
}
```

- **Immuable** (`readonly` sur `rect`/`pivot`) façon Unity : une autre région = un autre `Sprite` partageant la même texture → atlas gratuit.
- Défauts : `rect` = texture entière (`0, 0, texture.width, texture.height`), `pivot` = `(0.5, 0.5)`.
- `dispose()` est un no-op : le `Sprite` **ne possède pas** la texture (partageable).
- **Collision de nom** avec le `Sprite` node de nebula : côté système, importer `import { Sprite as SpriteNode } from "@atlasjs/nebula"`. L'API publique de `@atlasjs/gameplay` exporte le `Sprite` **asset**.

### 3. `SpriteRender` (L1 — source de vérité, `components/SpriteRender.ts`)

```ts
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../assets";

export class SpriteRender {
  public sprite: Sprite;
  public color: Color;
  public flipX: boolean;
  public flipY: boolean;
  public visible: boolean;
  public sortingOrder: number;

  public constructor(
    sprite: Sprite,
    color: Color = Color.White(),
    flipX: boolean = false,
    flipY: boolean = false,
    visible: boolean = true,
    sortingOrder: number = 0,
  );
}
```

- `sprite` remplace l'ancien champ `texture: Texture2D`. Requis au constructeur (un renderer sans sprite ne rend rien d'utile).

### 4. `SpriteRendererComponent` (L2 — façade, `scripting/components/SpriteRendererComponent.ts`)

Proxy **stateless** sur `SpriteRender`, re-résolu à chaque accès (invariant « façades sans état »).

```ts
export class SpriteRendererComponent extends ScriptComponent<SpriteRender> {
  public static readonly engine = SpriteRender;

  public get sprite(): Sprite;
  public set sprite(value: Sprite);

  public get color(): Color;
  public set color(value: Color);

  public get flipX(): boolean;
  public set flipX(value: boolean);

  public get flipY(): boolean;
  public set flipY(value: boolean);

  public get visible(): boolean;
  public set visible(value: boolean);

  public get sortingOrder(): number;
  public set sortingOrder(value: number);

  public setSprite(sprite: Sprite): this;
  public setColor(r: number, g: number, b: number, a?: number): this;
  public setFlip(x: boolean, y: boolean): this;
  public setVisible(visible: boolean): this;
  public setSortingOrder(order: number): this;
}
```

Usage scripting :

```ts
spriteRenderer.color = Color.Red();
spriteRenderer.flipX = true;
spriteRenderer.setColor(1, 0, 0).setFlip(true, false).setSortingOrder(5);
```

### 5. `SpriteRenderSystem` réécrit (`systems/SpriteRenderSystem.ts`)

Query `Transform2D, SpriteRender`. Conserve un `SparseSet<SpriteNode>` des nodes montés + un `SparseSet<Sprite>` du dernier asset vu (détection de swap).

Par entité, chaque frame :

1. **Mount paresseux** — pas de node monté : `new SpriteNode(sprite.texture, sampler)`, `setSourceRect(sprite.rect)`, `setAnchor(sprite.pivot)`, `scene.addChild(node)`, stocké.
2. **Swap de sprite** — si l'asset a changé depuis la dernière frame :
   - texture différente → **recréer** le node (dispose de l'ancien + retrait du scene + nouveau node) ;
   - même texture, `rect`/`pivot` différent (frame d'atlas) → `setSourceRect` / `setAnchor`.
3. **Sync** :
   - position/rotation depuis `Transform2D` ;
   - `scale_effective.x = transform.scale.x × (flipX ? -1 : 1)`, idem `.y` avec `flipY` → `setScale(...)` (**jamais** `SpriteNode.flipX/flipY`) ;
   - `setTint(color.r, color.g, color.b, color.a)` ;
   - `setVisible(visible)` ;
   - `zIndex = sortingOrder`.
4. **Cleanup** — `world.onRemove(SpriteRender, (entity) => …)` : retirer le node du scene-graph, le dispose, purger les `SparseSet`. En miroir du pattern de nettoyage du `PhysicsBodyRef`. **C'est le correctif de la fuite.**

Le sampler nearest partagé actuel est conservé (le filtrage configurable pourra migrer sur l'asset/texture plus tard).

## Flux de données

```
Auteur : new Sprite(texture, { rect, pivot })
       → world.addComponent(entity, SpriteRender, sprite)
Script : addComponent(SpriteRendererComponent, sprite) puis .color / .flipX / …
              ↓ (écrit dans)
         SpriteRender  (source unique de vérité)
              ↓ (projeté chaque frame par)
         SpriteRenderSystem  →  nebula Sprite (node)  →  rendu
```

Le façade et le système lisent/écrivent le **même** `SpriteRender` ; le node nebula est un miroir en aval, jamais une source.

## Fichiers touchés

**`@atlasjs/assets`**
- Remplacer le contenu par `src/Asset.ts` (contrat) + `src/index.ts`. Supprimer `AssetManager`, `Texture2D`, `TextureHandle`, `AssetPlugin`, `Tokens`, `types/`.

**`@atlasjs/gameplay`**
- `src/assets/Sprite.ts` + `src/assets/index.ts` (nouveau).
- `src/components/SpriteRender.ts` : `sprite`/`color`/`flipX`/`flipY`/`visible`/`sortingOrder`.
- `src/scripting/components/SpriteRendererComponent.ts` : façade complète.
- `src/systems/SpriteRenderSystem.ts` : réécriture + `onRemove`.
- `src/GameplayPlugin.ts` : câblage éventuel du `onRemove` (selon le pattern existant).
- `package.json` : ajouter la dépendance `@atlasjs/assets`.
- `src/index.ts` : re-exporter `Sprite` (asset), `SpriteRender`, `SpriteRendererComponent`, et `Color` (confort).

**`@atlasjs/nebula`**
- `package.json` : retirer la dépendance fantôme `@atlasjs/assets`.

**`apps/dino-brawl`**
- `src/game/EcsScene.ts` : construire un `Sprite` asset et le passer à `SpriteRender` au lieu de la texture brute.

## Tests (harness existant `test/helpers/harness.ts`)

- `Sprite` : défauts (rect = texture entière, pivot centré) ; `dispose()` no-op.
- `SpriteRender` : défauts (White / flags false / visible true / order 0).
- Façade : round-trip get/set vers `SpriteRender` (stateless — chaque accès re-résout).
- Projection système :
  - flip → signe correct de la scale du node ;
  - swap même texture / rect différent → `setSourceRect` (pas de recréation) ;
  - swap texture différente → node recréé ;
  - tint / visible / zIndex propagés.
- Cycle de vie : `onRemove(SpriteRender)` retire bien le node du scene-graph.

## Checklist d'implémentation — ✅ livrée

- [x] `@atlasjs/assets` : vider le mort, ajouter le contrat `Asset`.
- [x] `@atlasjs/gameplay` : `Sprite` asset (+ index, + dépendance assets).
- [x] `SpriteRender` L1 : nouveaux champs.
- [x] `SpriteRendererComponent` L2 : façade complète.
- [x] `SpriteRenderSystem` : réécriture + swap + `onRemove`.
- [x] `@atlasjs/nebula` : retirer la dépendance fantôme `@atlasjs/assets`.
- [x] `dino-brawl` `EcsScene` : migration vers le `Sprite` asset.
- [x] Re-exports gameplay.
- [x] Tests (`test/sprite-render*.test.ts`, `test/sprite-renderer-facade.test.ts`).
- [x] `tsc --noEmit` sur gameplay + build des dépendances modifiées (`assets`).
