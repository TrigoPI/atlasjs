---
id: GAMEPLAY-76
status: todo
domain: gameplay
source: "[[scripting-components]]"
effort: S
verified: 2026-08-25
---

# `ScriptManager.dispose()` ne détruit aucun script

`packages/gameplay/src/scripting/runtime/ScriptManager.ts:186-188` se contente de `this.unsubscribeHost()`. Les maps `records` / `recordsByEntity` conservent chaque instance de script — et via `RuntimeScriptContext`, une référence au `world` et au `ServiceRegistry`. **Aucun `onDestroy` n'est appelé** : toute ressource externe libérée dans un `onDestroy` utilisateur fuit au rechargement de scène ou en HMR. `dispose()` est pourtant appelé par `GameplayPlugin.uninstall()` (`src/GameplayPlugin.ts:396`), qui est le seul appelant du paquet.

Effet secondaire visible côté tests : `test/entity-prop-injection.test.ts:68` et `test/script-metadata-validation.test.ts:44` créent un **second** `ScriptManager` sur le même world déjà équipé par `createHarness` (donc un second abonnement `onRemove(ScriptHost)`) qui n'est jamais disposé. Correctif : itérer `records`, appeler `onDestroy?.()` sur les records `isCreated && !isDestroyed`, `__unbindContext()`, puis vider les deux maps et les deux files (`pendingCreate`, `pendingDestroy`) — la logique existe déjà dans `flushDestroys` (`:285-316`), il s'agit de la factoriser.

**Accroche :** `ScriptManager.ts:186-188`, en réutilisant le corps de `flushDestroys` (`:285-316`).
