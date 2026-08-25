# Sorting Layers, Y-sorting & Sprite Pivot — Design (v1)

> **Statut : ✅ implémenté.** Chantier **transverse** (touche le sort de `@atlasjs/nebula` + la sémantique de `@atlasjs/gameplay`). A absorbé l'item backlog *« Sorting layers nommés + order-in-layer »* et le fix pivot de l'item *« Pivot par frame »*, tous deux clos par ce design plutôt que trackés séparément dans le [backlog](../backlog/).
>
> **Périmètre livré** : `Node.sortingLayer`/`sortPrimary`/`sortSecondary` (remplacent `zIndex`) et le comparateur multi-critères de `RenderQueue.sort` (remplace l'ancien sort key arithmétique packé) dans `@atlasjs/nebula` ; le registry `SortingLayers` nommé + `applySortFields` (collapse mode+valeur) et `sortingLayer`/`sortingOrder` sur `SpriteRender` dans `@atlasjs/gameplay`. Le pivot est authorable sur le chemin ergonomique (`SpriteAsset.fromPath(path, { rect?, pivot? })`) et préservé en animation (`Frame.pivot`, forwardé par `SpriteSheet` et `AnimatorSystem`). Voir §10 pour ce qui reste hors périmètre v1.

## 1. Vue d'ensemble

Deux problèmes distincts mais liés, résolus ensemble.

**Problème A — ordre de rendu.** Aujourd'hui il n'y a qu'un `sortingOrder: int` global, partagé par `SpriteRender` et `TileMapRenderer`. On veut le modèle Unity : des **sorting layers nommés et ordonnés**, on assigne chaque renderer à un layer, et sur certains layers on active un **tri par axe** (Y en 2D → ce qui est plus bas à l'écran passe devant).

**Problème B — objets multi-tuiles occultants** (arbre, buisson, petite maison). Le joueur doit passer **devant** quand il est plus bas (au sud) et **derrière** quand il est plus haut (au nord).

