---
id: GAMEPLAY-89
status: todo
domain: gameplay
effort: M
verified: 2026-08-25
---

# `PhysicsCollisionSystem.dispatch` mint un `GameEntity` par contact et par sens

`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:48` appelle `createGameEntity` à chaque dispatch — soit **deux fois par paire de contact** (une par sens), à chaque événement de collision de chaque sous-pas fixe.

**Mesuré, pas supposé.** Après les corrections de `83c4953` (GAMEPLAY-77), `createGameEntity` est la **ligne la plus lourde du chemin collision, à 16 % des allocations** de la scène de mesure — profileur d'allocation échantillonné, 3000 frames, monde réaliste avec 29 paires de contact ré-émises à chaque sous-pas. Il était auparavant masqué par `createTransform`, qui pesait 43 % à lui seul.

C'est le même motif que celui que `83c4953` vient de traiter sur `Transform` : un handle apatride, dont l'état utile est `(world, entity, resolver)`, reconstruit à chaque usage. `GameEntityHandle` est déjà une **classe** (`packages/gameplay/src/scripting/core/GameEntity.ts`), donc le remède du ticket précédent — passer d'un littéral à accesseurs à un prototype — ne s'applique pas ici : le coût est le nombre d'instanciations, pas leur forme.

Pistes, à départager par la mesure :
- un handle **réutilisé** détenu par le système, re-ciblé avant chaque dispatch. Attention : ça casse la garantie d'apatridie vis-à-vis de l'appelant — un script qui garde la référence reçue dans `onCollisionEnter` verrait sa cible changer au contact suivant. À ne faire qu'avec un contrat explicite, ou pas du tout ;
- un cache `Entity → GameEntity` porté par le `ScriptManager`, qui rend l'identité stable et supprime l'allocation, au prix d'une entrée par entité vivante et d'une invalidation à la destruction ;
- ne rien faire, si le profil d'un jeu réel montre moins de contacts que la scène de mesure.

Méthode de mesure, à reprendre telle quelle : `HeapProfiler.startSampling` via `node:inspector`, **avec `includeObjectsCollectedByMajorGC` et `includeObjectsCollectedByMinorGC` à `true`** — sans ces deux drapeaux le profileur ne rapporte que les objets encore vivants, ce qui est inutilisable pour de la garbage sub-seconde et produit une variance ingérable. Replier les frames *builtin* sur leur ancêtre JS le plus proche, sinon les octets partent dans `Map.set`/`Array.push` et la fonction responsable disparaît. Un delta `heapUsed` ne mesure rien : il a donné des résultats inversés sur deux tickets de ce lot.

**Accroche :** `PhysicsCollisionSystem.ts:48` — mais commence par mesurer sur ton jeu, pas sur la scène de référence : le poids de cette ligne est proportionnel au nombre de contacts, qui varie énormément d'un jeu à l'autre.
