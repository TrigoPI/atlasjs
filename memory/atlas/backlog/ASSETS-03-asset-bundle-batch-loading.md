---
id: ASSETS-03
status: todo
domain: assets
source: "[[asset-system]]"
effort: M
verified: 2026-08-26
---

# `AssetManager` n'expose qu'un chargement unitaire — chaque app réécrit le lot

La surface publique d'`AssetManager` (`packages/assets/src/AssetManager.ts`) tient en quatre méthodes : `register` (`:18`), `load(asset)` (`:32`), `get(id)` (`:65`) et `destroy()` (`:69`). Une seule resource par appel, une récupération par `asset.id`, et rien d'autre — pas de lot, pas de nom logique, pas de progression. `LoadContext` (`packages/assets/src/LoadContext.ts`) est réduit au même `load` unitaire ; le doc de design l'annonce d'ailleurs comme « extensible (progress/cancel plus tard) » (`memory/atlas/assets/asset-system.md:103`), ce plus tard n'est jamais arrivé.

`apps/dino-brawl` comble le trou à la main. `src/game/loaders/` fait **171 lignes** (`AssetsLoader.ts` 90, `AssetList.ts` 35, `ResourcesIndex.ts` 43, `index.ts` 3), auxquelles s'ajoutent **80 lignes** de `src/game/sheets/` (`SheetLoader.ts` 46, `SheetList.ts` 34) pour la couche feuilles bâtie par-dessus — **251 lignes de plomberie** pour 23 descripteurs d'assets (8 textures, 10 sprites, 5 audios, `AssetList.ts:5-35`). Trois constats, tous vérifiés :

**Le nommage.** `AssetsLoader` maintient son propre index `atlas: Record<string, Resource>` (`AssetsLoader.ts:22`, `:35-39`) et une paire `addX(name, path)` par type (`:45-58`). L'app se retrouve avec **deux espaces de noms parallèles** pour la même resource : la clé logique `"texture:blue_dino"` côté app, et l'id du manager `"texture:/assets/sprites/dinos/dino_blue.png"` fabriqué par `TextureAsset` (`packages/nebula/src/assets/TextureAsset.ts:18`). Le second est stable mais dérivé du chemin de fichier, donc inutilisable comme alias de gameplay — d'où le premier. C'est exactement le rôle qu'un `key` de bundle tiendrait.

**Le chargement est séquentiel.** `AssetsLoader.load()` (`:60-67`) enchaîne trois `await` de phases, et chaque phase est une boucle `for…of` avec un `await` **dans le corps** (`:69-89`) : les 23 assets partent l'un après l'autre, soit 15 aller-retours réseau distincts sérialisés (10 chemins de texture — les 8 de `TextureList` plus les deux épées, tirées par `SpriteLoader` via `LoadContext`, `packages/nebula/src/assets/SpriteLoader.ts:10` — et 5 audios). À noter au passage `:85-86`, deux `await this.asset.load<Sprite>(desc.asset)` consécutifs sur le même asset : le second retombe sur la promesse mémorisée dans `this.loading`, donc c'est un `await` mort, pas un double fetch — symptôme d'une app qui tâtonne autour d'une API qui ne dit pas ce qu'elle garantit.

**La progression n'existe nulle part.** Le callback s'appelle `onAssetLoaded` (`AssetsLoader.ts:41`) mais n'est invoqué **qu'une fois**, après la dernière phase (`:66`) : c'est un « tout est prêt », pas un tick. `ArenaScene` le relaie tel quel (`apps/dino-brawl/src/game/ArenaScene.ts:87`) vers le `onReady?: () => void` de `GameCanvas` (`src/app/GameCanvas.tsx:73`) — un booléen, sans compteur. Et `LoadingScreen.tsx` ne contient **aucune occurrence de `progress`** : sa seule prop d'état est `ready?: boolean` (`:183-186`), la parade de dinos est une animation CSS purement décorative (`@keyframes dino-march`, `:129-132`) qui ne mesure rien. Le défaut est **latent** aujourd'hui, puisque `LoadingScreen` est orphelin (voir [[APP-02-dino-brawl-dead-react-screens]]) : personne n'observe le booléen. Il deviendra **actif** au premier rebranchement.

Deuxième défaut du même signal, celui-là dû à l'absence de lot : `onAssetsLoad()` est appelé à `ArenaScene.ts:87`, donc **avant** `spawnWorld(ctx)` (`:35`), qui déclenche une seconde vague séquentielle de chargements — `MapBuilder.ts:88` fait un `await assets.load<TileSetType>(asset)` dans une boucle sur les tilesets. « Prêt » est émis alors que les textures de la carte ne sont pas encore là. Avec un bundle unique couvrant les deux vagues, la question ne se poserait pas.

Piste, à instruire :

```ts
class AssetBundle {
  add<R extends Resource>(key: string, asset: Asset): this;
  load(onProgress?: (loaded: number, total: number, key: string) => void): Promise<void>;
  get<R extends Resource>(key: string): R;
  release(): void;
}
```

Deux questions de conception à trancher avant d'écrire la moindre ligne. **Le parallélisme doit-il être borné ?** Un `Promise.all` naïf sur une centaine de textures sature le pool de connexions du navigateur et retarde les premières : un plafond de concurrence (4–8) charge en fait *plus vite* les assets utiles en premier, et permet un ordre de priorité. Le compter dans `total` sans le borner serait la pire des deux options. **Où vit le comptage de références ?** `release()` suppose de savoir qu'une resource n'est plus référencée par aucun bundle. Or ni [[RENDER-04-resource-lifecycle-eviction]] (caches WebGPU en `Map`/`WeakMap` nues, sans LRU ni refcount) ni [[AUDIO-06-audioclip-refcount-eviction]] (`AudioClip.destroy()` est un no-op) n'ont d'endroit où le mettre — et `AUDIO-06` dit explicitement que le chantier refcount générique « n'a pas encore de note de backlog dédiée ». Ces deux notes plaident pour que le compteur vive **dans `AssetManager`**, à côté de `this.loaded`, et que le bundle ne soit qu'un client qui incrémente/décrémente : un refcount par bundle laisserait les deux caches en aval sans réponse. C'est un chantier à part entière, séparable de la partie lot + nommage + progression, qui elle est de coût modeste.

Cette note ne recoupe **pas** [[ASSETS-01-asset-manager-hardening]] : celle-là porte deux bugs ponctuels de `load()` (réinsertion dans `loaded` après un `destroy()` concurrent, clé de cache sans `asset.type`), pas la surface manquante. Le second de ces bugs est d'ailleurs latent parce que tous les `Asset` du dépôt préfixent déjà leur id de leur type (`texture:`, `sprite:`, `audio:` — `TextureAsset.ts:18`, `SpriteAsset.ts:35`, `AudioClipAsset.ts:14`) ; un bundle qui introduirait ses propres clés ne changerait rien à ça.

**Accroche :** `packages/assets/src/AssetManager.ts:32-63` — `load()` détient déjà la déduplication (`this.loading`) sur laquelle un lot doit s'appuyer pour ne pas compter deux fois le même asset dans sa progression, et c'est le seul endroit qui sait quand une resource passe de « en vol » à « chargée ». Le bundle se pose au-dessus, sans toucher au manager, sauf pour le refcount s'il est retenu.

**À rapprocher de :** [[GAMEPLAY-106-tiled-importer]] — l'importateur Tiled consommera un bundle (les tilesets de `MapBuilder.ts:88` sont aujourd'hui chargés un par un, hors de toute progression) ; ce chantier en est le préalable naturel.
