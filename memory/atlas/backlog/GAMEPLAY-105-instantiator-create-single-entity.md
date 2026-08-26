---
id: GAMEPLAY-105
status: todo
domain: gameplay
source: "[[prefab]]"
effort: S
verified: 2026-08-26
---

# Pas de chemin `Instantiator` pour une entité unique : l'app redescend au monde brut

`Instantiator` n'a qu'une porte d'entrée, `instantiate(prefab, ...rest)` (`packages/gameplay/src/prefab/Instantiator.ts:26-45`), et elle exige un `Prefab`. Pour une entité qui n'a aucune raison d'en avoir un — une caméra, un porteur de script, un singleton de scène — le code de jeu n'a pas d'API et redescend d'un étage.

`apps/dino-brawl/src/game/spawn/spawnCamera.ts:15-30` en est le cas pur : `ctx.services.get(NEXUS)`, `ctx.services.get(SCRIPT_MANAGER)`, puis `nexus.createEntity()`, deux `nexus.addComponent(...)`, deux `scriptManager.attach(...)`. `spawn/spawnEnemy.ts` **mélange les deux chemins dans la même fonction** (`:35-68`) : il récupère `INSTANTIATOR`, `NEXUS` **et** `SCRIPT_MANAGER`, crée l'entité de spawner à la main (`:52-59`) et instancie l'ennemi et son ombre par prefab (`:62-74`). Ce sont les deux seuls fichiers de `apps/dino-brawl/src/game/` à importer `SCRIPT_MANAGER`.

**Ce qui est perdu en descendant, vérifié point par point.**

- *Les façades de composants côté scripting.* `PrefabEntityBuilder.add` passe par `GameEntityHandle.addComponent` (`packages/gameplay/src/prefab/EntityBuilder.ts:31-33`), qui accepte les `ScriptComponentToken` et renvoie leur API (`packages/gameplay/src/scripting/core/GameEntity.ts:58-75`). `nexus.addComponent` ne connaît que les composants moteur. C'est visible dans `spawnCamera.ts:22`, qui ajoute `Transform2D`, alors que le script attaché juste après lit `Transform` — la façade (`CameraFollowScript.ts:19`). Nuance à ne pas surestimer : `Camera` n'a **pas** de façade (`packages/gameplay/src/scripting/components/index.ts` ne définit que `Collider`, `RigidBody`, `SpriteRenderer`, plus `Transform` et `CharacterController`), donc sur ce cas précis seul `Transform2D` est concerné.
- *Le nettoyage de l'entité partielle.* `instantiate` enveloppe le `build` dans un `try/catch` qui détruit la racine avant de relancer (`Instantiator.ts:33-42`). Le chemin brut laisse une entité à moitié construite dans le monde si un `addComponent` ou un `attach` lève.
- *Le `GameEntity` en retour.* `instantiate` rend un handle (`:44`) ; `spawnCamera` et le spawner de `spawnEnemy` rendent un `Entity` nu, donc l'appelant qui veut ensuite lire un composant doit refaire un `createGameEntity` ou passer par `nexus`.
- *L'option `parent`.* Le `setParent` sous garde du `try` (`:36-38`) n'existe pas côté brut.
- *L'isolement des tokens de services internes.* `NEXUS` et `SCRIPT_MANAGER` ne devraient pas circuler dans du code de gameplay applicatif ; c'est précisément ce que `INSTANTIATOR` est censé éviter.

**Piste :** `Instantiator.create(build: (entity: EntityBuilder) => void, options?: InstantiateOptions): GameEntity`. Tout est déjà là — `PrefabEntityBuilder` (`packages/gameplay/src/prefab/EntityBuilder.ts:16-45`) est indépendant de `Prefab`, et `instantiate` se réécrit par-dessus en une ligne : `return this.create((e) => prefab.build(e, params), options)`. Une dizaine de lignes nettes, aucune API cassée.

Ce que ça retire côté app : `spawnCamera.ts` tombe à un `create` de six lignes sans `NEXUS` ni `SCRIPT_MANAGER`, et `spawnEnemy.ts` cesse de mélanger deux modèles de construction. **`SCRIPT_MANAGER` sortirait alors entièrement de l'usage applicatif de dino-brawl** — plus aucun import dans `apps/dino-brawl/src/`.

Alternative à écarter, mais qu'il faut nommer : définir un `definePrefab` jetable à chaque cas (`definePrefab({ build: … })`, `Prefab.ts:5-10`) marche déjà aujourd'hui et ne coûte rien au moteur. C'est cependant nommer « prefab » un objet construit une seule fois, à usage unique, et forcer un détour conceptuel là où l'intention est « construis-moi une entité ». Le gain de la note est de rendre l'API honnête, pas de rendre un cas impossible possible : le défaut est **latent** au sens strict — rien ne casse aujourd'hui, l'app contourne — mais le contournement fuit deux tokens de services internes dans du code de jeu.

**Accroche :** `packages/gameplay/src/prefab/Instantiator.ts:26-45` — extraire le corps de `instantiate` en `create(build, options)` et faire de `instantiate` un appelant. Le `try/catch` de nettoyage et le `createGameEntity` final se déplacent tels quels, sans logique nouvelle.

**À rapprocher de :** [[GAMEPLAY-40-prefab-child-subprefab]] — même surface d'API, `EntityBuilder`, et même question de ce qu'un prefab doit ou non être obligé d'être.
