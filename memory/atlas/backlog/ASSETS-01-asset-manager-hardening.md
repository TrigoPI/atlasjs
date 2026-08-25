---
id: ASSETS-01
status: partial
domain: assets
source: "[[asset-system]]"
effort: S
verified: 2026-08-19
---

# Durcissement de l'AssetManager

Deux manques subsistent dans `AssetManager` : un `load()` dont la promesse résout après un `destroy()` entretemps réinsère quand même la resource dans `loaded`, ce qui la fait fuiter ; et la clé de cache (`asset.id` seul) n'est jamais croisée avec `asset.type`, ce qui ne protège pas contre une collision d'id entre deux types d'assets.

**Accroche :** `AssetManager.load()` (`packages/assets/src/AssetManager.ts:32-64`) donne déjà le point d'entrée exact à corriger — il faut vérifier l'état avant de réinsérer dans `this.loaded`, et inclure `asset.type` dans la clé de cache.
