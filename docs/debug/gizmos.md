# Debug — Gizmos (colliders & pivots)

> Statut : **implémenté** (v1). Les extensions V2 sont dans [`../backlog.md`](../backlog.md) § Debug — Gizmos.
> Portée : nouveau package `@atlasjs/gizmos` + extension **stroke** de `@atlasjs/nebula` / `@atlasjs/nebula-webgpu`. Vérification dans `apps/webgpu` et `apps/dino-brawl`.
> Contexte : avant cette feature, un collider était invisible et un pivot ne se devinait qu'en collant un sprite `debug.png` en enfant de l'entité (workaround qui vivait dans `apps/dino-brawl`, `SwordWithShadowPrefab`, **supprimé par cette feature**). Ce design remplace ce bricolage par des gizmos moteur, en posant la brique dont le futur éditeur aura besoin.

---

## 1. Objectif et périmètre

Rendre visibles, à l'exécution, deux informations aujourd'hui invisibles :

- **Les colliders** — position, taille et nature (solide vs sensor).
- **Les pivots / origines d'entité** — le point autour duquel tout tourne.

Deux modes de déclenchement complémentaires :

- **Composants par entité** (`ColliderGizmo`, `PivotGizmo`) pour un cas ciblé.
- **Switch global** (`settings.showColliders`) pour afficher d'un coup tous les colliders du monde, sans toucher aux entités. C'est le mode utile au quotidien (« pourquoi ça ne collide pas ? »).

Contrainte directrice, qui pilote tout le reste : **un outil de debug ne ment jamais**. Un gizmo approximatif est pire que pas de gizmo — il fait perdre une journée sur une fausse piste.

Le package doit être **opt-in total** : si le plugin n'est pas installé, aucun octet de code de debug dans le bundle du jeu.

**Hors périmètre v1** (→ § 9) : gizmos de sélection / poignées d'éditeur, gizmos de raycast, texte à l'écran, gizmos de hiérarchie, épaisseur de contour constante à l'écran, capsule/segment/polygon exacts, façade de scripting.

**Explicitement écarté** : l'accès aux gizmos depuis les scripts de gameplay. Les gizmos sont **100 % pilotés moteur** (app hôte / éditeur via `engine.services`). Pas de `ScriptService`, pas de façade `GizmoApi`.

---

## 2. Insight central : la seule source de vérité est la physique

C'est le point qui décide de l'architecture entière. Trois faits établis dans `buildColliderDesc` (`packages/gameplay/src/systems/PhysicsPushSystem.ts`) :

1. **`Transform2D.scale` n'est jamais appliqué au collider.** Le descripteur part avec `shape: col.shape` verbatim. Une entité avec `scale = (1.2, 1.2)` et un `box` 40×40 rend un sprite à 120 % mais expose une hitbox de 40×40 en unités monde.
2. **Deux régimes de placement.** Avec `PhysicsBodyRef`, la `translation` du collider vaut `col.offset`, **relatif au body** (le body porte le placement monde). Sans body, l'offset est **cuit en coordonnées monde à la création** — dans le chemin `pendingColliders`, qui ne tourne **qu'une seule fois**. Conséquence : un collider sans `RigidBody` est figé définitivement et ne suit plus son `Transform2D`.
3. **`RapierCollider.getTranslation()` renvoie la position monde absolue**, déjà convertie en unités monde (`packages/rapier/src/RapierCollider.ts`).

Un gizmo qui composerait naïvement `Collider2D` × `WorldTransform2D` dessinerait donc un rect de 48×48 là où le sprite se croit, alors que rapier teste 40×40 ailleurs. **Il mentirait.**

### Règle de la feature

> Le gizmo de collider lit **position et rotation depuis `PhysicsColliderRef`** (la vérité rapier), **les extents depuis `Collider2D.shape`** (jamais scalées par le transform), et **ne dessine rien tant que `PhysicsColliderRef` n'existe pas**.

Aucun fallback « intention ». L'absence de gizmo est elle-même l'information : *ce collider n'existe pas dans le monde physique*. Corollaires directement exploitables :

- L'écart sprite/hitbox sous scale devient visible en une frame.
- Le piège « collider sans body = figé » devient visible.
- Un collider jamais créé se signale par son absence, au lieu de se déguiser en collider sain.

---

## 3. Architecture

### 3.1 Package

