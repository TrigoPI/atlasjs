---
id: APP-25
status: todo
domain: app
effort: M
verified: 2026-09-04
---

# bump-royal — aucune règle de manche autour de l'élimination

Sortir de l'arène fait tomber le joueur puis le respawne à son point de départ, indéfiniment : ni vies, ni score, ni manche, ni fin de partie. L'élimination est donc mécaniquement livrée mais ne décide de rien, et un joueur seul en piste ne gagne pas.

**Accroche :** `PlayerFallScript` (`apps/bump-royal/src/game/script/player/PlayerFallScript.ts`) détient déjà l'instant d'élimination et la position de respawn ; c'est le point où un compteur de vies ou un arbitre de manche se brancherait.
