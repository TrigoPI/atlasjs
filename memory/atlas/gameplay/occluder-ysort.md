# occluders & Y-sort — Design (v1)

> **Statut : ✅ implémenté & vérifié navigateur (mergé sur `dev`).**
>
> Fait suite au Y-sort (`SortingLayers` + mode `ySorted`, cf. [`../rendering/renderer-architecture.md`](../rendering/renderer-architecture.md)) et au système TileSet/TileMap ([`tilemap.md`](tilemap.md)). Le seam collider décrit en §9 est resté un seam : la solidité du monde, livrée depuis, passe par un **calque d'objets `colliders` distinct** (`tiled/ingestColliders.ts`, collision layer `World`) et **non** par les rectangles `occluder_regions`.

## 1. Problème

Le Y-sort actuel trie **par couche** : `Ground` (manual, toujours dessous), `Entities` (ySorted, joueur & co triés par `worldY`), `Overhead` (manual, toujours dessus).

Ce modèle binaire ne sait pas gérer un objet **plus grand qu'une tuile** qui doit passer **tantôt devant, tantôt derrière** le joueur (mur, bâtiment, arbre). Deux impasses connues :

- **Le mettre dans `Overhead`** → toujours au-dessus : faux dès que le joueur devrait passer devant sa base.
- **Le découper en tuiles 32×32 triées chacune par son `worldY`** → l'objet se **déchire** (le joueur se glisse entre deux rangées de hauteur).

Cause racine :

> **Un calque de tilemap = 1 draw = 1 seule sort key.** Un gros objet qui vit _dans_ un calque ne peut pas, par construction, se trier individuellement contre le joueur.

## 2. Modèle

Un **occluder** se décompose en **strips** : une bande ayant **une seule ligne de pieds** (`footY`). On découpe selon la **ligne de base (la profondeur)**, **jamais** selon la hauteur — les tuiles empilées en hauteur restent soudées à leur base.

- tampon isolé (arbre, rocher) → **1 strip**
- mur droit horizontal (ex. 20×3) → **1 strip** (les 3 rangées de hauteur = un bloc)
- structure qui recule en profondeur (barrière nord-sud, L) → **N strips**, un par ligne de base distincte

Chaque strip rejoint la couche `ySorted` **comme une unité triable de plus**, à côté du joueur. Le tri par Y fait le reste : le joueur se glisse entre les strips selon son propre `footY`.

