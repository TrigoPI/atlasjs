# Prefab multi-entités — enfants inline + références internes (design)

> **Statut : ✅ implémenté.**
> Domaine : `@atlasjs/gameplay` (primitive moteur) + `apps/dino-brawl` (cas d'usage).
> Débloque le point marqué **V2** dans [`prefab.md`](prefab.md) §10 : un prefab qui crée déjà
> ses **enfants** et câble des **références internes** entre eux (l'ombre référence l'épée sœur,
> créée dans le même `build`).

---

## 1. Problème

Aujourd'hui un `Prefab` est **mono-racine** : `build(entity, params)` ne peut agir que sur l'entité
racine (`add`/`attach`). Pour assembler une unité composée de plusieurs entités (une épée flottante
**+** son ombre), il faut aujourd'hui orchestrer plusieurs `instantiate` **depuis la composition root**
et câbler les références à la main en se passant des `Entity` (`.id`) — c'est ce que fait
`apps/dino-brawl/src/game/spawn/spawnPlayer.ts` :

```ts
const anchor = instantiator.instantiate(swordAnchorPrefab, { … }, { parent: player.id });
const sword  = instantiator.instantiate(swordPrefab,       { owner: player.id, anchor: anchor.id, … });
instantiator.instantiate(swordShadowPrefab, { sword: sword.id, anchor: anchor.id, … }); // câblage manuel
```

Conséquences : la choré + le câblage épée↔ombre vivent dans la composition root (pas réutilisables),
et « changer le sprite d'épée en gardant l'ombre » n'est pas une seule valeur réutilisable.

**But** : une **seule** unité réutilisable `SwordWithShadow` = une racine → enfants `épée` + `ombre`,
l'ombre référençant l'épée **en interne**. On en instancie **N** pour former un anneau d'épées en
orbite autour d'une ancre.

## 2. Décisions structurantes

| Axe | Décision | Justification |
| --- | --- | --- |
| **Création d'enfants** | Nouveau `EntityBuilder.child(buildFn)` — **callback de build inline** | L'enfant reçoit son propre `EntityBuilder` ; tout est visible dans le prefab parent ; capture des sœurs par closure. (La variante « composer des sous-prefabs » a été écartée pour ce cas.) |
| **Références internes** | **Capture directe** de l'`Entity` du handle retourné par `child()` | Les enfants sont créés **synchronement** pendant `build` → leur `Entity` existe immédiatement. Aucune machinerie de « remap » (celle-ci ne sert qu'à la **sérialisation** → reste V2). |
| **Racine du groupe** | La racine porte un **`Transform2D` identité** (modèle « empty GameObject ») | Requis par `TransformPropagationSystem` (§4). Une racine littéralement *sans* transform casserait la propagation des enfants. |
| **Placement des enfants** | Enfants positionnés en **coords monde absolues** via leurs scripts (inchangé) | La racine identité rend `world = identity ∘ local` → comportement actuel préservé. Contrainte : la racine reste **top-level**. |
| **Group-destroy** | Réutilise le `destroy` récursif existant (`Instantiator`/`GameEntity`) | Détruire la racine tue tout le sous-arbre + les scripts. Gratuit. |

## 3. Le primitive `EntityBuilder.child(buildFn)`

**Toute** la modif moteur tient dans `packages/gameplay/src/prefab/`.

### Signature (ajout à l'interface `EntityBuilder`)

```ts
interface EntityBuilder {
  readonly entity: Entity;
  add(…): …;
  attach(…): …;
  child(build: (entity: EntityBuilder) => void): EntityBuilder; // ← nouveau
}
```

- `child()` figure sur **l'interface** → un enfant peut avoir ses propres enfants (profondeur
  arbitraire, sans code supplémentaire).
- Il **retourne le `EntityBuilder` de l'enfant** → `.entity` est disponible tout de suite pour câbler
  une sœur, et on peut encore `.add`/`.attach`/`.child` dessus après le callback.

### Implémentation (`PrefabEntityBuilder`)

```ts
public child(build: (entity: EntityBuilder) => void): EntityBuilder {
  const childEntity: Entity = this.world.createEntity();
  const childBuilder: PrefabEntityBuilder = new PrefabEntityBuilder(childEntity, this.world, this.scripts);
  build(childBuilder);
  this.world.setParent(childEntity, this.entity); // immédiat, même API que l'Instantiator
  return childBuilder;
}
```

- Seul ajout d'état : `PrefabEntityBuilder` doit **conserver `world`** (aujourd'hui il ne garde que
  `entity`/`self`/`scripts` et jette le `world` reçu au ctor).
