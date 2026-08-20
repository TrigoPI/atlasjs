# Sort Point Anchor — tri Y-sort solidaire d'une entité porteuse

> **Statut : ✅ implémenté.** Extension ciblée de [`sorting-layers.md`](sorting-layers.md) (mode `ySorted`). Touche `@atlasjs/gameplay` uniquement (`SpriteRender.sortPointEntity` + résolution dans `SpriteRenderSystem`, avec fallback silencieux via `world.exists`) ; `@atlasjs/nebula` reste inchangé. Voir §7 pour les extensions restées hors périmètre.

## 1. Problème

Sur un layer en mode `ySorted`, l'ordre de rendu est décidé par le **Y monde** du sprite (`sortPrimary = worldY`), le `sortingOrder` ne servant que de **tiebreak à Y égal** (`sortSecondary`). Cf. `sorting-layers.md` §5.3.

Conséquence pour un **accessoire équipable** (épée, chapeau, aura) qui flotte à un offset vertical de son porteur : son Y monde diffère de celui du porteur, donc il se trie sur sa propre position et **ignore de fait le `sortingOrder`**. Un accessoire dessiné 20px au-dessus de la tête (Y plus petit en convention Y-down) passe **derrière** le porteur — l'inverse de l'intention.

Cas concret (`apps/dino-brawl`) : `SwordScript` place l'épée à `ownerWorldPosition + (0, -20)`. Malgré `SortingOrder.Sword (20) > SortingOrder.Player (10)`, l'épée est rendue derrière le joueur.

## 2. Objectif

Permettre à un accessoire de se **trier au point de tri de son porteur** (modèle Unity « le personnage et son équipement forment une seule unité de profondeur ») :

- Contre le décor Y-sorté (arbres, buissons), porteur + accessoire s'intercalent **ensemble** par le Y des pieds du porteur.
- Entre eux, le `sortingOrder` (déjà le tiebreak) empile l'accessoire **au-dessus** du porteur.
- La **position visuelle** de l'accessoire reste libre (offset de flottement) ; seule sa **profondeur** devient solidaire.

Non-objectif : changer la sémantique `ySorted` elle-même. On ne fait que choisir *quel Y* alimente `sortPrimary`.

## 3. Approche retenue

Un champ **opt-in** sur `SpriteRender` désignant une **entité-ancre** dont le `WorldTransform2D.y` remplace la position propre comme point de tri. Résolution côté `SpriteRenderSystem`, au moment où il alimente déjà `applySortFields`.

Approches écartées :

