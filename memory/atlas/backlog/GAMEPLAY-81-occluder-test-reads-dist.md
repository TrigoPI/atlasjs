---
id: GAMEPLAY-81
status: todo
domain: gameplay
source: "[[occluder-ysort]]"
effort: S
verified: 2026-08-25
---

# Un test lit `dist` et valide une classe qui n'est pas celle du plugin

`packages/gameplay/test/occluder-plugin.test.ts:4` est le **seul fichier de toute la suite** à importer `@atlasjs/gameplay` au lieu de `../src` — il résout donc vers le `dist` du paquet. Deux conséquences. (a) La suite n'est pas hermétique : elle échoue sur un checkout propre sans `dist` bâti, et passe sur un `dist` périmé. (b) Le `OccluderStrip` du dist est une **classe différente** de celle que `GameplayPlugin` a définie — le harness (`test/helpers/harness.ts:8`) importe le plugin depuis `../../src`, qui référence `./components/OccluderStrip` : `addComponent` (`:25`) enregistre donc silencieusement un second type que `OccluderRenderSystem` ne verra jamais, `NexusWorld.addComponent` faisant un `getOrCreateStore` sans assertion (`packages/nexus/src/world/NexusWorld.ts:279-294`) — et le `not.toThrow()` du test masque exactement ça. Le premier test, `expect(typeof OccluderStrip).toBe("function")` (`:10`), est par ailleurs tautologique.

Correctif : importer depuis `../src`, et remplacer les deux assertions creuses par une vraie — un strip monté produit un `SpriteNode` de `sortPrimary === footY`.

**Accroche :** `test/occluder-plugin.test.ts:4` — changer l'import, puis réécrire les deux `it` (`:9-12` et `:14-27`).
