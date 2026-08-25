---
id: RENDER-26
status: todo
domain: rendering
source: "[[afterimages]]"
effort: M
verified: 2026-08-25
---

# Extraction du ring buffer d'`AfterimageRenderSystem`

`packages/gameplay/src/systems/AfterimageRenderSystem.ts:169-271` — `resolveCapacity`, `resize`, `empty`, `stamp`, `advance` — plus `createSlot` (`:384-394`) et l'interface `AfterimageSlot` (`:24-32`) forment un **ring buffer temporel pur, sans aucune dépendance à Nexus ni à nebula**, incrusté dans le système. C'est la réponse au « pourquoi ce fichier fait 395 LOC ». Conséquence sur la testabilité : les invariants les plus délicats — wrap-around de `head`/`count`, expiration par âge en tête de file, `resize` qui vide le buffer — ne sont atteignables qu'en montant un monde ECS complet.

**Ce n'est pas une invitation à déplacer le buffer dans nebula.** [`afterimages.md`](../rendering/afterimages.md) §2 tranche explicitement l'asymétrie avec `TrailNode` : celui-ci possède son buffer parce qu'il en dérive une géométrie (les normales miter), alors qu'ici il n'y a aucune géométrie à dériver et que le buffer n'est qu'une file d'états de sprite. Décision à respecter.

**Accroche :** extraire `packages/gameplay/src/rendering/AfterimageRing.ts`, une classe **locale au paquet** portant `slots`/`head`/`count` et exposant `resize`/`clear`/`stamp`/`advance`/`forEachAlive`. Le système tombe à ~245 LOC et n'orchestre plus que ECS ↔ ring ↔ nœuds.

**À rapprocher de :** [[RENDER-24-afterimage-idle-cost]] — le parcours borné aux emplacements vivants qu'il réclame devient une simple méthode du ring.