- `createEntity` + `setParent` sont **immédiats** (comme dans `Instantiator.instantiate`). Les scripts
  attachés aux enfants partent en `pendingCreate` → `onCreate` au prochain `flushCreates` (latence
  ~1 frame, sémantique `attach` inchangée).

### Câblage d'une référence interne (le point clé)

```ts
build(root, props) {
  const sword = root.child((e) => { /* … */ e.attach(SwordScript, { … }); });
  root.child((e) => {
    e.attach(SwordShadowScript, { sword: sword.entity, /* la sœur, résolue immédiatement */ … });
  });
}
```

## 4. ⚠️ La racine porte un `Transform2D` identité

`TransformPropagationSystem`
([`TransformPropagationSystem.ts:21`](../../packages/gameplay/src/systems/TransformPropagationSystem.ts))
démarre la propagation **uniquement** depuis `world.query(Transform2D).without(Parent)`, puis descend
récursivement dans les enfants.

- Une racine **sans** `Transform2D` n'est jamais un point d'entrée.
- L'épée / l'ombre ont un `Parent` (la racine) → elles sont exclues de la requête des racines.
- ⇒ Elles ne seraient **jamais atteintes** par la propagation → leur `WorldTransform2D` jamais calculé
  → rendu au mauvais endroit.

**Décision : la racine porte un `Transform2D` identité.** Elle devient un point d'entrée de propagation,
la descente atteint les enfants, et comme la racine est à l'identité `world = identity ∘ local`, la
position **absolue** écrite par les scripts des enfants est préservée (comportement actuel).

**Contrainte (à documenter) : la racine reste top-level** (pas de `parent` sur l'`instantiate` de la
racine). La parenter sous une entité qui a un transform ferait **double-transformer** les enfants (qui
écrivent des coords absolues) et leur ferait hériter du scale du parent — c'est précisément pourquoi
l'épée est « libre » aujourd'hui (le joueur a `scale (3,3)`).

> **Alternative écartée** : patcher `TransformPropagationSystem` pour descendre à travers des parents
> sans transform (nœuds de groupe « first-class »). Plus pur, mais touche un système cœur pour un gain
> nul sur ce cas → **backlog**.

## 5. Application `dino-brawl`

### `SwordWithShadowPrefab` (nouveau)

