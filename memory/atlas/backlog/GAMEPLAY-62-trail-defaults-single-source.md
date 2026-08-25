---
id: GAMEPLAY-62
status: todo
domain: gameplay
source: "[[trails]]"
effort: S
verified: 2026-08-23
---

# Une seule source pour les défauts de trail

`TrailNode` (`time` 0.2, `minVertexDistance` 2, `startWidth` 8, `endWidth` 0, blanc → blanc alpha 0) et le composant `TrailRenderer` portent les **mêmes constantes**, dupliquées. Deux sources de vérité : si l'une dérive, un utilisateur nebula pur et un utilisateur ECS n'obtiennent pas le même ruban à configuration égale, et rien ne le signale.

**Accroche :** le composant passe déjà par un objet `options` avec des `??` — il suffirait qu'il lise les défauts du nœud plutôt que de les redéclarer.
