---
id: GAMEPLAY-73
status: todo
domain: gameplay
source: "[[audio]]"
effort: S
verified: 2026-08-25
---

# `AUDIO_ENGINE` dur-requis alors qu'`INPUT`, dépendance équivalente, est paresseux

`packages/gameplay/src/GameplayPlugin.ts:78` met `AUDIO_ENGINE` dans `requires` et `:93` l'`await`. Conséquence : une app sans `AudioPlugin` **ne démarre pas du tout** — `Engine.resolveInstallOrder` (`packages/core/src/public/engine/Engine.ts:169-178`) lève `MissingDependencyError` depuis `boot()` (`:133`), avant tout `install`.

Or `INPUT` est utilisé de façon strictement équivalente — utile seulement si un composant donné existe dans le monde — mais **n'est pas** dans `requires` : `src/systems/PlayerInputSystem.ts:15-22` fait `services.get(INPUT)` paresseusement, **dans la boucle de query**, donc un projet sans `PlayerInput` ne touche jamais le token. Rien ne justifie l'écart, et le coût est déjà payé : `test/helpers/harness.ts:46` et `:64-66` stubbent un moteur audio pour **les 70 fichiers de test**, y compris ceux qui ne testent que du scripting.

Correctif : copier le pattern de `PlayerInputSystem` — retirer le token de `requires`, supprimer le `wait`, passer `engine.services` au lieu de `audio` au constructeur (`GameplayPlugin.ts:114`), résoudre paresseusement dans `src/systems/AudioSystem.ts`. Le mode de défaillance se déplace du boot vers le premier `play()` : plus localisé et attribuable, mais c'est un changement de contrat, donc envelopper le message de `ServiceRegistry.get`. `NEXUS`/`NEBULA_RENDERER`/`INERTIAL_ENGINE` restent durs à juste titre : ils sont consommés dès la construction des systèmes (`GameplayPlugin.ts:98-117`).

**Accroche :** `PlayerInputSystem.ts:15-22` est le patron à recopier tel quel dans `AudioSystem.update`.