```
packages/gizmos/                        → @atlasjs/gizmos
  src/
    index.ts
    tokens.ts                 GIZMOS
    GizmoPlugin.ts            requires NEXUS, NEBULA_RENDERER · provides GIZMOS
    Gizmos.ts                 service : settings + API immediate-mode
    GizmoSettings.ts          politique des gizmos built-in
    GizmoNodePool.ts          pool de RectNode / CircleNode recyclés
    components/
      ColliderGizmo.ts
      PivotGizmo.ts
    systems/
      ColliderGizmoSystem.ts
      PivotGizmoSystem.ts
      GizmoFlushSystem.ts
  test/
```

Dépendances : `@atlasjs/core`, `@atlasjs/nexus`, `@atlasjs/nebula`, `@atlasjs/math`, `@atlasjs/utils`, **`@atlasjs/gameplay`** (pour `Collider2D`, `PhysicsColliderRef`, `WorldTransform2D`) et **`@atlasjs/inertia`** (pour `ColliderShapeDesc`, à narrower par `.type`, et `Collider`, à lire pour la position).

Le sens est unique : `gameplay` n'apprend jamais l'existence de `gizmos` → aucun cycle.

**Prérequis découvert à l'intégration** : `GizmoPlugin` est le premier plugin à faire attendre **deux** plugins sur un même service pas encore fourni (`NEBULA_RENDERER`, attendu aussi par `GameplayPlugin`). `ServiceRegistry.wait` ne gardait qu'**un** waiter par token et l'écrasait silencieusement, donc le premier plugin n'était jamais réveillé → `BootTimeoutError` au bout de 10 s. Bug latent de `@atlasjs/core`, indépendant des gizmos, corrigé (waiters en liste par token) avec un test de régression dans `packages/core/test/ServiceRegistry.test.ts`. Le package est un **plugin optionnel** au sens du CLAUDE.md : le moteur et le gameplay restent indépendants de lui.

Le **stroke** n'atterrit pas ici : c'est une capacité de rendu, pas du debug. Il va dans `@atlasjs/nebula` (+ backend `nebula-webgpu`) et ferme l'item backlog « strokes / contours » de `docs/rendering/shapes.md`.

### 3.2 Modèle de rendu : immediate-mode sur pool de nœuds

Approche retenue : un **buffer immediate-mode** adossé à un **pool de nœuds nebula recyclés**, plutôt qu'un nœud retenu par entité (façon `SpriteRenderSystem`).

Justification :

- **Moins de code** que le modèle retenu : aucun `SparseSet` keyé par entité, aucun `world.onRemove`, aucun `unmount`.
- **Le switch global devient un `if`** au lieu d'un churn de montage/démontage sur des centaines d'entités à chaque bascule.
- **C'est le primitif dont l'éditeur a besoin** : poignées de sélection, raycasts, vecteurs, previews ne sont pas liés à une entité et n'auraient aucune prise sur un modèle retenu.
- **Ça laisse la porte ouverte** à une passe/batch gizmo dédiée dans nebula plus tard : remplacer `scene.addChild` par une passe overlay ne change aucune ligne d'API appelante.

Le pool ne rend jamais sa mémoire : il se stabilise sur le pic de gizmos de la session. C'est le comportement voulu ici — zéro `addChild`/`removeChild` et zéro GC en régime stable.

### 3.3 Service

```ts
export class GizmoSettings {
  public showColliders: boolean;   // défaut false — switch global : dessine TOUS les Collider2D
  public showPivots: boolean;      // défaut false
  public colliderColor: Color;     // défaut (0, 1, 0, 1)     vert
  public sensorColor: Color;       // défaut (0, 1, 1, 1)     cyan
  public pivotColor: Color;        // défaut (1, 0, 1, 1)     magenta
  public pivotRadius: number;      // défaut 2   — unités monde
  public borderWidth: number;      // défaut 1   — unités monde
}

export class Gizmos {
  public readonly settings: GizmoSettings;

  public color: Color;             // style courant, mutable
  public borderWidth: number;      // style courant ; 0 ⇒ rempli

  public drawRect(x: number, y: number, width: number, height: number, rotation: number): void;
  public drawCircle(x: number, y: number, radius: number): void;
}
```

```ts
export type GizmoPluginOptions = Partial<GizmoSettings>;   // état initial du settings
new GizmoPlugin({ showColliders: true });
```

Décisions :

