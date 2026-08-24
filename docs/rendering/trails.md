# Nebula — Trails (ruban miter instancié)

> Statut : **implémenté** (design validé et livré le 2026-08-23, mergé dans `dev`).
> Livré : tout ce que décrit ce document, plus deux mécanismes ajoutés en revue et absents du design initial — le vidage du ruban au front montant de `emitting` et la commande `clear()` du composant (§6.1, §6.2). Le doc a par ailleurs été corrigé en cours de route sur trois points : la marge de cull doit couvrir l'allongement du miter (§4.2), le `batchKey` dérive du blend et non du nœud (§4.2, §7), et le « zéro allocation par frame » ne vaut que pour le chemin géométrique CPU (§7).
> Non vérifié visuellement : le rendu du ruban pendant un swing réel à 60 fps dans dino-brawl, et le placement exact de la pointe (`(44,-44)`) — le pane de preview throttle cette app à 4 fps. La géométrie, elle, est vérifiée navigateur à plein framerate dans `apps/webgpu`.
> Portée : `@atlasjs/nebula` (core, backend-agnostic) + `@atlasjs/nebula-webgpu` (backend WebGPU) + `@atlasjs/gameplay` (composant + système ECS) + `apps/webgpu` et `apps/dino-brawl` (validation).
> Contexte : première brique de VFX du moteur. Suit le grain posé par `docs/rendering/renderer-architecture.md` et `docs/rendering/shapes.md` : un nouveau `NodeRenderer` branché sur la file de rendu commune, sans nouveau mécanisme de batching. Aucune forme n'était exposée au niveau ECS avant ce design — `TrailRenderer` est le premier renderer non-sprite côté `gameplay`.

---

## 1. Objectif et périmètre

Offrir un `TrailRenderer` de la même facilité d'emploi que celui d'Unity : on pose le composant sur une entité, elle laisse une traînée derrière elle.

Trois usages sont visés dès la conception, et servent de cibles de validation :

- **Swing d'arme** — traînée courte et fine sur la pointe d'une lame, allumée/éteinte par une phase de timeline d'attaque.
- **Mouvement** — traînée plus longue et large derrière un personnage qui dash ou tombe.
- **Projectile** — traînée portée par une entité éphémère, qui doit survivre proprement à la destruction de son émetteur.

Contraintes directrices :

- **Réutiliser le chemin instancié** (storage buffer + `draw(6, N)`) et la shader library built-in. Pas de nouveau mécanisme de batching, pas de géométrie dynamique.
- **Joints étanches** : le ruban ne doit montrer ni trou ni chevauchement dans ses virages, y compris en blend alpha où un chevauchement se verrait comme une couture claire.
- **Zéro allocation par frame** dans le chemin de rendu, et **zéro buffer GPU par trail** — un trail naît et meurt en permanence pendant une partie.
- Respecter les invariants des deux packages : core **backend-agnostic** (aucun WGSL, aucun `@webgpu/types`, aucun import backend), WGSL comme source de vérité côté backend, réflexion = autorité de layout.

Hors périmètre (YAGNI) : trails texturés, caps ronds, courbes de largeur et gradients multi-clés à la Unity, alignement configurable (en 2D le ruban fait toujours face à la caméra), corner vertices.

## 2. Insight central : le vrai ruban ne demande pas de vertex buffer dynamique

Un `TrailRenderer` mesh classique construit un triangle strip et réuploade ses vertices chaque frame. Ce n'est pas nécessaire ici, parce que la qualité d'un ruban ne vient pas de la topologie choisie : **elle vient des normales aux joints.**

- Une chaîne de quads indépendants, chacun orienté par la normale de *son* segment, laisse un coin vide à l'extérieur du virage et un chevauchement à l'intérieur.
- Un ruban propre partage, à chaque point, **une seule paire de positions de bord** entre les deux segments adjacents — la normale miter, moyenne des normales des deux segments voisins.

D'où la réalisation retenue :

> Chaque instance est **un segment**, et elle porte **les offsets miter de ses deux extrémités**. Ces offsets sont calculés une fois par point côté CPU, puis écrits **à l'identique** dans les deux segments adjacents. Le bord du joint est donc littéralement les deux mêmes positions des deux côtés : ruban **étanche**, pas de trou, pas de chevauchement, pas de couture alpha.

