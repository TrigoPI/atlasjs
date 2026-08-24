# Plan — Dash du joueur + AfterimageRenderer

Transitoire. Supprimé par `/atlas-done` à la clôture.

Tickets : [`RENDER-19`](../backlog/RENDER-19-afterimage-renderer.md) (renderer) et [`APP-08`](../backlog/APP-08-player-dash.md) (dash).
Design de référence : [`docs/rendering/afterimages.md`](../rendering/afterimages.md). **Il est la source de vérité** : en cas d'écart entre ce plan et le design, le design gagne.
Branche : `feat/app-08-player-dash`.

## Global Constraints

Contraintes qui lient **toutes** les tâches.

- **Ne jamais committer.** L'humain relit et committe chaque tâche lui-même. Laisser les changements non stagés.
- **Tout typer, même trivialement** : paramètres de fonction, variables locales, champs de classe. Convention du repo, sans exception.
- **Aucun commentaire ajouté** dans le code, sauf ligne d'intention courte là où le repo en a déjà (`/** … */` à la `ImpactScript`).
- **`import type`** pour tout symbole utilisé uniquement comme type dans les fichiers d'app et de scripts (`verbatimModuleSyntax: true`). Les valeurs runtime (composants, tokens, `Vec2`) restent en import normal.
- **TDD** : test qui échoue d'abord, puis implémentation. Les tests vivent dans `test/` du package, en miroir de `src/`.
- **Zéro allocation dans les chemins par frame** : pas de `new` dans une boucle de mise à jour, pas de littéral objet/tableau intermédiaire. Utiliser des scratchs pré-alloués, comme `SpriteRenderSystem` et `TrailRenderSystem`.
- **Pas de dépendance nouvelle, pas d'abstraction partagée nouvelle** au-delà de ce que le design décrit.
- **`nebula` ne bouge pas.** Aucun fichier de `packages/nebula` ou `packages/nebula-webgpu` ne doit être touché par ce plan.
- **Valeurs exactes** : toute constante numérique ou chaîne apparaît dans le brief de la tâche. Les reprendre **verbatim**, ne pas les arrondir ni les « améliorer ».
- Rapporter les tests avec la commande lancée et sa sortie. Ne jamais annoncer un test vert sans l'avoir lancé.

## Task 1: Composant `AfterimageRenderer` + `AfterimageRenderSystem` + enregistrement plugin

Réalise `RENDER-19`. Package : `@atlasjs/gameplay`. Lire [`docs/rendering/afterimages.md`](../rendering/afterimages.md) §2 à §4 et §7 — c'est la spec complète, y compris la table des défauts et la table des tests.

**Fichiers à créer**

- `packages/gameplay/src/components/AfterimageRenderer.ts`
- `packages/gameplay/src/systems/AfterimageRenderSystem.ts`
- `packages/gameplay/test/afterimage-renderer.test.ts` (composant)
- `packages/gameplay/test/afterimage-render-system.test.ts` (système)

**Fichiers à modifier**

- `packages/gameplay/src/components/index.ts` — exporter le composant
- `packages/gameplay/src/systems/index.ts` — exporter le système
- `packages/gameplay/src/GameplayPlugin.ts` — câblage

**Modèles à suivre, à lire avant d'écrire**

- `packages/gameplay/src/components/TrailRenderer.ts` — forme du composant : options optionnelles, défauts par `??`, canal `command`, `clear(): this`.
- `packages/gameplay/src/systems/TrailRenderSystem.ts` — squelette du système : `SparseSet<Mounted…>`, `resolveMounted`, front montant de `emitting`, traitement de `command`, `detach`, `clear`, `advanceDetached`.
- `packages/gameplay/src/systems/SpriteRenderSystem.ts` — comment un `SpriteNode` est monté, comment `flipX`/`flipY` sont repliés dans l'échelle (`scale.x * (flipX ? -1 : 1)`), comment la source rect et l'ancre viennent du `Sprite`, et la règle de recréation du nœud quand la texture change.
- `packages/gameplay/test/` — les tests existants de trail/sprite pour le style et les helpers de monde de test.

**Valeurs exactes**

Défauts du composant : `interval = 0.05`, `minDistance = 0`, `time = 0.25`, `startColor = new Color(1, 1, 1, 0.5)`, `endColor = new Color(1, 1, 1, 0)`, `emitting = true`, `maxImages = 16`, `visible = true`, `sortingLayer = "Default"`, `sortingOrder = 0`, `command = "none"`.

Bornes appliquées par le système : `maxImages` tronqué à l'entier et borné dans `[1, 64]`.

Étape de scheduler : `{ name: "gameplay:afterimage-render", stage: "PreRender", after: "gameplay:trail-render" }`, dans la voie `render`.

**Points où se tromper est facile**