- **Deux méthodes, géométrie pure.** Le style vit dans un **état courant** mutable (`gizmos.color.set(...)` puis on dessine), à la manière de `Gizmos.color` de Unity. Aucune allocation par appel, aucun objet d'options à construire par gizmo et par frame.
- **`borderWidth = 0` signifie rempli.** Le disque du pivot et l'anneau sont donc la même méthode : pas de `drawDisc` séparé.
- **`settings` porte la politique** des gizmos built-in, la racine porte le **dessin**. Deux responsabilités distinctes, un seul token `GIZMOS` à résoudre pour le consommateur.
- Le service est récupéré via `engine.services` (app hôte, éditeur), jamais via un script de gameplay.

Un `sensor` est dessiné dans une couleur distincte du solide : l'information « ce collider ne bloque pas » est gratuite à produire et coûteuse à deviner autrement.

---

## 4. Composants

```ts
export class ColliderGizmo { public color: Color | null; }               // null ⇒ settings.colliderColor
export class PivotGizmo    { public color: Color | null; public radius: number | null; }
```

Des marqueurs, avec overrides optionnels. **`null` signifie « hérite du `settings` »** pour les deux champs — un seul modèle mental, et la question « qui gagne entre le composant et le settings » n'a qu'une réponse. `PivotGizmo.radius` existe parce qu'un rayon lisible sur un personnage ne l'est pas sur une tuile de 16 px.

Les deux sont `defineComponent`és par le `GizmoPlugin`, pas par `GameplayPlugin`.

### Sémantique du gizmo de pivot

`sprite.pivot` est déjà cuit dans l'anchor du `SpriteNode` (`SpriteRenderSystem.mount`), donc **le pivot en monde est exactement la position `WorldTransform2D` de l'entité**. Le `PivotGizmo` dessine un disque à cette position : c'est le marqueur d'origine d'entité, et c'est littéralement ce que le workaround `debug.png` produisait.

---

## 5. Mécanique de frame

### 5.1 Ordre des steps

Le pool se réinitialise **en fin de frame**, pas au début : ça économise un step et supprime toute question d'ordre d'initialisation.

```
lane render / stage PreRender :
  gizmos:collider     ─┐
  gizmos:pivot        ─┤ produisent (acquièrent dans le pool, visible = true)
  … producteurs éditeur (plus tard), avec { before: "gizmos:flush" }
  gizmos:flush        ─┘ hideUnused() puis reset()

lane render / stage Main :
  renderer.render()     (NebulaPlugin)
```

`renderer.render()` est enregistré en `render` / **`Main`** (`packages/nebula/src/NebulaPlugin.ts`) et tous les systèmes de rendu gameplay sont en **`PreRender`** : la fenêtre est propre.

- `hideUnused()` éteint tout ce qui dépasse le curseur — donc les nœuds d'une frame chargée non réutilisés à la frame suivante sont masqués **avant** le draw, jamais avec une frame de retard.
- `reset()` remet le curseur à zéro pour la frame suivante.

**`gizmos:flush` est le seam nommé de l'éditeur** : tout futur producteur s'insère avec `before: "gizmos:flush"` sans modifier ce package.

### 5.2 Pool

Deux pools distincts (les types de nœuds diffèrent) : `RectNode` et `CircleNode`. Chacun a un curseur ; `acquire` renvoie le nœud courant, ou en crée un et l'ajoute à `nebula.scene` si le pool est épuisé.

Pas de `drawLine` ni de pool de `LineNode` en v1 : **aucun gizmo v1 ne dessine de ligne**. L'ajouter est un pool de plus et une méthode de plus, sans changement d'architecture — ça viendra avec le premier consommateur réel (hiérarchie, raycast, vecteurs → § 9).

### 5.3 Tri

Chaque nœud de gizmo pose `sortingLayer = GIZMO_SORTING_LAYER`, fixé à `1_000_000` — très au-delà de tout index de layer qu'une app déclarera (`SortingLayers` incrémente de 1 par layer). Le tri de nebula est un comparateur numérique simple sur `(sortingLayer, sortPrimary, sortSecondary)` **sans bit-packing** (`RenderQueue`) : les gizmos passent donc au-dessus de tout ce que l'app a déclaré, **sans que `@atlasjs/gizmos` connaisse les layers nommés de l'app**. Découplage total, aucune dépendance à `SortingLayers`.

