# Hiérarchie d'entités — parent/enfant + composition de transform (`@atlasjs/nexus` + `@atlasjs/gameplay`)

> **Statut : implémenté.** Attacher des sous-entités à une entité parent façon Unity : au niveau scène (`EcsScene`) d'abord, depuis les scripts ensuite, et de façon exploitable par un futur éditeur. La **structure** (parent/enfant) est une primitive générique de Nexus ; la **composition de transform** est une couche gameplay par-dessus.
>
> Prérequis de lecture :
> - `docs/core/nexus-ecs.md` — l'ECS (entités générationnelles, stores, `query`, command buffer, `onAdd`/`onRemove`).
> - `docs/gameplay/gameplay-redesign.md` — la source de vérité unique dans Nexus et l'autorité physique par type de body.
> - `docs/gameplay/scripting-components.md` — les deux niveaux de composants + le modèle de façade `ScriptComponent`.
> - `docs/core/scheduling.md` — lanes/stages, boucle fixed→update→render.
> - `docs/rendering/sprites.md` — le `SpriteRenderSystem` qui monte un `SpriteNode` par entité.

---

## 1. Contexte & objectif

Pour « commencer à s'amuser » avec le moteur, il faut pouvoir **attacher des sous-entités à un parent** : une barre de vie au-dessus d'un joueur, une arme dans une main, des roues sur un véhicule, un groupe de décor. L'enfant hérite de la position/rotation/échelle du parent.

`@atlasjs/nebula` sait déjà composer une hiérarchie local→monde via `Node`/`SceneGraph` (dirty-flag, `updateWorldMatrix`). Mais :

- L'ECS n'a **aucune notion de relation** entre entités.
- Le `SpriteRenderSystem` monte chaque `SpriteNode` **à plat** sous `nebula.scene.root` et y écrit directement `Transform2D` (traité comme du monde). La hiérarchie nebula n'est donc pas utilisée pour lier des entités.

**Objectif :** une hiérarchie d'entités native dans l'ECS, utilisable au niveau scène et scripts, et directement exploitable par un éditeur (afficher l'arbre, reparenter) — **sans** mettre la structure gameplay dans la couche rendu.

### Ce qu'on ne fait pas transiter par le SceneGraph nebula

Le SceneGraph nebula **garde son rôle**, distinct de la hiérarchie d'entités : rendu de nebula en standalone, sous-arbres purement visuels d'une seule entité, préoccupations couche-rendu (culling par world-bound, tri z-index, render passes). La **structure des entités**, elle, ne passe pas par lui — sinon l'éditeur et la physique dépendraient du renderer.

---

## 2. Principe directeur : deux hiérarchies, deux responsabilités, un sens de flux

```
Hiérarchie d'ENTITÉS (vérité gameplay)         Hiérarchie de NODES (vérité rendu)
  Parent/Children dans @atlasjs/nexus     →      SceneGraph @atlasjs/nebula
  WorldTransform2D calculé par propagation ── bridge ──▶  nodes plats (1 entité → 1 node)
```

- **Nexus** possède la *structure* (parent/enfant), transform-agnostique.
- **Gameplay** possède la *composition de transform* (local → monde).
- Le **bridge** (`SpriteRenderSystem`) fait couler le transform monde vers des nodes rendu qui restent plats.

C'est le split de Bevy (`bevy_ecs` hierarchy vs `bevy_transform` propagation), et il respecte les invariants AtlasJS : source de vérité unique dans Nexus, rendu = consommateur en aval, packages découplés, physique indépendante du renderer.

---

## 3. `@atlasjs/nexus` — primitive de relation générique

La relation est **de la donnée**, stockée en composants (donc requêtable et sérialisable), maintenue par une petite API sur `NexusWorld`. **Zéro notion de transform ou de 2D** — c'est un arbre d'entités pur.

### 3.1 Composants built-in

```ts
class Parent {
  public value: Entity;
}

class Children {
  public value: Entity[];
}
```

- `Parent` est porté par l'**enfant** (référence vers son parent).
- `Children` est porté par le **parent** (liste de ses enfants directs). **Maintenu par l'API**, traité en lecture seule à l'extérieur.
- Les deux sont enregistrés par Nexus (lazy, au premier `setParent`).

### 3.2 API sur `NexusWorld` (méthodes directes)

```ts
world.setParent(child: Entity, parent: Entity | null): void
world.getParent(child: Entity): Entity | undefined
world.getChildren(entity: Entity): ReadonlyArray<Entity>
```

- `setParent(child, parent)` : pose/déplace le lien. Met à jour **atomiquement** le `Parent` de l'enfant et les tableaux `Children` des deux côtés (retrait de l'ancien parent, ajout au nouveau).
- `setParent(child, null)` : détache (retire `Parent`, retire l'enfant de l'ancien `Children`). L'entité redevient une racine.
- `getChildren` renvoie `[]` si aucun enfant.
- `getChildren` renvoie le **tableau `Children.value` vivant** (pas une copie défensive), typé `ReadonlyArray` : ne pas le muter (caster pour contourner le `readonly` corromprait la hiérarchie), ni le retenir à travers un `setParent`/`destroyEntity` (il change sous la main).
- **Racines pour l'éditeur** : entités sans `Parent`, obtenues via `world.query(SomeBase).without(Parent)` (voir §7 pour la convention « les nœuds de groupe portent un `Transform2D` »).

