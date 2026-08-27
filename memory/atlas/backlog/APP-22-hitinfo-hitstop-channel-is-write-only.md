---
id: APP-22
status: todo
domain: app
source: "[[scoped-time-and-timers]]"
effort: S
verified: 2026-08-27
---

# Le canal `HitInfo.hitstop` n'a plus aucun lecteur, sauf ses propres tests

`MeleeHitResolver` transporte encore un hitstop jusqu'à la hurtbox : il le reçoit au constructeur (`apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts:36`), le réarme à chaque swing (`:42`), le pose sur le coup (`:53`), et `HurtboxScript` le range dans `lastHitstop` (`combat/HurtboxScript.ts:73`) pour l'exposer en `hitHitstop` (`:50-51`). Ce getter n'a **aucun appelant dans `src/`** — vérifié par grep sur tout `apps/dino-brawl/src`. Il en a **dix dans les tests** (`meleeHitResolver.test.ts` ×7, `swordScript.test.ts` ×2, `hurtboxScript.test.ts` ×2). Le canal est donc entretenu uniquement par la couverture qui le mesure.

Il est devenu inerte quand le gel est passé au moteur : `SwordScript.applyHitstop` lit `attack.impactHitstop` et appelle `TimeApi.freeze`, sans passer par la hurtbox. Le piège est qu'un `hit.hitstop` posé de bonne foi ne produira rien, et que les tests continueront de confirmer qu'il a bien été transporté.

**Accroche :** le nettoyage touche le constructeur de `MeleeHitResolver` et son `beginSwing()`, donc la signature que `SwordScript` appelle — c'est pour ça qu'il est resté hors du périmètre de la migration. Décider d'abord si le canal doit disparaître ou devenir le chemin officiel du hitstop par coup : `WeaponAttack.impactHitstop` (`attacks/WeaponAttack.ts:52`) le double aujourd'hui.

**À rapprocher de :** [[APP-05-per-attack-camera-shake]], qui suppose un hitstop paramétrable par attaque et devra trancher le même doublon.
