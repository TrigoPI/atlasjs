---
id: GAMEPLAY-96
status: todo
domain: gameplay
effort: M
verified: 2026-08-26
---

# Aucune planification temporelle dans `AtlasScript`

`ScriptLifecycle` (`packages/gameplay/src/scripting/core/ScriptLifeCycle.ts:3-12`) déclare huit hooks, et aucun ne concerne le temps : un script qui veut attendre, répéter ou décompter n'a que `onUpdate(dt)` et un champ numérique. `AtlasScript` (`packages/gameplay/src/scripting/core/AtlasScript.ts:47-102`) n'offre rien de plus. Résultat mesuré dans `apps/dino-brawl` : **dix horloges écrites à la main dans sept scripts**, toutes sur deux patrons.

Quatre comptes à rebours (`x -= dt; if (x <= 0)`) : `scripts/player/PlayerDashScript.ts:56` décrémenté en `:101-103` (cooldown de dash), `scripts/combat/HurtboxScript.ts:25` décrémenté en `:50-56` (i-frames), `scripts/combat/HurtReactionScript.ts:58` décrémenté en `:91-104` (hitstop de la victime), `scripts/weapon/SwordScript.ts:76` décrémenté en `:134-137` (hitstop de l'attaquant). Six accumulateurs (`x += dt`) : `SwordScript.ts:101` (phase du flottement de l'arme au repos) et `SwordScript.ts:140` (horloge d'échantillonnage de la pose) — deux horloges dans le même script, `scripts/player/MovementEmitterScript.ts:46-55` (intervalle d'émission, remis à zéro à chaque tir), `scripts/weapon/attacks/AttackChain.ts:71` (fenêtre de reset du combo), `PlayerDashScript.ts:159` (progression normalisée du dash), et `scripts/player/PlayerAnimationScript.ts:49`.

Ce dernier est l'effet de bord révélateur : le champ `clock` de `PlayerAnimationScript` est déclaré (`:28`), initialisé (`:40`), incrémenté (`:49`) et remis à zéro (`:57`) — et **jamais lu**. Quatre occurrences dans le fichier, aucune lecture. C'est du code mort qui a survécu parce qu'un accumulateur anonyme ressemble à tous les autres ; un `countdown` ou un `every` nommé et rattaché à un callback aurait rendu l'oubli impossible à écrire.

Piste d'API sur `AtlasScript`, annulée automatiquement à `onDestroy` (`ScriptManager.tearDownScript`, `packages/gameplay/src/scripting/runtime/ScriptManager.ts:384-417`, est le point de nettoyage existant) :

```ts
protected after(seconds: number, cb: () => void): TimerHandle;
protected every(seconds: number, cb: () => void): TimerHandle;
protected countdown(seconds: number): Countdown;   // .remaining .elapsed .done .reset(s)
protected cancel(h: TimerHandle): void;
```

Deux points de conception à poser avant d'écrire quoi que ce soit, sans trancher ici. **Quelle lane ?** `ScriptManager.update(dt)` (`ScriptManager.ts:126-130`) et `ScriptManager.fixedUpdate()` (`:132-136`) passent tous deux par `runLifecycle` (`:300-324`), câblés par `GameplayPlugin` en deux étapes distinctes — `gameplay:script-fixed` sur la lane fixe (`packages/gameplay/src/GameplayPlugin.ts:278-283`) et `gameplay:script-update` au stage `Logic` de la lane variable (`:292-296`). Une boucle de timers se poserait naturellement en tête de `runLifecycle`, juste après `flushCreates` (`:305`), ce qui la rend automatiquement disponible sur les deux lanes — mais il faut alors décider si un timer donné tourne sur l'une, l'autre, ou les deux, sous peine de le voir avancer deux fois par frame. **Quelle horloge ?** Les timers doivent obéir à l'échelle de temps du périmètre décrit par [[GAMEPLAY-97-scoped-hitstop-timescale]] : un cooldown de dash qui continue de couler pendant un hitstop recrée exactement le bug d'`AttackChain` documenté là-bas. Poser l'API des timers avant celle du `TimeScale` reviendrait à figer le mauvais `dt` dans la signature.

**Accroche :** `ScriptManager.ts:300-324` — `runLifecycle` est le seul endroit traversé par les deux lanes, et `flushCreates`/`flushDestroys` y encadrent déjà l'itération, donc un registre de timers y trouve son point d'avancement et son point d'annulation sans toucher au reste. Commencer par lire `PlayerAnimationScript.ts:28-57` : c'est le cas qui justifie l'API à lui seul.

**À rapprocher de :** [[GAMEPLAY-97-scoped-hitstop-timescale]] — les timers ne sont utilisables qu'une fois l'échelle de temps par périmètre décidée.
