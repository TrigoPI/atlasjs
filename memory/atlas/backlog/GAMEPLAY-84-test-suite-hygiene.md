---
id: GAMEPLAY-84
status: todo
domain: gameplay
effort: S
verified: 2026-08-25
---

# Hygiène de la suite de tests — harness sans teardown et bootstrap recopié

`packages/gameplay/test/helpers/harness.ts:32-40` : le type `Harness` ne renvoie **ni `dispose` ni `stop`**, donc le moteur démarré en `:69` n'est jamais arrêté — 30 moteurs s'accumulent sur une run. Le nettoyage est manuel (`h.physics.clear()`) et **incohérent** : sur les 30 fichiers qui appellent `createHarness`, 22 l'ont, 8 non.

Séparément, il manque un `helpers/render-harness.ts` : un couple `setup()` + `mount()` quasi identique (NexusWorld + `SceneGraph` + faux `NebulaRenderer`) est recopié dans **7 fichiers** — `sprite-render-system`, `tilemap-render-system`, `tilemap-rebuild-gate`, `occluder-render-system`, `trail-render-system`, `afterimage-render-system`, `sorting-layers-integration` (`new SceneGraph()` ×7 hors harness, `as unknown as NebulaRenderer` ×11) — et `determinism.test.ts:18-38` réimplémente en plus le bootstrap moteur complet (classe `Provide` + `fakeNebula` + stubs inertia/audio) que `harness.ts` fournit déjà. Trois fichiers caméra (`camera-manager`, `camera-api`, `camera-sync-system`) définissent chacun leur propre helper local `fakeNebula`, distinct des deux précédents. Enfin `vitest.config.ts` n'a aucun bloc `coverage`.

À noter au crédit de la suite : aucun `Math.random`, `Date.now`, `performance.now` ni `setTimeout` dans `src/` ni `test/` — il n'y a pas de source de non-déterminisme à traiter ici.

**Accroche :** `test/helpers/harness.ts:32-40` — ajouter `dispose()` au type `Harness` d'abord, le reste (`render-harness`, dédoublonnage de `determinism`) suit.
