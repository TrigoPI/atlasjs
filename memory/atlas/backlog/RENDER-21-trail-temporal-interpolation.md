---
id: RENDER-21
status: todo
domain: rendering
source: "[[trails]]"
effort: S
verified: 2026-08-23
---

# Interpoler les trails sur le temps, pas sur l'index

`TrailNodeRenderer` calcule `t = i / (count - 1)` : le paramètre d'un point dépend donc du *nombre* de points, pas de son âge. À chaque commit ou éviction, le `t` de tous les points saute d'environ `i / ((N-2)(N-1))` — soit ~12 % d'oscillation de largeur et d'alpha près de la queue sur un trail court, à la cadence d'émission.

Imperceptible dans la configuration livrée (queue fondue à alpha 0 et largeur 0, donc delta absolu minuscule), visible dès qu'on configure une queue non fondue (`endColor.a > 0`) ou un ruban très court.

**Accroche :** `TrailNode` porte déjà l'âge de chaque point (`getPointAge`) et son `time` ; `t = age / time` est un remplacement direct dans `computeEdgesAndColors`.
