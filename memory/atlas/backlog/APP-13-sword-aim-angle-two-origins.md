---
id: APP-13
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# En idle, la position et la rotation de l'épée sont mesurées depuis deux origines

`updateIdleState` (`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:121-130`) calcule ses deux sorties depuis deux angles différents. La **position** vient de `getAimAngle()` (`:123`, `:227-229`), c'est-à-dire de l'angle publié par `AimScript`, mesuré depuis la position monde de l'ancre du joueur (`apps/dino-brawl/src/game/scripts/weapon/AimScript.ts:25-28`). La **rotation** vient de `getSwordRotation()` (`:129`, `:222-225`), qui refait une lecture complète via `readAimAngle` (`apps/dino-brawl/src/game/scripts/weapon/aim.ts:5-13`) en passant `this.transform.worldPosition` comme origine — l'épée elle-même. En état attaquant l'incohérence n'existe pas : `applyAttackPose` (`:168-178`) dérive la position (`:175`) et la rotation (`:176`) du même `aimAngle` calculé une fois (`:149`).

Première conséquence, **active** : la dégénérescence. L'épée orbite à 40 px de l'ancre (`apps/dino-brawl/src/game/spawn/spawnPlayer.ts:90`), donc amener le curseur sur le sprite du joueur le fait passer à quelques pixels de l'épée. `readAimAngle` construit alors un vecteur `curseur - épée` quasi nul dont l'angle (`aim.ts:12-13`, `packages/math/src/Vec2.ts:87-89`) bascule sur tout le cercle au moindre bruit sous-pixel. Le repli n'est pas `NaN` : pour le vecteur exactement nul, `atan2(0, 0)` vaut 0 et `normalizeAngle` (`Vec2.ts:3-7`) le laisse à 0, donc le sprite se colle à `π/4`. Résultat observable : la position continue d'orbiter proprement — elle, est mesurée depuis l'ancre, à 40 px du curseur — pendant que la rotation du sprite saute et jitte.

Seconde conséquence, plus discrète et permanente : `worldPosition` (`packages/gameplay/src/scripting/components/Transform.ts:72-81`) lit `WorldTransform2D`, que `gameplay:transform-propagation` publie au stage `Late` (`packages/gameplay/src/GameplayPlugin.ts:315-318`), alors que les scripts tournent au stage `Logic` (`:293-296`). L'origine lue en `:223` est donc celle de la **frame précédente**, pas celle écrite deux lignes plus haut en `:128`. La rotation retarde d'une frame sur la position — invisible à l'arrêt, visible en déplacement latéral rapide.

Le fond du problème est qu'`AimScript` publie déjà cette donnée chaque frame, depuis le même helper, et que `getSwordRotation` en est une réimplémentation locale avec une autre origine : deux sources de vérité pour une même mesure, dont une seule est honorée selon le chemin d'exécution. Le correctif naturel est d'aligner l'idle sur l'attaque — `this.transform.rotation = aimAngle + Math.PI / 4` en `:129`, exactement ce que fait `:176` quand `pose.angleOffset` vaut 0 — ce qui supprime `getSwordRotation` (`:222-225`) et rend l'import de `readAimAngle` (`:3`) inutile dans ce fichier. L'alternative — garder l'origine locale en gardant un repli sur vecteur nul — coûte plus de code pour un gain cosmétique et laisse les deux sources de vérité en place.

**Accroche :** `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:129` — la ligne qui choisit la mauvaise source. `:176` donne déjà la formule correcte à recopier.
