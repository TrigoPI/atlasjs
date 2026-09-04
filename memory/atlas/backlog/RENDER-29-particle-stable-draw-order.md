---
id: RENDER-29
status: vision
domain: rendering
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Ordre de dessin stable à l'intérieur d'un émetteur

Une particule morte est recyclée par échange avec la dernière vivante, donc l'ordre de dessin à l'intérieur d'un émetteur **n'est pas l'ordre de naissance**. Invisible en blending additif et sur un nuage à sprite unique avec une seule rampe d'alpha ; visible dès que deux particules du même nuage doivent se recouvrir dans un ordre déterminé. Une compaction stable à deux pointeurs corrigerait le point.

**Accroche :** `CPUParticleNode.kill(index)` est le site unique — il copie les 14 tableaux SoA depuis `living - 1` et décrémente (`packages/nebula/src/graphics/CPUParticleNode.ts:660-681`), et n'est appelé que depuis `integrate` (ligne 652). `clear()` et `setCapacity` ne réordonnent rien.

**Pourquoi ce n'est pas le défaut.** Les morts se groupent en tête du tableau (les plus vieilles d'abord, puisque les naissances s'empilent en queue), donc une compaction recopie presque tous les survivants sur toute frame comportant au moins une mort. Mesuré à ~22 000 copies de flottants par frame à 2 000 particules, contre ~363 pour l'échange avec le dernier — un facteur ~60. Le SoA compte 14 tableaux parallèles, ce qui donne l'ordre de grandeur : chaque particule déplacée vaut 14 copies. Les chiffres ne sont pas reproductibles depuis le dépôt (aucun benchmark n'y est versionné) ; les revérifier avant de trancher.