### 3.3 Invariants

- **Garde anti-cycle** : `setParent` throw si `parent` est un descendant de `child` (même logique que `Node.isDescendantOf` dans nebula). Reparenter sur soi-même throw aussi.
- **Idempotence** : `setParent(child, sameParent)` est un no-op.
- **Destruction récursive (défaut)** : `destroyEntity(e)` détruit récursivement tous les descendants de `e`. Détruire un enfant le retire du `Children` de son parent. *(L'option « orphelin / reparent-à-la-racine » → backlog.)*
- **Sécurité pendant l'itération** : reparent/detach au milieu d'un `query().each()` est une **modification structurelle** et doit passer par le command buffer : `world.commands.setParent(child, parent)` (appliqué au `flush`/`Sync`). En dehors d'une itération, `world.setParent` est immédiat. C'est la même dualité que `addComponent` / `world.commands`.

---

## 4. `@atlasjs/math` — complétion de `Mat3`

`Mat3` sait aujourd'hui `fromTransform2D`, `copy`, `identity`, `clone`, `transformPoint2` — mais **pas `multiply`**. On ne peut donc pas composer deux transforms 2D avec. Cette feature complète `Mat3` en une **matrice affine 2D de plein droit** (utile bien au-delà de la hiérarchie : physique, rendu, gizmos éditeur), et évite de traîner le `Mat4` (16 floats) que `Node` utilise là où `Mat3` (9 floats) suffit.

Ajouts :

```ts
public multiply(b: Mat3): Mat3           // this = this * b
public static multiply(a: Mat3, b: Mat3): Mat3
public invert(): Mat3                     // pour le reparent « garde la position monde »
public getTranslation(out?: Vec2): Vec2   // décompose : translation
public getRotation(): number              // décompose : angle
public getScale(out?: Vec2): Vec2         // décompose : échelle
```

La composition matricielle est **exacte** — elle gère le shear (échelle non-uniforme + rotation imbriquées), là où une composition TRS naïve serait approchée.

---

## 5. `@atlasjs/gameplay` — composition de transform

### 5.1 `Transform2D` devient local ; `WorldTransform2D` porte le monde

- **`Transform2D`** (existant, LEVEL 1) est désormais le transform **local**, relatif au parent. À la racine, local == monde. **Rétrocompatible** : aujourd'hui toutes les entités sont des racines, donc rien ne change tant qu'on ne parente pas.
- **`WorldTransform2D`** (nouveau, LEVEL 1) porte la **matrice monde** et est **dérivé** (géré automatiquement, lecture seule pour le code de jeu) :

```ts
class WorldTransform2D {
  public readonly matrix: Mat3;

  public getPosition(out?: Vec2): Vec2;
  public getRotation(): number;
  public getScale(out?: Vec2): Vec2;
}
```

Il est présent pour toute entité ayant un `Transform2D` : la propagation le crée s'il manque et le retire quand `Transform2D` est retiré.

### 5.2 `TransformPropagationSystem`

Un `NexusSystem` qui parcourt la forêt **racines → feuilles** (via `getChildren`) et écrit `WorldTransform2D.matrix`. Une règle unique :

```
racine (pas de Parent)  →  world = Mat3.fromTransform2D(local)
enfant                  →  world = parentWorld.clone().multiply(Mat3.fromTransform2D(local))
body dynamic            →  world = Mat3.fromTransform2D(local)   // physique = autorité
```

- **Body dynamic = autorité physique** : la composition parent est **ignorée** (son `Transform2D`, écrit par la physique, *est* son monde). Mais ses enfants composent quand même sur **son** monde.
- **Nœud sans `Transform2D` (pass-through)** : un *intermédiaire* sans transform ne modifie pas ses enfants — on redescend en propageant le monde de l'ancêtre transform le plus proche. En revanche l'arbre doit être **enraciné** sur une entité qui a un `Transform2D` : la propagation démarre depuis `query(Transform2D).without(Parent)` (voir §7).
- **Ordre correct garanti** par le parcours descendant : un parent est toujours calculé avant ses enfants.
- **Perf V1** : recalcul complet chaque frame (l'échelle actuelle le permet). Le dirty-tracking par sous-arbre (comme `Node`) → backlog.

### 5.3 Consommateurs modifiés

- **`SpriteRenderSystem`** : lit `WorldTransform2D` (au lieu de `Transform2D`) pour alimenter le `SpriteNode` plat. Voir §5.5 pour le bord rendu.
- **`PhysicsPushSystem`** (branche kinematic/static) : place le body depuis `WorldTransform2D` (monde composé) au lieu de `Transform2D`.
- **`PhysicsPullSystem`** : **restreint aux bodies `dynamic`**. Aujourd'hui il écrit le monde du body dans `Transform2D` pour *tous* les bodies ; pour un enfant kinematic/static, ça écraserait le **local** avec du **monde** (corruption). Restreindre au dynamic est de toute façon cohérent avec le modèle d'autorité (kinematic/static sont pilotés par le transform).

### 5.4 Ordonnancement — une seule passe, latence physique d'1 frame

Rappel du scheduling existant (`GameplayPlugin`) :

```
fixed:  physics-push (PhysicsRequest) → [inertia] → physics-pull / physics-collision (PhysicsWriteback)
update: player-input (Early) → script-update (Logic) → animator (Logic) → audio (Logic)
render: camera-sync → sprite-render → tilemap-render → occluder-render → trail-render → afterimage-render (PreRender)
```

`TransformPropagationSystem` s'insère dans la lane **`update`, après la logique** — stage `Late`, sous le nom `gameplay:transform-propagation` (donc après `gameplay:animator`, avant le `Sync` de fin). Ainsi :

- **Rendu (même frame)** : `sprite-render` (render/PreRender) lit un `WorldTransform2D` frais → **exact**.
- **Physique (frame suivante)** : `physics-push` (fixed/PhysicsRequest) lit le `WorldTransform2D` calculé à la frame précédente → **1 frame de retard**, exactement la latence que la physique tolère déjà (les scripts déplacent un kinematic en update, la physique le récupère au fixed suivant).

Le cas « fun » (enfants **sans body** : barres de vie, armes, déco) est **100% exact** puisqu'il ne passe que par le rendu. Une passe physique de hiérarchie **sans latence** (propagation dédiée dans la lane fixed) → **backlog**.

> Note : `WorldTransform2D` doit exister avant la première lecture physique. La propagation le crée ; `physics-push` retombe sur `Transform2D` s'il est absent (première frame).

### 5.5 Bord rendu : décompose `Mat3` → TRS (caveat shear)

Le `SpriteNode` plat consomme du TRS (`setPosition`/`setRotation`/`setScale`), pas une matrice. Le bridge décompose donc `WorldTransform2D.matrix` → translation/rotation/échelle via les accessors `Mat3`. C'est **exact partout sauf** rendre un quad *shearé* (parent à échelle non-uniforme + rotation imbriquée) — comportement identique au `lossyScale` d'Unity. La physique est rigide (pas de shear) donc toujours exacte.

Rendre le shear exactement demanderait un seam « matrice monde » sur le `Node` nebula (ex. `Node.setLocalMatrix`) → **backlog**.

---

## 6. API scripts — façade `Transform`

À la Unity `transform.SetParent(...)`, sur la façade stateless existante (elle re-résout à chaque accès, cf. invariants scripting) :

```ts
this.transform.setParent(parent: Transform | null, worldPositionStays?: boolean): Transform
this.transform.parent: Transform | null      // getter (readonly)
this.transform.getChildren(): Transform[]
```

- `setParent` route vers `world.setParent(entity, parentEntity)` et applique le changement **immédiatement** : c'est sûr car les callbacks de cycle de vie d'un script (`onUpdate`/`onFixedUpdate`) ne s'exécutent jamais à l'intérieur d'un `world.query(...).each(...)`. Si un appelant reparente depuis **sa propre** itération `query().each()`, il doit différer via `world.commands.setParent(...)` (même dualité que §3.3).
- `worldPositionStays` (défaut **`true`**, comme Unity) : après reparent, on recalcule le `Transform2D` **local** pour que le monde ne bouge pas : `localMatrix = parentWorld.invert() * currentWorld`, puis on ré-injecte translation/rotation/échelle (d'où `Mat3.invert`). Avec `false`, le local est conservé tel quel et réinterprété dans le repère du parent (l'enfant « snap »).
- `parent` / `getChildren` résolvent les composants `Parent`/`Children` de Nexus et renvoient des façades `Transform` fraîches. `getChildren` ne renvoie que les enfants **portant un `Transform2D`** (les intermédiaires pass-through, §5.2, sont donc absents de la liste).
- **Références inter-entités** : un script parente vers un transform qu'il tient déjà (passé en prop de script, ou renvoyé par un service). La *découverte* d'entités arbitraires (« trouve le player ») reste hors scope — c'est la scène qui câble.

---

## 7. API scène (la scène de l'app — `ArenaScene` aujourd'hui —, `world` brut) + éditeur

Au niveau scène, tout tombe naturellement parce que `Parent`/`Children` est natif Nexus :

```ts
const player: Entity = nexus.createEntity();
const healthBar: Entity = nexus.createEntity();

nexus.addComponent(healthBar, Transform2D);
nexus.setParent(healthBar, player);
```

La composition de transform s'active dès que les deux entités ont un `Transform2D`.

**Éditeur (futur — on conçoit pour, on ne construit pas d'UI ici)** — tout est déjà là :

- **Afficher l'arbre** : racines = `query(...).without(Parent)` ; expansion = `getChildren(entity)`.
- **Reparenter (drag-drop)** : `world.setParent(child, newParent)` (structurel). La version « garde la position monde » réutilise le helper gameplay de §6.
- **Rafraîchir en direct** : `world.onAdd(Parent)` / `world.onRemove(Parent)` existent déjà. *(Un signal `onReparent` dédié → backlog si nécessaire.)*
- **Convention** : la **racine** d'un arbre transform porte un `Transform2D` (identité par défaut pour un nœud de groupe). C'est ce qui rend l'énumération simple et fiable (`query(Transform2D).without(Parent)`). Des intermédiaires plus bas peuvent être sans transform (pass-through, §5.2) ; seule la racine doit en avoir un.

---

## 8. Sémantiques par défaut

| Sujet | Défaut V1 | Note |
|-------|-----------|------|
| Destruction d'un parent | **Récursive** (détruit les descendants) | Style Unity. Option orphelin → backlog. |
| Reparent (position) | **`worldPositionStays = true`** | Style Unity ; flag exposé côté script. |
| Cycle | **throw** | `setParent` refuse un ancêtre comme enfant. |
| Composition physique | **rendu exact ; physique à 1 frame de retard** | Enfants sans body : exact. Dynamic : non composé (autorité physique). |

---

## 9. Périmètre V1 & hors-scope

**Dans la V1 :**

1. `@atlasjs/nexus` : `Parent`/`Children`, `setParent`/`getParent`/`getChildren`, garde anti-cycle, destruction récursive, intégration command buffer.
2. `@atlasjs/math` : `Mat3.multiply`/`invert` + décompose.
3. `@atlasjs/gameplay` : `WorldTransform2D`, `TransformPropagationSystem`, mise à jour `SpriteRenderSystem`/`PhysicsPushSystem`/`PhysicsPullSystem`, façade `Transform` (`setParent`/`parent`/`getChildren`).
4. `apps/dino-brawl` : démo d'attachement natif dans `EcsScene` + depuis un script.

**Hors-scope (→ `docs/backlog/`) :**

- Passe physique de hiérarchie **sans latence** (propagation dans la lane fixed).
- Rendu **exact du shear** (seam matrice monde sur `Node` nebula).
- **Dirty-tracking** par sous-arbre pour la propagation.
- Composition de transform pour les bodies **dynamic** (recalcul local = monde−parent).
- Destruction **orpheline** (reparent-à-la-racine) en option.
- Signal éditeur **`onReparent`** dédié.
- Système de **relations générique** typé façon flecs (au-delà du seul parent/enfant).

---

## 10. Checklist d'implémentation (phases)

- [x] **Phase 1 — Nexus.** `Parent`/`Children`, `setParent`/`getParent`/`getChildren`, garde anti-cycle, destruction récursive, `world.commands.setParent`. Tests : lien/reparent/detach, cycle rejeté, cascade de destruction, reparent différé pendant itération.
- [x] **Phase 2 — Math.** `Mat3.multiply` (+ statique), `invert`, `getTranslation`/`getRotation`/`getScale`. Tests : identités, compo associative, invert∘compo, round-trip décompose sans shear.
- [x] **Phase 3 — Propagation gameplay.** `WorldTransform2D` + `TransformPropagationSystem` (règle unique + dynamic + pass-through), enregistrement dans la lane `update`. Tests : racine, chaîne parent→enfant, dynamic ignore le parent, ordre parent-avant-enfant.
- [x] **Phase 4 — Consommateurs.** `SpriteRenderSystem` lit `WorldTransform2D` (+ décompose bord rendu), `PhysicsPushSystem` (kinematic/static) lit `WorldTransform2D`, `PhysicsPullSystem` restreint au dynamic. Tests : sprite enfant suit le parent, kinematic enfant suit (1 frame), dynamic non corrompu.
- [x] **Phase 5 — Façade scripts.** `Transform.setParent`/`parent`/`getChildren` + `worldPositionStays`. Tests : reparent garde/ne garde pas la position monde, façade reste stateless.
- [x] **Phase 6 — Dino Brawl + docs.** Démo `EcsScene` (attachement natif) + script d'attachement ; mettre à jour `docs/backlog/` (items reportés) et marquer ce doc « implémenté ».
