---
id: CORE-05
status: todo
domain: core
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# Introspection en lecture des étapes du scheduler

Impossible aujourd'hui d'écrire un test qui vérifie **où** une étape s'est enregistrée. `LaneScheduler` et `StepHandle` n'exposent rien des specs déjà posées, et `Harness` n'expose ni `engine` ni `scheduler`. Un test de câblage de système ne peut donc asserter que « ça ne throw pas » : renommer une étape ou changer son `after` ne casse aucun test.

Relevé en revue sur `AfterimageRenderSystem`, dont le triplet `{ name: "gameplay:afterimage-render", stage: "PreRender", after: "gameplay:trail-render" }` était épinglé verbatim par le plan et reste non vérifié. Le problème n'est pas propre à ce système : aucun des systèmes de `gameplay` n'a de test d'ordonnancement, et l'ordre entre `sprite-render`, `tilemap-render`, `occluder-render`, `trail-render` et `afterimage-render` est du contrat de rendu, pas du détail.

**Accroche :** un accesseur en lecture seule sur `LaneScheduler` (les specs résolues, ou l'ordre topologique final) suffirait, plus une exposition du scheduler par le harness de test. Le contournement écarté en revue — provoquer un `SchedulerCycleError` avec une étape sonde — teste le cycle, pas la position, et couple le test à un mécanisme d'erreur.
