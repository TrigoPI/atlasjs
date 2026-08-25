# Caméra gameplay — `Camera` + `CameraManager` + `CameraSyncSystem` + `CameraApi` (`@atlasjs/gameplay`)

> **Statut : ✅ implémenté** (cœur ; extensions V2 → [`../backlog/`](../backlog/)). Introduit une caméra **gameplay** (entité Nexus) qui pilote la caméra de rendu de `@atlasjs/nebula`, plus `screenToWorld`/`worldToScreen`. La caméra gameplay est **un producteur de plus** qui écrit dans `renderer.camera`, exactement comme `SpriteRenderSystem` pousse les sprites ou `PhysicsPushSystem` pousse les transforms. Le modèle mono-caméra de nebula (une seule passe de rendu) est **inchangé**.
> Prérequis de lecture : `memory/atlas/gameplay/gameplay-redesign.md` (bridge par système, source de vérité unique), `memory/atlas/gameplay/scripting-components.md` (les deux niveaux de composants + façades de service), `memory/atlas/gameplay/input-scripting.md` (le pattern `ScriptService`/`InputApi` que `CameraApi` reprend), `memory/atlas/core/scheduling.md` (lanes/stages), `memory/atlas/rendering/renderer-architecture.md` (interface `Camera`, `Renderer.camera`).

> **État d'implémentation** :
> - [x] §4 `Camera2D.screenToWorld`/`worldToScreen` (nebula)
> - [x] §4bis `NebulaRenderer.getCameraViewport()` passthrough (nebula)
> - [x] §5 composant `Camera` (LEVEL 1)
> - [x] §6 `CameraManager` + token `CAMERA_MANAGER`
> - [x] §7 `CameraSyncSystem`
> - [x] §8 `CameraApi`
> - [x] §8bis camera shake (`shake.ts` + `CameraManager.shake`/`advanceShake` + `CameraApi.shake`)
> - [x] §10 câblage `GameplayPlugin`
> - [x] §12 démo `dino-brawl` (édit en place ; vérif visuelle navigateur en attente)

---

## 1. Contexte

`@atlasjs/nebula` fournit **une seule** caméra de rendu :

- **`Camera` (interface)** — `viewProjection: Mat4` + `update(width, height)`. Déjà pensée 3D-ready.
- **`Camera2D`** — impl concrète : `position: Vec2` + `zoom`, recalcule `projection` (`orthographic(0, w, h, 0, -1, 1)`, origine **coin haut-gauche**) × `view` (`scale(zoom)·translate(-position)`) chaque frame.
- **`Renderer.camera: Camera`** — une caméra unique ; tout le `SceneRenderer` rend à travers elle, `getCameraViewport()` (backend) en dérive le culling.
- **`NebulaRenderer.camera`** ré-expose ce `Camera2D` (ergonomie 2D).

Aujourd'hui, cette caméra est pilotée **directement** (un ancien `packages/editor`, supprimé depuis, faisait pan/zoom dessus). Il manque :

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
- Débloquait une partie de l'ancien item backlog « méthodes `Camera2D` manquantes » pour l'éditeur, sans faire la réconciliation éditeur ici. Cet item a été retiré du backlog avec la suppression de `packages/editor`.

### 4bis. Exposer `getCameraViewport()` sur `NebulaRenderer`

Le `CameraSyncSystem` a besoin de l'**extent** du viewport pour le décalage de centrage. `getCameraViewport()` existe déjà côté `Renderer` et renvoie un `Bound` en **unités monde** (`origin = position`, `size = tailleLogique / zoom`) — c'est exactement le demi-extent qu'il faut : `(tailleLogique/2)/zoom == getCameraViewport().{width,height} / 2`. On l'expose donc simplement sur `NebulaRenderer` en **passthrough** (`getCameraViewport(): Bound` → `renderer.getCameraViewport()`), et le sync prend la moitié. Aucun nouvel accesseur de taille logique n'est nécessaire, et l'ordre (poser le `zoom` **avant** de lire le viewport) garantit un extent au bon zoom.

## 5. `Camera` (LEVEL 1, `packages/gameplay/src/components/Camera.ts`)

Composant de **données pures**. Position/rotation viennent du `Transform2D` de l'entité ; le composant ne porte que ce qui est propre à la caméra.

```ts
export class Camera {
  public zoom: number = 1;
}
```

