# Caméra gameplay — `Camera` + `CameraManager` + `CameraSyncSystem` + `CameraApi` (`@atlasjs/gameplay`)

> **Statut : design validé, à implémenter.** Introduit une caméra **gameplay** (entité Nexus) qui pilote la caméra de rendu de `@atlasjs/nebula`, plus `screenToWorld`/`worldToScreen`. La caméra gameplay est **un producteur de plus** qui écrit dans `renderer.camera`, exactement comme `SpriteRenderSystem` pousse les sprites ou `PhysicsPushSystem` pousse les transforms. Le modèle mono-caméra de nebula (une seule passe de rendu) est **inchangé**.
> Prérequis de lecture : `docs/gameplay/gameplay-redesign.md` (bridge par système, source de vérité unique), `docs/gameplay/scripting-components.md` (les deux niveaux de composants + façades de service), `docs/gameplay/input-scripting.md` (le pattern `ScriptService`/`InputApi` que `CameraApi` reprend), `docs/core/scheduling.md` (lanes/stages), `docs/rendering/renderer-architecture.md` (interface `Camera`, `Renderer.camera`).

> **État d'implémentation** (plan : `docs/gameplay/camera-plan.md`) :
> - [x] §4 `Camera2D.screenToWorld`/`worldToScreen` (nebula)
> - [x] §4bis `NebulaRenderer.getCameraViewport()` passthrough (nebula)
> - [x] §5 composant `Camera` (LEVEL 1)
> - [x] §6 `CameraManager` + token `CAMERA_MANAGER`
> - [ ] §7 `CameraSyncSystem`
> - [ ] §8 `CameraApi`
> - [ ] §10 câblage `GameplayPlugin`
> - [ ] §12 démo sandbox (optionnel)

---

## 1. Contexte

`@atlasjs/nebula` fournit **une seule** caméra de rendu :

- **`Camera` (interface)** — `viewProjection: Mat4` + `update(width, height)`. Déjà pensée 3D-ready.
- **`Camera2D`** — impl concrète : `position: Vec2` + `zoom`, recalcule `projection` (`orthographic(0, w, h, 0, -1, 1)`, origine **coin haut-gauche**) × `view` (`scale(zoom)·translate(-position)`) chaque frame.
- **`Renderer.camera: Camera`** — une caméra unique ; tout le `SceneRenderer` rend à travers elle, `getCameraViewport()` (backend) en dérive le culling.
- **`NebulaRenderer.camera`** ré-expose ce `Camera2D` (ergonomie 2D).

Aujourd'hui, cette caméra est pilotée **directement** (l'éditeur, `packages/editor`, fait pan/zoom dessus). Il manque :

