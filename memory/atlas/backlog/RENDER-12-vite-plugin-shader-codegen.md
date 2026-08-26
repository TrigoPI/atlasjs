---
id: RENDER-12
status: todo
domain: rendering
source: "[[shaders-materials]]"
effort: M
verified: 2026-08-19
---

# Plugin Vite de codegen `.d.ts` pour les shaders

Aucun plugin Vite de génération de types n'existe dans le repo : le seul typage des propriétés d'un material reste `Material.set()`/`.get()`, validés à l'exécution, sans types statiques dérivés du WGSL. Il faut un plugin qui consomme la réflexion WGSL déjà en place pour générer un `.d.ts` par shader, avec autocomplétion typée sur les noms de propriétés.

**Accroche :** la réflexion WGSL (parsing des uniforms/bindings) existe déjà côté runtime et sert de base à `Material.set()`/`.get()` (`packages/nebula/src/core/material/Material.ts`) ; il ne reste qu'à la brancher sur un plugin Vite en amont de la compilation.