- **LEVEL 1** : `this.addComponent(Camera)` retourne l'instance brute (dispatch non-façade), le script fait `this.requireComponent(Camera).zoom = 1.5` directement (`getComponent` renvoie `Camera | undefined`).
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

  public shake(spec: ShakeSpec, direction?: Vec2): void;  // §8bis : lance un kick
  public advanceShake(dt: number): void;                  // §8bis : intègre le ressort
  public getShakeOffset(): Vec2;                          // §8bis : offset courant (Vec2 réutilisé)
}
```

- `screenToWorld`/`worldToScreen` délèguent à `renderer.camera` (le `Camera2D` nebula, tenu à jour par le `CameraSyncSystem`). Comme le centrage est baké dans la matrice (§2), aucune arithmétique de viewport ici.
- Seam **multi-caméra** : demain, `setActive` deviendrait `add`/`setLayer`/…, et `screenToWorld(entity?)` résoudrait par caméra.

## 7. `CameraSyncSystem` (`packages/gameplay/src/systems/CameraSyncSystem.ts`)

Le push par frame, sur la lane **`render`**, **avant** le rendu nebula (et avant `SpriteRenderSystem`, dont le culling lit `getCameraViewport`).

```ts
export class CameraSyncSystem {
  public constructor(manager: CameraManager, renderer: NebulaRenderer);