### 5.4 Requête et absence de double-dessin

Un seul passage par système, `optional` pour le composant :

```
world.query(Collider2D, PhysicsColliderRef).optional(ColliderGizmo).each(...)
```

puis, dans le corps : sortir si `!settings.showColliders && gizmo === undefined`. Le cas « composant présent **et** switch global actif » ne dessine donc qu'une seule fois.

### 5.5 Portée du switch global des pivots

`PivotGizmoSystem` requête `WorldTransform2D` et non `SpriteRender` : le gizmo marque l'**origine d'entité**, qui existe même sans rendu (ancre, point de spawn, nœud de groupe). `WorldTransform2D` n'est présent que si l'entité a un `Transform2D` (`GameplayPlugin` retire l'un avec l'autre), donc `showPivots = true` dessine un disque **par entité réelle**, pas par tuile : les tuiles d'un `TileMap` sont cuites dans un `TileMapNode` et ne sont pas des entités. Le compte reste borné par le nombre d'entités de la scène, et le pool absorbe le pic.

### 5.6 Coût assumé

`RapierCollider.getTranslation()` alloue un `new Vec2` par appel : environ 2 allocations par collider par frame, **uniquement quand le debug est allumé**. Assumé pour la v1 — c'est un outil opt-in, et je ne veux pas qu'un outil de debug force un changement de contrat dans un package physique. Chemin de sortie si ça devient mesurable : une surcharge `getTranslation(out?: Vec2)` sur le contrat `Collider` d'`inertia`.

---

## 6. Le stroke (`@atlasjs/nebula` + `@atlasjs/nebula-webgpu`)

### 6.1 Le problème

`shape_instanced.wgsl` travaille en **espace quad local** (`localPos ∈ -0.5..0.5`) : `dist = length(localPos)`, cercle coupé à `0.5`. Une épaisseur exprimée dans cet espace serait **scalée par le nœud** : un rect 40×80 aurait un contour deux fois plus épais sur un axe que sur l'autre.

### 6.2 La solution : dériver la taille monde de la matrice model

Dans le vertex shader :

```wgsl
let sx: f32 = length(instance.model[0].xyz);
let sy: f32 = length(instance.model[1].xyz);
out.halfSize = vec2<f32>(sx, sy) * 0.5;   // nouveau @location
```

Dans le fragment, tout raisonne en **unités monde** :

```wgsl
let isCircle: bool = in.params.x > 0.5;
let border: f32 = in.params.y;

let p: vec2<f32> = in.localPos * in.halfSize * 2.0;

let circleDist: f32 = length(p) - in.halfSize.x;
let q: vec2<f32> = abs(p) - in.halfSize;
let rectDist: f32 = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);
let d: f32 = select(rectDist, circleDist, isCircle);

let aa: f32 = max(fwidth(d), 1e-5);
let outer: f32 = 1.0 - smoothstep(-aa, 0.0, d);
let inner: f32 = smoothstep(-aa, 0.0, d + border);
let stroked: f32 = select(outer, outer * inner, border > 0.0);
let coverage: f32 = select(stroked, 1.0, !isCircle && border <= 0.0);
```

**Aucun branchement, que des `select`** — et c'est une contrainte du langage, pas une préférence de style. `fwidth` est un builtin de **dérivée** : WGSL interdit de l'appeler depuis du contrôle de flux non-uniforme. Comme `in.params` est un attribut interpolé (donc possiblement non-uniforme), un `if`/`return` anticipé qui en dépend rend tout le code suivant non-uniforme et le shader **refuse de compiler** :

```
error: 'fwidth' must only be called from uniform control flow
note: control flow depends on possibly non-uniform value
```

D'où la structure : les deux SDF et la dérivée sont calculées **inconditionnellement au niveau supérieur**, et les trois décisions (cercle vs rect, stroke vs plein, rect plein) sont des `select`. Les deux SDF coûtent quelques ALU de plus par fragment ; c'est le prix d'un shader qui compile. **Toute extension de ce shader** (coins arrondis via `params.z/w`, feather) doit respecter la même règle : aucun `if` dépendant de `params` avant l'appel à `fwidth`.

Trois propriétés qui font préférer ça au passage de la taille via `params.z/w` :

