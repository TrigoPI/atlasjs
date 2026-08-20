---
id: APP-01
status: todo
domain: app
effort: S
verified: 2026-08-19
---

# Dette de typecheck dans `apps/dino-brawl`

`pnpm exec tsc --noEmit -p tsconfig.app.json` échoue aujourd'hui (un `tsc --noEmit` nu ne vérifie rien dans cette app) pour deux raisons indépendantes. D'une part, du code mort dans `src/app/App.tsx` : une state machine loading/menu/error abandonnée dont les imports (`ErrorScreen`, `LoadingScreen`, `MenuScreen`) et l'état (`status`, `errorMessage`, `handleProceed`, `handleStart`) ne sont plus lus, le JSX correspondant étant commenté. D'autre part, un vrai bug de type dans `src/game/scripts/player/RunningParticleSpawnerScript.ts:50` : l'appel `this.instantiate(this.runningParticlePrefab, { position })` omet le prop `owner`, désormais requis par `RunningParticlePrefabProps` (`apps/dino-brawl/src/game/prefabs/fx/RunningParticlePrefab.ts:25-28`).