  public update({ world, dt }: NexusSystemContext): void {
    this.manager.advanceShake(dt);                          // 0) intégrer le ressort de shake (§8bis)

    const active: Entity | undefined = this.manager.getActive();
    if (active === undefined) return;                       // aucune caméra → ne touche à rien

    const wt = world.getComponent(active, WorldTransform2D);
    const cam = world.getComponent(active, Camera);
    if (wt === undefined || cam === undefined) return;

    const center: Vec2 = wt.getPosition();                  // position MONDE (suit le parenting)
    const cam2d = this.renderer.camera;                     // Camera2D nebula
    cam2d.zoom = cam.zoom;                                   // 1) poser le zoom d'abord
    const vp = this.renderer.getCameraViewport();            // 2) extent monde au bon zoom (§4bis)
    const shake: Vec2 = this.manager.getShakeOffset();       // 3) offset de shake, en unités monde
    cam2d.position.set(center.x - vp.width / 2 + shake.x, center.y - vp.height / 2 + shake.y);  // 4) baker centrage + shake
  }
}
```

- Lit `WorldTransform2D` (produit par `TransformPropagationSystem` en `update/Late`) → frais en `render/PreRender`. **Follow via parenting gratuit** (`nexus.setParent(cam, player)`).
- Ordre strict : **zoom → lire viewport → position** (le viewport dépend du zoom courant).
- N'itère pas une query : il **résout l'unique entité active**. Implémenté comme `NexusSystem` via `registerSystem` ; il a besoin du `dt` (pour `advanceShake`) mais d'aucune query.
- `advanceShake(dt)` est appelé **avant** le `return` anticipé : le ressort continue de s'amortir même sans caméra active, plutôt que de rester figé et de repartir en sursaut au prochain `setActive`.
- Écrit uniquement `renderer.camera.position/zoom` — ne touche à rien d'autre.

## 8. `CameraApi` (façade de service, `packages/gameplay/src/scripting/services/CameraApi.ts`)

Miroir exact d'`InputApi`. Curated, ne fuite jamais nebula ni le `NebulaRenderer`.

```ts
export class CameraApi extends ScriptService<CameraManager> {
  public static readonly token = CAMERA_MANAGER;

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 { return this.provided.screenToWorld(screen, out); }
  public worldToScreen(world: Vec2, out?: Vec2): Vec2 { return this.provided.worldToScreen(world, out); }
  public setMain(entity: Entity): void { this.provided.setActive(entity); }
  public shake(spec: ShakeSpec, direction?: Vec2): void { this.provided.shake(spec, direction); }
}
```

### 8bis. Camera shake — un ressort amorti, pas une courbe de bruit

Le shake est le seul effet qui écrit `renderer.camera.position` **en plus** du centrage. Il vit entièrement dans `CameraManager` (état) + `shake.ts` (paramètres), et le `CameraSyncSystem` se contente d'additionner son offset (§7).

**Le mécanisme : masse-ressort amorti à une seule impulsion.** Pas de bruit, pas d'échantillonnage de courbe, pas de durée. `shake()` ne déplace pas la caméra : il pose une **vitesse initiale** sur un offset qui vaut zéro au repos, et le ressort fait le reste. Chaque sous-pas intègre explicitement, en deux lignes symétriques sur `x` et `y` :

```
velocity += (−stiffness · offset − damping · velocity) · dt
offset   += velocity · dt
```

L'offset part donc de zéro, s'éloigne dans la direction du kick, est rappelé vers le centre, dépasse, et l'oscillation meurt en quelques allers-retours. En dessous d'un seuil de repos (`SHAKE_REST = 0.01` sur l'offset **et** la vitesse), offset et vitesse sont **remis à zéro net** — la caméra revient exactement au centre plutôt que de traîner un résidu sous-pixel indéfiniment.

**Trois paramètres, aucune durée** (`ShakeSpec`, `packages/gameplay/src/camera/shake.ts`) :

| Champ | Rôle |
|---|---|
| `strength` | vitesse initiale du kick, en **unités monde par seconde** (pas une amplitude : l'amplitude atteinte en découle, via `stiffness`) |
| `stiffness` | force de rappel vers le centre. Plus haut = retour plus sec, amplitude plus faible, fréquence plus élevée |
| `damping` | vitesse d'extinction du ballant. Plus haut = se stabilise en moins d'oscillations |

Quatre presets couvrent les cas usuels (`ShakePresets.light` / `medium` / `heavy` / `rumble`) ; on s'en écarte en spreadant plutôt qu'en repartant de zéro : `{ ...ShakePresets.heavy, strength: 200 }`.

**Direction.** `shake(spec, direction?)` normalise `direction` lui-même — l'appelant peut passer un vecteur brut (un delta de coup, une normale de collision). Sans `direction`, ou si son module est nul, le kick est **vers le haut** (`(0, strength)`).

**Un seul shake à la fois.** Un nouvel appel **remplace** le spec en vol et écrase la vitesse : les shakes ne s'accumulent pas et ne se mettent pas en file. L'offset courant, lui, n'est pas remis à zéro — un second coup pendant le ballant du premier repart de là où la caméra se trouve.

**Spec invalide = no-op silencieux.** `strength <= 0`, `stiffness <= 0` ou `damping < 0` font sortir `shake()` sans rien toucher : ni le spec actif, ni la vitesse. Un `strength: 0` est donc « ne secoue pas », pas « secoue de zéro », et n'interrompt pas un shake en cours.

**Stabilité de l'intégrateur (la partie non évidente).** L'intégration est explicite, donc elle **diverge** dès que le pas dépasse la limite de stabilité du ressort. Comme le pas vient de la lane `render` (variable, dépendant de la machine), un `dt` de frame ne peut pas être utilisé tel quel : un preset raide sur une frame lente ferait exploser l'offset. Deux garde-fous :

- **Sous-pas dérivé du spec.** `advanceShake(dt)` découpe `dt` en pas d'au plus `min(1/120, 1/√stiffness, 1/damping)` — la borne est recalculée depuis le spec **actif**, si bien que n'importe quel preset reste stable à n'importe quel frame rate, sans que le doc ait à interdire des valeurs.
- **Rattrapage borné.** Le `dt` consommé est plafonné à `1/10 s` : après une longue pause (onglet en arrière-plan, breakpoint), le shake ne rejoue pas le temps perdu en rafale.

**Ce que le shake n'est pas.** Pas de shake **par caméra** : l'état vit dans le manager, une seule caméra étant active à la fois (§3). Pas de rotation ni de zoom secoués — uniquement une translation (cf. §3, rotation hors v1). Pas de fin d'effet observable : rien ne notifie « le shake est terminé », l'état se lit via `getShakeOffset()`.

Côté script, tout passe par `CameraApi.shake` — un usage réel est décrit dans `memory/atlas/gameplay/weapon-attack-cues.md`.

## 9. Flux par frame

```
update/Late   : TransformPropagationSystem  → WorldTransform2D (position monde de la caméra)
render/PreRender (avant sprite-render):
  CameraSyncSystem → advanceShake(dt) (ressort amorti, §8bis)
                   → lit active (WorldTransform2D + Camera.zoom)
                   → .zoom = zoom ; .position = center - getCameraViewport().{w,h}/2 + shakeOffset
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