Ce que cette réalisation évite :

| Évité | Pourquoi c'est important |
|---|---|
| Toute API de buffer dynamique dans le core | `VertexBuffer` et `Geometry` restent immuables. Pas de nouvelle capacité `update()` dont il faudrait concevoir la sémantique d'upload et de durée de vie. |
| Tout buffer GPU par trail | `WebGPUInstanceBufferPool` fait déjà de l'upload storage poolé par frame et supporte plusieurs `acquire()` par frame. Rien à libérer quand un trail meurt — décisif pour les trails détachés. |
| Tout code de pipeline | `WebGPUPipelineFactory.getInstanced(...)` puis `draw(6, N)` sont déjà exactement ce qu'il faut, comme pour les formes. |

Le coût côté backend tombe ainsi à **un fichier WGSL, une classe de batch et deux enregistrements**.

**Limite assumée.** Sur un repli quasi-180°, la longueur du miter part à l'infini. On la clampe : le facteur d'allongement est borné à `MAX_MITER = 2`, ce qui fait retomber le bord vers la normale du segment et laisse au pire une légère encoche sur un angle pathologique. Technique standard.

**Le struct par segment**, dont les offsets sont donnés par la réflexion WGSL :

```
Segment {
  posA:   vec2, posB:   vec2,   // extrémités du segment, en espace monde
  edgeA:  vec2, edgeB:  vec2,   // offset miter (normale × demi-largeur) à chaque extrémité
  colorA: vec4, colorB: vec4,   // couleur + alpha à chaque extrémité
}                               // 64 octets, sans padding
```

## 3. Couche nœud (`@atlasjs/nebula`, `graphics/`)

`TrailNode extends Node` porte **la simulation**, pas seulement les données. Un trail reste donc utilisable depuis `apps/webgpu` en pur nebula, sans ECS — cohérent avec l'autonomie des nœuds existants.

Champs publics : `time`, `minVertexDistance`, `startWidth`, `endWidth`, `startColor`, `endColor`, `blend` (défaut `"alpha"`).

Pas de champ `emitting` sur le nœud : émettre, c'est appeler `emit()`. L'appelant décide, le nœud n'a pas à porter un drapeau que personne d'autre que lui ne lirait.

Interface comportementale — **deux méthodes** :

- `emit(x: number, y: number): void` — pousse la position courante de l'émetteur.
- `advance(dt: number): void` — vieillit les points et évince les périmés.

Plus `clear()`, `pointCount`, et un accès en lecture aux points pour le renderer.

**La règle de la tête.** Si l'on ne poussait un point que tous les `minVertexDistance`, la tête du ruban traînerait jusqu'à `minVertexDistance` derrière l'émetteur — franchement visible sur un swing rapide. Donc `emit()` :

1. buffer vide → crée le point de tête, âge 0 ;
2. sinon, si la distance à la tête ≥ `minVertexDistance` → **commit** : la tête devient un point intérieur, un nouveau point de tête est créé à `(x, y)`, âge 0 ;
3. sinon → **déplace** simplement la tête existante sur `(x, y)` et remet son âge à 0.

La tête colle donc à l'émetteur chaque frame, et un émetteur immobile ne fait pas disparaître son ruban prématurément : seule la queue vieillit, jusqu'à ce qu'il ne reste qu'un point — donc plus rien à dessiner.

**Éviction.** `advance(dt)` ajoute `dt` à chaque âge, puis retire depuis la queue tant que `âge > time`. Un commit sur un buffer plein retire d'abord le plus vieux point. Le ring buffer est trois `Float32Array` (`xs`, `ys`, `ages`), alloués à la construction. La capacité se change par `setCapacity(maxPoints)`, qui ne réalloue que si la valeur diffère et tronque les points en trop depuis la queue.

