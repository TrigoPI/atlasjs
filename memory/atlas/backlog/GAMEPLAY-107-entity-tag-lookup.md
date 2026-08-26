---
id: GAMEPLAY-107
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-26
---

# Aucun moyen de retrouver une entité sans en tenir déjà la référence

Il n'existe ni composant `Tag` ni composant `Name` dans le moteur : la liste complète des composants enregistrés par `GameplayPlugin` (`packages/gameplay/src/GameplayPlugin.ts:154-172`) ne contient rien de la sorte, et `packages/gameplay/src/components/` n'expose aucun marqueur d'identité. Corollaire côté scripting : la surface offerte à un `AtlasScript` est `ScriptContext` (`packages/gameplay/src/scripting/core/ScriptContext.ts:9-18`), qui donne `getEntityId()`, `getEntity(entity: Entity)`, `getService`, `instantiate` et `destroy`. `getEntity` prend un `Entity` en entrée — c'est un *handle*, pas une recherche. Un script ne peut atteindre une autre entité que si quelqu'un lui en a passé l'identifiant.

En pratique, toute relation inter-entités de `dino-brawl` est donc câblée à la main dans un prefab. `SwordPrefab` fait descendre `owner` et `anchor` depuis ses props (`apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts:25-33`) pour les recoller sur `renderer.sortPointEntity` (`:47`) et sur `SwordScript`/`SwordSortingScript` (`:91-105`) ; `EnemyPrefab` passe le `HurtboxScript` fraîchement attaché et `entity.entity` à `HurtReactionScript` (`apps/dino-brawl/src/game/prefabs/enemy/EnemyPrefab.ts:72-80`). Ça fonctionne bien tant que la relation vit à l'intérieur d'un même arbre de prefab, parce que le constructeur de l'arbre connaît ses deux extrémités. Ce qu'aucun mécanisme ne couvre, c'est le cas où deux sous-arbres sans ancêtre commun doivent se trouver.

Avant d'ajouter quoi que ce soit, il faut séparer deux besoins qui n'ont pas la même réponse. **Trouver un singleton bien connu** (« le joueur », « la caméra ») ne demande pas de recherche : le dépôt a déjà le patron, et il est meilleur. La caméra active est portée par `CameraManager` derrière le token `CAMERA_MANAGER` (`packages/gameplay/src/camera/tokens.ts:5-6`), désignée par `setActive(entity)` (`packages/gameplay/src/camera/CameraManager.ts:34`) et atteinte depuis un script via la façade `CameraApi` (`packages/gameplay/src/scripting/services/CameraApi.ts:8-9`). Un `ServiceRegistry.createToken` (`packages/core/src/public/engine/ServiceRegistry.ts:17`) plus un `provide` à la composition root coûte une ligne, se type, et la résolution est un `Map.get` — pas une itération.

**Requêter un ensemble** (« toutes les entités portant `Hurtbox` ») est en revanche déjà le rôle des queries de `@atlasjs/nexus` : `NexusWorld.query` (`packages/nexus/src/world/NexusWorld.ts:336-356`) rend un `Query` avec `entities()`, `each()`, `without()` et `optional()` (`packages/nexus/src/query/Query.ts:3-16`). Le trou n'est donc pas l'absence de requête, c'est que **`ScriptContext` n'expose pas `query`** : un script n'a aucun accès au monde. Exposer une façade de query aux scripts est un travail borné, et il couvre ce besoin sans introduire de nouvelle notion.

Reste la recherche par tag ou par nom à proprement parler, et c'est celle qu'il faut regarder avec méfiance. Un tag n'est qu'un composant marqueur — la query existante le couvre déjà, à condition d'y avoir accès. Un nom est une chaîne, donc une table de plus à maintenir, une résolution au runtime, et surtout le mécanisme par lequel un projet contourne une composition mal posée au lieu de la corriger. **Défaut latent, pas actif** : `dino-brawl` n'a aujourd'hui aucun site qui souffre de l'absence, parce que toutes ses relations tiennent dans un arbre de prefab. À ne pas ouvrir sans un besoin réel qui résiste aux deux réponses ci-dessus.

**Accroche :** `packages/gameplay/src/scripting/core/ScriptContext.ts:9-18` — c'est là que se décide ce qu'un script peut atteindre, et c'est le seul endroit à toucher si la réponse retenue est « exposer la query ». Le reste du chantier (tag, nom, registre) se décide en amont, pas dans le code.

**À rapprocher de :** [[GAMEPLAY-15-generic-typed-relations]], qui attaque le même sujet par l'autre bout — nommer les relations entre entités plutôt que les découvrir.
