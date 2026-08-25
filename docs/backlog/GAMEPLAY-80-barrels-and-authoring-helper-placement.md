---
id: GAMEPLAY-80
status: todo
domain: gameplay
effort: S
verified: 2026-08-25
---

# Surface publique et rangement — barrels incomplets et helper d'authoring mal placé (note groupée)

Les barrels ne permettent plus de déduire ce qui est public. (a) `src/components/index.ts` liste 19 composants mais **pas `OccluderStrip`** : c'est `src/index.ts:16` qui l'exporte ad hoc et `GameplayPlugin.ts:60` qui l'importe hors barrel. (b) `src/index.ts:17-22` exporte `OccluderRenderSystem` + `bakeOccluderStrips` alors qu'**aucun** des 12 autres systèmes (`src/systems/index.ts`) n'est public — `src/index.ts` n'exporte pas le barrel `./systems`. (c) `src/components/index.ts:13` exporte `ScriptHost`, classe marqueur vide utilisée seulement en interne par `ScriptManager.ts:5`. (d) `src/prefab/index.ts:2` exporte `PrefabEntityBuilder` (`src/prefab/EntityBuilder.ts:23`), l'implémentation, à côté de l'interface `EntityBuilder` (`:14`). Le bon patron existe déjà dans le paquet : `src/scripting/runtime/index.ts` n'exporte que le module `ScriptManager`, ni `RuntimeScriptContext` ni `IncrementalScriptIdGenerator`. **Attention** : `OccluderStrip`, `OccluderRegion`, `OccluderStripData` et `bakeOccluderStrips` sont réellement consommés par `apps/dino-brawl/src/game/tiled/ingestOccluders.ts:4,10-15` — ce ne sont pas des fuites, c'est le barrel de dossier qui ment.

Second volet, le rangement : `src/systems/utils/bake-occluder-strips.ts` est un outil d'**authoring** exécuté une fois au chargement de carte (aucun système du paquet ne l'appelle ; ses seuls appelants sont l'app et deux tests), rangé à côté de `tilemap-geometry.ts` qui est, lui, un util de système chaud — il a sa place dans `src/rendering/` ou un `src/authoring/`. Au passage, dans ce fichier : deux closures (`instanceAt` `:35`, `rowTiles` `:65`) réallouées à chaque appel, et `tiles.push(...rowTiles(cy))` (`:81`) qui étale une rangée entière en arguments.

**Accroche :** `src/index.ts:16-22` — les quatre exports ad hoc y sont regroupés, c'est le point d'entrée le plus court.
