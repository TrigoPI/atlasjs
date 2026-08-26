---
id: GAMEPLAY-97
status: todo
domain: gameplay
effort: M
verified: 2026-08-26
---

# Pas d'échelle de temps par périmètre : le hitstop est réimplémenté deux fois

`TimeApi` (`packages/gameplay/src/scripting/services/TimeApi.ts:5-16`) n'expose qu'un `scale`, et ce `scale` est **global** : `Engine` l'applique au `rawDt` de la boucle (`packages/core/src/public/engine/Engine.ts:254`) avant d'alimenter les trois lanes — fixe, `update` et `render` (`:259-264`). Le commentaire du contrat le dit sans détour (`packages/core/src/public/engine/TimeControl.ts:4-8`). Il n'existe aucun moyen de ralentir un sous-arbre. Or un hitstop de mêlée doit figer l'attaquant et sa victime, pas la caméra ni les FX : mettre `scale` à 0 gèlerait aussi le shake déclenché sur le même impact (`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:156`). Conséquence logique : `TimeApi` n'a **aucun appelant** dans le monorepo, ni dans `packages/` ni dans `apps/`, et l'app a écrit son propre gel.

Deux fois, indépendamment, et de façon divergente. Côté attaquant, `SwordScript.ts:134-138` : tant que `hitstopRemaining > 0`, l'horloge d'attaque `attackClock` (`:140`) n'avance pas et la pose est ré-appliquée à l'angle de visée figé — rien d'autre n'est touché. Côté victime, `apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts:91-104` : le même décompte suspend le knockback, et met en plus l'`Animator` en pause à l'entrée (`:125-127`) puis le reprend à la sortie (`:102`). Deux gels, deux périmètres différents, une seule intention.

Les deux valeurs viennent pourtant de la même source — `SwordScript.ts:154` lit `this.attack.impactHitstop`, et le résolveur est armé avec la même valeur (`:196-198`) qui transite par `MeleeHitResolver.ts:46,60` et `HurtboxScript.ts:74` jusqu'à `HurtReactionScript.ts:123`. Rien ne garantit pour autant qu'ils démarrent sur la même frame : `HurtReactionScript` ne détecte le coup qu'en comparant `hurtbox.hitCount` dans son propre `onUpdate` (`:78-81`). Aujourd'hui la victime réagit dans la même frame **uniquement** parce que l'ennemi est instancié après le joueur et son épée (`apps/dino-brawl/src/game/ArenaScene.ts:41-53`), donc après eux dans l'ordre d'itération de `ScriptManager`. Le défaut est donc **latent** : inverser cet ordre de spawn décale la victime d'une frame par rapport à l'attaquant, et une désynchronisation de game-feel de cette taille ne se voit dans aucun test.

Un défaut **actif**, lui, existe déjà : `AttackChain.onUpdate` (`apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts:70-72`) accumule `elapsedSinceBegin` en temps réel, sans rien savoir du gel, alors que le seuil qu'il alimente (`:85-90`) est comparé à la durée d'une attaque mesurée sur l'horloge **gelée** de `SwordScript`. Un hitstop long consomme donc la fenêtre de reset du combo. C'est traité dans une note d'app séparée, mais c'est la démonstration du problème : dès qu'un gel existe sans être une propriété du moteur, tout ce qui l'ignore dérive.

Piste : un composant `TimeScale { value: number }` hérité par le sous-arbre, un `TimeApi.hitstop(seconds, scope?)`, et un `onUpdate(dt)` qui reçoit le `dt` du périmètre au lieu du `dt` brut. La question ouverte est le coût : faire porter une échelle par sous-arbre suppose de la propager racines → feuilles, exactement comme `TransformPropagationSystem` propage les matrices (`packages/gameplay/src/systems/TransformPropagationSystem.ts:18-29` pour la collecte des racines, `:42-73` pour la récursion). Le mécanisme est réutilisable tel quel — même parcours, même règle « le parent est calculé avant ses enfants » — mais il coûte une seconde passe par frame sur toute la forêt, ce qui n'est justifiable que si le composant est rare et si la passe se limite aux sous-arbres qui en portent un. À arbitrer avant de s'engager.

**Accroche :** `packages/gameplay/src/scripting/services/TimeApi.ts:5-16` — c'est la seule surface que voit un script, et c'est là que se décide si le gel est global ou porté par un périmètre. Écrire d'abord le test qui échoue : deux scripts sur deux sous-arbres, geler l'un, vérifier que l'autre continue d'avancer.

**À rapprocher de :** [[APP-05-per-attack-camera-shake]], qui suppose déjà un hitstop paramétrable par attaque, et [[GAMEPLAY-96-script-timers]], dont l'API de timers doit consommer le `dt` du périmètre plutôt que le `dt` brut.
