# Dino Brawl — nettoyage & mise au propre de l'app

> **Statut : implémenté.** Le renommage `apps/sandbox` → `apps/dino-brawl`, le découpage `game/config.ts`/`controls.ts`/`spawn/`/`scripts/{player,camera,weapon,fx}/`, et le nettoyage du code mort annoncé sont en place. Seule exception : le `game/tiled/` décrit ici (avec ses bugs `TileSet.tileWidth`/`firstGid`) n'existe plus — remplacé par la refonte plus récente de [`tiled-bridge.md`](tiled-bridge.md), pas corrigé en place.
> Chantier de nettoyage de l'app sandbox en préparation de la scalabilité du gameplay.
> **Hors périmètre (chantiers séparés) :** système de prefab/factory générique, data-driven Tiled (spawns/objets déclarés dans la map), systèmes de combat (HP/dégâts/knockback).

---

## 1. Objectif

Remettre l'app `apps/sandbox` au propre, la renommer `dino-brawl`, et clarifier les responsabilités des scripts pour que le gameplay puisse grossir sans que le code parte en god-file.

**Contrainte forte : zéro changement de comportement.** À la fin, le jeu doit être **strictement identique à l'écran** (mêmes positions, mêmes animations, même caméra, même épée). Ce chantier est un refactor structurel, pas une évolution gameplay.

---

## 2. Principe directeur

C'est le cœur du chantier, tout le reste en découle :

> **Un script = du comportement par frame. La composition et la configuration initiale vivent dans la fonction de spawn.**

Aujourd'hui les deux sont mélangés :

- `PlayerScript.onCreate` fait `setScale(3, 3)`, `sortingOrder = 10`, et configure couleur/échelle/position de l'ombre — du setup statique déguisé en comportement.
- `SwordScript.onCreate` fait `setScale(scale)` et `sortingOrder = 20` ; sa prop `sprite` n'est jamais lue.
- `WallScript.onCreate` appelle carrément `addComponent(...)` — il compose une entité depuis un script.

Après : les scripts ne gardent que ce qui varie dans le temps (input → mouvement, état → animation, orbite/lancer de l'épée, suivi caméra). Tout le setup statique (échelle, sorting order, hiérarchie, position de spawn, config de l'ombre) remonte dans les fonctions de spawn.

---

## 3. Renommage