- L'estampe fige l'état **monde** (`WorldTransform2D`), pas le `Transform2D` local.
- La garde `minDistance` ne remet **pas** `sinceLastStamp` à zéro quand elle bloque (design §4.2 étape 4). Une rafale de rattrapage au redémarrage est le bug à ne pas écrire, et il doit avoir son test.
- Le tri utilise la Y de **l'image**, pas celle de l'émetteur (design §4.2 étape 6).
- Le tint **remplace** celui du `SpriteRender` source, il ne le multiplie pas.
- Le front montant de `emitting` vide le buffer. Sans ça, un dash affiche les fantômes du dash précédent.
- L'interpolation de couleur ne doit pas allouer de `Color` par image et par frame.

**Vérification**

- `pnpm --filter @atlasjs/gameplay test` — toute la suite verte, pas seulement les nouveaux tests (le compte au départ est de 267).
- `pnpm --filter @atlasjs/gameplay build` — obligatoire : le package résout par son champ `exports` vers `./dist`, donc sans build les consommateurs voient l'ancienne API.
- Rapporter la commande et sa sortie.

## Task 2: `HurtboxScript.grantInvincibility()`

Ouvre le point d'accroche i-frames de `APP-09`. Application : `apps/dino-brawl`.

**Fichier à modifier**

- `apps/dino-brawl/src/game/scripts/combat/HurtboxScript.ts`

**Fichier de test**

- `apps/dino-brawl/test/game/scripts/combat/hurtboxScript.test.ts` (existe déjà — y ajouter les cas)

**Ce qu'il faut faire**

`HurtboxScript` garde `invincibilityRemaining` privé, et seul `takeHit()` l'arme (pour `invincibilityDuration`). Ajouter une méthode publique :

```ts
public grantInvincibility(duration: number): void
```

Sémantique, chaque point avec son test :

- Pendant la fenêtre accordée, `takeHit()` renvoie `false` et n'incrémente **pas** `hitCount`.
- `isInvincible` est vrai pendant la fenêtre, faux après qu'elle a été consommée par `onUpdate`.
- La fenêtre **s'étend** mais ne se **raccourcit** jamais : `grantInvincibility(d)` ne réduit pas un `invincibilityRemaining` déjà supérieur à `d`. Un dash ne doit pas écourter l'invincibilité d'un coup reçu juste avant.
- `duration <= 0` ne change rien et ne rend pas vulnérable une hurtbox déjà invincible.

Ne rien changer d'autre : pas de renommage, pas de refonte de `takeHit`.

**Vérification**

- `pnpm --filter dino-brawl test` — suite entière verte (compte au départ : 256).
- Rapporter la commande et sa sortie.

## Task 3: Clip `dash`, binding `Shift`, `PlayerDashScript`

Cœur de `APP-08`. Application : `apps/dino-brawl`. Lire [`docs/rendering/afterimages.md`](../rendering/afterimages.md) §5.

**Fichiers à modifier**

- `apps/dino-brawl/src/game/sheets/sheets/DinoSheet.ts` — ajouter le clip
- `apps/dino-brawl/src/game/controls.ts` — ajouter l'action
- `apps/dino-brawl/src/game/config.ts` — ajouter l'entrée de tri
- `apps/dino-brawl/src/game/scripts/player/index.ts` — exporter le script

**Fichiers à créer**

- `apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts`
- `apps/dino-brawl/test/game/scripts/player/playerDashScript.test.ts`

**Valeurs exactes**

- Clip : `dash: new SpriteAnimation({ frames: sheet.getManyInRange("dino_", 11, 11), fps: 1, loop: false, autoPlay: true })`. Placer l'entrée entre `hurt` et `pre_sprint`.
- Action : `dash: button().keys(Key.Shift)` dans `dinoControls`.
- Tri : `Afterimage: 7` dans `SortingOrder`, en première entrée de l'objet (sous `Shadow: 8`).
- Défauts des props du script : `distance = 220`, `duration = 0.18`, `cooldown = 0.6`.

**Contrat de `PlayerDashScript`**

Props (via `registerScriptMetadata`, sur le modèle de `PlayerMovementScript`) :

```ts
{
  distance?: number;
  duration?: number;
  cooldown?: number;
  afterimages?: AfterimageRenderer;
  woosh?: AudioClip;
  hurtbox?: HurtboxScript;
}
```

Comportement :