1. **Aucun slot `params` brûlé.** `params.z/w` sont **réservés aux coins arrondis / feather** par `docs/rendering/shapes.md`. Les dériver de la matrice les laisse libres.
2. **`fwidth` sur une grandeur en unités monde** donne des unités-monde-par-pixel : l'antialiasing reste correct à n'importe quel zoom caméra, gratuitement.
3. **Aucun changement de layout.** `params` est déjà un `vec4` → la reflection reste autorité et `WebGPUShapeBatch` n'est pas touché.

### 6.3 Surface côté core

- `ShapeNode.borderWidth: number` (défaut `0`) + `setBorderWidth()`.
- **Une ligne** dans `ShapeRenderer` : `data.params.set(kind, shape.borderWidth, 0, 0)`.

`params.y = 0` sur tout l'existant ⇒ **comportement de fill inchangé** pour tous les appelants actuels.

### 6.4 Non-régression des chemins de fill existants

**Le rect plein doit court-circuiter la SDF.** Sa géométrie *est* le quad : il n'a aucune marge pour l'antialiasing. Au bord, `localPos = ±0.5` ⇒ `q = 0` ⇒ `d = 0` ⇒ `coverage = 0`. Appliquer la SDF au fill mettrait donc le rang de pixels extérieur à alpha 0 : **tous les rects pleins existants perdraient leur bord** et gagneraient un contour flou. D'où le `select(stroked, 1.0, !isCircle && border <= 0.0)` final, qui force la couverture à exactement `1.0` — le chemin d'origine reste bit-identique. Mesuré sur `apps/webgpu` : le bord d'un rect plein passe de 0 à 255 en **un seul pixel**, sans dégradé.

**Vérifié numériquement** plutôt qu'à l'œil : sur un rect **non carré** 160×60 avec `borderWidth = 3` à dpr 2, les quatre côtés mesurent **7 px** de backing chacun (6 px + 1 px d'AA). Une épaisseur exprimée en espace quad local aurait donné des côtés verticaux ~2,7× plus épais que les horizontaux.

**Le cercle plein est mathématiquement inchangé** sous scale uniforme. Avec `p = localPos · 2r` : `d = 2r·dist − r = r(2·dist − 1)`, nul en `dist = 0.5` comme avant, et `fwidth(d) = 2r·fwidth(dist)` ⇒ la condition `d > −aa` équivaut exactement à `dist > 0.5 − fwidth(dist)`, soit la bande de smoothstep d'origine. Sous scale **non-uniforme**, le nouveau chemin est *plus* correct (l'AA était étiré). Aucune régression attendue, mais `apps/webgpu` reste dans le périmètre de vérification : c'est du code qui marche aujourd'hui.

**Bord extérieur du contour** : pour un stroke, la bande dessinée est `d ∈ [−border, 0]`, donc le demi-pixel extérieur est antialiasé — comportement SDF normal, mais un `borderWidth` très inférieur à 1 unité monde paraîtra délavé. Défaut à `1`.

**Ellipse** : un cercle sous scale non-uniforme est une ellipse, dont la SDF n'est pas analytique → l'épaisseur de l'anneau y devient approximative. Sans impact ici, `CircleNode` mappant `radius` sur `scale = (2r, 2r)` (toujours uniforme).

**Shear sous hiérarchie** : `halfSize` est dérivé de la **longueur des colonnes** de la matrice model, ce qui est exact sous rotation (une rotation préserve la norme) mais seulement approximatif si un ancêtre combine **scale non-uniforme et rotation**, cas où la matrice composée cisaille. L'épaisseur de contour deviendrait alors légèrement inégale. Ce n'est pas introduit par le stroke — une forme *pleine* est déjà rendue de travers dans ce cas, c'est l'item backlog **H2 « Rendu exact du shear »** ([`../backlog.md`](../backlog.md)) — mais le stroke rend le problème visible là où il ne l'était pas. Aucun cas de reproduction dans le moteur aujourd'hui : il faut imbriquer une forme sous un parent à la fois rotaté et scalé non-uniformément.

`LineNode` compose son `lineMatrix` dans le model : la taille monde dérivée y vaut `(longueur, épaisseur)`, donc un stroke sur une ligne produirait une ligne creuse. `borderWidth` reste à `0` pour les lignes ; ce n'est pas un cas d'usage v1.

---

## 7. Formes de collider couvertes en v1

