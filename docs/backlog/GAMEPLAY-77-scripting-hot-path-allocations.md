---
id: GAMEPLAY-77
status: todo
domain: gameplay
source: "[[scripting-components]]"
effort: S
verified: 2026-08-25
---

# Allocations évitables sur les chemins chauds du scripting (note groupée, trois points)

1. **`createTransform` mint 16 objets par appel** — `src/scripting/components/Transform.ts:63-191` construit un littéral d'objet portant 5 propriétés à accesseurs (`parent`, `worldPosition` en lecture seule ; `position`, `rotation`, `scale` en get+set, soit 8 fonctions d'accès) et 7 méthodes, donc 15 fonctions fraîches + 1 objet par mint, alors que l'état utile est `(world, entity)`. À dire honnêtement : l'impact par frame est **plus faible qu'il n'y paraît** — sur les 11 sites d'acquisition d'un `Transform` dans `apps/dino-brawl`, 6 cachent le handle dans un champ en `onCreate`. Les chemins réellement chauds sont `getChildren()` (`:178-187`) et le getter `parent` (`:67-72`), qui mintent un handle **par élément à chaque appel**, plus `CameraFollowScript.ts:24` qui refait `this.target.requireComponent(Transform)` à chaque `onUpdate`. Correctif : convertir en `class TransformHandle` avec `(world, entity)` en champs et les méthodes sur le prototype — l'invariant « façade sans état, re-résolution à chaque accès » est intégralement préservé.
2. **`getScriptMetadata` non mémoïsé** — `src/scripting/core/ScriptMetadata.ts:27-53`, appelé depuis `ScriptManager.ts:218` (`injectProps`) à chaque `attach`, donc à chaque script de chaque prefab instancié (projectiles, FX). Il remonte la chaîne de prototypes et fait une copie `{...}` par champ exposé (`:48`), pour un résultat pourtant invariant par constructeur. Correctif : une `WeakMap<Function, ScriptMetadata>` de résultats fusionnés — distincte du `REGISTRY` existant (`:18`) — **avec invalidation depuis `registerScriptMetadata` (`:20-25`)** ; sans quoi un `registerScriptMetadata` appelé après un premier `attach` (cas HMR) servirait des métadonnées périmées.
3. **`getScriptsByEntity` alloue un tableau par appel** — `ScriptManager.ts:149-171`, appelé depuis `src/systems/PhysicsCollisionSystem.ts:49` **deux fois par paire de contact** (`:35-36`, une par sens), à chaque événement de collision de chaque sous-pas fixe. Le tableau est le plus souvent vide (`if (scripts.length === 0) return;` juste après, `:51`). Correctif : une variante sans allocation (`forEachScript(entityId, visitor)`), et court-circuiter d'abord sur `recordsByEntity.get(entityId)?.size`.

Aucun des trois n'a été mesuré au profileur : à traiter en lot, après chiffrage.

**Accroche :** `Transform.ts:63-191` porte le gros du volume ; `ScriptMetadata.ts:27-53` est le correctif le plus court.