**Réalisation clé (rend l'implémentation quasi gratuite) :**

> **Un strip, c'est un `TileMapNode`** — la classe exacte qu'un calque de sol utilise déjà (un sac d'instances de tuiles, 1 texture, 1 sort key). La seule différence avec un calque : ses `instances` = les tuiles d'**un** rectangle, et sa sort key = **`footY`** (mode `ySorted`) au lieu de l'origine du calque.

|                  | Calque de sol _(existant)_   | Occluder strip _(nouveau)_           |
| ---------------- | ---------------------------- | ------------------------------------ |
| nodes            | 1 `TileMapNode` / calque     | 1 `TileMapNode` / **strip**          |
| `node.instances` | toutes les cellules visibles | les tuiles **du rectangle**          |
| `worldY` du tri  | origine du calque _(manual)_ | **`footY`** du rectangle _(ySorted)_ |
| recalcul         | chaque frame (culling)       | **une fois** (statique)              |

**Séparation à graver :** _nombre de tuiles affichées (instances)_ ≠ _nombre de décisions de tri (sort key)_. Beaucoup d'instances, **une seule** sort key par strip.

## 3. Décisions d'architecture

| #   | Décision                           | Choix retenu                                                                                                                                              |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unité de tri                       | **1 strip = 1 ligne de base distincte** ; découpe par profondeur, jamais par hauteur                                                                      |
| 2   | Représentation d'un strip au rendu | **Réutilise `TileMapNode`** (nebula), pas de nouvelle primitive                                                                                           |
| 3   | Représentation en ECS              | **Backend 1 : 1 entité légère `OccluderStrip` par strip** (statique, bakée). Backend 2 « flyweight zéro-entité » → backlog                                |
| 4   | Authoring                          | **Peinture tuile-par-tuile** (calque `occluders`) + **rectangles** sur un object layer `occluder_regions` (intention : groupe + `footY`)                  |
| 5   | `footY`                            | Bord **bas** du rectangle, en **monde** (l'artiste contrôle la ligne de pieds)                                                                            |
| 6   | Frontière packages                 | **Composant + système + baker pur** dans `@atlasjs/gameplay` ; **ingestion Tiled** dans l'app dino-brawl (`MapBuilder`)                                   |
| 7   | Couche de tri                      | Les strips vont sur **`Entities`** (la seule `ySorted`) ; leur `sortingOrder` est **toujours `0`** en v1 — deux strips au même `footY` sont départagés par `kindOrder` puis `batchKey` |
| 8   | Collider                           | **Seam** documenté (rectangle partagé), **création hors périmètre v1** (→ feature collisions)                                                             |
| A   | Calque `occluders`                 | **Input du baker**, **pas** rendu comme un calque plat (sinon double dessin)                                                                              |
| B   | Espace des instances               | **Local** (cellOrigin), échelle via la `Transform2D` du Grid (comme `TileMap`) ; `footY` **monde** stocké dans le composant                               |
| C   | Culling                            | **v1 : pas de culling** (strips peu nombreux et statiques) ; instances jamais reconstruites ; AABB-cull par strip → backlog                               |
| D   | Multi-tileset                      | **Plusieurs calques `occluders_*`** (1 tileset chacun, par catégorie : arbres, murs…) ; un rectangle → **1 strip par tileset contributeur**, même `footY` |

## 4. Authoring dans Tiled

Deux calques, aucune image toute faite (le rectangle **ne référence aucun sprite** — le visuel, c'est les tuiles peintes dessous) :

1. **Un ou plusieurs calques de tuiles `occluders_*`** (un par tileset/catégorie : `occluders_trees`, `occluders_walls`… — rappel : un `TileMap` = **un** tileset, décision D) — l'artiste peint tuile par tuile. Ce sont les **pixels**. Ces calques sont **consommés par le baker**, pas rendus à plat (décision A).
2. **Calque d'objets `occluder_regions`** — **un rectangle par occluder** (outil _Insert Rectangle_, zéro image). C'est l'**intention** : « ce paquet de tuiles = un bloc, ancré ici ». Un rect est reconnu comme région d'occluder ssi son `groupPath` inclut `"occluder_regions"` **ou** qu'il porte la propriété `occluder = true`. Propriétés custom :
   - `slice`: `"single"` (défaut) — le rectangle = **1 strip**, `footY` = bord bas du rectangle. Pour murs droits, arbres, bâtiments à empreinte 1-profonde.
   - `slice`: `"perRow"` — **1 strip par rangée de cellules** (`cy`), `footY` = bas de chaque rangée. Pour les structures qui **reculent en profondeur** (barrière nord-sud, diagonale, L).
   - `sortingLayer`: nom de couche (défaut `"Entities"`).

Le rectangle porte **trois infos, zéro sprite** : (1) _quelles_ tuiles vont ensemble, (2) _où_ est le `footY`, (3) _(futur)_ la boîte de collision.

> Pourquoi pas 100 % automatique ? Un empilement vertical de tuiles peut être « un mur haut » (hauteur) **ou** « une barrière qui recule » (profondeur) — tuiles identiques, seule l'intention diffère. Le rectangle porte cette intention. La détection auto par composantes connexes → backlog (§13).

## 5. Ingestion / baker

Le [Tiled bridge existant](../../../apps/dino-brawl/src/game/tiled/) fait déjà le gros du travail : `TiledDocument` parse les object layers **et** leurs custom properties ; `MapBuilder.build()` crée déjà l'entité `Grid` (`Transform2D.scale = MAP_SCALE`) + les enfants `TileMap`/`TileMapRenderer`, et convertit les rectangles en coordonnées **monde** via `colliderFromRect` (×échelle).

**Extension de l'ingestion** (app — aujourd'hui `tiled/ingestOccluders.ts`, appelé par `MapBuilder.build`) :

1. Les calques de tuiles `occluders_*` fournissent les cellules (`getTile(cx, cy)` → index) + leur `TileSet` (un par tileset/catégorie, décision D).
2. Pour chaque rectangle de `occluder_regions`, **et pour chaque calque occluder ayant ≥1 tuile sous le rectangle**, appeler le baker pur du package → **un `OccluderStrip` par (rectangle × tileset contributeur)**, tous au **même `footY`** :

```ts
// @atlasjs/gameplay (src/authoring/) — helper pur, sans dépendance Tiled
export type OccluderRegion = {
  cellBounds: CellRange; // en cellules, bornes INCLUSIVES (cxMin, cyMin, cxMax, cyMax)
  slice: "single" | "perRow";
  sortingLayer: string; // "Entities" par défaut, choisi par l'appelant
  footYWorld: number; // bord bas du rectangle, en monde (= colliderFromRect(rect).y + .height)
  rowFootYWorld: (cy: number) => number; // bas monde d'une rangée, pour slice "perRow"
};

export function bakeOccluderStrips(
  region: OccluderRegion,
  layer: TileMap, // le calque "occluders"
  cellSize: Vec2,
  cellGap: Vec2,
): OccluderStripData[]; // { footY, tiles: TileInstance[], texture: Texture2D, sortingLayer }
```

3. Pour chaque `OccluderStripData`, spawn une **entité enfant du Grid** portant `OccluderStrip` + `Transform2D` (identité → hérite l'échelle du Grid via `TransformPropagationSystem`, comme un `TileMap`).

**Boucle du baker** (miroir de `TileMapRenderSystem.rebuildInstances`, mais bornée au rectangle) :

```ts
for (let cy = region.cellBounds.cyMin; cy <= region.cellBounds.cyMax; cy++) {
  for (let cx = region.cellBounds.cxMin; cx <= region.cellBounds.cxMax; cx++) {
    const index = layer.getTile(cx, cy);
    if (index < 0) continue; // cellule vide
    const tile = layer.tileset.tryGetTile(index);
    if (tile === undefined) continue; // index hors tileset
    const rect = tile.sprite.rect;
    const origin = cellOrigin(cellSize, cellGap, cx, cy); // LOCAL
    tiles.push({
      x: origin.x,
      y: origin.y,
      width: rect.width,
      height: rect.height,
      uvRect,
    });
  }
}
```

- `slice: "single"` → un seul `OccluderStripData`, `footY = region.footYWorld` (aucun strip si le rectangle ne couvre aucune tuile).
- `slice: "perRow"` → un `OccluderStripData` par `cy` non vide, `footY = region.rowFootYWorld(cy)` (bas monde de cette rangée, fourni par l'appelant).

> **Multi-tileset** : un occluder mixant deux tilesets (ex. bâtiment mur + porte) donne **2 strips au même `footY`** — ils se trient ensemble (l'ordre entre strips de même `footY` est départagé par `batchKey`, acceptable v1).

**Cas de bord** : rectangle sans tuile → skip silencieux côté baker (il renvoie `[]`) ; un calque `occluders_*` qui a des tuiles mais **aucun** strip baké → warn dev côté ingestion (`ingestOccluders`, tuiles non rendues) ; rectangles chevauchants → une tuile couverte par deux rectangles est bakée **dans les deux** strips (le non-chevauchement est une convention d'authoring).

## 6. Modèle de données

```ts
// gameplay/src/components/OccluderStrip.ts — LEVEL 1 (donnée bakée, statique)
export class OccluderStrip {
  public footY: number; // ligne de pieds, en MONDE (sert le tri)
  public readonly tiles: TileInstance[]; // le "sac" — instances en espace LOCAL du Grid, posé une fois
  public readonly texture: Texture2D; // le tileset
  public sortingLayer: string; // couche ySorted (défaut "Entities")

  public constructor(
    footY: number,
    tiles: TileInstance[],
    texture: Texture2D,
    sortingLayer: string,
  ) {
    this.footY = footY;
    this.tiles = tiles;
    this.texture = texture;
    this.sortingLayer = sortingLayer;
  }
}
```

Composant **LEVEL 1** (`components/`), utilisé **brut** et réexporté depuis `gameplay/src/index.ts` — aucune logique moteur à cacher, pas de token scripting dédié.

## 7. Rendu — `OccluderRenderSystem`

Package `@atlasjs/gameplay`, lane `render` / stage `PreRender` (comme `SpriteRenderSystem`/`TileMapRenderSystem`), après `CameraSyncSystem`. `Map<Entity, TileMapNode>` pour tracker un node par strip.

```ts
export class OccluderRenderSystem implements NexusSystem {
  private readonly nodes: Map<Entity, TileMapNode> = new Map();

  public constructor(
    private readonly nebula: NebulaRenderer,
    private readonly sortingLayers: SortingLayers,
  ) {}

  public update({ world }: NexusSystemContext): void {
    world
      .query(WorldTransform2D, OccluderStrip)
      .each((entity, worldTransform, strip) => {
        const node = this.resolveNode(entity, strip); // instances bakées au montage

        // transform (échelle du Grid) : le helper partagé avec TileMapRenderSystem
        // (src/rendering/syncNodeTransform.ts) — même décomposition TRS lossy
        syncNodeTransform(
          node,
          worldTransform,
          this.positionScratch,
          this.scaleScratch,
          false, // flipX
          false, // flipY
        );

        applySortFields(
          node,
          this.sortingLayers,
          strip.sortingLayer, // "Entities" (ySorted)
          0, // sortingOrder — constant en v1 (pas de départage exposé)
          strip.footY, // ← LA sort key : footY (monde)
        );
      });
  }

  public unmount(entity: Entity): void {
    /* node.removeFromParent() + nodes.delete */
  }

  private resolveNode(entity: Entity, strip: OccluderStrip): TileMapNode {
    let node = this.nodes.get(entity);
    if (node === undefined) {
      node = new TileMapNode();
      node.texture = strip.texture;
      node.instances = strip.tiles; // ← le sac, posé UNE fois (statique)
      this.nebula.scene.addChild(node);
      this.nodes.set(entity, node);
    }
    return node;
  }
}
```

- **Instances bakées une fois** au montage (statique) — aucun `rebuildInstances` par frame.
- **Culling (décision C)** : **reporté en v1** (strips peu nombreux et statiques) — tous les strips sont soumis chaque frame ; l'AABB-cull par strip (`getCameraViewport()` → `node.visible`) est au backlog. Instances jamais reconstruites.
- **Lifecycle** : `world.onRemove(OccluderStrip, e => system.unmount(e))` dans `GameplayPlugin` (même pattern que `SpriteRenderSystem`/`TileMapRenderSystem`).

### 7.1 Batching (perf) — pourquoi ce n'est _pas_ 1 draw call par strip

`RenderQueue.flush()` fusionne les commandes **contiguës** partageant `kind` + `batchKey` en **un seul draw call** (`isSameRun`, [`RenderQueue.ts:63`](../../../packages/nebula/src/renderers/RenderQueue.ts)). Pour les strips : `kind = "tilemap"`, `batchKey` = l'entier interné par `TileMapNodeRenderer` pour la clé matériau `texture.id|sampler.id|blend`.

Tu as **plusieurs tilesets** d'occluders (arbres, murs…) → chacun son `batchKey`. Conséquence : les strips **de même tileset** contigus en `footY` fusionnent ; un **changement de tileset** (ou un sprite intercalé) **casse le run**.

> Draw calls ≈ nombre de changements de `(kind, tileset)` en descendant l'axe Y + sprites intercalés — **pas** le nombre de strips. Avec 2-4 tilesets d'occluders, ça reste **quelques dizaines de draws instanciés** au pire — négligeable GPU. Optimisation si un jour nécessaire (jamais à cette échelle) : **atlas occluder partagé** ou **texture-array** pour recoller les tilesets en un seul `batchKey` (→ backlog §13).

## 8. Intégration au tri

Aucun changement au tri : `applySortFields` en mode `ySorted` écrit `sortPrimary = footY`, `sortSecondary = sortingOrder`. `RenderQueue.sort()` ordonne `sortingLayer → sortPrimary → sortSecondary → kindOrder → batchKey`. Le joueur (`SpriteNode`, `Entities`, trié par `position.y`) et les strips (`TileMapNode`, `Entities`, triés par `footY`) atterrissent dans le **même** queue → interleaving automatique.

**Discipline d'authoring** : `footY` = **bord bas** du rectangle, calé sur la ligne de pieds visuelle de l'occluder. Un `footY` au centre trierait un mur par son milieu.

## 9. Seam collider (hors périmètre v1 — toujours non consommé)

Le socle est déjà là et le rectangle **pourrait** servir les deux features :

- `Collider2D` **sans** `RigidBody2D` = **géométrie statique** : `PhysicsPushSystem.update` query `Collider2D.without(PhysicsColliderRef)` → `createCollider(desc, undefined)` ([`PhysicsPushSystem.ts:107`](../../../packages/gameplay/src/systems/PhysicsPushSystem.ts)).
- La collision layer `Occluder` est **déjà définie** (`defineCollisionLayers("Player", "Occluder", "World", "Enemy", "Weapon")`, [`config.ts:19`](../../../apps/dino-brawl/src/game/config.ts)).

→ **État actuel** : la feature collisions a été livrée **sans** consommer ce seam. La solidité du monde vient d'un calque d'objets Tiled `colliders` séparé, ingéré par [`ingestColliders.ts`](../../../apps/dino-brawl/src/game/tiled/ingestColliders.ts) avec `layer = CollisionLayers.World` ; le joueur est `collidesWith: World` ([`PlayerPrefab.ts:75`](../../../apps/dino-brawl/src/game/prefabs/player/PlayerPrefab.ts)). Aucun `Collider2D` n'est créé depuis `occluder_regions`, et la layer `Occluder` n'est portée par aucun collider. Fusionner les deux rectangles (un seul rect = tri + collision) reste possible → backlog §13.

## 10. Coordonnées & échelle

- Cellules → **local** : `cellOrigin(cellSize, cellGap, cx, cy)` ([`utils/tilemap-geometry.ts`](../../../packages/gameplay/src/systems/utils/tilemap-geometry.ts)).
- Échelle monde : `Transform2D.scale = MAP_SCALE` sur le Grid, composée dans `WorldTransform2D.matrix` de chaque enfant → appliquée par le node (comme `TileMapRenderSystem.syncNode`). Les strips sont **enfants du Grid** → héritent l'échelle sans effort (décision B).
- `footY` **monde** : le rectangle passe déjà par `colliderFromRect` (×`MAP_SCALE`, origine top-left) → `footY = colliderWorld.y + colliderWorld.height`. Stocké tel quel dans `OccluderStrip.footY` (pas de recomposition au rendu).

## 11. Enregistrements & placement

| Élément                                                     | Package / dossier                                            | Enregistrement                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `OccluderStrip`                                             | `gameplay/src/components/`                                   | défini dans `GameplayPlugin.install` ; composant LEVEL 1 réexporté brut via `gameplay/src/index.ts`       |
| `OccluderRenderSystem`                                      | `gameplay/src/systems/`                                      | `registerSystem(render, …, { stage: "PreRender" })` + `world.onRemove(OccluderStrip, …)` |
| `bakeOccluderStrips` + `OccluderRegion`/`OccluderStripData` | `gameplay/src/authoring/`                                    | — (helper pur)                                                                           |
| Ingestion `occluder_regions` + calques `occluders_*`        | `apps/dino-brawl/src/game/tiled/ingestOccluders.ts`          | appelé depuis `MapBuilder.build`, après les calques de tuiles                            |

Barrels : réexport de `OccluderStrip` / `OccluderRenderSystem` / `bakeOccluderStrips` depuis `gameplay/src/index.ts`.

## 12. Stratégie de test

- **Baker (unitaire, sans GPU)** : `single` → 1 strip (tuiles ramassées, `footY` correct) ; `perRow` → 1 strip par `cy` non vide avec le bon `footY` ; région vide → aucun strip ; cellules hors rectangle ignorées ; `TileSet` mocké (`{ id, width, height }`).
- **`OccluderRenderSystem` (intégration ECS)** : node monté/démonté sur add/remove `OccluderStrip` ; `applySortFields` écrit `sortPrimary = footY` sur `Entities` ; échelle héritée du `WorldTransform2D` ; instances posées **une fois** (pas de rebuild par frame).
- **Tri (intégration)** : un joueur à `worldY = Yp` s'ordonne **entre** deux strips (`footY` < `Yp` < `footY'`).
- **Batching (unitaire `RenderQueue`)** : N commandes même `kind`/`batchKey` contiguës → 1 run ; une commande intercalée casse le run — couvert par [`packages/nebula/test/RenderQueue.test.ts`](../../../packages/nebula/test/RenderQueue.test.ts) (au niveau `RenderQueue`, pas spécifiquement avec des strips).
- **Vérif navigateur (obligatoire, WebGPU)** : scène dino-brawl, le joueur passe **devant** un mur quand il est plus bas et **derrière** quand il est plus haut ; un `perRow` reculant s'interleave rangée par rangée ; compteur de draws bas (un seul tileset). Les fichiers d'app doivent `import type` les symboles type-only (sinon Vite casse au runtime — écran noir).

## 13. Non-objectifs / backlog (v2+)

- **Backend 2 — flyweight zéro-entité** : baker qui émet une sort key par strip directement dans le `RenderQueue`, strips d'une même bande de profondeur groupés en un node. À faire **uniquement** si le profiler réclame (milliers d'occluders intercalés). Même modèle mental → migration mécanique.
- **Détection automatique** (composantes connexes du calque `occluders`, base = cellule du bas de chaque colonne) — sans rectangle, mais arbres / structures nord-sud imprécis, et pas de colliders offerts. Mode de secours.
- **Slicing riche** : `perCol`, diagonale, per-cell ; anchor/foot configurable par tuile.
- **Atlas / texture-array occluder partagé** : les tilesets multiples (arbres, murs…) sont supportés en v1 (1 strip par tileset), mais chaque tileset = un `batchKey` → quelques draws de plus. Les fusionner en un atlas / texture-array = optimisation batching (non nécessaire à l'échelle actuelle).
- **Création des `Collider2D` occluder** : toujours à faire (la feature collisions est passée par un calque `colliders` distinct, cf. §9) — fusionner tri et collision sur le même rectangle `occluder_regions`.
- **Culling des strips** : AABB par strip contre le viewport (reporté v1 — peu de strips).
- **occluders dynamiques** (rebuild d'instances / `footY` quand l'objet bouge) — v1 suppose **statique**.
- **Sérialisation** : `slice`/`sortingLayer` déjà portés par les propriétés Tiled ; un `AssetRef` d'occluder → dépend du JSON tilemap (backlog tilemap).
