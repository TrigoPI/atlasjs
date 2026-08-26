---
id: APP-21
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Le garde `audio === undefined` de `PlayerDashScript` est inatteignable

`PlayerDashScript` déclare `private audio?: AudioApi` (`apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts:47`), le résout en `onCreate` (`:73`, `this.audio = this.getService(AudioApi)`), puis se garde contre son absence avant de jouer le son de dash (`:176`, `if (this.audio === undefined || this.woosh === undefined)`).

La première moitié de ce garde ne peut jamais être vraie. `getService` passe par `ServiceRegistry.get` (`packages/core/src/public/engine/ServiceRegistry.ts:20-27`), qui **lève** quand le token n'est pas fourni au lieu de rendre `undefined` — et `ScriptService` résout son backend dans son constructeur, donc l'échec arrive à la construction de la façade, pas à la lecture du champ. Deux issues seulement : `onCreate` lève et le script part en quarantaine, ou `this.audio` est défini. Le champ optionnel et son garde décrivent un troisième état que le runtime ne produit pas.

Repéré en migrant `playerDashScript.test.ts` vers `createScriptHarness` : l'ancien `FakeContext` local rendait `undefined` pour un service absent, ce qui fabriquait silencieusement cet état impossible et faisait passer une assertion (« dashes silently when no audio service is available ») sur une fiction. `StubScriptContext` lève désormais, comme le runtime ; la spec rend l'intention explicite en enregistrant le couple `AudioApi` / `undefined` dans la table de services, ce qui garde l'assertion vivante tout en montrant au point d'appel qu'on simule quelque chose que le moteur ne fait pas.

Deux façons de refermer, à départager. Soit rendre le champ non optionnel (`private audio!: AudioApi`) et retirer la moitié morte du garde — le plus honnête, et ça fait dire au type ce que le runtime garantit ; l'appel `playOneShot` reste protégé par `woosh === undefined`, qui est une prop réellement optionnelle. Soit décider que l'audio *doit* être facultatif pour ce script, ce qui demande un `getService` non levant côté moteur — ce que [[GAMEPLAY-88-script-service-missing-token-message]] n'offre pas et n'envisage pas. La première est le bon rapport valeur/coût ; la seconde n'a de sens que si un jour un jeu doit tourner sans `AudioPlugin`.

À vérifier au passage : `HurtReactionScript.ts:64` et `WeaponAttack.ts:56` résolvent `AudioApi` de la même façon et méritent le même examen.

**Accroche :** `apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts:47` — c'est l'optionnalité du champ qui rend le garde plausible ; la retirer fait tomber le reste tout seul.

**À rapprocher de :** [[GAMEPLAY-88-script-service-missing-token-message]], qui traite du message d'erreur de ce même chemin — le fait que `getService` lève y est acquis, ce qui est exactement ce qui rend le garde d'ici mort.
