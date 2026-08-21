---
id: APP-06
status: todo
domain: app
source: "[[weapon-attack-cues]]"
effort: M
verified: 2026-08-21
---

# Cues d'attaque portant autre chose que du son et du re-armement

`AttackCue` ne transporte aujourd'hui que `sound` et `rearmHits`. Les besoins de feel qui viendront ensuite — faire apparaître un FX à l'instant de l'impact, déplacer le joueur pendant la détente d'une fente (root motion), moduler les dégâts phase par phase — demanderaient chacun un champ optionnel de plus et un consommateur dédié.

**Accroche :** le type est conçu pour ça, l'ajout est purement additif et `TimelineAttack.fireCue()` est le point unique où un nouveau champ se branche. Attention en revanche à `rearmsHits`, qui est un booléen par frame et non un compteur (cf. caveat §9.3 du doc de design) : un canal qui aurait besoin de se déclencher plusieurs fois dans une même frame ne peut pas suivre ce modèle.
