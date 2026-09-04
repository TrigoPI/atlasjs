---
id: GAMEPLAY-117
status: vision
domain: gameplay
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Sous-émetteurs

Faire naître un autre système de particules à la naissance, à la mort ou à la collision d'une particule — une fusée dont chaque étincelle éclate à son extinction.

**Accroche :** `definePrefab` (`packages/gameplay/src/prefab/Prefab.ts:5`) et `Instantiator` (`packages/gameplay/src/prefab/Instantiator.ts`) instancient déjà un arbre d'entités depuis un script, et `ParticleEmitter` est un composant ordinaire (`packages/gameplay/src/components/ParticleEmitter.ts:21`) — un sous-émetteur est donc un prefab instancié à la position d'une particule. La question ouverte est la **propriété du cycle de vie** (qui détruit l'enfant, et que devient-il si le parent meurt d'abord), pas le mécanisme.

Le déclencheur « à la collision » dépend de [[GAMEPLAY-116-particle-collision]] ; les déclencheurs naissance et mort, non — ils sont faisables dès aujourd'hui.