**Insight structurant.** Le Y-sorting est **par-entité, pas par-tuile**. Une couche de tilemap = **un seul batch** avec **une seule valeur de tri** (c'est tout le gain 10k tuiles / 60fps). On ne peut pas intercaler le joueur *entre deux tuiles* d'un même batch sans casser le batch. Donc :

- un objet qui doit s'intercaler dynamiquement avec le joueur **doit être une entité sprite** triée par sa base Y ;
- le sol plat et la déco qui n'occultent jamais restent des **tilemaps batchées**.

```
Ground   (tilemap, batché,  manual)   ← jamais d'occlusion
  ↓
Entities (sprites,          ySorted)  ← joueur + arbres + buissons, s'intercalent par le Y des pieds
  ↓
Overhead (tilemap, batché,  manual)   ← toits/canopée qu'on passe toujours dessous
```

**Frontière packages.** `@atlasjs/nebula` reste **purement mécanique** : il trie des nombres `(sortingLayer, sortPrimary, sortSecondary, kind, batch)`, il ignore ce qu'est un « Y-sort » ou un layer nommé. `@atlasjs/gameplay` possède le **registry nommé + la sémantique Y-sort** et *collapse* mode+valeur dans les champs numériques que nebula trie. Miroir exact du split `Sprite`(gameplay) ↔ `SpriteNode`(nebula).

## 2. Périmètre v1 & non-objectifs

**Dans le périmètre v1 :**
- Registry de **sorting layers nommés**, ordonnés, code-first, avec un **mode de tri par layer** (`manual` | `ySorted`).
- `sortingLayer: string` sur `SpriteRender` **et** `TileMapRenderer` ; `sortingOrder` conservé (= order-in-layer).
- Tri Y-sorted par le **pivot monde** du sprite (« Sort Point = Pivot » façon Unity), avec **tiebreak `sortingOrder`** au Y égal.
- Refonte du sort de nebula : champs structurés sur le `DrawCommand` + comparateur multi-critères (suppression du packing radix + du clamp 16-bit).
- **Pivot authorable sur le chemin ergonomique** (`SpriteAsset.fromPath(path, { rect?, pivot? })`) et **préservé en animation** (`Frame.pivot` → `AnimatorSystem`).
- Rétro-compat : défaut `sortingLayer = "Default"` (index 0, `manual`) → comportement actuel préservé.

**Non-objectifs v1 (→ [backlog](../backlog/)) :**
- Gros bâtiments **profonds en Y** nécessitant un tri par bandes (le cas « derrière une partie / devant une autre du même objet ») → split manuel ou layer Overhead.
- (Dé)sérialisation / éditeur des sorting layers.
- Axe de tri **custom** (vecteur arbitraire) ou **mode par-caméra** — on hardcode l'axe Y-down.
- Tuiles individuelles Y-triées → **non supporté par design** (casse le batch).
- Override de pivot **par-instance** sur `SpriteRender` (le pivot vit sur l'asset `Sprite`).
- **Pivots distincts par frame** dans une même sheet (v1 = un pivot uniforme par sheet).
- Colliders du tronc / footprint physique de l'occulteur → **orthogonal** (physique), hors sujet.

## 3. Décisions d'architecture

| # | Décision | Choix retenu |
| --- | --- | --- |
| 1 | Modèle des occulteurs multi-tuiles | **Entités sprite** (pivot aux pieds, layer Y-sorted) ; **jamais** des tuiles Y-triées |
| 2 | Point de tri | **Pivot monde du sprite** (`getWorldPosition().y`) = « Sort Point = Pivot » |
| 3 | Mécanisme de tri | **Comparateur structuré** sur champs séparés (Y flottant brut, pas de quantification) ; **pas** de clé packée |
| 4 | Précédence | `sortingLayer → sortPrimary → sortSecondary → kind → batchKey` |
| 5 | Sémantique par mode | `manual` : `sortPrimary = sortingOrder`, `sortSecondary = 0`. `ySorted` : `sortPrimary = pivotWorldY`, `sortSecondary = sortingOrder` (tiebreak) |
| 6 | Convention d'axe | **Y-down** : `sortPrimary` ascendant = dessiné après = **devant** |
| 7 | Registry | **Nommé, ordonné, code-first**, owned par gameplay (façon `CameraManager`) ; `"Default"` pré-seedé (index 0, `manual`) |
| 8 | Split packages | nebula **mécanique** (trie des nombres) ; gameplay **sémantique** (noms + Y-sort + collapse) |
| 9 | Pivot | Déjà baké dans le quad ; on **débloque** `fromPath` + on **préserve** en animation (`Frame.pivot`) |
| A | Rétro-compat | `sortingLayer` défaut `"Default"` → l'existant reste inchangé |

## 4. Couche mécanique — `@atlasjs/nebula`

nebula ne connaît ni les noms de layers ni la notion de Y-sort. Il reçoit des nombres et trie.

### 4.1 `Node` — champs de tri

Le `zIndex` actuel est **remplacé** par trois champs (défauts entre parenthèses) :

```ts
// packages/nebula/src/graphics/Node.ts
class Node extends Transformable {
  public visible: boolean;        // (true) — collect() skip le sous-arbre si false
  public sortingLayer: number;    // (0) index de couche, critère de tri grossier
  public sortPrimary: number;     // (0) valeur de tri intra-couche (Y monde ou order)
  public sortSecondary: number;   // (0) tiebreak intra-couche (order au Y égal)
}
```

> **Migration.** Les appelants nebula directs (tests, éditeur) qui posaient `zIndex` posent désormais `sortPrimary`. Sans gameplay, tout est dans le layer 0 et `sortPrimary` joue le rôle du z-order.

### 4.2 `DrawCommand` — champs structurés

On remplace le `sortKey: number` de chaque variante par les champs séparés. `batchKey` **inchangé** (le `flush` regroupe toujours par `kind` + `batchKey`).

```ts
// packages/nebula/src/renderers/DrawCommand.ts
interface DrawCommandBase {
  readonly kind: "sprite" | "shape" | "tilemap";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;    // KIND_ORDER[kind], précalculé (sprite<shape<tilemap)
  readonly batchKey: number;
  // …payload spécifique (texture, instances, …)
}
```

`KIND_ORDER` (`packages/nebula/src/renderers/NodeRenderer.ts`) est **conservé** — il n'alimente plus une clé packée, il fournit `kindOrder` (critère 4).

### 4.3 `RenderQueue.sort` — comparateur multi-critères

```ts
// packages/nebula/src/renderers/RenderQueue.ts
sort(): void {
  this.commands.sort((a, b) =>
    (a.sortingLayer  - b.sortingLayer)  ||   // 1. couche
    (a.sortPrimary   - b.sortPrimary)   ||   // 2. Y (ou order), selon ce que gameplay a posé
    (a.sortSecondary - b.sortSecondary) ||   // 3. tiebreak (order au Y égal)
    (a.kindOrder     - b.kindOrder)     ||   // 4. sprite < shape < tilemap
    (a.batchKey      - b.batchKey)           // 5. regroupe le même batch (flush inchangé)
  );
}
```

`NodeRendererBase.computeSortKey` (packing radix + clamp 16-bit) **disparaît** ; les `collect()` (`SpriteRenderer`, `ShapeRenderer`, `TileMapNodeRenderer`) recopient les champs du node dans le command et posent `kindOrder = KIND_ORDER[kind]`.

**Pourquoi ça marche sans croiser les sémantiques.** `sortingLayer` est le critère 1 → on ne compare jamais un `sortPrimary`-Y d'une couche avec un `sortPrimary`-order d'une autre. Dans une couche donnée, le mode est uniforme → toutes les comparaisons de `sortPrimary`/`sortSecondary` sont like-with-like.

**Perf.** La file est petite (dizaines à quelques centaines de commands : un par sprite visible, un par calque batché, un par shape). Un comparateur JS sur cet ordre de grandeur est en microsecondes — le seul argument pour la clé packée (tri numérique branchless) tombe.

## 5. Couche sémantique — `@atlasjs/gameplay`

### 5.1 Registry `SortingLayers`

Nommé, ordonné, configuré au boot (façon `CameraManager`), owned par gameplay et injecté aux render systems.

```ts
// packages/gameplay/src/rendering/SortingLayers.ts
type SortMode = "manual" | "ySorted";

class SortingLayers {
  define(defs: { name: string; mode?: SortMode }[]): void;  // append APRÈS "Default" ; l'ordre du tableau = l'ordre des index
  indexOf(name: string): number;   // "Default" = index 0 (mode "manual") ; nom inconnu → warn + fallback 0
  modeOf(index: number): SortMode;
}
```

```ts
// au boot de l'app
sortingLayers.define([
  { name: "Ground",   mode: "manual"  },   // index 1
  { name: "Entities", mode: "ySorted" },   // index 2
  { name: "Overhead", mode: "manual"  },   // index 3
]);
```

> **Sémantique `"Default"`.** Le registry **pré-seede** toujours `"Default"` à l'**index 0** (mode `manual`). `define()` **ajoute** les layers fournis *après* Default (il ne le supprime pas). Conséquences :
> - Sans jamais appeler `define()` → tout est dans `"Default"` (index 0), trié par `sortingOrder` → **comportement actuel exact** (rétro-compat).
> - Avec `define([...])` → le contenu non migré (resté en `"Default"`) est le **plancher** (dessous tout le reste) ; les layers déclarés s'empilent au-dessus.
>
> **`indexOf` sur nom inconnu** : warn dev + fallback layer 0 (jamais throw en runtime de rendu — cohérent avec l'injection « warn-never-throw » du reste de gameplay).

### 5.2 Composants

`SpriteRender` **et** `TileMapRenderer` gagnent `sortingLayer: string` (défaut `"Default"`) et **conservent** `sortingOrder: number` (= order-in-layer). Rétro-compat totale.

```ts
// packages/gameplay/src/components/SpriteRender.ts
class SpriteRender {
  // …existant (sprite, color, flipX/Y, visible)…
  public sortingOrder: number;    // conservé — order-in-layer
  public sortingLayer: string;    // NOUVEAU — défaut "Default"
}
```

### 5.3 Render systems — le *collapse* mode+valeur

`SpriteRenderSystem` et `TileMapRenderSystem` résolvent le nom → index et posent les champs du node **selon le mode** :

```ts
// SpriteRenderSystem.update() (idem TileMapRenderSystem.syncNode())
const i: number = this.sortingLayers.indexOf(spriteRender.sortingLayer);
node.sortingLayer = i;
if (this.sortingLayers.modeOf(i) === "ySorted") {
  node.sortPrimary   = worldTransform.getPosition().y;   // Y monde du pivot = les pieds
  node.sortSecondary = spriteRender.sortingOrder;        // tiebreak au Y égal
} else {
  node.sortPrimary   = spriteRender.sortingOrder;        // ordre manuel classique
  node.sortSecondary = 0;
}
```

> **Tilemap dans un layer `ySorted`** (edge case) : `sortPrimary` = Y de l'origine du calque → le calque entier trie **comme un bloc** à ce Y (pas de tri par-tuile — c'est voulu). En pratique les tilemaps vivent dans des layers `manual`.

### 5.4 Flux de données

```
update lane:  TransformPropagationSystem  → WorldTransform2D final
              SpriteRenderSystem           → pose node.sortingLayer + sortPrimary(=Y pieds) + sortSecondary
render lane:  SceneRenderer.render():
                updateWorldMatrices()       (même Y que gameplay a lu)
                collect() → DrawCommand { sortingLayer, sortPrimary, sortSecondary, kindOrder, batchKey }
                queue.sort()  → comparateur §4.3
                queue.flush() → batch des runs adjacents (inchangé)
```

Convention Y-down : `sortPrimary` ascendant → sprite plus bas à l'écran (Y plus grand) trié après → dessiné par-dessus → **devant**. C'est « pieds plus bas = devant ». ✅

## 6. Pivot — débloquer l'authoring & préserver en animation

Le pivot **existe et est baké** dans le quad (`SpriteNode.anchor` → `updateModelMatrix` : `(0.5 - anchor)·size`), copié par `SpriteRenderSystem` (`sprite.pivot → node.setAnchor`). Comme le quad est ancré au pivot et le node est à la position de l'entité, **le pivot est physiquement à la position de l'entité** → `getWorldPosition().y` est le Y du pivot *automatiquement*. Un seul bouton : le pivot.

Convention : `Vec2` en `[0,1]`, Y-down. `(0.5, 0.5)` = centre (défaut) ; `(0.5, 1.0)` = **bas-centre = les pieds**.

Deux trous à combler (le reste du chemin est déjà correct) :

**6.1 Chemin ergonomique — `SpriteAsset.fromPath`.**

```ts
// packages/gameplay/src/assets/SpriteAsset.ts
static fromPath(path: string, options?: { rect?: Bound; pivot?: Vec2 }): SpriteAsset {
  return new SpriteAsset(new TextureAsset(path), options);
}
```

Permet le one-liner : `SpriteAsset.fromPath(Plant, { rect: treeRect, pivot: new Vec2(0.5, 1.0) })`.

**6.2 Chemin animation — `Frame.pivot`.**

`Frame` n'a **aucun** pivot aujourd'hui → `AnimatorSystem` reconstruit chaque frame en `(0.5, 0.5)`. On ajoute :

```ts
// packages/nebula/src/animations/Frame.ts
class Frame {
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;   // NOUVEAU — défaut (0.5, 0.5)
}
```

- Le slicing `SpriteSheet` (`fromGrid`/`fromAutoGrid`) accepte un `pivot` et le stamp sur chaque `Frame` (un pivot **uniforme** par sheet en v1).
- `AnimatorSystem.spriteFor` le forwarde : `new Sprite(frame.texture, { rect: frame.rect, pivot: frame.pivot })`.

**Requis** parce qu'un joueur animé, sans ce fix, perd ses pieds au démarrage de l'anim → il « saute » **et** son point de tri passe au centre pendant que les arbres trient par les pieds → occlusion incohérente. Ferme aussi le bug backlog *« le perso saute au démarrage de l'anim »*.

## 7. Authoring des occulteurs (cible dino-brawl)

```ts
// registry au boot
sortingLayers.define([
  { name: "Ground",   mode: "manual"  },   // sol batché
  { name: "Entities", mode: "ySorted" },   // joueur + arbres + buissons
  { name: "Overhead", mode: "manual"  },   // canopée/toits (optionnel)
]);

// un arbre slicé depuis plant.png, pieds au bas-centre
const treeAsset = SpriteAsset.fromPath(Plant, {
  rect:  new Bound(0, 0, 96, 160),   // rect de l'arbre gauche
  pivot: new Vec2(0.5, 1.0),         // ← les pieds
});
const tree = await assets.load<Sprite>(treeAsset);

const e = nexus.createEntity();
nexus.addComponent(e, Transform2D, /* où poser les pieds */);
const sr = nexus.addComponent(e, SpriteRender, tree);
sr.sortingLayer = "Entities";

// le joueur, même layer → s'intercale par le Y des pieds
playerSpriteRender.sortingLayer = "Entities";
```

- Sol → tilemap dans `"Ground"`. Touffes d'herbe (déco plate) → tilemap `"Ground"` (moins cher). Buisson qui occulte → entité sprite dans `"Entities"` comme un arbre.
- Le blocage physique du tronc (le joueur ne traverse pas l'arbre) est **orthogonal** : un collider séparé, hors de ce chantier.

## 8. Enregistrements & placement des fichiers

| Élément | Package / dossier | Note |
| --- | --- | --- |
| `Node.sortingLayer/sortPrimary/sortSecondary` (remplace `zIndex`) | `nebula/src/graphics/Node.ts` | + setters |
| `DrawCommand` champs structurés (remplace `sortKey`) | `nebula/src/renderers/DrawCommand.ts` | `batchKey` inchangé |
| `RenderQueue.sort` comparateur | `nebula/src/renderers/RenderQueue.ts` | `flush`/`isSameRun` inchangés |
| Suppression `computeSortKey` ; `collect()` recopie les champs + `kindOrder` | `nebula/src/renderers/{NodeRendererBase,SpriteRenderer,ShapeRenderer,TileMapNodeRenderer}.ts` | `KIND_ORDER` conservé |
| `SortingLayers` registry | `gameplay/src/rendering/SortingLayers.ts` (nouveau) | owned par `GameplayPlugin`, injecté aux render systems |
| `sortingLayer` sur `SpriteRender` + `TileMapRenderer` | `gameplay/src/components/` | défaut `"Default"` |
| Collapse mode+valeur | `gameplay/src/systems/{SpriteRenderSystem,TileMapRenderSystem}.ts` | §5.3 |
| `SpriteAsset.fromPath(path, options?)` | `gameplay/src/assets/SpriteAsset.ts` | `{ rect?, pivot? }` |
| `Frame.pivot` + slicing + forward | `nebula/src/animations/{Frame,SpriteSheet}.ts`, `gameplay/src/systems/AnimatorSystem.ts` | pivot uniforme/sheet |

Barrels : réexport `SortingLayers` depuis `gameplay/src/index.ts`.

## 9. Stratégie de test

- **Unit nebula** — `RenderQueue.sort` : précédence `sortingLayer` ; ordre `sortPrimary` ; tiebreak `sortSecondary` puis `kindOrder` puis `batchKey` ; les commands même-batch adjacents restent groupés (batching préservé). Cas Y flottant (pas de quantification).
- **Unit gameplay** — `SortingLayers` : `define`/`indexOf`/`modeOf`, `"Default"` seedé à 0, nom inconnu → warn + fallback 0. Render systems : `manual` pose `sortPrimary=sortingOrder, sortSecondary=0` ; `ySorted` pose `sortPrimary=worldY, sortSecondary=sortingOrder`.
- **Unit pivot** — `SpriteAsset.fromPath(path, { rect, pivot })` forwarde pivot + rect ; `Frame` porte pivot (défaut centre) ; `AnimatorSystem.spriteFor` forwarde le pivot (frame animée garde ses pieds, ne retombe pas à `(0.5,0.5)`).
- **Intégration ECS** — joueur + 2 arbres dans `"Entities"` (ySorted) : joueur **derrière** quand au nord (Y plus petit), **devant** quand au sud (Y plus grand) ; tiebreak `sortingOrder` respecté à Y égal.
- **Vérif navigateur (obligatoire)** — scène `dino-brawl` : sol tilemap `"Ground"` + `"Entities"` avec joueur animé + arbres de `plant.png`. On déplace le joueur haut/bas → l'occlusion bascule à la **ligne des pieds** ; le joueur animé garde ses pieds (pas de saut) ; nombre de draw calls sain (les arbres même-sheet batchent quand ils sont adjacents dans l'ordre trié). **`import type`** pour les symboles type-only (piège Vite : `tsc` passe mais Vite casse au runtime → écran noir).

## 10. Non-objectifs / backlog

Reportés (cf. §2) : bâtiments profonds à tri par bandes ; (dé)sérialisation + éditeur des sorting layers ; axe custom / mode par-caméra ; tuiles individuelles Y-triées (non supporté par design) ; override de pivot par-instance ; pivots distincts par frame ; colliders/footprint physique des occulteurs. Ces deux items backlog (« Sorting layers nommés + order-in-layer » et « Pivot par frame ») sont déjà fusionnés dans ce design plutôt que trackés séparément dans [`memory/atlas/backlog/`](../backlog/) — rien à y fermer une fois ce chantier implémenté.
