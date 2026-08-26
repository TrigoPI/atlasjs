---
id: GAMEPLAY-99
status: todo
domain: gameplay
effort: S
verified: 2026-08-26
---

# Un script ne peut pas atteindre un script voisin sur sa propre entité

`AtlasScript` expose `entityId` (`packages/gameplay/src/scripting/core/AtlasScript.ts:47`), `getEntity` (`:51`), `instantiate` (`:55`), `destroy` (`:59`), `getService` (`:63`) et l'accès composants (`:69-102`). Pas de `getScript`. `GameEntity` en a un (`packages/gameplay/src/scripting/core/GameEntity.ts:18`), mais il faut un handle pour l'atteindre : le seul chemin est `this.getEntity(this.entityId).getScript(X)`, qui alloue au passage un `GameEntityHandle` neuf (`packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts:37-39`) alors que le contexte en garde déjà un sur soi en champ privé (`:23,30`). Personne dans `apps/dino-brawl` ne l'écrit : les trois appels à `getScript` de l'app portent tous sur une entité **étrangère** — l'ancre du joueur (`src/game/scripts/weapon/SwordScript.ts:232`, `src/game/scripts/weapon/SwordSortingScript.ts:47`) ou une cible touchée (`src/game/scripts/combat/MeleeHitResolver.ts:53-54`).

Sur sa propre entité, l'app contourne par le prefab. `apps/dino-brawl/src/game/prefabs/player/PlayerPrefab.ts:82-85` attache `PlayerDashScript`, garde l'instance, et la repasse en prop à `PlayerAnimationScript` (`:87`) puis à `PlayerMovementScript` (`:89-93`) — deux props requises (`scripts/player/PlayerAnimationScript.ts:19,84` et `scripts/player/PlayerMovementScript.ts:19,65`) pour exprimer « le script de dash de mon entité ».

Le commentaire qui accompagne l'attache (`PlayerPrefab.ts:81`) est le vrai signal : il justifie l'ordre par le fait que `ScriptManager` exécute les scripts dans l'ordre d'insertion. C'est exact, et c'est un détail d'implémentation non déclaré. `runLifecycle` itère `this.records.values()` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:307`), une `Map` clé par `ScriptID`, et les `ScriptID` sont attribués par un compteur strictement croissant (`packages/gameplay/src/scripting/runtime/IncrementalScriptIdGenerator.ts:10-13`) au moment de l'`attach` (`ScriptManager.ts:90,98`). L'ordre d'exécution est donc l'ordre d'attache — pour toutes les entités confondues, la `Map` étant globale. Et il se décale : `tearDownScript` supprime la clé (`:392`), donc un script détruit puis ré-attaché reçoit un id neuf et repart **en fin** de `Map`, derrière tous les autres. Le jeu est correct aujourd'hui parce que le prefab attache dans le bon ordre et que rien ne détruit un script isolément.

Piste : `getScript<T>(type)` et `requireScript<T>(type)` sur `AtlasScript`, délégant au `ScriptResolver` déjà tenu par `RuntimeScriptContext` (`:22,29`) et déjà utilisé par `GameEntityHandle.getScript` (`GameEntity.ts:99-101`). Une méthode de plus sur `ScriptContext`, une sur `AtlasScript`, zéro plomberie nouvelle.

L'argument de sûreté tient : `attach` empile le script dans `pendingCreate` (`ScriptManager.ts:110`) et `onCreate` n'est appelé qu'au premier `flushCreates` (`:326-349`), lui-même déclenché en tête de `runLifecycle` (`:305`). Quand `onCreate` s'exécute, le prefab entier est donc construit et tous ses scripts sont attachés — la résolution y est sûre, contrairement au constructeur, qui court pendant `attach` (`:73`) avant même que le contexte soit lié.

Il faut dire explicitement ce que ça ne résout **pas** : l'ordre d'exécution. Un `getScript` rend la référence obtenable sans passer par le prefab, mais `PlayerAnimationScript` continuera de lire un `isDashing` calculé dans la même frame **seulement si** `PlayerDashScript` tourne avant lui. La dépendance change de forme — elle cesse d'être un argument de prefab et redevient une dépendance de phase — mais elle ne disparaît pas. C'est un sujet à part.

**Accroche :** `packages/gameplay/src/scripting/core/ScriptContext.ts:9-18` — l'interface est la seule chose à élargir ; `RuntimeScriptContext` a déjà le résolveur et le handle sur soi, et `AtlasScript` ne fait que déléguer.

**À rapprocher de :** [[GAMEPLAY-98-game-entity-hierarchy-navigation]], qui propose d'exposer ce même handle sur soi, et [[GAMEPLAY-100-script-lifecycle-enable-late-update]], qui traite le versant « ordre d'exécution » laissé ouvert ici.
