---
id: APP-18
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Deux clips joués sur la même frame dans `PlayerAnimationScript`

`PlayerAnimationScript.onUpdate` (`apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts:43-68`) enchaîne deux décisions d'animation **indépendantes**. La branche `else` de l'entrée nulle joue `idle` (`:56-59`), puis une condition séparée — un `if` autonome, pas un `else if` — teste `this.boost.isDown() && v.mag() === 0` et joue `pre_sprint` (`:61-63`). Les deux conditions sont mutuellement compatibles : entrée nulle et boost maintenu, elles s'exécutent l'une après l'autre sur la même frame.

En aval, `Animator.play` (`packages/gameplay/src/components/Animator.ts:31-43`) délègue à `AnimationPlayer.play` (`packages/nebula/src/animations/AnimationPlayer.ts:49-73`), qui, à chaque changement de nom, arrête le clip courant (`:61-63`) puis démarre le suivant (`:72`). Le couple `idle` → `pre_sprint` fait donc un aller-retour complet **à chaque frame** tant que le boost est maintenu à l'arrêt : `idle` démarré et immédiatement arrêté, `pre_sprint` redémarré depuis sa première frame, et deux signaux `started` émis par frame (`Animator.ts:38-40`, la garde `current !== previous` étant satisfaite dans les deux sens).

Aucun symptôme visuel aujourd'hui : le clip `pre_sprint` ne compte **qu'une seule frame** (`apps/dino-brawl/src/game/sheets/sheets/DinoSheet.ts:44-49`, `getManyInRange("dino_", 17, 17)`), donc le redémarrer à chaque frame affiche toujours la même image, et `idle` n'a jamais le temps d'avancer. Le défaut est donc **latent** : c'est la structure qui est fausse, pas le rendu. Il se réveille dès que `pre_sprint` gagne une deuxième frame — le clip se figera sur sa première image — ou dès qu'un consommateur s'abonne à `started` pour déclencher un effet. Le cas n'est pas couvert : `apps/dino-brawl/test/game/scripts/player/playerAnimationScript.test.ts` teste l'inactivité, la course et l'arbitrage du dash, jamais le boost maintenu à l'arrêt.

Le correctif attendu est un `else if` : `pre_sprint` est le cas d'inactivité *avec* boost, `idle` le cas d'inactivité sans. Le seul arbitrage à poser est l'ordre — `pre_sprint` doit passer avant `idle`, sinon la branche est morte.

À signaler au passage, dans le même fichier : le champ `clock` est déclaré (`:28`), initialisé (`:40`), incrémenté (`:49`) et remis à zéro (`:57`) — et **jamais lu**. Surface morte qu'un accumulateur anonyme rend invisible, et qu'un timer nommé du moteur rendrait impossible à écrire.

**Accroche :** `PlayerAnimationScript.ts:53-63` — les onze lignes contiennent le défaut entier, et le test à ajouter (boost maintenu, entrée nulle, un seul `play` par frame) se pose dans le `describe` existant de `playerAnimationScript.test.ts:130`.

**À rapprocher de :** `GAMEPLAY-96`, **livré** (voir [[scoped-time-and-timers]]) et donc sorti du backlog. Il citait le `clock` mort de ce fichier comme le cas justifiant l'API de timers ; ce champ a été supprimé à la migration, mais le défaut décrit ici — deux `play` dans la même frame — lui est indépendant et reste entier.
