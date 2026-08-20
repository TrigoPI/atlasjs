---
id: AUDIO-06
status: vision
domain: audio
source: "[[audio]]"
effort: M
verified: 2026-08-19
---

# Refcount/eviction des `AudioClip`

`AudioClip.destroy()` (`packages/audio/src/assets/AudioClip.ts`) est un no-op documenté (l'`AudioBuffer` est laissé au GC natif) : aucun refcount ni éviction ne libère un clip explicitement.

**Bloqué par :** le durcissement/refcount de l'`AssetManager` lui-même, catégorisé « V2 » dans `docs/assets/asset-system.md`, n'a pas encore de note de backlog dédiée — `ASSETS-01-asset-manager-hardening.md` couvre deux bugs ponctuels de l'`AssetManager`, pas ce chantier de refcount générique.