1. Une caméra **gameplay** : une entité Nexus (avec un `Transform2D`) dont la position/zoom pilotent la caméra de rendu — pour un follow-player, un switch de caméra, etc.
2. `screenToWorld` / `worldToScreen` accessibles au code de jeu (picking souris → monde, placement d'UI monde → écran).
3. Une notion de **caméra active / « main »** à la Unity, avec la possibilité d'en créer d'autres et de switcher.

### 1.1. La caméra de rendu n'est pas « la caméra de l'éditeur »

`renderer.camera` est **la caméra de rendu bas niveau** — le point de vue unique par lequel la scène est dessinée, et l'autorité de la matrice `viewProjection`. L'éditeur n'en est qu'**un producteur** (pan/zoom en edit mode). La caméra gameplay en est **un autre producteur** (play mode). Ils n'écrivent jamais en même temps : en edit mode l'éditeur pilote, en play mode la main camera gameplay pilote. Ce doc n'introduit **pas** de système de « mode » formel edit↔play (→ backlog) ; en pratique, s'il n'y a pas de caméra gameplay active, le sync ne touche à rien.

## 2. Insight central : le centrage se bake dans la matrice

Le modèle de `Camera2D` est **top-left** : `position` = coordonnée monde au coin haut-gauche de l'écran. La souris (`@atlasjs/input`, `clientX - rect.left`) est dans le **même** espace (px logiques, origine haut-gauche) que l'ortho `(0, w, h, 0)`. Donc, sans rotation de caméra, projection et viewport s'annulent et le screen↔world est analytique **trivial** (pas besoin de `Mat4.invert()`) :

```
worldToScreen(world) = (world - position) * zoom
screenToWorld(screen) = position + screen / zoom
```

La convention gameplay, elle, est **centrée** (Unity-like) : la position de l'**entité** caméra = **centre** du viewport (idéal follow-player). Le `CameraSyncSystem` fait le pont en **bakant le centrage dans la matrice nebula** :

```
renderer.camera.position = centreMonde - (tailleLogique / 2) / zoom
```

Conséquence élégante : une fois ce décalage écrit dans `renderer.camera.position`, `screenToWorld` **reste la formule top-left simple** et respecte automatiquement le centrage — le screen↔world n'a **pas** besoin de connaître la taille du viewport ni le centre ; **seul le sync** en a besoin. Vérification :

```
screenToWorld(s) = pos + s/zoom
                 = (centre − tailleLogique/(2·zoom)) + s/zoom
                 = centre + (s − tailleLogique/2) / zoom      ✓ (mapping centré correct)
```

nebula reste donc « juste une matrice » (bas niveau, top-left) ; la convention centrée vit **entièrement côté gameplay**, et l'éditeur peut continuer à utiliser le modèle top-left directement.

## 3. Décisions de design

| # | Décision |
|---|----------|
| Portée multi-caméra | **Une seule caméra active à la fois** (switchable via `setActive`). Plusieurs entités-caméra peuvent exister, une seule pilote le rendu. Rendu = **1 passe** (nebula inchangé). Rendu simultané (split-screen/minimap/RTT) → backlog. |
| Convention de position | **Centrée** (position entité = centre du viewport). Le sync convertit vers le top-left de nebula. |
| Autorité | Un **service** `CameraManager` (token `CAMERA_MANAGER`) : seule autorité de la caméra active + du screen↔world. Seam ouvert pour le multi-caméra futur. |
| Composant | `Camera` = composant **LEVEL 1** (`components/`), utilisé **brut** par les scripts (données pures : `zoom`). **Pas de façade LEVEL 2** : rien à router (activer passe par le service, pas par le composant) — cf. invariant « pas de façade par symétrie » (précédent `PlayerInput`). |
| Accès script | Façade de service **`CameraApi`** (miroir exact d'`InputApi`, `ScriptService<CameraManager>`, `static token = CAMERA_MANAGER`) : `screenToWorld`/`worldToScreen`/`setMain`. Ne fuite jamais nebula. |
| screen↔world | Méthodes **sur `Camera2D`** (autorité de la matrice, réutilisable par l'éditeur) ; `CameraManager`/`CameraApi` **délèguent** à `renderer.camera`. |
| Position monde | Le sync lit `WorldTransform2D` (position **monde**, pas locale) → **follow via parenting gratuit** : caméra enfant du joueur = suit le joueur. |
| Rotation | **Ignorée en v1** (le `view` de `Camera2D` n'applique que scale+translate ; une rotation exigerait `Mat4.invert` pour le screen↔world). → backlog. |

## 4. Modification `@atlasjs/nebula` : `screenToWorld`/`worldToScreen` sur `Camera2D`

Seul changement nebula. Deux méthodes pures sur `Camera2D` (l'autorité de la matrice), `out?` pour éviter les allocs (philo perf) :

```ts
public screenToWorld(screen: Vec2, out?: Vec2): Vec2;   // out = position + screen / zoom
public worldToScreen(world: Vec2, out?: Vec2): Vec2;    // out = (world - position) * zoom
```

- Modèle **top-left conservé** (aucune connaissance du centrage — c'est une affaire gameplay).
- Pas de `Mat4.invert()` requis. `out` par défaut = nouveau `Vec2`.
- Débloque une partie du backlog **B2** (« méthodes `Camera2D` manquantes » pour l'éditeur), sans faire la réconciliation éditeur ici.

### 4bis. Exposer `getCameraViewport()` sur `NebulaRenderer`

Le `CameraSyncSystem` a besoin de l'**extent** du viewport pour le décalage de centrage. `getCameraViewport()` existe déjà côté `Renderer` et renvoie un `Bound` en **unités monde** (`origin = position`, `size = tailleLogique / zoom`) — c'est exactement le demi-extent qu'il faut : `(tailleLogique/2)/zoom == getCameraViewport().{width,height} / 2`. On l'expose donc simplement sur `NebulaRenderer` en **passthrough** (`getCameraViewport(): Bound` → `renderer.getCameraViewport()`), et le sync prend la moitié. Aucun nouvel accesseur de taille logique n'est nécessaire, et l'ordre (poser le `zoom` **avant** de lire le viewport) garantit un extent au bon zoom.

## 5. `Camera` (LEVEL 1, `packages/gameplay/src/components/Camera.ts`)

Composant de **données pures**. Position/rotation viennent du `Transform2D` de l'entité ; le composant ne porte que ce qui est propre à la caméra.

```ts
export class Camera {
  public zoom: number = 1;
}
```

- **LEVEL 1** : `this.addComponent(Camera)` retourne l'instance brute (dispatch non-façade), le script fait `this.getComponent(Camera).zoom = 1.5` directement.
- **Nommage** : `Camera` (sans suffixe, convention LEVEL 1). Distinct du `Camera2D` de nebula (autre package, autre responsabilité : la matrice de rendu). Le `CameraSyncSystem` importe les deux ; aucun conflit de nom (`Camera` gameplay vs `Camera2D` nebula).
- **YAGNI** : pas de `clearColor` / `viewport rect` / `renderTarget` en v1 (→ backlog multi-caméra). L'entité caméra doit posséder un `Transform2D` (le sync lit son `WorldTransform2D`).

## 6. `CameraManager` (service, `packages/gameplay/src/camera/CameraManager.ts`)

L'autorité unique. Détient une réf `NebulaRenderer` + l'entité active.

```ts
export class CameraManager {
  public constructor(renderer: NebulaRenderer);

  public setActive(entity: Entity | undefined): void;   // définit / vide la main camera
  public getActive(): Entity | undefined;

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2;  // délègue à renderer.camera
  public worldToScreen(world: Vec2, out?: Vec2): Vec2;
}
```

- `screenToWorld`/`worldToScreen` délèguent à `renderer.camera` (le `Camera2D` nebula, tenu à jour par le `CameraSyncSystem`). Comme le centrage est baké dans la matrice (§2), aucune arithmétique de viewport ici.
- Seam **multi-caméra** : demain, `setActive` deviendrait `add`/`setLayer`/…, et `screenToWorld(entity?)` résoudrait par caméra.

## 7. `CameraSyncSystem` (`packages/gameplay/src/systems/CameraSyncSystem.ts`)

Le push par frame, sur la lane **`render`**, **avant** le rendu nebula (et avant `SpriteRenderSystem`, dont le culling lit `getCameraViewport`).

```ts
export class CameraSyncSystem {
  public constructor(manager: CameraManager, renderer: NebulaRenderer);

  public update({ world }: NexusSystemContext): void {
    const active: Entity | undefined = this.manager.getActive();
    if (active === undefined) return;                       // aucune caméra → ne touche à rien

    const wt = world.getComponent(active, WorldTransform2D);
    const cam = world.getComponent(active, Camera);
    if (wt === undefined || cam === undefined) return;

    const center: Vec2 = wt.getPosition();                  // position MONDE (suit le parenting)
    const cam2d = this.renderer.camera;                     // Camera2D nebula
    cam2d.zoom = cam.zoom;                                   // 1) poser le zoom d'abord
    const vp = this.renderer.getCameraViewport();            // 2) extent monde au bon zoom (§4bis)
    cam2d.position.set(center.x - vp.width / 2, center.y - vp.height / 2);  // 3) baker le centrage
  }
}
```

- Lit `WorldTransform2D` (produit par `TransformPropagationSystem` en `update/Late`) → frais en `render/PreRender`. **Follow via parenting gratuit** (`nexus.setParent(cam, player)`).
- Ordre strict : **zoom → lire viewport → position** (le viewport dépend du zoom courant).
- N'itère pas une query : il **résout l'unique entité active**. (Implémenté comme `NexusSystem` via `registerSystem`, ou comme step simple — tranché au plan ; il n'a besoin ni de `dt` ni de query.)
- Écrit uniquement `renderer.camera.position/zoom` — ne touche à rien d'autre.

## 8. `CameraApi` (façade de service, `packages/gameplay/src/scripting/services/CameraApi.ts`)

Miroir exact d'`InputApi`. Curated, ne fuite jamais nebula ni le `NebulaRenderer`.

```ts
export class CameraApi extends ScriptService<CameraManager> {
  public static readonly token = CAMERA_MANAGER;

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 { return this.provided.screenToWorld(screen, out); }
  public worldToScreen(world: Vec2, out?: Vec2): Vec2 { return this.provided.worldToScreen(world, out); }
  public setMain(entity: Entity): void { this.provided.setActive(entity); }
}
```

## 9. Flux par frame

```
update/Late   : TransformPropagationSystem  → WorldTransform2D (position monde de la caméra)
render/PreRender (avant sprite-render):
  CameraSyncSystem → lit active (WorldTransform2D + Camera.zoom)
                   → .zoom = zoom ; .position = center - getCameraViewport().{w,h}/2
render/Main   : NebulaRenderer.render() dessine via renderer.camera (culling getCameraViewport OK)
```

Ordonnancement : `CameraSyncSystem` en `render/PreRender`, **avant** `gameplay:sprite-render` (via `before` intra-stage) et avant l'étape de rendu nebula (stage `Main`). Détail (même stage + `before`, ou un ancrage antérieur) tranché au plan.

## 10. Câblage `GameplayPlugin`

- **Définir** le composant `Camera` (`world.defineComponent(Camera)`).
- **Construire** `CameraManager(nebula)` + `CameraSyncSystem(manager, nebula)`.
- **`provide(CAMERA_MANAGER, manager)`** (+ token dans `tokens.ts`).
- **Enregistrer** `CameraSyncSystem` en `render/PreRender` (`before: "gameplay:sprite-render"`), garder le `StepHandle` pour l'`uninstall`.
- **`onRemove(Camera)`** : si l'entité retirée est l'active → `manager.setActive(undefined)` (pas de caméra active fantôme). Garder l'`Unsubscribe`.

## 11. Exports

`@atlasjs/gameplay` `index.ts` : exporter `Camera` (composant), `CameraManager`, `CAMERA_MANAGER`, `CameraApi`. (`CameraSyncSystem` reste interne comme les autres systèmes.)

## 12. Création de la main camera (côté jeu)

Pas d'entité magique auto-créée par le plugin (à la Unity, la Main Camera est un objet **visible** de la scène). Le jeu la crée explicitement :

```ts
// Dans une Scene (onCreate)
const cam: Entity = nexus.createEntity();
// attacher Transform2D + Camera (via un script, ou addComponent)
nexus.setParent(cam, player);                 // follow gratuit (optionnel)
cameraManager.setActive(cam);

// Dans un script
const world: Vec2 = this.getService(CameraApi)
  .screenToWorld(this.getService(InputApi).mousePosition);
this.getComponent(Camera).zoom = 1.5;
```

## 13. Tests (TDD, harness `test/helpers/harness.ts`)

- **`Camera2D` (nebula)** : `screenToWorld`/`worldToScreen` inverses l'un de l'autre ; `zoom`/`position` corrects ; `out?` réutilisé.
- **`CameraManager`** : `setActive`/`getActive` ; `screenToWorld`/`worldToScreen` délèguent à `renderer.camera`.
- **`CameraSyncSystem`** : avec une caméra active à `center=(cx,cy)`, `zoom=z` et un viewport `(w,h)` → `renderer.camera.position == (cx - (w/2)/z, cy - (h/2)/z)` et `.zoom == z` ; parenting → suit la position monde du parent ; aucune caméra active → `renderer.camera` intouché.
- **Round-trip centrage** : `screenToWorld(centreÉcran) == centreMonde` de la caméra active après un sync.
- **Cycle de vie** : retirer la caméra active → `getActive() === undefined`.
- **Intégration harness** : entité `Transform2D + Camera`, `setActive`, `frame()` → la matrice de rendu reflète la caméra ; `screenToWorld` de la souris cohérent.

## 14. Non-objectifs (v2 → `docs/backlog.md`)

Rendu simultané multi-caméras (split-screen / minimap / render-to-texture = une `RenderPass` par caméra, viewport rects distincts) ; rotation de caméra (exige `Mat4.invert`, `view` sans rotation) ; `clearColor` / `viewport rect` / `renderTarget` par caméra ; couches de rendu / culling mask par caméra ; système de « mode » edit↔play formel ; caméra à projection non-ortho (perspective, ouverture 3D).

## 15. Ordre d'implémentation suggéré

1. Nebula : `Camera2D.screenToWorld`/`worldToScreen` (+ `out?`) + tests ; exposer la taille logique du viewport sur `NebulaRenderer` (§4bis). Rebuild `dist`.
2. Gameplay : composant `Camera` (LEVEL 1) + export + token `CAMERA_MANAGER`.
3. Gameplay : `CameraManager` (délégation screen↔world, active entity) + tests.
4. Gameplay : `CameraSyncSystem` (centrage, lit `WorldTransform2D`) + tests.
5. Gameplay : `CameraApi` (façade service) + export.
6. `GameplayPlugin` : définir composant, construire manager+système, `provide`, enregistrer système (stage/`before`, teardown), `onRemove(Camera)`.
7. `tsc --noEmit` gameplay ; rebuild `dist`.
8. (Démo) `apps/sandbox/EcsScene` : créer une main camera enfant du joueur + `setActive`, un script qui lit `screenToWorld(mouse)` — validation visuelle.
