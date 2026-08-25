---
name: player-dash-afterimages-feature
description: "Dash joueur + AfterimageRenderer — MERGÉ dans dev le 2026-08-24 (non poussé) ; 2 pièges moteur découverts"
type: project
---

Dash du joueur (dino-brawl, touche `Shift`, frame 11 de la sheet) + `AfterimageRenderer`/`AfterimageRenderSystem` dans `@atlasjs/gameplay`. Livré le **2026-08-24** : 7 commits sur `feat/app-08-player-dash`, **mergés dans `dev`** (merge commit `9342c93`). `dev` a 8 commits locaux **non poussés** vers `origin`. `nebula` n'a pas été touché : une image rémanente est un `SpriteNode` de plus, figé et teinté.

**Ce que le repo ne dit pas et qui coûte du temps à re-découvrir :**

- **Vérifier un effet sub-seconde dans le navigateur est impossible en direct.** Un dash de 0,18 s ne survit pas au délai d'une capture, et le pane retombe à 4 fps dès qu'on le sollicite. La méthode qui marche est dans la skill `atlas-verify-webgpu` §13 : prouver les timings en unitaire, et le chemin de rendu par un A/B où on allonge **durée ET distance** (allonger la durée seule empile les copies sur l'émetteur et l'écran paraît vide).
- **Deux propriétés porteuses de `ScriptManager`** sont maintenant documentées dans `docs/gameplay/exposed-script-variables.md` §6 : le « warn jamais throw » de `injectProps` **déplace** la panne (prop manquante → throw par frame dans un `runLifecycle` sans `try/catch` → tous les scripts meurent), et l'ordre d'attache **est** l'ordre d'exécution, exploité par le dash.
- `definePrefab` est une **fonction identité** : la composition d'un prefab se teste directement contre un faux `EntityBuilder`, sans `NexusWorld`. Un implémenteur a affirmé le contraire et s'est trompé.

**Why:** les deux pièges moteur sont invisibles depuis le code, et la méthode de vérification d'un effet sub-seconde se re-découvre autrement à chaque fois.

**How to apply:** vérifié après merge sur `dev` : gameplay 303, dino-brawl 316, typecheck propre. Suites à faire : [[next-feature-collisions]] n'est pas concerné, mais GAMEPLAY-64 (arbitrage du déplacement, le knockback s'ajoute toujours au dash) est la dette la plus structurante laissée ouverte. Voir aussi [[trail-renderer-feature]], feature voisine et distincte.
