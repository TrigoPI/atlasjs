---
id: GAMEPLAY-35
status: partial
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-25
---

# Déduplication des overloads `addComponent`/`getComponent`/`hasComponent`/`removeComponent`

`ComponentAccess.ts` factorise déjà le quatuor d'overloads en une interface unique, reprise par `ScriptContext` et `GameEntity`, mais les trois classes concrètes — `AtlasScript`, `RuntimeScriptContext`, `GameEntityHandle` (`GameEntity.ts`) — redéclarent encore chacune le quatuor verbatim. Reste à les faire converger sur `ComponentAccess` sans redéclaration.

`requireComponent` est un **cas à part, plus grave que la simple redéclaration** : il n'est ni dans `ComponentAccess` ni dans `ScriptContext`, seulement sur l'interface `GameEntity`. `AtlasScript` (`src/scripting/core/AtlasScript.ts:90-103`) **ré-implémente donc le garde** — `getComponent`, puis `isScriptComponentToken` pour retrouver le nom, puis `throw` — au lieu de déléguer à `GameEntityHandle` (`src/scripting/core/GameEntity.ts:75-84`), qui fait exactement la même chose. Les deux messages d'erreur divergent déjà (`[AtlasScript] …` contre `[GameEntity] …`), et une évolution du garde côté `GameEntity` ne serait pas répercutée côté script. Correctif : ajouter `requireComponent` à `ScriptContext`, l'implémenter dans `RuntimeScriptContext` par `this.self.requireComponent(...)` (le champ `self: GameEntity` existe déjà), et faire d'`AtlasScript.requireComponent` un pur passe-plat.

À préserver en révisant cet item : le *corps* du dispatch token/composant, lui, n'est bien écrit qu'une seule fois, dans `GameEntityHandle` — l'invariant documenté tient. C'est la *surface typée* qui est redéclarée, pas la logique.

Incertitude à lever avant de s'engager sur l'effort : on ne sait pas si TypeScript permet à une classe `implements ComponentAccess` (interface à overloads) de ne pas redéclarer les overloads tout en conservant la résolution de surcharge correcte au site d'appel via le type de la classe elle-même. Si ce n'est structurellement pas possible, la duplication restante serait irréductible sans changer de modèle — à vérifier par un essai de compilation avant de committer sur cet item.