| Forme | v1 | Rendu |
|---|---|---|
| `box` | ✅ exact | `RectNode` stroké, extents = `width`/`height` du desc |
| `circle` | ✅ exact | `CircleNode` stroké (anneau SDF), rayon du desc |
| `capsule` | ❌ | rien dessiné + **un** warn |
| `segment` | ❌ | rien dessiné + **un** warn |
| `polygon` | ❌ | rien dessiné + **un** warn |

`box` (8 usages) et `circle` (4) sont les seules formes réellement utilisées dans le dépôt ; `capsule`/`segment`/`polygon` n'apparaissent qu'une fois chacune, dans les types et les tests.

**Pas d'AABB approximative** pour les formes non couvertes : ça violerait la règle du § 2. Rien dessiné + un warn est honnête ; une boîte englobante qui ne coïncide pas avec la vraie forme est une fausse piste.

Le warn est émis **une seule fois par type de forme** (un `Set` de types déjà signalés sur le système). Un warn par frame à 60 fps noie la console.

---

## 8. Tests et vérification

Vitest, environnement node (pas de jsdom), comme le reste du dépôt — mêmes `define` (`__DEV__`/`__CONSOLE_TRANSPORT__`/`__WEBSOCKET_TRANSPORT__` à `"false"`) que les packages voisins.

**Comment tester un warn** : `createLogger` renvoie un `Logger` **sans aucun transport** quand `__DEV__` est faux (`packages/utils/src/logging/Logger.ts`), donc espionner `console.warn` ne voit rien. Espionner `Logger.prototype.warn` intercepte l'appel indépendamment des transports — pas de `define` à basculer (ce sont des constantes de compilation, donc tout le package ou rien), pas de seam d'injection à ajouter au système. C'est le premier test de warn du dépôt ; c'est le motif à réutiliser.

### 8.1 Pool & service

Dessiner N formes → N nœuds acquis et ajoutés à la scène ; le flush masque le surplus ; **la frame 2 réutilise les mêmes instances** (assertion d'identité — c'est ce qui prouve le zéro-churn) ; curseur remis à zéro ; `sortingLayer` = la constante gizmo ; couleur et `borderWidth` reportés sur le nœud.

### 8.2 `ColliderGizmoSystem` — le test qui *est* le design

| Cas | Attendu |
|---|---|
| `box` + `PhysicsColliderRef`, `Transform2D.scale = (2, 2)` | un rect à la translation **rapier**, extents **non scalés** |
| `Collider2D` sans `PhysicsColliderRef` | **rien** dessiné |
| composant présent **mais** `PhysicsColliderRef` absent | **rien** dessiné |
| `isSensor = true` | `settings.sensorColor` |
| `showColliders = true`, aucun `ColliderGizmo` | dessiné quand même |
| `showColliders = false`, aucun `ColliderGizmo` | rien |
| composant **et** switch global actifs | **un seul** rect |
| `capsule` / `segment` / `polygon` | rien dessiné + **un seul** warn, pas un par frame |
| solide dessiné **après** un sensor dans le même `update` | `colliderColor`, pas le `sensorColor` résiduel |
| `gizmos.borderWidth` laissé à `0` par un autre producteur | `settings.borderWidth`, pas l'aplat plein |
| `ColliderGizmo.color` non nul | override de la couleur du settings |

Le premier cas verrouille en exécutable la règle « le gizmo ne ment pas » ; c'est le test le plus important du lot.

Les deux systèmes producteurs **n'ont aucun ordre relatif déclaré** entre eux (tous deux seulement `before: "gizmos:flush"`), donc le scheduler les sème par ordre d'insertion. Le pivot laisse `borderWidth = 0` derrière lui ; sans repose explicite, le collider de la frame suivante hériterait de `0` et **tous les contours se dessineraient en aplat plein**, masquant les sprites qu'on cherche à observer. Chaque système doit donc reposer l'état complet du pinceau, et **les deux sens sont testés** — un test par système, chacun vérifié par mutation.

Le cas **solide-après-sensor** couvre un piège structurel de l'immediate-mode à état : `Gizmos.color` et `Gizmos.borderWidth` sont un pinceau **mutable partagé** (§ 3.3), que rien ne réinitialise entre deux entités, deux systèmes ou deux frames. Un système qui ne pose pas l'état complet du pinceau avant *chaque* dessin héritera de la valeur précédente — et le gizmo mentirait sur la couleur. Les assertions se font par **contenu** et non par index : l'ordre d'itération des entités n'est pas un contrat.

