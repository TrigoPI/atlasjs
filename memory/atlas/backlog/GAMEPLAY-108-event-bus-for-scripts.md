---
id: GAMEPLAY-108
status: todo
domain: gameplay
effort: S
verified: 2026-08-26
---

# Deux entités non apparentées n'ont aucun canal de communication autre que la référence directe

`EventBus<TEvents>` existe et est complet : `on`, `once`, `off`, `emit`, `emitSafe`, `clear` (`packages/core/src/public/engine/EventBus.ts:9-108`). Il est même instancié par le moteur — `Engine.events` (`packages/core/src/public/engine/Engine.ts:34`, construit `:54`). Mais deux choses le rendent inatteignable pour un script. D'abord il est typé `EventBus<EngineEvents>`, et `EngineEvents` est une map **fermée** de deux entrées, `engine:start` et `engine:stop` (`packages/core/src/public/engine/types/Engine.types.ts:15-18`), les seules émises (`Engine.ts:126` et `:144`) : rien n'y ajoute un événement de jeu. Ensuite il est exposé comme champ public de `Engine`, pas fourni dans le `ServiceRegistry` — aucun `provide` ne le déclare — donc il est hors de portée du seul mécanisme d'accès dont dispose un script.

Ce mécanisme, c'est `ScriptService` : une façade résout son backend par un token statique au constructeur (`packages/gameplay/src/scripting/core/ScriptService.ts:3-6` et `:21`). Les quatre façades existantes sont `AudioApi`, `CameraApi`, `InputApi`, `TimeApi` (`packages/gameplay/src/scripting/services/index.ts:1-4`) — pas d'`EventsApi`. Un script n'a donc, pour parler à une entité qu'il ne possède pas, que la référence câblée à la construction.

Le mécanisme d'abonnement **local** existe pourtant et il est utilisé : `Animator` porte son propre `EventBus<AnimatorEvents>` (`packages/gameplay/src/components/Animator.ts:4-16`) exposé par `on` (`:61`), et trois scripts de `dino-brawl` s'y branchent — `RunningParticleScript.ts:18` pour s'autodétruire en fin de clip, `ImpactScript.ts:25` pour la même chose, `HurtReactionScript.ts:68`. Le patron est donc déjà admis dans le dépôt ; ce qui manque, c'est son équivalent hors d'un composant précis. **Latent plutôt qu'actif** : aucun besoin de `dino-brawl` n'échoue aujourd'hui faute de bus global, l'app s'en tire par des références de prefab (voir [[GAMEPLAY-107-entity-tag-lookup]]).

La forme est la vraie question, et elle doit être tranchée avant d'écrire du code. Un bus global à clés `string` est trivial à ajouter — un token `EVENTS`, un `EventBus<Record<string, unknown>>` fourni par `GameplayPlugin`, une façade `EventsApi` de vingt lignes sur le modèle de `TimeApi` (`packages/gameplay/src/scripting/services/TimeApi.ts:5-16`). Et il est difficile à déboguer : aucune vérification de la charge utile, aucun moyen de savoir qui écoute quoi, et la tentation immédiate de tout y faire passer.

L'alternative est un **événement typé par token**, exactement le patron que le dépôt applique déjà aux composants avec `defineScriptComponent` (`packages/gameplay/src/scripting/core/ScriptComponentToken.ts:13-23`) et aux services avec `ServiceRegistry.createToken` (`packages/core/src/public/engine/ServiceRegistry.ts:17`) : `defineEvent<TPayload>(description)` rendant un jeton porteur de son type, puis `emit(token, payload)` / `on(token, cb)`. La charge utile est vérifiée, le producteur et le consommateur partagent un symbole importable donc traçable, et la cohérence avec le reste de l'API est immédiate. Le coût supplémentaire par rapport au bus `string` est faible ; c'est probablement le bon rapport valeur/coût, mais c'est une décision d'API, pas une correction.

**Accroche :** `packages/gameplay/src/scripting/services/TimeApi.ts` — la plus courte des quatre façades, et le gabarit exact d'une `EventsApi` une fois le token et la forme de l'événement décidés. Le token lui-même se poserait à côté de `CAMERA_MANAGER` (`packages/gameplay/src/camera/tokens.ts:5-6`) et se fournirait dans `GameplayPlugin.install`, à la suite des quatre `provide` existants (`packages/gameplay/src/GameplayPlugin.ts:144-147`).

**À rapprocher de :** [[GAMEPLAY-88-script-service-missing-token-message]] — toute nouvelle façade hérite du message d'erreur inexploitable décrit là quand son token n'est pas fourni.
