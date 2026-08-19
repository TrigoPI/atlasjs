# Documentation AtlasJS

> Fichier **généré** par `pnpm docs:index`. Ne pas éditer à la main.

Le backlog vit dans [`backlog/`](backlog/) — **77** items ouverts, index dans [`backlog/_index.md`](backlog/_index.md).

Les plans d'implémentation en cours vivent dans [`plans/`](plans/) et sont **transitoires** : ils sont supprimés à la clôture de la feature (`/atlas-done`).

## racine

| Document | Statut |
| --- | --- |
| [2026-08-19-docs-reorganisation-design.md](2026-08-19-docs-reorganisation-design.md) | design validé, à implémenter. |
| [backlog.md](backlog.md) | Convention de statut : 📋 non implémenté (design validé, à faire) · 🔶 partiel (commencé,  |

## assets

| Document | Statut |
| --- | --- |
| [asset-system.md](assets/asset-system.md) | implémenté (Tasks 1–7, branche claude/feat/asset-manager). Définit ce qu'est un « asset »  |

## core

| Document | Statut |
| --- | --- |
| [nexus-ecs.md](core/nexus-ecs.md) | implémenté (phases 0→7 + migration gameplay terminées). Document de design + suivi. Voir l |
| [scheduling.md](core/scheduling.md) | implémenté — phases 0 à 8 + vitest terminées, y compris la Phase 3 (Physics dt), livrée au |

## debug

| Document | Statut |
| --- | --- |
| [gizmos.md](debug/gizmos.md) | implémenté (v1). Les extensions V2 sont dans [../backlog.md](../backlog.md) § Debug — Gizm |

## gameplay

| Document | Statut |
| --- | --- |
| [animation-events.md](gameplay/animation-events.md) | implémenté. Ajoute trois events au composant Animator : started, finished, loop. Extension |
| [audio-variation.md](gameplay/audio-variation.md) | design validé, non implémenté. Suite du [système audio v1](audio.md). Ajoute le bouton pit |
| [audio.md](gameplay/audio.md) | implémenté. Backend @atlasjs/audio (AudioEngine/AudioLoader/AudioPlugin) + intégration gam |
| [camera.md](gameplay/camera.md) | ✅ implémenté (cœur ; extensions V2 → [../backlog.md](../backlog.md) § Gameplay — Caméra).  |
| [entity-hierarchy.md](gameplay/entity-hierarchy.md) | implémenté. Attacher des sous-entités à une entité parent façon Unity : au niveau scène (E |
| [exposed-script-variables.md](gameplay/exposed-script-variables.md) | ✅ implémenté. Donne à la voie scripting un mécanisme d'injection de dépendances dans les s |
| [gameplay-redesign.md](gameplay/gameplay-redesign.md) | implémenté (phases 0→6 terminées). Document de design + suivi. Voir la checklist en bas. |
| [input-scripting.md](gameplay/input-scripting.md) | implémenté (les deux phases livrées). |
| [occluder-ysort.md](gameplay/occluder-ysort.md) | ✅ implémenté & vérifié navigateur (mergé sur dev). |
| [prefab-multi-entity.md](gameplay/prefab-multi-entity.md) | ✅ implémenté. |
| [prefab.md](gameplay/prefab.md) | ✅ implémenté (shippé sur dev). |
| [scripting-components.md](gameplay/scripting-components.md) | implémenté. État final de la saga d'unification de l'accès composant côté script. Ce docum |
| [sprite-animation.md](gameplay/sprite-animation.md) | implémenté. Câble l'animation de sprite dans la voie gameplay : un composant Animator (cli |
| [tilemap.md](gameplay/tilemap.md) | ✅ implémenté (mergé sur dev). Extensions reportées : [../backlog.md](../backlog.md) § Game |

## physics

| Document | Statut |
| --- | --- |
| [character-controller.md](physics/character-controller.md) | implémenté, mergé dans dev. Contrat CharacterController dans @atlasjs/inertia, backend Rap |
| [collision-layer.md](physics/collision-layer.md) | implémenté (Phase 1), mergé dans dev. CollisionLayers (membership/filtre nommés) dans @atl |

## rendering

| Document | Statut |
| --- | --- |
| [canvas-resize.md](rendering/canvas-resize.md) | implémenté. Renderer.resize(w, h) en pixels logiques (CSS), backing store physique × devic |
| [material-graph.md](rendering/material-graph.md) | design cadré, non implémenté. Document de vision. |
| [renderer-architecture.md](rendering/renderer-architecture.md) | implémenté (6 phases 0→5 + dirty-flag + tint/blend par sprite). Durcissement post-refactor |
| [shaders-materials.md](rendering/shaders-materials.md) | implémenté (4 phases livrées + correctif versioning). Reste des pistes futures (plugin Vit |
| [shapes.md](rendering/shapes.md) | implémenté (backlog A1 clos). Le plan d'exécution détaillé (anciennement shapes-primitives |
| [sort-point-anchor.md](rendering/sort-point-anchor.md) | 📋 design validé, non implémenté. Extension ciblée de [sorting-layers.md](sorting-layers.m |
| [sorting-layers.md](rendering/sorting-layers.md) | 📋 design validé, non implémenté. Chantier transverse (touche le sort de @atlasjs/nebula + |
| [sprites.md](rendering/sprites.md) | implémenté. Refonte du système de rendu de sprite du package @atlasjs/gameplay, avec intro |

