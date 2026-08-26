---
id: APP-02
status: todo
domain: app
source: "[cleanup](../../../apps/dino-brawl/docs/cleanup.md)"
effort: S
verified: 2026-08-21
---

# Écrans React orphelins dans `apps/dino-brawl`

`ErrorScreen`, `LoadingScreen` et `MenuScreen` (`apps/dino-brawl/src/app/`) ne sont plus référencés depuis que la state machine loading/menu/error a été retirée de `App.tsx` : leur JSX était commenté et les imports faisaient échouer le typecheck. Reste à trancher — les rebrancher derrière un vrai état d'app, ou supprimer les trois composants.

**Accroche :** `GameCanvas` accepte déjà `onReady`/`onError` en props optionnelles, c'est le point d'attache si on rebranche.
