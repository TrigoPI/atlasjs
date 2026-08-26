---
id: AUDIO-07
status: vision
domain: audio
source: "[[audio]]"
effort: M
verified: 2026-08-19
---

# (Dé)sérialisation des refs de clip (`AssetRef` par id)

Aucun mécanisme d'`AssetRef` par id n'existe dans le monorepo : une scène ou un prefab sérialisé sur disque ne peut pas référencer un `AudioClip` par un identifiant stable, seulement par closure de code comme les autres assets aujourd'hui.
