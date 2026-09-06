---
id: APP-26
status: todo
domain: app
source: "[[collision-contacts]]"
effort: S
verified: 2026-09-05
---

# bump-royal — l'ancre de poussière subit le squish du joueur

L'ancre enfant qui porte l'émetteur de poussière est placée en coordonnées **locales**, donc l'offset
monde `contact − centre du joueur` est divisé par l'échelle du parent. `PlayerCollisionScript`
divise par l'échelle **de base** (`baseScale`, soit `3.5`), alors que la propagation de transform
applique l'échelle **vivante** — que le même script écrase dans la foulée avec le facteur de squish
(`squishScale: 0.85`). L'émission tombe donc ~2 unités **en deçà** du point de contact exact, sur le
segment vers le joueur, le temps que le squish se résorbe.

**Ce n'est volontairement pas corrigé.** Diviser par l'échelle vivante casserait pendant une chute :
`PlayerFallScript` réduit l'échelle du joueur jusqu'à `0`, et la division exploserait l'ancre à
l'infini juste avant l'élimination. Et sur le fond, une poussière qui suit le squish **au moment
exact du choc** est défendable : l'ancre reste solidaire du corps qui se déforme, ce qui se lit comme
un impact plutôt que comme un artefact. La correction n'a d'intérêt que si le décalage devient
visible à d'autres échelles ou avec un squish plus fort.

**Accroche :** `placeDust` dans
`apps/bump-royal/src/game/script/player/PlayerCollisionScript.ts` — la ligne
`const inverseScale: number = 1 / this.baseScale.x;` est le compromis entier. Une correction juste
doit lire l'échelle vivante **avec une garde sur zéro**, ou repositionner l'ancre hors de la
hiérarchie du joueur ; la vraie sortie est [[GAMEPLAY-120-particle-emit-origin]], qui supprime
l'ancre.
