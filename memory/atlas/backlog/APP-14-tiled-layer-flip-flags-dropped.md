---
id: APP-14
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Les retournements de tuile des calques Tiled sont décodés puis jetés

`TiledDocument` décode correctement les bits de retournement de chaque gid de calque (`apps/dino-brawl/src/game/tiled/TiledDocument.ts:132`) et les recopie sur la cellule produite (`:142-149`), où le type les déclare (`apps/dino-brawl/src/game/tiled/resolved.types.ts:14-21`). `MapBuilder` ne les lit jamais : la boucle de remplissage n'écrit que l'index (`apps/dino-brawl/src/game/tiled/MapBuilder.ts:201-203`, `tileMap.setTile(cell.cx, cell.cy, cell.localIndex)`). Un grep de `flipX`/`flipY` sur l'app ne trouve, côté tuiles, que le décodage dans `tiled/` et les fixtures de `test/tiled/` — aucun consommateur.

Le contraste est net avec les **tile-objects**, qui suivent le chemin complet : le même décodage (`TiledDocument.ts:183, 198-199`) est cette fois transmis au `SpriteRender` (`MapBuilder.ts:251-252`), que `SpriteRenderSystem` applique par une échelle négative (`packages/gameplay/src/rendering/syncNodeTransform.ts:23`). Le même fichier `.tmj` afficherait donc correctement un arbre retourné posé comme objet, et de travers la même tuile retournée posée dans un calque. À noter que la démonstration est aujourd'hui purement lisible dans le code : la carte livrée (`apps/dino-brawl/maps/dino_brawl.json`) ne contient aucun tile-object.

Le flag diagonal est un cas à part : `FLIP_D` est exporté (`apps/dino-brawl/src/game/tiled/gid.ts:3`) mais `resolveGid` (`:12-18`) ne le lit pas et `ResolvedGid` (`:6-10`) n'a pas de champ pour lui — c'est de la surface morte. Or Tiled encode une rotation de 90° comme `FLIP_D` combiné à `FLIP_H` ou `FLIP_V` : une tuile pivotée arrive donc en simple miroir, et pas seulement non pivotée.

Scénario : dans Tiled, retourner horizontalement une tuile d'un calque, réexporter, relancer — la tuile s'affiche non retournée, sans le moindre warning, alors que le chemin d'erreur voisin (tileset non résolu) en émet un (`MapBuilder.ts:182-186`). Le défaut est **latent** aujourd'hui : un scan des quatre calques de `maps/dino_brawl.json` ne trouve aucun gid porteur d'un bit de retournement. Il devient actif au premier retournement posé dans l'éditeur, silencieusement, et sur une carte de 10 000 cellules la perte se cherche à l'œil.

Le correctif n'est pas seulement applicatif : `TileMap` ne sait **pas** représenter un retournement par cellule — son stockage est un `Map<number, number>` d'index de tuile (`packages/gameplay/src/components/TileMap.ts:8, 22-30`), et ni `TileMapRenderer` ni `TileMapRenderSystem` n'ont de notion de flip. Tant que le moteur n'expose rien, `MapBuilder` n'a nulle part où écrire l'information. Deux voies : porter le flag dans le moteur (partie qui relève de [[GAMEPLAY-106-tiled-importer]]), ou, en attendant, émettre un warning côté app quand une cellule retournée est ingérée — coût quasi nul, transforme une perte silencieuse en perte signalée, et n'engage aucune décision d'API.

**Accroche :** `apps/dino-brawl/src/game/tiled/MapBuilder.ts:202` — la ligne où l'information est perdue. C'est le bon point d'entrée parce qu'elle rend immédiatement visible ce qui manque en face : `setTile` n'a pas de paramètre pour l'accueillir.

**À rapprocher de :** [[GAMEPLAY-106-tiled-importer]] pour la partie moteur, et [[PHYSICS-02-tiled-collider-ingestion-shapes]], autre trou d'ingestion du même importeur.
