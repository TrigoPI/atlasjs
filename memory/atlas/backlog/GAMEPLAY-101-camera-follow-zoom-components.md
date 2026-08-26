---
id: GAMEPLAY-101
status: todo
domain: gameplay
effort: S
verified: 2026-08-26
---

# Le moteur n'a aucun suivi de caméra, et l'app le réimplémente en dépendant du framerate

`packages/gameplay/src/camera/` tient quatre fichiers — `CameraManager.ts`, `shake.ts`, `tokens.ts` et le barrel (`index.ts:1-3`) — et ne sait faire qu'une chose côté comportement : le shake. Celui-là est de bonne facture — ressort intégré explicitement, pas de sous-pas dérivé du spec pour rester stable à n'importe quelle cadence, catch-up borné (`CameraManager.ts:84-111`). Tout le reste de `CameraManager` est de la plomberie : `setActive`/`getActive`, `screenToWorld`/`worldToScreen`. Et `CameraApi` (`packages/gameplay/src/scripting/services/CameraApi.ts:8-30`) n'expose rien de plus — quatre méthodes en tout, les deux conversions, `setMain` et `shake`. **Rien pour suivre une cible**, qui est pourtant l'effet de caméra le plus universel en 2D. Le composant `Camera` lui-même se résume à `{ zoom: number }` (`packages/gameplay/src/components/Camera.ts`).

L'app compense avec deux scripts et un câblage manuel : `apps/dino-brawl/src/game/scripts/camera/CameraFollowScript.ts` (42 lignes), `CameraZoomScript.ts` (28 lignes), assemblés dans `apps/dino-brawl/src/game/spawn/spawnCamera.ts:15-30`. Aucun des trois n'a de test — `apps/dino-brawl/test/` ne contient que `game/` et `tiled/`, sans rien sous `spawn/` ni `scripts/camera/`.

Deux défauts mesurables dans ces scripts, et ce sont eux qui motivent la promotion plutôt que la simple envie de factoriser.

**Le lissage dépend du framerate — défaut actif.** `CameraFollowScript.ts:23-35` applique un facteur `0.1` à l'écart, **par frame**, sans jamais lire `dt` : `onUpdate()` ne prend même pas d'argument. `CameraZoomScript.ts:24-26` fait exactement la même chose sur le zoom. La constante de temps du lissage est donc proportionnelle à la période de frame : à 60 fps il reste `0.9^60 ≈ 0.2 %` de l'écart après une seconde, à 30 fps il en reste `0.9^30 ≈ 4 %`. Autrement dit la caméra rattrape le joueur environ deux fois plus lentement sur une machine à 30 fps — un comportement de gameplay corrélé au matériel, sur le système qui décide de ce que le joueur voit. Le `if (offset.mag() < 0.01)` (`:30-32`) n'est pas une deadzone de design, c'est un garde-fou contre l'asymptote.

**Deux allocations par frame — défaut actif mais mineur.** `CameraFollowScript.ts:24` fait `this.target.requireComponent(Transform)` à chaque frame. `Transform` est un `ScriptComponentToken` (`packages/gameplay/src/scripting/components/Transform.ts:205`) dont `create` est `new TransformHandle(world, entity)` (`:201-203`), et `GameEntityHandle.getComponent` appelle `type.create(...)` sans cache (`packages/gameplay/src/scripting/core/GameEntity.ts:53`) : c'est donc un handle neuf par frame. Ligne `:25-28`, le `.clone()` en ajoute un second. Le handle pouvait être résolu une fois dans `onCreate` — il l'est déjà pour la caméra elle-même (`:19`), pas pour la cible.

**Piste.** `CameraFollow2D { target, damping, deadzone, offset, bounds, snap() }` et `CameraZoom { target, damping, min, max }` en composants de données, un système qui les intègre, et `CameraApi.follow(target, opts)` / `zoomTo(z, opts)` en façade scripting. La vraie valeur ajoutée n'est pas la factorisation : c'est d'exprimer le lissage en **constante de temps** plutôt qu'en facteur par frame — `1 - Math.exp(-dt / tau)`, ou le sous-pas borné que `CameraManager.advanceShake` applique déjà au ressort de shake (`:94-101`). Le moteur a donc déjà le patron chez lui, à trois fichiers de distance.

**Question ouverte à trancher : dans quelle lane.** `CameraSyncSystem` — celui qui lit le `WorldTransform2D` de la caméra active et pousse la position au renderer — est enregistré dans la lane **render**, stage `PreRender`, avant `gameplay:sprite-render` (`packages/gameplay/src/GameplayPlugin.ts:338-342`). Un système de suivi dans la lane `fixed` donnerait un lissage déterministe et indépendant de la cadence de rendu, mais il devrait attendre la propagation de transform, qui vit dans `update`/`Late` (`:315-318`). Le placer dans `update`/`Late` avant `gameplay:transform-propagation` est plus simple et suffit à corriger la dépendance au framerate dès lors que le lissage est exprimé en constante de temps. À décider avant d'écrire le système, pas après.

**Le backlog caméra existant ne recouvre pas le sujet — vérifié.** `GAMEPLAY-16` (rendu multi-caméras), `GAMEPLAY-17` (rotation), `GAMEPLAY-18` (clearColor/viewport/renderTarget par caméra), `GAMEPLAY-19` (culling masks), `GAMEPLAY-20` (mode edit↔play), `GAMEPLAY-21` (projection perspective), `GAMEPLAY-22` (scroll sous-pixel sur render target basse résolution) portent toutes sur le **rendu** ou la **projection**. Aucune ne parle de comportement de suivi. Le trou est réel.

**Accroche :** `packages/gameplay/src/camera/CameraManager.ts:104-111` — `stableShakeStep` et la boucle de sous-pas de `advanceShake` sont exactement la forme d'intégration indépendante du framerate que le suivi doit reprendre. Écrire `CameraFollow2D` à côté de `shake.ts` et faire consommer les deux par le même système évite d'inventer un second modèle temporel dans le même dossier.

**À rapprocher de :** [[GAMEPLAY-87-world-transform-one-frame-stale]] — un système de suivi lit une position monde et en écrit une autre dans la même frame, ce qui le rend directement sensible à l'ordre de la propagation de transform.
