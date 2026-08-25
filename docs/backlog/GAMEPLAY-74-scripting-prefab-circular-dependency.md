---
id: GAMEPLAY-74
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-25
---

# Dépendance circulaire latente entre `scripting/core` et `prefab`

Dépendance mutuelle entre deux dossiers. Sens A, **type-only donc effacé** : `src/scripting/core/AtlasScript.ts:7-8` et `src/scripting/core/ScriptContext.ts:6-7` font `import type { Prefab } from "../../prefab/Prefab"` (et `InstantiateArgs` depuis `Instantiator`). Sens B, **import de valeur** : `src/prefab/EntityBuilder.ts:3` et `src/prefab/Instantiator.ts:3` font `import { createGameEntity } from "../scripting/core"`.

Pas de cycle à l'exécution aujourd'hui — `import type` est toujours élidé à la compilation — mais l'invariant ne tient qu'à une convention d'écriture, non à un réglage du paquet : `verbatimModuleSyntax` n'est activé que dans les tsconfig des apps (`apps/dino-brawl`, `apps/webgpu`), pas dans `tsconfig.base.json` ni dans `packages/gameplay`. Convertir une de ces 4 lignes en import de valeur — p. ex. pour ajouter un garde runtime `isPrefab()` — crée un cycle ESM réel, sans rien pour l'arrêter. C'est aussi ce qui **interdit** de séparer `scripting` et `prefab` en deux paquets.

**Accroche :** déplacer les *déclarations de type* `Prefab` (`prefab/Prefab.ts:3-6`) et l'interface `EntityBuilder` (`prefab/EntityBuilder.ts:14-20`) dans `scripting/core/`, en laissant les implémentations (`PrefabEntityBuilder` `:23-53`, `Instantiator`) dans `prefab/`. La dépendance devient unidirectionnelle `prefab → scripting/core`.
