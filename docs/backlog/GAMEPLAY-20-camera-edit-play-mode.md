---
id: GAMEPLAY-20
legacyId: C5
status: vision
domain: gameplay
source: "[[camera]]"
effort: S
verified: 2026-08-19
---

# Mode edit↔play formel

`packages/editor` a été supprimé du dépôt (commit `a1a7380`), ce qui vide la prémisse d'origine de cet item : arbitrer entre un producteur éditeur et le producteur gameplay de `renderer.camera`. `CameraManager`/`CameraSyncSystem` restent aujourd'hui l'unique producteur. Le sujet redeviendra actionnable le jour où un éditeur reviendra au programme.