- Lit l'action `dash` (`ButtonAction`) et l'action `move` (`Vector2Action`) depuis `PlayerInput`, comme `PlayerMovementScript`. Requiert `CharacterController`.
- Déclenchement sur `isPressed()`, refusé si un dash est en cours ou si le cooldown n'est pas écoulé. Le cooldown se compte **depuis le début** du dash, pas depuis sa fin.
- À l'appui, la direction est capturée une fois puis **verrouillée** : `move` normalisé s'il est non nul, sinon `(-1, 0)` ou `(1, 0)` selon `SpriteRenderer.flipX`. `move` est ignoré pendant tout le dash.
- Le déplacement suit une progression normalisée : à chaque frame, `progress` avance de `dt / duration` borné à `1`, et le pas envoyé à `character.move()` est `direction * distance * (progress - progressPrécédent)`. La somme des pas sur un dash vaut donc exactement `distance`, quelle que soit la découpe des `dt` — c'est le point que le test doit épingler. Structurer le calcul pour qu'un changement de courbe reste un remplacement d'une seule expression.
- `isDashing: boolean` en getter public, vrai du déclenchement jusqu'à `progress === 1` inclus dans la frame de fin.
- Si `afterimages` est fourni : `emitting = true` au déclenchement, `false` à la fin du dash. Poser `emitting = false` dans `onCreate` pour ne pas rémaner à l'arrêt.
- Si `woosh` est fourni : un `playOneShot` au déclenchement, avec jitter de pitch, exactement sur le modèle de `HurtReactionScript.playHitSound` (`AudioApi` par `getService`, jitter `0.08`, `Math.max(0.01, …)`). Aucun son si le service ou le clip manque.
- Si `hurtbox` est fourni : `grantInvincibility(duration)` au déclenchement.
- Ne toucher ni à l'`Animator` ni à `flipX` : c'est le domaine de `PlayerAnimationScript` (Task 4).

**Tests attendus**

Cooldown (refus puis autorisation), direction capturée et verrouillée contre un `move` qui change en cours de dash, repli sur `flipX` sans input, somme des pas égale à `distance` sur des `dt` inégaux, dernier pas non dépassé (pas de sur-course sur une grosse frame), `isDashing` sur tout le cycle, `emitting` allumé puis éteint, `grantInvincibility` appelé avec la durée du dash, et absence de crash quand `afterimages`/`woosh`/`hurtbox` sont absents.

**Vérification**

- `pnpm --filter dino-brawl test`
- `pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json` — **le `-p tsconfig.app.json` est obligatoire**, un `tsc --noEmit` nu dans cette app ne vérifie rien.
- Rapporter les commandes et leurs sorties.

## Task 4: Câblage `PlayerPrefab`, `PlayerMovementScript`, `PlayerAnimationScript`

Ferme `APP-08`. Application : `apps/dino-brawl`.

**Fichiers à modifier**

- `apps/dino-brawl/src/game/prefabs/player/PlayerPrefab.ts`
- `apps/dino-brawl/src/game/scripts/player/PlayerMovementScript.ts`
- `apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts`
- `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` — passer le clip woosh

**Fichiers de test**

- `apps/dino-brawl/test/game/scripts/player/playerDashScript.test.ts` — étendre si besoin
- Ajouter la couverture du saut de mouvement et du choix de clip là où c'est testable

**Ce qu'il faut faire**

Dans `PlayerPrefab` :

- `entity.add(AfterimageRenderer, { … })` avec **exactement** ces valeurs : `interval: 0.04`, `time: 0.22`, `startColor: new Color(1, 1, 1, 0.45)`, `endColor: new Color(1, 1, 1, 0)`, `emitting: false`, `maxImages: 8`, `sortingLayer: SortingLayer.Entities`, `sortingOrder: SortingOrder.Afterimage`.
- Attacher `PlayerDashScript` **avant** `PlayerAnimationScript` et `PlayerMovementScript` — l'ordre d'attache est ce qui garantit un `isDashing` frais dans la frame (`ScriptManager` itère dans l'ordre d'insertion). Récupérer l'instance retournée par `entity.attach(...)` et l'injecter en prop dans les deux autres, sur le modèle de `EnemyPrefab` avec `hurtbox`.
- Lui passer le composant `AfterimageRenderer` retourné par `entity.add`, et le clip woosh reçu en option de prefab.

Dans `PlayerMovementScript` : nouvelle prop requise `dash: PlayerDashScript` ; `onUpdate` retourne tôt sans appeler `character.move()` quand `dash.isDashing`.

Dans `PlayerAnimationScript` : nouvelle prop requise `dash: PlayerDashScript` ; quand `dash.isDashing`, jouer `"dash"` et retourner sans toucher au reste, **sauf** `flipX`, qui doit continuer de refléter la direction du dash — sinon un dash vers la gauche affiche un dino qui regarde à droite. La direction du dash est verrouillée, donc utiliser celle-là et non `move`. Exposer ce qu'il faut sur `PlayerDashScript` pour le permettre (un getter de direction en lecture, sans copie par frame).

Dans `spawnPlayer` : passer `woosh_1` en option de `createPlayerPrefab`. Les trois clips woosh sont déjà chargés et utilisés par le combo d'épée ; réutiliser `woosh1Sound`.

**Vérification**

- `pnpm --filter dino-brawl test`
- `pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json`
- Rapporter les commandes et leurs sorties.
