---
id: APP-20
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# `MapBuilder` importe une carte précise, pas le format Tiled

`MapBuilder` (`apps/dino-brawl/src/game/tiled/MapBuilder.ts:58-160`) expose une option pour la résolution des sorting layers — `resolveSortingLayer` est une fonction injectée (`:47`), appelée en tête de `buildTileLayer` (`:171-174`). La sélection des calques d'occluders, elle, est un `layer.name.startsWith("occluders")` écrit en dur dans la boucle (`:115-117`), absent de `MapBuilderOptions`. Deux politiques de nommage cohabitent donc dans le même builder : l'une configurable et documentée par son type, l'autre invisible depuis l'extérieur. Un auteur de carte qui nomme son calque `occlusion` ou `props_occluders` n'obtient ni erreur ni avertissement — le calque est simplement rendu comme un calque ordinaire. Défaut **latent** tant que la seule carte du jeu respecte la convention, et silencieux par construction le jour où elle ne la respecte plus.

Deuxième point : les calques d'occluders reçoivent un `TileMapRenderer` complet dans `buildTileLayer` (`:191-197`, avec `sortingOrder` et `sortingLayer` renseignés), pour se le faire retirer une fois `ingestOccluders` passé (`:155-157`). Le composant existe uniquement parce que `bakeOccluderStrips` a besoin du `TileMap` peuplé — mais c'est le `TileMap` qui porte les cellules (`:190`, `:201-203`), pas le renderer. Du travail effectué pour être annulé, plus une frame de risque si l'ordre des étapes change. Ce chemin n'est couvert par **aucun test** : `apps/dino-brawl/test/tiled/ingestOccluders.test.ts` teste `ingestOccluders` isolément, et il n'existe pas de test de `MapBuilder.build` — ni la sélection par préfixe, ni l'ajout-puis-retrait ne sont vérifiés.

Troisième point : les points nommés extraits de la carte sont accumulés dans un objet indexé par nom (`:121`, `:126`). Tiled n'impose aucune unicité de nom d'objet ; deux points homonymes s'écrasent donc silencieusement, le dernier de `doc.objects` gagnant. Côté auteur, cela veut dire qu'un `spawn_point` dupliqué par copier-coller — le geste normal dans l'éditeur — déplace le spawn sans le moindre signe. Le seul consommateur actuel lit un point unique (`apps/dino-brawl/src/game/ArenaScene.ts:36`), ce qui rend le défaut latent aujourd'hui ; un jour où la carte porte plusieurs points de patrouille, il devient une perte de données.

Isolément, les trois sont mineurs. Ensemble, ils décrivent le même symptôme : un importateur écrit pour *cette* carte plutôt que pour le format. Les correctifs locaux sont évidents — un `occluderLayerPrefix?: string` (ou un prédicat) dans `MapBuilderOptions`, un chemin de construction qui n'ajoute pas le renderer pour ces calques, un `Map` avec avertissement sur collision — et coûtent chacun quelques lignes. Mais si l'importateur remonte côté moteur, ce sont exactement les décisions que sa surface publique devrait rendre explicites, et les patcher ici serait à refaire là-bas.

**Accroche :** `MapBuilderOptions` (`MapBuilder.ts:44-49`) — c'est le type qui ment : il annonce la sortie des conventions vers l'appelant et n'en sort qu'une. Ajouter le troisième champ y rend les deux autres points visibles au même endroit.

**À rapprocher de :** [[GAMEPLAY-106-tiled-importer]] — même périmètre, et ces trois conventions sont le contenu concret de sa surface d'options.
