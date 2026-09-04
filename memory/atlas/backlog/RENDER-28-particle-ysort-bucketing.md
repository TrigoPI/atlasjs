---
id: RENDER-28
status: vision
domain: rendering
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Découper un nuage de particules en buckets de Y

`CPUParticleNodeRenderer.collect` renvoie **une seule `ParticleDrawCommand` par émetteur** (`packages/nebula/src/renderers/CPUParticleNodeRenderer.ts:72-86`), donc tout le nuage se trie comme un bloc, au Y de l'émetteur. Sous un layer `ySorted`, une particule qui dérive au-dessus d'un personnage ne peut pas s'intercaler avec lui : elle reste du même côté que son émetteur. Découper un nuage en *k* commandes bucketées par Y échangerait des draw calls contre de la correction.

**Accroche :** `applySortFields` écrit déjà `sortPrimary = worldY` par nœud quand le layer est `ySorted` (`packages/gameplay/src/rendering/applySortFields.ts:20-23`), et `ParticleEmitterSystem` lui passe `position.y` (`packages/gameplay/src/systems/ParticleEmitterSystem.ts:98-104`) — le bucketing consiste donc à émettre *k* commandes depuis un seul `collect`, pas à toucher au tri.

Le contournement pratique aujourd'hui est de poser les FX sur un layer `manual`.

**À rapprocher de :** les trails ont la même structure — une commande par nœud, triée au Y du nœud (`TrailRenderSystem` appelle aussi `applySortFields(..., position.y)`, cf. `trails.md`:250) — donc la même limite de correction, mais elle n'y est **pas** consignée : `trails.md` §7 ne documente que la conséquence *draw call* du `ySorted` (les trails s'intercalent avec les sprites par leur Y et ne fusionnent donc quasi jamais), pas celle-ci. À ajouter là-bas si ce découpage est retenu, les deux features partageant la solution.
