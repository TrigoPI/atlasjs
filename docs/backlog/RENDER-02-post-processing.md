---
id: RENDER-02
legacyId: A3
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: M
verified: 2026-08-19
---

# Post-processing

Aucune passe de post-traitement (bloom, vignette, etc.) n'est câblée : il faut enchaîner des passes de rendu-vers-texture au-dessus du mécanisme existant.

**Accroche :** `packages/nebula/src/core/renderer/RenderTarget.ts` (`RenderTarget`, `PassDescriptor`) et `NebulaRenderer.render(pass?)` → `SceneRenderer.render(scene, pass?)` fournissent déjà le rendu-vers-texture ; il ne reste qu'à chaîner plusieurs passes dessus.
