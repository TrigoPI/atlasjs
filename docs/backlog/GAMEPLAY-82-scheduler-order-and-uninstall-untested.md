---
id: GAMEPLAY-82
status: todo
domain: gameplay
effort: M
verified: 2026-08-25
---

# L'ordonnancement du scheduler et `uninstall()` ne sont couverts par aucun test

`GameplayPlugin.registerSteps` (`packages/gameplay/src/GameplayPlugin.ts:264-388`) enregistre **15 étapes**, chacune avec son `stage` et six d'entre elles avec une contrainte `before`/`after` explicite — par exemple `gameplay:physics-collision after gameplay:physics-pull`, `gameplay:camera-sync before gameplay:sprite-render`, et une chaîne linéaire `sprite-render → tilemap-render → occluder-render → trail-render → afterimage-render` traversant les 5 systèmes de rendu. **Aucune n'est assertée nulle part** : en casser une laisse les 303 tests verts, alors que `packages/gameplay/CLAUDE.md:54` fait du scheduler « the single ordering authority ».

Même trou pour `GameplayPlugin.uninstall()` (`:390-399`) : retrait des 15 `StepHandle`, appel des 16 unsubscribers (poussés en `:123` et `:195`), `trailRenderSystem.clear()` / `afterimageRenderSystem.clear()`, `scriptManager.dispose()` — zéro test. Correctif : un test qui vérifie les contraintes d'ordre déclarées, et un test de démolition.

**Accroche :** `GameplayPlugin.ts:264-388` liste les 15 étapes et leurs contraintes ; le test de démolition démarre sur `:390-399`.

**À rapprocher de :** [[CORE-05-scheduler-step-introspection]] — l'introspection en lecture des étapes est ce qui rendrait le premier test simple à écrire.
