---
id: CORE-08
status: todo
domain: core
effort: M
verified: 2026-08-25
---

# Signal `onBeforeDestroy` en tête de `NexusWorld.destroyEntity`

`NexusWorld.destroyEntity` (`packages/nexus/src/world/NexusWorld.ts:116-141`) n'offre aucun point d'accroche avant de commencer sa démolition : il récurse sur les enfants, détache du parent, vide les stores un par un en émettant `onRemove` au fil de l'eau, puis appelle `entityManager.destroy`. Un consommateur qui a besoin d'agir **pendant que l'entité est encore intacte** n'a donc qu'un seul levier : se brancher sur l'`onRemove` d'un composant et espérer que son store soit balayé avant les autres.

C'est exactement ce que fait `ScriptManager` depuis le commit `ddef90c`, qui a rendu l'accès aux composants fiable dans `onDestroy`. Le résultat est testé et non régressif, mais il repose sur **trois dépendances qu'aucune API ne garantit** :

1. **L'ordre d'itération de `this.stores`.** `destroyEntity` parcourt une `Map` dans son ordre d'insertion, et cet ordre est celui du **premier accès à l'exécution** — `defineComponent` n'attribue qu'un `ComponentID` (`:143-149`), les stores naissent paresseusement dans `getOrCreateStore` (`:368-383`). `ScriptManager` doit donc toucher son store dès son constructeur pour être sûr d'être balayé en premier. Remplacer cette boucle par une itération sur le registry, un tri d'ids ou un stockage archétypal (voir [[CORE-01-archetype-soa-storage]]) casserait l'invariant.
2. **La récursion enfants d'abord.** `onDestroy` s'exécute alors que le sous-arbre a **déjà été entièrement détruit** : un parent qui itère ses enfants pendant sa propre destruction voit un sous-arbre vide. Cohérent avec un modèle bottom-up, mais écrit nulle part.
3. **Le détour par un composant marqueur.** `ScriptHost` n'existe que pour porter ce hook.

Proposition : émettre `onBeforeDestroy(entity)` **en tête** de `destroyEntity`, avant la récursion sur les enfants et avant toute suppression de store. Les trois dépendances disparaissent d'un coup — plus besoin de forcer l'ordre des stores, plus de couplage à l'ordre de la `Map`, et l'`onDestroy` d'un parent verrait son sous-arbre intact. À trancher au passage : le signal doit-il être émis une fois pour la racine, ou pour chaque entité du sous-arbre (probablement les deux, en pré-ordre).

Autres consommateurs qui en bénéficieraient : [[GAMEPLAY-61-render-systems-unmount-lifecycle]] (les systèmes de rendu veulent démonter leurs nœuds avant que les composants ne s'évaporent), et plus généralement tout système qui doit libérer une ressource externe indexée sur une entité. `GAMEPLAY-76` (fuite de scripts au `dispose` du `ScriptManager`) portait le même besoin ; il a été **livré** dans la PR #3 — `dispose` appelle désormais `tearDownScript` pour chaque script.

**Accroche :** `NexusWorld.ts:116-118` — le signal se pose juste après l'`assertEntityExists`. Le mécanisme d'émission existe déjà (`this.emit(this.removeListeners, …)`), il s'agit d'ajouter une liste de listeners de même forme, sans identifiant de composant.

**À rapprocher de :** le correctif intermédiaire `ddef90c` (`fix(gameplay): let onDestroy read the entity it is tearing down`), dont cette note est la vraie solution ; ses tests attraperont toute régression de l'invariant, mais depuis `gameplay`, pas depuis `nexus`.