**Convention d'indexation** : l'index 0 est la **tête** (le point le plus récent, à l'émetteur), l'index `count - 1` la **queue**. Le paramètre d'interpolation d'un point est donc `t = i / (count - 1)`, avec `t = 0` du côté `startWidth`/`startColor` — même sémantique que Unity, où « start » désigne l'extrémité émettrice.

**Ordre d'appel** : `emit()` puis `advance()` dans la même frame. La tête a ainsi l'âge `dt` au moment du rendu, ce qui est cohérent avec le fait qu'elle existe depuis `dt`.

**Espace des points.** Les points sont stockés **en espace monde** et le transform propre du `TrailNode` est ignoré pour leur placement — sémantique du trail world-space d'Unity. Le nœud est ajouté à la racine de la scène.

## 4. Couche render (`@atlasjs/nebula`, `renderers/`)

### 4.1 `TrailDrawCommand`

Nouveau membre de l'union taguée `DrawCommand`, avec le tronc commun habituel (`sortingLayer`, `sortPrimary`, `sortSecondary`, `kindOrder`, `batchKey`, `renderState`) plus :

```
positions:  ReadonlyArray<Vec2>   // par point, tête → queue
edges:      ReadonlyArray<Vec2>   // par point
colors:     ReadonlyArray<Vec4>   // par point
pointCount: number
```

La commande transporte des données **par point**, pas par segment : c'est le batcher qui apparie. Aucune donnée n'est dupliquée, et c'est ce qui garantit structurellement l'étanchéité (voir 4.3).

`KIND_ORDER.trail = 3` rejoint `sprite: 0`, `shape: 1`, `tilemap: 2`.

### 4.2 `TrailNodeRenderer`

`matches(node)` → `node instanceof TrailNode`. `collect(node, viewport, scratch)` :

1. `pointCount < 2` → `null` (rien à dessiner).
2. Cull : bbox du nuage de points élargie de la demi-largeur max **multipliée par `MAX_MITER`**, testée contre le viewport → `null` si dehors. Le facteur est nécessaire : un joint miter déporte un sommet jusqu'à `MAX_MITER` fois la demi-largeur locale, donc une marge d'une simple demi-largeur sous-couvre le ruban et ferait disparaître d'un coup un trail replié au bord du viewport. Le bbox se calcule sur les points **source**, avant tessellation, pour ne pas payer l'étape suivante sur un trail hors champ — mais il faut alors élargir la marge de l'**overshoot de la spline**, car une Catmull-Rom déborde de l'enveloppe convexe de ses points de contrôle. Ce débord est borné par `maxChord / 8`, où `maxChord` est la plus grande distance entre deux points source consécutifs ; la borne est atteinte sur un virage à 90° à cordes égales (centripète = uniforme quand l'espacement est égal, donc la paramétrisation ne sauve pas ce cas). La marge vaut donc `demi-largeur_max * MAX_MITER + maxChord / 8` dès que `smoothing > 1`.

Sans ce terme la marge est dépassée exactement quand `maxChord > 8 × demi-largeur_max`, et le symptôme est brutal : `collect` renvoie `null`, donc **tout** le ruban disparaît le temps d'une frame, pas seulement le bourrelet. Inatteignable pour le rappier (`startWidth: 48`, cordes ~13,5 u — 30× de marge), atteignable avec les défauts de la bibliothèque (`startWidth: 8` → seuil à 64 u/frame, soit un projectile rapide ou un hitch de 200 ms) et vite atteint sur un ruban fin (`startWidth: 2` → 16 u/frame). `maxChord` s'accumule dans la boucle que le bbox parcourt déjà : un `sqrt` par trail.
3. Tessellation (RENDER-23) : les points source sont densifiés par une spline Catmull-Rom **centripète** (`alpha = 0.5`), `smoothing` sous-segments par paire de points source (`0`/`1` = pas de subdivision, comportement historique). Centripète et non uniforme, parce que l'échantillonnage de l'émetteur est irrégulier — sa vitesse varie d'une frame à l'autre — et qu'une paramétrisation uniforme dépasse (overshoot) et peut s'auto-intersecter sur un espacement inégal ; le lissage devient ainsi indépendant du framerate. Le paramètre `t` d'un point densifié doit valoir celui de sa position **source** — `t = (i + f) / (sourceCount - 1)`, `f` étant la fraction entre les points source `i` et `i+1` — et surtout pas la longueur d'arc réelle de la spline, sinon le dégradé de largeur et de couleur se déformerait selon l'espacement des points.

**Le code le calcule pourtant depuis l'index densifié, et c'est exact** : avec un `smoothing` constant par paire, les deux formules sont algébriquement égales, puisque `count - 1 == (sourceCount - 1) * smoothing` par construction, donc `(i + f) / (sourceCount - 1) == index / (count - 1)`. Aucun tableau de paramètres intermédiaire n'est donc conservé. **Cette égalité ne tient que tant que `smoothing` est constant par paire** : le jour où la subdivision devient adaptative (par longueur de corde, par exemple), elle se rompt et il faudra reconstruire explicitement la paramétrisation source.
4. Pour chaque segment `i` de la polyligne densifiée, direction `dir_i = normalize(p[i+1] - p[i])`, normale `n_i = (-dir_i.y, dir_i.x)`.
5. Pour chaque point `i`, l'offset de bord :
   - extrémités : `n_0` à la tête, `n_{count-2}` à la queue ;
   - intérieur : `m = normalize(n_{i-1} + n_i)`, allongé de `1 / dot(m, n_i)` borné à `MAX_MITER` ;
   - multiplié par la demi-largeur `lerp(startWidth, endWidth, t) * 0.5`.
6. Couleur du point : `lerp(startColor, endColor, t)`.
7. `batchKey` = un identifiant dérivé du **blend mode**, comme le `BATCH_IDS` de `ShapeRenderer` → tous les trails d'un même blend adjacents dans la file fusionnent en un seul `begin`/`add`/`draw`. C'est correct parce que les segments sont autonomes dans le shader : rien n'y est par-trail, plusieurs rubans partagent donc sans risque un storage buffer et un `draw(6, N)`. Le z-order reste juste puisque `RenderQueue.flush` ne fusionne que des commandes **adjacentes après tri** — si quoi que ce soit se trie entre deux trails, le run se coupe de lui-même.

Les `Vec2[]`/`Vec4[]` de sortie vivent dans un `TrailRenderData` caché en `WeakMap` par nœud (via `NodeRendererBase`), grandi une fois à `(maxPoints - 1) * smoothing + 1` (la taille de la polyligne densifiée) et muté en place — même schéma que `TileMapRenderData`. **Zéro allocation par frame.**

`renderState` vient de `NodeRendererBase.RENDER_STATES[node.blend]`, donc `"additive"` suffit pour un trail glow.

### 4.3 `TrailBatcher` et l'invariant d'étanchéité

```
add(command):
  for i in 0 .. pointCount - 2:
    batch.add(positions[i], positions[i+1],
              edges[i],     edges[i+1],
              colors[i],    colors[i+1])
```

Le segment `i` reçoit `edges[i+1]` comme `edgeB`, et le segment `i+1` reçoit ce **même** `edges[i+1]` comme `edgeA`. Idem pour les positions. Les deux côtés d'un joint sont donc bit-à-bit identiques par construction — l'étanchéité n'est pas une propriété numérique fragile à vérifier, c'est une conséquence du fait qu'il n'existe qu'une seule valeur.

### 4.4 Enregistrement

`SceneRenderer` instancie `TrailNodeRenderer` dans son tableau `nodeRenderers` ; la boucle d'enregistrement existante branche son batcher dans la `RenderQueue` sans autre changement. Les trails se trient dans la file commune, donc le **z-interleave avec sprites, formes et tilemaps est correct** sans travail supplémentaire.

### 4.5 Interfaces `core/renderer/`

- `SpriteBatch.ts` : ajout de `TrailBatch extends InstancedBatch`, sœur de `ShapeBatch` :
  `begin(renderState)` et `add(posA, posB, edgeA, edgeB, colorA, colorB)`.
- `ResourceFactory.ts` : ajout de `createTrailBatch(): TrailBatch`.

## 5. Backend WebGPU (`@atlasjs/nebula-webgpu`)

### 5.1 `shaders/trail.wgsl` (built-in `"trail"`)

`@group(1) @binding(0) var<storage, read> segments: array<Segment>`, pas de `@group(2)` (aucune texture) → layout de pipeline `[global, storage]`, exactement comme les formes.

Le vertex shader construit le quad depuis la table de 6 coins `(along, side)` avec `along ∈ {0, 1}` et `side ∈ {-1, +1}` :

```
let seg = segments[instanceIndex];
let c   = corners[vertexIndex];
let far = c.x > 0.5;

let base  = select(seg.posA,   seg.posB,   far);
let edge  = select(seg.edgeA,  seg.edgeB,  far);
let color = select(seg.colorA, seg.colorB, far);

out.position = uGlobal.viewProjection * vec4<f32>(base + edge * c.y, 0.0, 1.0);
out.color    = color;
out.side     = c.y;
```

**`select` et non `mix` :** la sélection ne fait aucune arithmétique, donc les deux segments d'un joint produisent des positions bit-à-bit identiques sans qu'on ait à raisonner sur la réassociation FMA d'un `mix`. L'étanchéité survit jusqu'au rasterizer.

Le fragment shader adoucit le bord sur la largeur :

```
let aa       = max(fwidth(in.side), 1e-5);
let coverage = clamp((1.0 - abs(in.side)) / aa, 0.0, 1.0);
return vec4<f32>(in.color.rgb, in.color.a * coverage);
```

Le feather porte sur les **bords longs** du ruban ; les extrémités restent coupées net (pas de géométrie de cap — hors périmètre).

### 5.2 Reste du backend

- `batch/WebGPUTrailBatch.ts` — `extends WebGPUInstancedBatch implements TrailBatch`, six tableaux parallèles et un `valueOf(index, name)`, calqué sur `WebGPUShapeBatch`.
- `WebGPURenderer.createTrailBatch()`.
- `WebGPUShaderList` : entrée `TrailInstanced` + `WebGPUBuiltinShaders.trail`.

Rien d'autre : `drawInstancedBatch` et `WebGPUPipelineFactory` fonctionnent tels quels. La réflexion gère les membres `vec2` dans un struct de storage, donc le struct de 6 membres est décrit une seule fois, en WGSL.

## 6. Couche gameplay (`@atlasjs/gameplay`)

### 6.1 Composant `TrailRenderer`

Tout est optionnel, donc un `options` seul, suivant la convention d'`AudioSource` :

```ts
export interface TrailRendererOptions {
  time?: number;              // durée de vie d'un point, en s — défaut 0.2
  minVertexDistance?: number; // pas d'échantillonnage, unités monde — défaut 2
  smoothing?: number;         // sous-segments Catmull-Rom par paire de points — défaut 3, 0/1 = aucun,
                              // tronqué à l'entier, borné à MAX_SMOOTHING = 8
  startWidth?: number;        // largeur à la tête — défaut 8
  endWidth?: number;          // largeur à la queue — défaut 0
  startColor?: Color;         // défaut blanc opaque
  endColor?: Color;           // défaut blanc alpha 0 (fade)
  emitting?: boolean;         // défaut true
  maxPoints?: number;         // cap du ring buffer — défaut 64
  blend?: BlendMode;          // défaut "alpha"
  visible?: boolean;          // défaut true
  sortingLayer?: string;      // défaut "Default"
  sortingOrder?: number;      // défaut 0
}
```

Le nom fait écho à `TileMapRenderer` face au `TileMapNodeRenderer` de nebula : le composant est la molette côté ECS, le renderer est l'implémentation côté rendu.

Une seule commande, sur le patron d'`AudioSource` (`play()`/`stop()` → champ `command` consommé par son système) :

```ts
export type TrailRendererCommand = "none" | "clear";
```

`clear()` positionne `command = "clear"` ; le système appelle `node.clear()` puis remet le champ à `"none"`. C'est le moyen de couper le ruban **sans** toucher à l'émission.

### 6.2 Système `TrailRenderSystem`

Enregistré dans la lane `render`, stage `PreRender`, après `gameplay:occluder-render` — donc en fin de chaîne. L'ordre est libre (le tri se fait sur les champs de sort, pas sur l'ordre de création des nœuds), mais rester en bout de chaîne garde la dépendance explicite. Il monte un `TrailNode` par entité dans un `SparseSet`, exactement comme `SpriteRenderSystem`.

Chaque `update({ world, dt })`, pour chaque `(WorldTransform2D, TrailRenderer)` :

1. résoudre le nœud (monter au premier passage) ;
2. recopier les molettes du composant sur le nœud ;
3. consommer un `command === "clear"` en attente ;
4. si `emitting` vient de passer de faux à vrai, `node.clear()` (voir ci-dessous) ;
5. si `emitting`, `node.emit(worldPosition.x, worldPosition.y)` ;
6. `node.advance(dt)` ;
7. `applySortFields(node, sortingLayers, layer, order, position.y)`.

Les deux vidages arrivent **avant** l'émission de la frame, pour que le nouveau tracé démarre propre.

La règle de distance minimale, l'éviction et le cap **ne sont pas connus du système** : il ne fait que nourrir le nœud. C'est le nœud qui est le module profond.

**Pourquoi vider au front montant de `emitting`.** Un segment signifie « l'émetteur a parcouru de A à B ». Si l'émission était coupée entre les deux, ce segment est un mensonge — et il se voit. Cas réel qui a motivé la règle : sur un combo de rappier, l'attaque suivante démarre à la frame d'après, donc les points du swing précédent sont tous encore vivants (âge ≈ 1 frame contre `time` 0,14 s), pendant que la pointe téléporte d'une centaine d'unités monde parce que la pose repasse de `angleOffset: 0` (fin de `recover`) à `windupAngle` (début de `strike`). Sans vidage, `emit` commit ce saut et le batcher produit un segment pleine largeur qui traverse le personnage pendant 0,14 s. Le système mémorise donc le dernier `emitting` vu par monture — un `MountedTrail { node, emitting }` calqué sur le `MountedSprite` de `SpriteRenderSystem` — et vide sur la transition. Aucune app ne peut oublier de le faire.

Le drapeau est initialisé depuis la valeur courante du composant au montage, pour qu'une monture ne déclenche jamais de vidage parasite.

### 6.3 Cycle de vie : le trail se détache et s'éteint

Quand l'émetteur meurt, la traînée déjà émise ne doit pas disparaître d'un coup.

1. `registerCleanup` ajoute `world.onRemove(TrailRenderer, entity => trailRenderSystem.detach(entity))`.
2. `detach(entity)` sort le nœud du `SparseSet` et le pousse dans une liste `detached`. Il n'est plus visité par la query, donc plus alimenté en points — il n'y a pas de drapeau à baisser.
3. Chaque `update()`, après la query ECS : boucle à l'envers sur `detached`, `advance(dt)`, et dès que `pointCount < 2` → `removeFromParent()` + swap-remove.
4. La durée de vie d'un orphelin est bornée par `time` : **aucun risque de fuite**, et rien à libérer côté GPU puisque le storage buffer est poolé par frame.
5. `GameplayPlugin.uninstall()` appelle `trailRenderSystem.clear()` pour retirer les orphelins restants de la scène.

## 7. Performance

- **Zéro allocation par frame dans le chemin géométrique CPU** : ring buffers `Float32Array` dans le nœud, `Vec2[]`/`Vec4[]` pré-alloués dans le render data, tableaux parallèles réutilisés dans le batch. À nuancer côté backend : `WebGPUInstancedBatch.pack()` alloue un `ArrayBuffer` neuf par draw — dette préexistante du chemin instancié, partagée avec les sprites et les formes, pas introduite par les trails.
- **Zéro buffer GPU par trail** : tout passe par le pool d'instances, remis à zéro chaque frame.
- **Un draw call par blend mode — quand les commandes sont adjacentes après tri.** `RenderQueue.flush` ne fusionne qu'un run contigu, donc la fusion n'a lieu que si rien ne se trie entre deux trails. Sur un layer `ySorted` (le cas de dino-brawl), les trails s'intercalent avec les sprites par leur Y et ne fusionnent quasi jamais : compter plutôt **un draw par trail** en pratique là-bas. Un trail typique de 0,2 s à 60 fps fait une dizaine de points source, donc **une trentaine de segments au `smoothing` par défaut de 3** — une instance GPU par sous-segment ; un trail de dash de 0,5 s en fait une trentaine, donc ~90.
- Le coût CPU de `collect()` est linéaire en nombre de points **densifiés**, avec un `normalize` et un `dot` par point, plus un `hypot` et un `pow` par paire de points source pour les nœuds centripètes (calculés une fois chacun et roulés d'une itération à la suivante, pas trois fois).
- Le **remplissage GPU**, lui, ne change quasiment pas avec le `smoothing` : l'aire du ruban est la même, on la découpe simplement en plus de quads. C'est le nombre d'instances qui monte, pas le nombre de pixels — utile à garder en tête pour ne pas surpondérer le coût de la tessellation.

## 8. Tests et validation

| Niveau | Ce qui est vérifié |
|---|---|
| `nebula` — `TrailNode` | commit à `minVertexDistance` ; tête qui suit l'émetteur chaque frame sans commit ; remise à zéro de l'âge de la tête ; éviction par âge via `advance(dt)` ; cap `maxPoints` qui retire le plus vieux ; `clear()` |
| `nebula` — `TrailNodeRenderer` | `null` en dessous de 2 points ; `segments === pointCount - 1` ; **`edges[i+1]` partagé entre les segments `i` et `i+1`** ; lerp de largeur et de couleur tête→queue ; clamp du miter sur un repli à 180° ; points exactement coïncidents sans `NaN` ; `null` hors viewport **et non-`null` quand seul le joint miter entre dans le viewport** ; `batchKey` identique pour deux nœuds de même blend, différent sinon ; et côté tessellation : ligne droite restée droite sous subdivision, `smoothing = 1` reproduisant la géométrie historique, étanchéité re-vérifiée sur **chaque** joint densifié, `smoothing` énorme borné à `MAX_SMOOTHING`, **non-cull d'un ruban dont seul le bourrelet de spline entre dans le viewport**, et le défaut `3` exercé de bout en bout sans toucher au champ |
| `gameplay` — `TrailRenderSystem` | mount au premier update ; molettes propagées au nœud ; `onRemove` → détaché et non plus mis à jour par la query ; orphelin qui s'éteint puis quitte la scène ; nombre d'enfants de la scène revenu au niveau initial (preuve de non-fuite) |
| Navigateur | `apps/webgpu` : un nœud parcourant un huit — valide le miter en courbe douce **et** le repli serré. Puis `apps/dino-brawl` : trail sur la pointe du rappier pendant le combo. |

La validation navigateur suit `atlas-verify-webgpu` : une erreur de compilation WGSL ne remonte pas en erreur console, et le dev server peut servir une scène périmée après hot-reload.

## 9. Découpage de livraison

Chaque étape compile et passe ses tests seule — c'est pour cette raison que la plomberie backend arrive avant le renderer qui l'allume.

1. `feat(nebula): add TrailNode` — nœud, ring buffer, simulation, tests. Rien ne dessine encore.
2. `feat(nebula-webgpu): add the trail batch and shader` — interface `TrailBatch`, `createTrailBatch()` côté core et backend, `trail.wgsl`, `WebGPUTrailBatch`. Compile, ne dessine toujours rien.
3. `feat(nebula): render trails as a mitered ribbon` — `TrailDrawCommand`, `TrailNodeRenderer`, `TrailBatcher`, `KIND_ORDER.trail`, enregistrement dans `SceneRenderer`, plus une scène de démo dans `apps/webgpu` et sa validation navigateur.
4. `feat(gameplay): add the TrailRenderer component and system` — composant, système, détachement, câblage plugin, tests.
5. `feat(dino-brawl): add a trail to the rappier` — validation en usage réel.

Les étapes 1→2 et 2→3 changent l'API publique de `nebula` et `nebula-webgpu` : `pnpm --filter <pkg> build` avant que le consommateur suivant type-check.

## 10. Suites naturelles (hors périmètre)

À verser dans `docs/backlog/` à la clôture :

- **Trails texturés** — un `u` de distance cumulée par point suffit à ouvrir les UV le long de la longueur ; le struct de segment et le chemin de batch ne changent pas.
- **Caps ronds** — extrémités adoucies, aujourd'hui coupées net.
- **Courbes de largeur et gradients multi-clés** — le lerp linéaire tête→queue couvre le cas courant ; Unity offre des courbes complètes.
- **`AfterimageRenderer`** — feature voisine et distincte : estamper des copies fanées du sprite de l'émetteur, look très utilisé en pixel-art pour les dashs. N'a rien à voir avec un ruban et ne doit pas être confondu avec ce design.
