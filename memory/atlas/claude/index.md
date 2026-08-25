# Mémoire de Claude sur AtlasJS

Ce que Claude retient de ce projet, une note par fait. Chargé au démarrage de
chaque session par `.claude/hooks/claude-memory.mjs` — **cette page seule**, pas
les notes, qui sont lues à la demande.

Corrige librement : une note fausse ici vaut une erreur répétée à chaque session.

- [[execution-cadence-preference]] — subagent-driven, one task at a time, user commits each step
- [[verify-against-committed-head]] — user edits at commit time; re-run task tests on the committed state, don't trust the reviewed diff
- [[vite-type-only-imports]] — app/script files must `import type` type-only symbols; tsc passes but Vite runtime breaks (black screen) — browser-verify
- [[run-prettier-before-staging]] — repo HAS a .prettierrc; format touched .ts/.tsx before staging (scoped, never repo-wide). But docs/*.md are NOT prettier-maintained → edit them semantic-only, do NOT reformat (tables/code churn)
- [[sandbox-browser-verify-gotchas]] — WebGPU pane slow/flaky + HMR serves stale scene; restart dev server, use a window.__scene stash to inspect nodes
- [[occluder-ysort-feature]] — implemented & browser-verified; large occluders = strips sorted by footY (Tiled `occluder_regions` rects); shares that rectangle with Phase-3 colliders
- [[next-feature-collisions]] — collision layer (Phase 1) shipped; Phase 3 world-solidity now done (see below, on a branch)
- [[world-collisions-character-controller]] — Phase-3 solidity via rapier KinematicCharacterController; merge-ready on branch feat/claude/tilemap-collision (not merged); gotchas: kinematic≠blocked, events≠solidity, Collider2D.offset not pivot
- [[prefab-instantiation-feature]] — SHIPPED to dev: definePrefab + EntityBuilder + this.instantiate/destroy; the GameEntity.destroy-only script-leak is now mitigated in-package (ScriptHost marker + onRemove, merged to dev 2026-08-08); real Nexus onEntityDestroyed signal still backlog
- [[audio-system-feature]] — SHIPPED to dev 2026-08-11: @atlasjs/audio backend (AudioEngine/AudioLoader/AudioPlugin) + gameplay integration (AudioSource/AudioSystem/AudioApi); SFX + looping music + volume; injectable SSR-safe engine (node tests, no jsdom); GameplayPlugin hard-requires AUDIO_ENGINE
- [[dino-brawl-typecheck-command]] — bare `tsc --noEmit` in the app is a NO-OP; must use `-p tsconfig.app.json`
- [[weapon-attacks-feature]] — merged in dev; declarative AttackTimeline phases + MeleeHitResolver (2026-08-21); props inject AFTER construction → build lazily; hitstop inert by default
- [[debug-gizmos-feature]] — SHIPPED to dev 2026-08-19: @atlasjs/gizmos immediate-mode collider/pivot gizmos; exposed a latent core ServiceRegistry bug; killed packages/editor
- [[docs-reorganisation]] — shipped 2026-08-19: 85 atomic backlog notes, 3 hooks, /atlas-done; never trust a status line in docs/
- [[trail-renderer-feature]] — merged to dev 2026-08-23; emission-resume must clear the ribbon; 2 reusable browser-verify techniques
- [[player-dash-afterimages-feature]] — MERGÉ dans dev le 2026-08-24 (non poussé) ; vérifier un effet sub-seconde demande un A/B exagéré ; 2 propriétés porteuses de ScriptManager documentées
- [[node-test-directory-arg]] — `node --test <dossier>` ne découvre rien sous Node 26.3 ; il charge le dossier comme un module et échoue sur un `'test failed'` trompeur — passer les fichiers ou un glob quoté
- [[pnpm-test-skips-repo-scripts]] — `pnpm test` (turbo) ne couvre que `apps/*` et `packages/*` : `scripts/` et `.claude/hooks/` doivent être lancés à la main