- **`sortY` explicite poussé par un script** — moteur plus découplé, mais impose un script qui maintient le champ chaque frame pour chaque accessoire ; pas « plug & play ».
- **`sortingOrder` comme biais du Y** (`sortPrimary = worldY + order·k`) — casse le tri de profondeur : un accessoire à fort ordre sauterait devant des éléments derrière lesquels il devrait passer. Ne produit pas le comportement « solidaire ».
- **Réutiliser la hiérarchie `Parent`/`Children`** — plus consistant architecturalement, mais refactor plus large (l'épée n'est pas parentée aujourd'hui, elle copie la position) et l'héritage du sort point serait implicite pour *tout* enfant, moins flexible qu'un opt-in explicite.

## 4. Conception

### 4.1 Composant — `SpriteRender`

`packages/gameplay/src/components/SpriteRender.ts` reçoit un champ :

```ts
public sortPointEntity: Entity | null = null;
```

- Défaut `null` → comportement inchangé (tri sur la position propre). Aucun sprite existant impacté.
- `Entity` importé depuis `@atlasjs/nexus` (déjà une dépendance du package).
- Ajouté hors constructeur (assigné après `add`, comme `sortingLayer`/`sortingOrder` le sont déjà dans les prefabs) pour ne pas alourdir la signature.

### 4.2 Résolution — `SpriteRenderSystem.update`

Avant l'appel à `applySortFields`, le système résout le Y de tri :

```ts
let sortY: number = position.y;

if (
  spriteRender.sortPointEntity !== null &&
  world.exists(spriteRender.sortPointEntity)
) {
  const anchor: WorldTransform2D | undefined = world.getComponent(
    spriteRender.sortPointEntity,
    WorldTransform2D,
  );

  if (anchor !== undefined) {
    sortY = anchor.getPosition(this.sortScratch).y;
  }
}

applySortFields(
  node,
  this.sortingLayers,
  spriteRender.sortingLayer,
  spriteRender.sortingOrder,
  sortY,
);
```

- **Fallback silencieux** : ancre absente (jamais eu de `WorldTransform2D`) ou détruite → on retombe sur `position.y`. Cohérent avec la philosophie *warn-never-throw* du gameplay : pas de crash sur une référence pendante. Le garde `world.exists(...)` est **nécessaire** : `world.getComponent` sur une entité détruite lève (`assertEntityExists`) — il ne renvoie `undefined` que pour une entité vivante sans le composant. `world.exists` est un check non-levant et *generation-safe* (une poignée périmée dont l'index a été recyclé résout bien « n'existe pas »).
- `this.sortScratch` : un `Vec2` réutilisable ajouté au système (comme `positionScratch`/`scaleScratch`), zéro allocation par frame.
- Sur un layer `manual`, `applySortFields` ignore déjà le Y (`sortPrimary = sortingOrder`) → le champ n'a aucun effet là-bas, aucun cas spécial à écrire.

### 4.3 Flux de données

```
SwordPrefab           renderer.sortPointEntity = props.owner   (une fois)
   │
SwordScript.onUpdate  transform.position = ownerWorldPos + (0,-20)   (position VISUELLE)
   │
SpriteRenderSystem    sortY = WorldTransform2D(owner).y             (PROFONDEUR)
   │                  applySortFields(..., sortY)
   ▼
ySorted:  sortPrimary = ownerY (== joueur)   →   tiebreak sortSecondary = order
          ⇒ épée (20) au-dessus du joueur (10), l'ensemble solidaire vs décor
```

### 4.4 Usage — `apps/dino-brawl`

`SwordPrefab.ts`, une ligne :

```ts
const renderer: SpriteRender = entity.add(SpriteRender, props.sprite);
renderer.sortingLayer = SortingLayer.Entities;
renderer.sortingOrder = SortingOrder.Sword;
renderer.sortPointEntity = props.owner;
```

`SwordScript` est inchangé : il continue de piloter la position visuelle (`owner + (0,-20)`).

### 4.5 Exposition scripting

`SpriteRenderer` (scripting/components) est un **token identité** sur `SpriteRender` : un script détenant un `Entity` brut peut faire `this.spriteRenderer.sortPointEntity = rawEntity`. Aucune nouvelle API `GameEntity` n'est introduite (YAGNI) — le chemin prefab dispose déjà du `Entity` brut du porteur.

## 5. Tests

`packages/gameplay/test/sprite-render-system.test.ts` (layer `ySorted`) :

1. **Résolution de l'ancre** — ancre à `y = 100`, sprite propre à `y = 80`, `sortPointEntity = ancre` ⇒ `node.sortPrimary === 100`.
2. **Tiebreak d'empilement** — ancre et accessoire au même Y résolu, `order` accessoire > `order` ancre ⇒ `sortSecondary` accessoire strictement plus grand (dessiné après = devant).
3. **Fallback** — `sortPointEntity` pointant une entité inexistante/détruite ⇒ `sortPrimary === positionPropre.y`.

## 6. Portée & invariants

- **Un seul champ, opt-in, rétrocompatible.** `null` par défaut = comportement actuel exact.
- **Sémantique `ySorted` intacte.** `applySortFields` n'est pas modifié ; on ne change que le Y qu'on lui passe.
- **Frontière packages préservée.** `@atlasjs/nebula` continue de trier des nombres sans rien connaître de l'ancrage. La sémantique reste côté `@atlasjs/gameplay`.
- **Zéro allocation par frame** (scratch `Vec2` réutilisé).

## 7. Extensions futures (→ backlog)

- **Offset de tri** (`sortPointEntity` + petit biais) pour empiler plusieurs accessoires entre eux sans dépendre uniquement de `sortingOrder`.
- **Ancrage via la hiérarchie** : dériver le sort point du parent quand l'accessoire est déjà un enfant `Parent`/`Children`, pour éviter un second lien.
- **Exposition `GameEntity`** d'un accessor `Entity` brut si un besoin scripting cross-entité émerge.
