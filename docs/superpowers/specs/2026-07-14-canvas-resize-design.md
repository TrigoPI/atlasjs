# Canvas resize — design (B3)

> Statut : **validé**, prêt pour plan d'implémentation
> Portée : `@atlasjs/nebula` (interface `Renderer`), `@atlasjs/nebula-webgpu` (`WebGPURenderer`), apps `sandbox` + `webgpu`
> Référence backlog : `docs/renderer-backlog.md` §B3

## Problème

Quand le canvas est redimensionné, la caméra ne suit pas. Aujourd'hui :

- `canvas.width`/`height` sont fixés une seule fois au load dans chaque app (`window.innerWidth/Height`), sans `devicePixelRatio`.
- Aucun `ResizeObserver` ni handler de resize.
- Le `GPUCanvasContext` est configuré une seule fois dans `init()`.
- `WebGPURenderer.updateCamera()` lit `canvas.width/height` **chaque frame** et appelle `camera.update(width, height)` — donc la projection **suivrait** un redimensionnement, mais rien ne met jamais à jour `canvas.width/height`.

Le trou est donc le **chemin de resize** : observer le canvas, mettre à jour le backing store, alimenter la caméra.

## Décisions

| Sujet | Choix |
|---|---|
| Ownership | **Hybride** : `resize(w, h)` dans l'interface `Renderer` (contrat impératif) **+** auto-observe par défaut dans `WebGPURenderer` (`autoResize`, opt-out). |
| HiDPI | Backing store en **pixels physiques** (`× devicePixelRatio`). Caméra en **pixels logiques (CSS)** → taille visuelle constante quel que soit le DPR. |
| Politique de vue | **Expand** : 1 unité monde = 1 pixel logique ; agrandir la fenêtre révèle plus de scène, les objets gardent leur taille pixel. (Formule ortho actuelle inchangée.) |
| Source de taille (auto) | `ResizeObserver` sur le canvas, `devicePixelContentBoxSize` (physique exact) + `contentBoxSize` (logique). Fallback `contentBoxSize × devicePixelRatio`. |
| Reconfigure contexte | **Non nécessaire** : en WebGPU le drawing buffer suit `canvas.width/height`, le prochain `getCurrentTexture()` renvoie la bonne taille. |
| Render targets plein écran | **Hors scope** (aucun n'existe ; post-processing = A3). Hook futur noté, rien à recâbler. |

## Architecture

### 1. Contrat & séparation logique/physique

Ajout à l'interface `Renderer` (`packages/nebula/src/core/renderer/Renderer.ts`), backend-agnostic :

```ts
resize(width: number, height: number): void; // width/height = pixels LOGIQUES (CSS)
```

Dans `WebGPURenderer` :

- Nouveaux champs privés `logicalWidth`, `logicalHeight` (CSS px).
- `updateCamera()`, `getViewport()`, `getCameraViewport()` lisent `logicalWidth/Height` au lieu de `canvas.width/height`.
- `Camera2D` **inchangée** (reçoit déjà `(width, height)`, désormais nourrie en logique).

### 2. Cœur de resize (privé, partagé)

```ts
private applyResize(
  logicalWidth: number,
  logicalHeight: number,
  physicalWidth: number,
  physicalHeight: number,
): void;
```

- Guard : si une dimension physique <= 0 (élément caché), on ignore (pas de `canvas.width = 0`, qui casserait `getCurrentTexture()`).
- Stocke `logicalWidth/Height`.
- Applique `canvas.width = physicalWidth`, `canvas.height = physicalHeight` (arrondi entier).
- Pas de `context.configure()`.

`resize(width, height)` public (chemin impératif / manuel) :
- `dpr = devicePixelRatio` (défaut 1) ; appelle `applyResize(width, height, round(width * dpr), round(height * dpr))`.

### 3. Auto-observe (hybride)

Constructeur :

```ts
new WebGPURenderer(canvas, options?: { autoResize?: boolean }); // autoResize défaut = true
```

Dans `init()`, si `autoResize` :
- Créer un `ResizeObserver` sur le canvas. Callback :
  - Si `entry.devicePixelContentBoxSize` disponible → physique exact (`inlineSize`/`blockSize`), et logique via `entry.contentBoxSize`.
  - Sinon fallback : logique = `contentBoxSize`, physique = `contentBoxSize × devicePixelRatio`.
  - Appelle `applyResize(...)` directement (pas via `resize()`, pour garder le physique exact).
- Le `ResizeObserver` fire immédiatement → dimensionnement initial gratuit.
- Conserver la réf dans un champ privé.

`destroy()` : `observer?.disconnect()` puis réf à null, avant le teardown existant.

Mode manuel (`autoResize: false`) : pas d'observer ; l'app appelle `renderer.resize(w, h)` (ou `nebula.resize(w, h)`).

### 4. Surface `NebulaRenderer`

Passthrough (symétrie avec `getViewport()` déjà exposé) :

```ts
public resize(width: number, height: number): void {
  this.renderer.resize(width, height);
}
```

### 5. Apps

Dans tous les cas on retire seulement le sizing manuel du canvas ; le content-box est déjà fourni par du CSS `100vw/100vh` (inline pour sandbox, feuille de style globale `css/index.css` pour webgpu), donc aucune règle de style à ajouter.

- `apps/sandbox/src/App.tsx` : retirer `mount.width/height = window.innerWidth/Height` (auto-observe gère). CSS `100vw/100vh` déjà inline sur le `<canvas>`.
- `apps/webgpu/src/material.ts` (**entry active**, référencée par `index.html`) : retirer `canvas.width/height = window.innerWidth/Height`.
- `apps/webgpu/src/index.ts` (entry alternative) : idem, retirer le sizing manuel.

## Unités concernées

| Unité | Rôle | Dépend de |
|---|---|---|
| `Renderer.resize` (interface) | Contrat impératif backend-agnostic | — |
| `WebGPURenderer.resize` / `applyResize` | Backing store physique + taille logique + guard | `canvas`, `devicePixelRatio` |
| `WebGPURenderer` ResizeObserver | Détection auto, source de taille | `ResizeObserver`, `applyResize` |
| `updateCamera/getViewport/getCameraViewport` | Consomment la taille logique | `logicalWidth/Height`, `Camera2D` |
| `NebulaRenderer.resize` | Passthrough (mode manuel) | `Renderer.resize` |

## Hors scope

- Resize des render targets plein écran (aucun n'existe ; A3 post-processing).
- Politique "fixed design resolution / scale-to-fit" (letterbox) — modèle expand retenu.
- Debounce du resize (reconfigure inutile, `canvas.width=` bon marché ; ajout trivial si besoin plus tard).
- Réconciliation éditeur↔nebula (B2), indépendant.

## Vérification

Changement observable dans le preview :

1. Lancer l'app, redimensionner la fenêtre → le sprite garde sa taille pixel, plus de scène visible, aucun étirement/distorsion.
2. `read_console_messages` / `preview_logs` : aucune erreur `getCurrentTexture` ni WebGPU.
3. Écran HiDPI / zoom navigateur : rendu net (backing store × DPR).
4. Screenshot avant/après resize comme preuve.