- `apps/sandbox/` → `apps/dino-brawl/` (déplacement du dossier).
- `package.json` : `"name": "sandbox"` → `"dino-brawl"`.
- `.claude/launch.json` : la config `sandbox` (`--filter sandbox`) → `dino-brawl` (`--filter dino-brawl`). La config `webgpu` est inchangée.
- `docs/` : les 33 références à `apps/sandbox` mises à jour (elles décrivent l'app comme consommateur des packages).
- `CLAUDE.md` : mentions de `apps/sandbox` mises à jour.
- Classe de scène : `EcsScene` → `ArenaScene` (le nom actuel décrit la techno ECS, pas le rôle de la scène).

Pas de changement de `pnpm-workspace.yaml` (glob `apps/*`).

---

## 4. Structure cible

```
apps/dino-brawl/src/
  main.tsx
  app/
    App.tsx            layout + montage
    GameCanvas.tsx     bootstrap moteur (plugins, canvas, cycle de vie)
    DebugOverlay.tsx   overlay FPS
  game/
    config.ts          SortingLayer · CollisionLayers · SortingOrder · MAP_SCALE
    resources.ts       (ex ResourcesPath.ts)
    controls.ts        defineActions + type DinoControls (partagé)
    ArenaScene.ts       orchestration mince (~40 lignes)
    spawn/
      index.ts
      spawnWorld.ts     tilemaps ground + props + grid
      spawnPlayer.ts    dino + animator + input + collider + ombre
      spawnSword.ts     épée en orbite
      spawnCamera.ts    caméra + scripts follow/zoom
      spawnProps.ts     arbres occluders
    scripts/
      index.ts
      PlayerMovementScript.ts
      PlayerAnimationScript.ts
      SwordScript.ts
      CameraFollowScript.ts    (ex CameraScript)
      CameraZoomScript.ts
      TileMapBuilderScript.ts  (ex MapBuilderScript)
    tiled/               (ex map-loader/, aplati)
      index.ts
      MapLoader.ts
      Layer.ts · LayerManager.ts
      MapObject.ts · MapObjectBuilder.ts · MapObjectManager.ts
      TileSet.ts · TileSetManager.ts
      tiled.types.ts · map.types.ts
```

### 4.1 `app/` — séparation shell / bootstrap / debug

`App.tsx` mélange aujourd'hui trois choses : le montage React, le bootstrap moteur (instanciation des 8 plugins, création du renderer/monde physique, cycle de vie), et l'overlay de debug FPS.

- `GameCanvas.tsx` : possède le `useEffect` moteur — instancie l'`Engine`, branche les plugins, crée la scène, gère le teardown. Expose un callback FPS.
- `DebugOverlay.tsx` : l'affichage FPS positionné en absolu.
- `App.tsx` : compose les deux.
- `Window.tsx` : supprimé (jamais monté).

### 4.2 `game/spawn/` — fonctions de spawn locales

De simples fonctions TS : `spawnPlayer(ctx, opts): Entity`. Pas de registry, pas d'API engine, pas d'abstraction générique — c'est explicitement le rôle du futur chantier prefab. Ces fonctions absorbent tout le setup statique retiré des scripts. `ArenaScene.onCreate` se réduit à : définir les sorting layers, charger la map, appeler les `spawn*` dans l'ordre, activer la caméra.

---

## 5. `game/config.ts`

Centralise les constantes aujourd'hui éparpillées en strings/nombres magiques :

- **`SortingLayer`** : les noms de sorting layers (`Ground`, `Entities`, `Overhead`) typés — fini les `sortingLayer = "Entities"` en string libre.
- **`CollisionLayers`** : le `defineCollisionLayers("Player", "Occluder")` actuellement dans la scène. Monte ici car les scripts de collision en auront besoin (chantier collisions à venir).
- **`SortingOrder`** : les ordres de tri magiques dispersés sur 4 fichiers (`shadow -1`, `shadow 8`, `player 10`, `wall 10`, `sword 20`) regroupés en un enum ordonné, lisible d'un coup d'œil.
- **`MAP_SCALE`** : la constante d'échelle de map (aujourd'hui dans `EcsScene`).

Scène, scripts et fonctions de spawn importent de là.

---

## 6. Scripts — re-découpe par responsabilité

### 6.1 Joueur : `PlayerScript` + `PlayerMovementScript` → deux scripts propres

Les deux scripts actuels lisent tous les deux `move`/`boost` et dupliquent le type `Inputs`. Re-découpe par responsabilité réelle :

- **`PlayerMovementScript`** : input `move`/`boost` → déplacement kinematic. (Conserve `onCollisionEnter` avec son `console.log` de debug.)
- **`PlayerAnimationScript`** : état de mouvement → sélection de clip (`idle`/`run`/`sprint`) + `flipX`.

Tout le setup statique de l'actuel `PlayerScript` (`setScale(3,3)`, position de spawn, `sortingOrder`, config de l'ombre : couleur/échelle/position/sortingOrder) **remonte dans `spawnPlayer`**. Le `PlayerScript` actuel disparaît en tant que script.

### 6.2 `SwordScript`

- Retirer la prop `sprite` (jamais lue).
- `scale` et `sortingOrder` appliqués dans `spawnSword`, pas dans `onCreate`.
- Le comportement (orbite, charge, lancer) reste identique.

### 6.3 Renommages de scripts

- `CameraScript` → `CameraFollowScript`.
- `MapBuilderScript` → `TileMapBuilderScript`.
- `CameraZoomScript` inchangé (déjà focalisé).

### 6.4 `controls.ts`

Le `defineActions({ move, boost, hello })` et le type `Inputs` sont dupliqués (scène + deux scripts). Un seul `controls.ts` exporte le spec et un type `DinoControls`. L'action `hello` (`Key.MouseLeft`, jamais lue) est **supprimée**.

---

## 7. `game/tiled/` — nettoyage sur place (pas d'extraction en package)

