---
id: CORE-04
status: vision
domain: core
source: "[[scheduling]]"
effort: L
verified: 2026-08-19
---

# Driver de rollback (netcode)

`Engine.advanceFixed(maxSteps)` existe comme seam public, mais n'est appelé aujourd'hui que par la boucle RAF interne — aucun driver externe ne s'en sert pour du rollback (snapshot/resimulation). Ce n'est pas un objectif actuel du moteur ; il reste à concevoir un tel driver si le besoin se présente.

**Accroche :** `advanceFixed` est déjà un seam public taillé pour ça.
