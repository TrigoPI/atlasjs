---
id: APP-12
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Le trail de l'épée émet avant la première attaque, et plus jamais après

`SwordPrefab` construit le `TrailRenderer` de la pointe avec `emitting: true` (`apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts:76-88`, le drapeau à `:83`). `SwordScript.onCreate` (`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:78-98`) n'y touche pas : il initialise ses propres champs — horloges, échelle de base, `state`, `buffered`, `hitstopRemaining` — et laisse le composant dans l'état que le prefab lui a donné. Les deux seuls écritures du drapeau sont des **transitions** : `startAttack` l'allume (`:182`), la fin d'attaque l'éteint (`:161-164`, `:163`). L'état initial n'est donc posé nulle part.

Le défaut est **actif**, parce que l'épée bouge en état idle. `updateIdleState` (`:121-130`) la place chaque frame sur une orbite de rayon 40 autour de l'ancre (`apps/dino-brawl/src/game/spawn/spawnPlayer.ts:90`) suivant l'angle de visée (`:125`), et y ajoute un flottement sinusoïdal de ±8 px à 0,7 Hz (`:126`, `:217-220`). L'entité qui porte le trail est un enfant de l'épée décalé de `(20, -20)` (`SwordPrefab.ts:73-75`) : elle hérite de tout ce mouvement. `TrailRenderSystem` (`packages/gameplay/src/systems/TrailRenderSystem.ts:66-68`) empile un point par frame tant que `emitting` est vrai, avec un `minVertexDistance` de 3 et une durée de vie de 0,2 s (`SwordPrefab.ts:77-78`). Au lancement de la scène, avant le moindre clic, l'épée traîne donc un ruban permanent — franc quand la souris balaie l'orbite, réduit à un frémissement quand elle est immobile (le flottement seul plafonne à `8 × 2π × 0,7 ≈ 35 px/s`).

La signature visuelle est l'inverse de l'intention : le ruban existe **jusqu'à** la première attaque, puis disparaît définitivement, puisque `:163` met `emitting` à `false` et que plus rien ne le rallume hors attaque. Un joueur qui lance le jeu voit l'effet en permanence, puis ne le voit plus jamais qu'au moment des swings.

Deux corrections possibles. Poser `this.trail.emitting = false` en fin d'`onCreate` : une ligne, et le script devient le seul propriétaire du drapeau, cohérent avec le fait qu'il en est déjà le seul écrivain. Ou passer `emitting: false` dans le prefab : même résultat visuel, mais l'état initial reste porté par la construction et l'asymétrie demeure — le prochain prefab d'arme la reproduira. La première a le meilleur rapport valeur/coût.

Au-delà de ce cas, c'est la forme du bug qui compte : `onCreate` n'initialise que les champs du script, jamais les composants qu'il pilote. Tout composant écrit uniquement sur transition hérite silencieusement de ce que le prefab a posé, et la divergence ne se voit qu'à l'œil, jamais dans un test.

**Accroche :** `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:97` — juste après `this.hitstopRemaining = 0`, dans le bloc qui pose déjà tout l'état initial du script. C'est le seul endroit où l'invariant « au démarrage, on n'attaque pas » est écrit une fois.
