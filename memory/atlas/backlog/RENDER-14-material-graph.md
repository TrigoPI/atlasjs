---
id: RENDER-14
status: vision
domain: rendering
source: "[[material-graph]]"
effort: L
verified: 2026-08-19
---

# Material graph : sérialisation & éditeur de graphe

Aucune brique de cette vision n'existe dans le code : ni `MaterialData`, ni `materialize`/`dematerialize`, ni package `@atlasjs/material-graph`, ni registre de nœuds WGSL (confirmé sur `packages/nebula/src/core/material/Material.ts`, qui ne connaît que l'objet `Material` vivant, et par l'absence de tout dossier `material-graph` hors `memory/atlas/`). Le design est entier et cadré (`memory/atlas/rendering/material-graph.md`) mais reste une seule vision indivisible aujourd'hui : chaque brique dépend de la précédente et aucune n'a de début d'implémentation distinct à isoler en tâche autonome. La découper en plusieurs notes suggérerait un séquencement qui n'existe pas encore.

Elle recouvre :

- **Tier 1 — material instance** : le modèle sérialisable `MaterialData` (POJO), les fonctions `materialize`/`dematerialize` avec resolvers injectés (`ShaderResolver`/`TextureResolver`), et un champ `version` pour le format ; à poser dans `@atlasjs/nebula`, indépendamment du graphe.
- **Package `@atlasjs/material-graph`** : le modèle nœud/edge (DAG sérialisable), le registre de types de nœuds extensible, le walker de compilation (tri topologique → WGSL → `createShader`), le builder code-first, et la sérialisation versionnée.
- **Bibliothèque de nœuds WGSL built-in** : nœuds d'entrée (`input.uv`, `property.texture`, `property.color`), nœuds de math/sampling, et master node de sortie couleur.
- **Extensions « plus tard »** : un DSL fluide en sucre au-dessus du builder, le branchement d'un éditeur de graphe (palette depuis le registre, lecture/écriture JSON, preview via `compile`), et un pipeline de migration de format (`v1 → v2 → …`) pour ne jamais casser les assets sauvegardés.
- **Questions de design ouvertes** (§8 du doc source) : système de types de ports et règles de conversion, nommage/défauts des property nodes, granularité de la bibliothèque de nœuds v1, validation du graphe (cycles, ports non connectés, types incompatibles) — à trancher à l'implémentation, pas avant.