Renommé depuis `map-loader/`, dossier `map-object/` aplati (il contient layers ET tilesets, pas seulement des objets). Défauts réels à corriger au passage :

- **`TileSet.tileWidth` / `tileHeight`** : déclarés `public readonly … : number` mais **jamais assignés** dans le constructeur → `undefined` au runtime. Soit les assigner (ils sont dans `TileSetConstructorData`), soit les retirer si inutiles. → **les assigner** (le type doit dire la vérité).
- **`TileSet.firstGid = data.firstGid - 1`** puis `getId()` fait `id - 1 - this.firstGid` : deux décalages `-1` qui se compensent. Normaliser en une seule convention claire et documenter par le code (pas de commentaire).
- **`getSerializedLayer`** : ajouter le type de retour explicite `SerializedTile[]` (règle `CLAUDE.md` : toujours typer).
- **`TiledMap.tileidth`** : typo → `tilewidth`.
- **`LayerManager.addLayer`** : mort → supprimer.
- **`map-loader/Layer.ts` (`TileLayer`)** : mort, doublon de `map-object/Layer.ts` → supprimer.
- `map-object.types.ts` → `map.types.ts`, `tiled.type.ts` → `tiled.types.ts` (pluriel cohérent).

Correction de la typo `firstGid`/`getId` : c'est le seul point sensible. Elle doit être vérifiée par rendu navigateur (la map doit s'afficher pixel-identique).

---

## 8. Code mort supprimé

- `WallScript` (jamais attaché à une entité).
- `map-loader/Layer.ts` (`TileLayer`, non utilisé).
- `Window.tsx` (jamais monté).
- Action `hello` (jamais lue).
- Prop `sprite` de `SwordScript` (jamais lue).
- `LayerManager.addLayer` (jamais appelé).
- Variable mal nommée : `blueDinoSprite`/`blueDinoTexture` chargent en réalité le dino **jaune** (`ResourcesPath.Sprites.Dinos.Yellow`) → renommer conformément à l'asset réellement chargé.
- Les `.DS_Store` commités + ajout d'une règle `.gitignore` pour ne plus les suivre.

**Conservés :** les 40 sprites d'épées (`Iicon_32_*`) — serviront plus tard. Les sprites de dinos non utilisés (bleu/vert/rouge) — même raison (plusieurs joueurs à venir).

---

## 9. Vérification

Refactor sans changement de comportement, donc la vérification est un diff visuel :

1. `pnpm build` sur l'app (tsc) passe.
2. `pnpm lint` passe.
3. Vérification navigateur via le dev server (`dino-brawl`) — **redémarrage du dev server, pas HMR** (le pane WebGPU sert des scènes stales sous HMR) :
   - la map (ground + props) s'affiche identique (valide la correction `firstGid`/`getId`) ;
   - le dino spawn au bon endroit, à la bonne échelle, avec ses animations idle/run/sprint et le flipX ;
   - l'ombre est correctement placée/teintée sous le dino ;
   - l'épée orbite et se lance comme avant ;
   - la caméra suit et le zoom molette fonctionne ;
   - les arbres occluders sont aux bonnes positions et Y-triés.
4. Screenshot avant/après pour confirmer l'équivalence visuelle.

Comme les imports type-only cassent Vite au runtime sans casser tsc (`import type` obligatoire pour les symboles type-only dans les fichiers d'app), la vérif navigateur est obligatoire, pas seulement le build.

---

## 10. Ce que ce chantier prépare (mais n'implémente pas)

- **Prefab/factory** : les fonctions `spawn*` sont les futures cibles d'absorption ; elles sont volontairement locales et non génériques.
- **Data-driven Tiled** : le `tiled/` propre et le `MapObjectBuilder` (pattern evaluator déjà là) sont prêts à instancier des spawns/occluders déclarés dans la map.
- **Collisions tilemap** : `CollisionLayers` centralisé dans `config.ts` et `onCollisionEnter` déjà branché côté joueur.
- **Multi-joueurs** : `spawnPlayer(ctx, opts)` paramétrable (couleur, input map, spawn) plutôt qu'un singleton codé en dur.