Remplace et **absorbe** `SwordPrefab` + `SwordShadowPrefab` (leur construction passe **inline** dans les
callbacks `child()`). `SwordAnchorPrefab` **reste** (l'ancre est enfant du joueur, créée à part).
`SwordScript` / `SwordShadowScript` **restent** (attachés inline). Les barrels `prefabs/index.ts` sont
mis à jour (retrait des deux prefabs absorbés, ajout du nouveau).

```ts
export type SwordWithShadowPrefabProps = {
  owner: Entity;         // sortPointEntity de l'épée (foot-sort sur le joueur)
  anchor: Entity;        // centre du cercle (enfant du joueur)
  r: number;             // rayon
  angle: number;         // angle initial sur le cercle
  angularSpeed: number;  // vitesse angulaire (rad/s) — l'orbite s'anime
  swordSprite: Sprite;
  shadowSprite: Sprite;
  shadowOffset?: Vec2;   // décalage de l'ombre par rapport à la base
  shadowScale?: Vec2;
};

export const createSwordWithShadowPrefab = () =>
  definePrefab<SwordWithShadowPrefabProps>({
    name: "sword_with_shadow",
    build: (root, props) => {
      root.add(Transform2D); // racine identité (§4)

      const orbit = { anchor: props.anchor, r: props.r, angle: props.angle, angularSpeed: props.angularSpeed };

      const sword = root.child((e) => {
        const renderer = e.add(SpriteRender, props.swordSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Sword;
        renderer.sortPointEntity = props.owner;
        renderer.sprite.pivot.set(0, 0);
        const t = e.add(Transform2D);
        t.scale.set(1.5, 1.5);
        e.attach(SwordScript, { ...orbit });
      });

      root.child((e) => {
        const renderer = e.add(SpriteRender, props.shadowSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Shadow;
        renderer.color = new Color(0, 0, 0, 0.3);
        e.add(Transform2D);
        e.attach(SwordShadowScript, {
          ...orbit,
          sword: sword.entity,
          shadowOffset: props.shadowOffset ?? new Vec2(-16, -70),
          scale: props.shadowScale ?? new Vec2(0.5, 0.5),
        });
      });
    },
  });
```

### Scripts

Les épées **orbitent** : l'angle varie dans le temps. La position de base d'une épée à l'instant `t`
est `anchor.worldPosition + polar(r, angle + angularSpeed·t)`. Les deux scripts reçoivent les mêmes
params d'orbite (`{ anchor, r, angle, angularSpeed }`) et calculent cette base via une **petite
fonction pure partagée** `orbitBase(anchorWorld, r, angle, angularSpeed, clock)` (DRY, pas de formule
polaire dupliquée). Ils sont attachés dans le **même** `instantiate` → même frame d'`onCreate`, donc
horloges alignées → bases identiques chaque frame (pas de dérive).

- **`SwordScript`** : `position = orbitBase(…) + floatingOffset(sin t)` (float vertical seul).
- **`SwordShadowScript`** : `position = orbitBase(…) + shadowOffset` (**sans** le float → l'ombre suit
  l'orbite mais ne monte/descend pas avec le flottement). Le `scale` reste dérivé de la hauteur de
  float de l'épée (lecture de `sword.worldPosition`, logique actuelle conservée).

### `spawnPlayer`

Les `instantiate` séparés `sword` / `swordShadow` deviennent une **boucle** de N `SwordWithShadow`
répartis sur le cercle ; l'ancre et l'ombre du dino restent.

```ts
const count: number = 6;
for (let i: number = 0; i < count; i++) {
  const angle: number = (i / count) * Math.PI * 2;
  instantiator.instantiate(swordWithShadowPrefab, {
    owner: player.id,
    anchor: anchor.id,
    r: 40,
    angle,
    angularSpeed: 1.5,
    swordSprite,
    shadowSprite,
  });
}
```

## 6. Géométrie (rappel du modèle)

- L'**ancre** (enfant du joueur, suit donc le joueur) est le **centre** d'un cercle de rayon `r`.
- Les épées **orbitent** : `angle(t) = angle + angularSpeed·t`.
- Position de **base** d'une épée à l'instant `t` = `anchor.worldPosition + polar(r, angle(t))` —
  suit le joueur (via l'ancre) **et** tourne autour de lui.
- L'épée flotte verticalement : `+ sin(2π·f·t) · amplitude`.
- L'**ombre** est à `anchor.worldPosition + polar(r, angle(t)) + shadowOffset` — elle suit l'orbite
  mais **ne flotte pas** (calculée sur la base, pas sur la position flottée de l'épée) ; seule son
  échelle réagit à la hauteur de float de l'épée.

## 7. Tests

- **Moteur (vitest, `@atlasjs/gameplay`)** : `child()` — l'enfant existe et est **parenté** à la racine ;
  une **référence interne** (`sword.entity` passée au script de l'ombre) est bien résolue ; **profondeur**
  (enfant d'enfant) ; **destroy récursif** (détruire la racine retire enfants **et** scripts).
- **App** : browser-verify — l'anneau d'épées flotte, suit le joueur, les ombres restent fixes sous
  chaque épée, le foot-sort de l'épée par rapport au joueur est correct.

## 8. Invariants — à ne pas casser

- **`child()` réutilise le chemin existant** : `world.createEntity` + `PrefabEntityBuilder` +
  `world.setParent`. Pas de chemin de création parallèle.
- **Création synchrone, scripts différés** : `createEntity`/`add`/`setParent` immédiats ; `onCreate`
  des scripts enfants au prochain `flushCreates`. Ne jamais supposer `onCreate` synchrone.
- **La racine d'un groupe est un nœud top-level à transform identité.** Ne pas la parenter sous une
  entité à transform (double-transform + héritage de scale).
- **Pas de remap runtime.** Les références internes se câblent par capture directe de `.entity`. Le
  remap n'existe que pour un futur modèle **sérialisé** (V2).
- **`SwordScript`/`SwordShadowScript` restent des scripts** (comportement), pas des composants moteur.

## 9. Hors périmètre (V2)

- **`child(subPrefab, params)`** (composer des sous-prefabs réutilisables) — extension possible du
  primitive ; non retenue pour ce cas (choix « inline »).
- **Remap de références internes sérialisées** (prefab JSON / `PrefabAsset`) — le vrai « gros morceau »
  de la sérialisation ; reste V2 (comme le reste de l'éditeur).
- **Propagation à travers des nœuds de groupe sans transform** — patch de `TransformPropagationSystem` ;
  backlog.

## 10. Docs à mettre à jour

- [`prefab.md`](prefab.md) §10 : marquer « prefabs multi-entités avec enfants inline » **implémenté**
  (via `child()`), en gardant le **remap sérialisé** en V2.
- [`../backlog/`](../backlog/) : `child(subPrefab)` → voir [`GAMEPLAY-40`](../backlog/GAMEPLAY-40-prefab-child-subprefab.md) ;
  propagation sans-transform, orbite animée.
