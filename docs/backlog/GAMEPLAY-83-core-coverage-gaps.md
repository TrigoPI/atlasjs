---
id: GAMEPLAY-83
status: todo
domain: gameplay
source: "[[scripting-components]]"
effort: M
verified: 2026-08-25
---

# Trous de couverture sur le cœur du paquet

La répartition des tests ne suit pas le risque. `ScriptManager` — le cœur du paquet — **n'a aucun fichier de test dédié** parmi les 70 fichiers de `packages/gameplay/test/` : `dispose` (0 test), `destroyById` (0), `setEnabled` (0), et la réentrance (`attach` depuis `onCreate`/`onUpdate`, qui mute la `Map` en cours d'itération de `runLifecycle`, `src/scripting/runtime/ScriptManager.ts:254-266`) : 0. `PhysicsPullSystem` n'est **jamais nommé** dans un test : le writeback de `transform.rotation` (`src/systems/PhysicsPullSystem.ts:17`), `rigidBody.velocity` (`:19`) et `angularVelocity` (`:20`) n'est jamais asserté. Les branches `Exit` des collisions (`src/systems/PhysicsCollisionSystem.ts:62` et `:68`, cas `started === false`) ne sont jamais exercées — seuls `Enter` et `TriggerEnter` le sont.

Le Y-sort **inter-systèmes** n'est testé nulle part : chaque système de rendu est testé isolément avec *sa propre* instance de `SortingLayers` (19 `new SortingLayers()` dans la suite), et `test/sorting-layers-integration.test.ts` ne monte qu'un `SpriteRenderSystem` ; rien ne fait cohabiter sprite + strip occluder + tilemap dans la même couche `ySorted`, ce qui est pourtant la promesse de la feature occluder. Enfin `TimeApi` (`src/scripting/services/TimeApi.ts`) est exporté du barrel public via `src/scripting/services/index.ts:4` avec 0 test et 0 consommateur. Le contraste qui résume le problème : 5 tests autour du seul `maxImages` d'un VFX cosmétique — troncature, clamp bas, clamp haut, `+Infinity`, rétrécissement (`test/afterimage-render-system.test.ts:402-477`, fichier de 699 lignes / 33 tests) — contre 0 fichier dédié au `ScriptManager`.

**Accroche :** créer `test/script-manager.test.ts` et attaquer par `dispose` + réentrance, les deux cas les plus proches d'un bug réel.
