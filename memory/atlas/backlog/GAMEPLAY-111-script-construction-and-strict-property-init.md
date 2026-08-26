---
id: GAMEPLAY-111
status: vision
domain: gameplay
source: "[[exposed-script-variables]]"
effort: L
verified: 2026-08-26
---

# La forme d'un script force l'app à désactiver `strictPropertyInitialization`

`apps/dino-brawl/tsconfig.app.json` déclare `"strict": true` (`:20`) puis rouvre une brèche : `"strictPropertyInitialization": false` (`:26`). Ce n'est pas un choix de confort local, c'est la conséquence mécanique de deux décisions de l'API de scripting.

**(a) Un script se construit sans argument.** `ScriptConstructor<T> = new () => T` (`packages/gameplay/src/scripting/core/core-types.ts:6-7`), et `ScriptManager.attach` fait `new ScriptType()` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:73`) *avant* de lier le contexte (`:81`) puis d'injecter les props (`:82`, implémenté en `:246-285`). Les champs qui reçoivent des props ne peuvent donc pas être initialisés au constructeur : ils sont écrits de l'extérieur, après coup. C'est visible sur `SwordScript`, dont six champs `readonly` déclarés `:38-43` (`playerAnchor`, `radius`, `angleOffset`, `attack`, `hitbox`, `trail`) n'ont aucun initialiseur parce qu'`injectProps` les remplit.

**(b) Les composants et services se récupèrent dans `onCreate`, pas au constructeur.** Le contexte n'est pas encore lié quand le constructeur tourne, donc `requireComponent` et `getService` ne sont utilisables qu'ensuite. `PlayerDashScript` déclare ainsi `character`, `sprite`, `dash`, `move` sans valeur (`apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts:45-50`) pour les affecter dans `onCreate` (`:67-76`). `SwordScript` en cumule les deux causes : au-delà des six props, quinze champs supplémentaires sont déclarés nus (`:53-76`) et remplis dans `onCreate` (`:78-98`). `MovementEmitterScript` pousse le motif plus loin encore, avec des champs `protected` non initialisés dans la classe de base que la sous-classe surcharge avec valeur (`apps/dino-brawl/src/game/scripts/player/MovementEmitterScript.ts:22-26` contre `RunningParticleSpawnerScript.ts:15-16`).

La conséquence qu'il faut énoncer clairement : le drapeau est **global au projet**. En le mettant à `false` pour rendre les scripts écrivables, l'app perd la vérification d'initialisation pour **tout** son code, y compris les classes qui n'ont rien à voir avec le scripting. Un champ oublié dans un `config`, un resolver, un helper de combat ne sera plus signalé. Le défaut est actif aujourd'hui, même si aucun bug connu ne s'y rattache. Un contournement local existe — écrire `declare private x: T;` pour rendre explicite « ce champ est rempli ailleurs » — mais il n'est employé nulle part dans `dino-brawl` (aucune occurrence de `declare` dans `apps/dino-brawl/src`), et il ne fait que documenter l'intention : la garantie reste absente.

La piste structurelle, à poser comme direction et pas comme tâche : une fabrique `defineScript({ props, create(ctx) { … return { onUpdate } } })` où props, composants et services seraient tous disponibles à l'intérieur d'une seule closure. Les champs deviendraient des `const` locaux, initialisés au moment où ils sont lisibles, et la classe de problème disparaîtrait — le drapeau pourrait remonter à `true`. Mais ce serait une **seconde forme d'écriture de script** à faire cohabiter avec l'héritage d'`AtlasScript`, qui porte aujourd'hui tout le cycle de vie (`packages/gameplay/src/scripting/core/AtlasScript.ts:20-27`), la surface `getComponent`/`addComponent`/`getService`, et sur lequel repose la sous-classe abstraite `MovementEmitterScript`. Deux formes veut dire deux chemins dans `ScriptManager`, deux documentations, et une question ouverte pour un éditeur futur. La décision préalable n'est pas technique : c'est de savoir si le moteur veut une forme ou deux.

Deux correctifs ciblés sur le même mécanisme d'injection ont déjà été livrés : `injectProps` ne laisse plus une prop `undefined` écraser un défaut de classe, et `registerScriptMetadata` est typé sur `PropsOf<TScript>`, ce qui rend les clés inconnues et les mauvais *kinds* détectables à la compilation. Ils assainissent le contrat des props sans toucher à la forme de construction — c'est précisément ce qui reste ouvert ici.

**Accroche :** `packages/gameplay/src/scripting/runtime/ScriptManager.ts:73-82` — les dix lignes qui contiennent tout le problème : construction sans argument, liaison du contexte, injection des props, dans cet ordre. Toute proposition se juge à ce qu'elle fait de cette séquence.
