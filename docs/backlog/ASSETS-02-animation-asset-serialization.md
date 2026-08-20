---
id: ASSETS-02
status: vision
domain: assets
source: "[[asset-system]]"
effort: M
verified: 2026-08-19
---

# Sérialisation d'un asset d'animation

Il n'existe aucun `AnimationAsset`/`SpriteAnimationAsset` sérialisable : un clip d'animation ne peut être défini que par code, contrairement aux textures et sprites qui ont déjà leur `Asset`/`AssetLoader`. Il reste à définir ce type d'asset et son loader sur le modèle de `SpriteAsset`.

**Accroche :** `SpriteAsset`/`TextureAsset` (`packages/gameplay/src/assets/Sprite.ts`) donnent déjà le patron `Asset`/`AssetLoader` à répliquer pour un clip d'animation.