`@atlasjs/gameplay` `index.ts` : exporter `Camera` (composant), `CameraManager`, `CAMERA_MANAGER`, `CameraApi`, plus `ShakeSpec`/`ShakePresets` (§8bis — le spec est un argument d'appel côté jeu). (`CameraSyncSystem` reste interne comme les autres systèmes.)

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
this.requireComponent(Camera).zoom = 1.5;
this.getService(CameraApi).shake(ShakePresets.medium);   // §8bis
```

## 13. Tests (TDD, harness `test/helpers/harness.ts`)

- **`Camera2D` (nebula)** : `screenToWorld`/`worldToScreen` inverses l'un de l'autre ; `zoom`/`position` corrects ; `out?` réutilisé.
- **`CameraManager`** : `setActive`/`getActive` ; `screenToWorld`/`worldToScreen` délèguent à `renderer.camera`.
- **`CameraSyncSystem`** : avec une caméra active à `center=(cx,cy)`, `zoom=z` et un viewport `(w,h)` → `renderer.camera.position == (cx - (w/2)/z, cy - (h/2)/z)` et `.zoom == z` ; parenting → suit la position monde du parent ; aucune caméra active → `renderer.camera` intouché.
- **Shake** (`test/camera-shake.test.ts`) : au repos l'offset est nul ; le kick suit la direction donnée et ne dépend que de `strength` (direction normalisée) ; le ressort revient au repos seul ; une frame très longue reste bornée ; le point d'arrivée est le même quel qu'ait été le frame rate, et chaque preset reste stable à une cadence rampante ; un spec à `stiffness`/`strength` non positif est ignoré ; direction de module nul → kick vertical.
- **Round-trip centrage** : `screenToWorld(centreÉcran) == centreMonde` de la caméra active après un sync.
- **Cycle de vie** : retirer la caméra active → `getActive() === undefined`.
- **Intégration harness** : entité `Transform2D + Camera`, `setActive`, `frame()` → la matrice de rendu reflète la caméra ; `screenToWorld` de la souris cohérent.

## 14. Comportements connus (par design, pas des bugs)

Deux conséquences directes du flux par frame (§9), à connaître plutôt qu'à corriger :

- **`screenToWorld`/`worldToScreen` lus dans un `onUpdate` reflètent la caméra de la frame précédente.** `CameraSyncSystem` est l'unique producteur de `renderer.camera`, et il tourne en lane `render`, synchronisé après `update`. Un script qui appelle ces méthodes pendant `onUpdate` lit donc encore la position/zoom laissés par le sync de la frame N-1, pas ceux calculés pour la frame N.
- **`renderer.camera` reste à sa valeur par défaut en frame 0.** Tant que `CameraSyncSystem` n'a pas tourné une première fois — c'est-à-dire avant le premier passage de la lane `render` — `renderer.camera` est encore le `Camera2D` construit par défaut par `NebulaRenderer`, non centré sur la caméra active gameplay.

## 15. Non-objectifs (v2 → `memory/atlas/backlog/`)

Rendu simultané multi-caméras (split-screen / minimap / render-to-texture = une `RenderPass` par caméra, viewport rects distincts) ; rotation de caméra (exige `Mat4.invert`, `view` sans rotation) ; `clearColor` / `viewport rect` / `renderTarget` par caméra ; couches de rendu / culling mask par caméra ; système de « mode » edit↔play formel ; caméra à projection non-ortho (perspective, ouverture 3D).

## 16. Ordre d'implémentation suggéré

1. Nebula : `Camera2D.screenToWorld`/`worldToScreen` (+ `out?`) + tests ; exposer la taille logique du viewport sur `NebulaRenderer` (§4bis). Rebuild `dist`.
2. Gameplay : composant `Camera` (LEVEL 1) + export + token `CAMERA_MANAGER`.
3. Gameplay : `CameraManager` (délégation screen↔world, active entity) + tests.
4. Gameplay : `CameraSyncSystem` (centrage, lit `WorldTransform2D`) + tests.
5. Gameplay : `CameraApi` (façade service) + export.
6. `GameplayPlugin` : définir composant, construire manager+système, `provide`, enregistrer système (stage/`before`, teardown), `onRemove(Camera)`.
7. `tsc --noEmit` gameplay ; rebuild `dist`.
8. (Démo) `apps/dino-brawl/EcsScene` : créer une main camera enfant du joueur + `setActive`, un script qui lit `screenToWorld(mouse)` — validation visuelle.
