---
id: RENDER-33
status: todo
domain: rendering
effort: S
verified: 2026-09-05
---

# Un émetteur à `shape.radius: 0` et `startSpeed: 0` n'affiche plus rien

Observé pendant la vérification navigateur du point de contact (2026-09-05) : un émetteur par
ailleurs valide, ramené à `shape: { kind: "circle", radius: 0 }` et `startSpeed: 0` pour concentrer
la bouffée en un point, **ne dessine plus une seule particule** — et **aucune erreur en console**.
Configuration dégénérée, mais silencieuse : rien n'indique à l'auteur que sa config est refusée
plutôt que rendue.

**Hypothèse, à traiter comme telle et non comme un diagnostic :** une direction ou une vitesse nulle
produit des `NaN` quelque part dans la chaîne spawn → simulation → écriture d'instance, et une
position ou une taille `NaN` sort silencieusement du rendu. Le candidat évident — un `normalize()`
sur vecteur nul — **n'est pas dans `sampleShape`** : la direction d'émission y est calculée en
`Math.cos(angle)` / `Math.sin(angle)` sur un angle tiré au hasard
(`packages/nebula/src/graphics/CPUParticleNode.ts:749-759` pour le cas `circle`), donc elle reste
unitaire même à `radius: 0`, et `radius` ne sert qu'à multiplier l'offset. À `startSpeed: 0` la
vélocité écrite est `(0, 0)` (`:710-711`), légitime. **La cause est donc ailleurs que là où on
l'attend**, et la première étape est une sonde, pas une relecture.

**Accroche :** reproduire dans une spec vitest de `packages/nebula` — la simulation CPU est du
TypeScript pur et entièrement testable hors GPU — puis lire les tableaux SoA de `CPUParticleNode`
(`getX`/`getY`/`getVelocityX`/`getVelocityY`) après quelques `advance` pour voir si un `NaN` apparaît
et à quel champ. Si les positions sont saines, le problème est en aval, côté taille ou packing
d'instance.