### 8.3 `PivotGizmoSystem`

Cercle à la position `WorldTransform2D`, `borderWidth = 0` (donc rempli), rayon depuis le composant, couleur depuis le composant ou le settings.

### 8.4 `ShapeRenderer` (dans `packages/nebula/test/`)

`params.y` porte le `borderWidth` ; défaut `0` sur un nœud existant (non-régression).

### 8.5 `GizmoPlugin`

Fournit `GIZMOS` ; `defineComponent` les deux composants ; enregistre les steps dans le bon ordre relatif ; `uninstall()` retire les steps **et** les nœuds du pool de la scène.

### 8.6 Vérification navigateur (le WGSL n'est pas testable en node)

1. **`apps/webgpu`** — un rect stroké et un anneau ; **et** la non-régression du fill existant (cf. § 6.4).
2. **`apps/dino-brawl`** — `showColliders` allumé, contrôle de la hitbox d'épée et des colliders de tilemap.

Redémarrer le serveur de dev plutôt que de faire confiance au HMR, qui sert des scènes périmées sur ce projet.

---

## 9. Non-objectifs / suites V2

- **Gizmos d'éditeur** : poignées de sélection/déplacement/échelle, contour de l'entité sélectionnée, preview de collider en cours d'édition. Le seam est posé (`before: "gizmos:flush"`), rien n'est implémenté.
- **`Gizmos.drawLine` + pool de `LineNode`** : débloque d'un coup les gizmos de raycast / vecteurs (direction, vitesse, normales de contact) et les lignes de hiérarchie. Écarté en v1 faute de consommateur (§ 5.2).
- **Texte à l'écran** (labels d'entité, valeurs) : dépend du rendu de texte (item backlog A2).
- **Épaisseur de contour constante à l'écran** : aujourd'hui `borderWidth` est en unités monde, donc le contour s'épaissit visuellement au zoom. Une épaisseur constante en pixels demanderait le facteur de zoom caméra dans le shader.
- **`capsule` / `segment` / `polygon` exacts** : capsule via un 3ᵉ `shapeKind` SDF, segment/polygon via une boucle de `LineNode`.
- **Passe/batch gizmo dédiée** dans nebula (§ 3.2, approche C) : overlay dessiné après la scène, hors scene-graph. Sans effet sur l'API appelante.
- **Contour du sprite / sort point** : rect du sprite rendu, marqueur du `sortPointEntity`.
- **Surcharge `Collider.getTranslation(out?: Vec2)`** dans `inertia` pour supprimer les allocations par frame (§ 5.6).
- **Accès depuis les scripts de gameplay** : écarté par décision, pas par oubli (§ 1).

---

## 10. Alternatives écartées

| Décision | Retenu | Écarté, et pourquoi |
|---|---|---|
| Déclenchement | Composants **+** switch global | Composants seuls (debug fastidieux sur 40 colliders de tilemap) ; global seul (impossible de cibler, pas de gizmo pivot par entité) |
| Rendu du collider | **Stroke** dans le shader shape | Aplat semi-transparent (teinte le sprite, illisible quand ça se chevauche) ; contour en 4 `LineNode` (4 nœuds par collider, ne gère ni cercle ni capsule) |
| Placement | **Nouveau package** `@atlasjs/gizmos` | Dans `gameplay` (part dans le bundle de tous les jeux, gameplay grossit encore) ; dans `@atlasjs/debug` (serveur WS Node, il faudrait le scinder en sous-exports node/browser) |
| Switch global | **Service token + options d'install** | Options d'install seules (pas de toggle à chaud, aucune prise pour l'éditeur) ; singleton module-level mutable (casse le multi-monde, sort du modèle de services) |
| Modèle de rendu | **Immediate-mode + pool** | Nœud retenu par entité (plus de code, churn au toggle, aucune prise pour l'éditeur) ; passe nebula dédiée (touche `SceneRenderer` pour un bénéfice surtout esthétique) |
| Formes non couvertes | **Rien + warn unique** | AABB approximative (viole « le gizmo ne ment pas ») ; couverture exacte des 5 formes (double le périmètre WGSL et ajoute un 2ᵉ chemin de rendu pour des formes inutilisées) |
| Taille monde dans le shader | **Dérivée de la matrice model** | Passée via `params.z/w` (brûle les slots réservés aux coins arrondis / feather) |
