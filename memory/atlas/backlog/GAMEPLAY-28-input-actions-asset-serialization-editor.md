---
id: GAMEPLAY-28
status: vision
domain: gameplay
source: "[[input-scripting]]"
effort: L
verified: 2026-08-19
---

# (Dé)sérialisation d'asset d'actions + éditeur

`defineActions`/`ActionMapDescriptor` sont déjà des données sérialisables en mémoire, mais aucun loader ni asset ne les persiste. Comme pour le mode edit↔play caméra, `packages/editor` a été supprimé du dépôt (commit `a1a7380`) : il n'y a plus de package pour porter l'UI d'édition. Le sujet redeviendra actionnable le jour où un éditeur reviendra au programme.
