---
id: RENDER-25
status: vision
domain: rendering
source: "[[afterimages]]"
effort: M
verified: 2026-08-24
---

# Décalage et courbe d'échelle le long de la traînée d'images rémanentes

Une image rémanente est aujourd'hui une copie **exacte** de l'instantané : même échelle, même position, seul le tint change avec l'âge. Des looks plus stylisés demandent de faire dériver la copie de son instantané — un décalage croissant le long de la trajectoire, un rétrécissement ou un étirement avec l'âge.

**Accroche :** le point d'insertion existe déjà. Le système interpole `startColor → endColor` sur `age / time` dans sa routine de dessin ; une courbe d'échelle ou un décalage se branchent sur exactement le même `t`, au même endroit, sans toucher au ring buffer ni au chemin de rendu. Explicitement hors périmètre du design initial ([`afterimages.md`](../rendering/afterimages.md) §1, §9).
