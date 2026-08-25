---
id: GAMEPLAY-78
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-25
---

# Trancher le sort de `getExposedFields`

`getExposedFields` (`packages/gameplay/src/scripting/core/ScriptMetadata.ts:55`) est exporté par le barrel `scripting/core/index.ts`, donc par `@atlasjs/gameplay`, et son **seul consommateur du monorepo est `packages/gameplay/test/script-metadata.test.ts`** (12 usages) — aucun appel dans `src/`, aucun dans `apps/`. `ScriptManager.injectProps` consomme directement `getScriptMetadata`, pas ce helper.

`memory/atlas/gameplay/exposed-script-variables.md:82` le décrit explicitement comme une commodité pour « les tests et les consommateurs externes (futur éditeur) », retournant une copie `Map` pour isoler l'appelant. Ce n'est donc pas du code mort par accident : c'est une API d'outillage posée en avance, dont il faut décider si on la garde en vue d'un éditeur ou si on la retire de la surface publique en attendant qu'un besoin réel apparaisse. Le paquet `editor` ayant été supprimé, personne ne la réclame aujourd'hui.

**C'est une décision produit, pas une correction.** À trancher explicitement plutôt qu'à laisser dériver.

**Note du 2026-08-25 : les deux autres points de cette note sont clos.** Elle en groupait trois à l'origine. Les points 1 et 2 (`setEnabled` inatteignable, `ScriptInstanceRecord.scriptType` jamais relu) ne sont plus valides : le commit `162b89a` a donné un vrai rôle à `isEnabled` et à `scriptType` en mettant en quarantaine les scripts qui lèvent, et un commit ultérieur a exposé `setEnabled(instance, enabled)` en surcharge plus un lecteur `isEnabled`, ce qui referme la question. Seul le point 3 reste ouvert, et il est reproduit ci-dessus.

**Accroche :** `packages/gameplay/src/scripting/core/index.ts` — soit on assume l'export public, soit on le retire et `script-metadata.test.ts` importe le symbole par son chemin de fichier.
