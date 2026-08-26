---
id: GAMEPLAY-98
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: S
verified: 2026-08-26
---

# `GameEntity` ignore la hiérarchie qu'il traverse pourtant déjà

L'interface `GameEntity` (`packages/gameplay/src/scripting/core/GameEntity.ts:12-21`) expose `id`, `requireComponent`, `getScript`, `destroy` et l'accès composants hérité de `ComponentAccess` — **ni parent, ni enfants, ni recherche**. La hiérarchie n'est atteignable qu'en biais, et la même classe qui refuse de l'exposer s'en sert quatre lignes plus bas : `destroySubtreeScripts` (`:108-114`) appelle `this.world.getChildren(entity)` (`:109`) pour démolir le sous-arbre. L'information est là, dans le handle, derrière un `private`.

L'autre chemin est la façade `Transform`, qui expose bien `parent` (`packages/gameplay/src/scripting/components/Transform.ts:56-62`) et `getChildren()` (`:186-199`) — mais un `Transform` ne permet pas de revenir à son entité : le symbole `ENTITY` qui porte l'id est déclaré module-privé (`:14`) et le seul accesseur, `entityOf` (`:42-44`), n'est pas exporté non plus. Naviguer la hiérarchie depuis un script mène donc à des `Transform` dont on ne peut ni lire l'`id`, ni tirer un composant autre que le transform, ni résoudre un script. C'est cohérent avec le doc de design, qui posait explicitement la découverte d'entités arbitraires hors scope (`memory/atlas/gameplay/entity-hierarchy.md:193`) — mais le prix commence à se voir.

Coût constaté dans l'app : `apps/dino-brawl/src/game/prefabs/enemy/EnemyPrefab.ts:76` passe `target: entity.entity` à `HurtReactionScript`, c'est-à-dire « mon parent », câblé à la main depuis le prefab. Le script doit en conséquence porter la relation en trois déclarations — la prop requise (`apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts:25`), le champ (`:38`) et l'entrée de métadonnées (`:174`) — pour exprimer un lien que `world.getParent` connaît déjà. Les trois usages qui suivent (`:61`, `:63`, `:153`) ne demandent rien d'autre que « l'entité au-dessus de moi ».

Piste : `readonly parent: GameEntity | undefined` et `readonly children: readonly GameEntity[]` sur `GameEntity`, plus un `protected get self(): GameEntity` sur `AtlasScript`. Le matériel existe déjà : `createGameEntity` (`GameEntity.ts:117-123`) reçoit le `world` et le `ScriptResolver`, et `RuntimeScriptContext` construit **déjà** un handle sur soi qu'il garde en champ (`packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts:23,30`) — il n'est simplement pas exposé par l'interface `ScriptContext`.

Signaler le coût dans la doc de l'API : chaque accès alloue un handle, comme `Transform.parent` aujourd'hui (`Transform.ts:56-62` construit un `TransformHandle` neuf à chaque lecture) et comme `ScriptContext.getEntity` (`RuntimeScriptContext.ts:37-39`). À capturer dans `onCreate`, jamais à appeler dans `onUpdate`. Un cache de handles par entité côté `ScriptManager` serait prématuré : le handle est un objet à trois champs sans état, et le seul cache déjà en place — le `self` de `RuntimeScriptContext` — existe parce qu'il y en a exactement un par script, pas pour éviter une allocation chaude. Tant qu'aucun profil ne montre le contraire, la règle d'usage suffit.

**Accroche :** `packages/gameplay/src/scripting/core/GameEntity.ts:108-114` — `destroySubtreeScripts` fait déjà l'appel `world.getChildren` dont l'API publique manque ; ajouter les deux accesseurs à l'interface (`:12-21`) et à `GameEntityHandle` ne demande aucune dépendance nouvelle.

**À rapprocher de :** [[GAMEPLAY-99-atlas-script-get-script]], qui bute sur la même absence côté `AtlasScript` — un `self` exposé sert les deux.
