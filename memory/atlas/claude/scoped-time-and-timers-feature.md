# Temps périmétré et timers de script

Livré le 2026-08-27 sur `feat/gameplay-97-scoped-time-and-timers` (non poussé), 8 commits.
Ferme `GAMEPLAY-97`, `GAMEPLAY-96` et `APP-15`. Design : [[scoped-time-and-timers]].

Le moteur a une échelle de temps héritée par sous-arbre (`TimeScale` + `TimeScaleManager`,
résolue **à la lecture** avec mémo par frame et court-circuit quand aucune entité n'en porte),
et `AtlasScript` expose `stopwatch()`/`countdown()`/`every()`/`cancel()`. Les deux hitstops
divergents et les dix horloges à la main de `dino-brawl` ont disparu.

## Ce que j'ai appris, et qui ne se relit pas dans le diff

**Un test peut décrire le bon scénario et l'exercer dans le seul ordre où le bug est invisible.**
C'est le mode de défaillance dominant de ce chantier, rencontré une dizaine de fois. Trois formes :
le test qui lit une valeur pour la première fois *après* la mutation qu'il devait détecter ; celui
qui passe avant toute implémentation pour une autre raison que celle visée (`this.every` était
`undefined`, donc `onCreate` levait, donc le script était désactivé — même observable, mécanisme
différent) ; et celui qui tombe à zéro *par accident* parce que sa pause tombe pile sur une
frontière d'intervalle. Aucun ne se voit en relisant le fichier. Tous se voient en mutant.

**Corriger du code peut rendre un test aveugle.** Ajouter une garde dans le callback du repeater a
rendu `emitter.reset()` invisible à toute la suite : l'accumulateur se drainait par des tirs à
vide. La mutation qui était tuée avant la correction passait 334/334 après. **Rejouer la table de
mutation *entière* après chaque correction**, pas seulement la ligne corrigée.

**« Le mécanisme est testé, le câblage ne l'est pas »** est revenu quatre fois : `hitstop: 0.08`
absent du contenu, `owner: entity.entity` dans le prefab, les deux replis à 1, et le sac de timers
par script. À chaque fois le mécanisme avait sa couverture et rien ne pinçait le branchement.

**Mes propres plans ont été faux huit fois**, dont deux réintroductions d'un bug que j'avais
corrigé plus tôt dans le même chantier (`Math.max(0, NaN)`). Les huit ont été trouvées **sur du
code non modifié, avant d'écrire une ligne** — en exécutant l'assertion douteuse dans node, en
comptant les tests d'un fichier, en lisant un tsconfig. Le plus coûteux aurait supprimé 15 tests
en silence sous couvert de « migrer vers `createScriptHarness` ».

**Faire vérifier mes affirmations plutôt que les faire appliquer.** Chaque implémenteur a réfuté au
moins une de mes prédictions, preuve à l'appui, et c'était systématiquement la partie la plus utile
de son rapport : un mutant que j'annonçais tué et qui était équivalent, une mutation qui ne
reproduisait pas le scénario visé, et surtout « seul le timing glisse » qui valait en réalité
−14 % de distance parcourue. Demander explicitement « dis-moi ce qui est faux dans ce brief » a
mieux marché que n'importe quelle consigne de rigueur.

## Deux pièges de ce système en particulier

**Un timer remis à zéro pendant une frame compte à partir de la suivante** — le runtime les avance
avant `onUpdate`. Sémantique assumée, uniforme, mais elle décale d'une frame tout script qui
démarrait une action et consommait `dt` dans la foulée. Détail et conséquence en §4.4 du design.

**Migrer un accumulateur vers un timer change le sens de la valeur** : `progress += dt/duration`
signifie « déjà consommée », `elapsed/duration` signifie « disponible cette frame ». Vérifier *où*
le seuil est testé, pas seulement remplacer le champ.

Les pièges de test réutilisables sont dans `packages/gameplay/CLAUDE.md` (assertions sur un `dt`
calculé, ce que la couture unitaire ne peut pas observer, le vrai patron de casse à la migration).
