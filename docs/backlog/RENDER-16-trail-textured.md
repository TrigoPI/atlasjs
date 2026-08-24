---
id: RENDER-16
status: todo
domain: rendering
source: "[[trails]]"
effort: M
verified: 2026-08-23
---

# Trails texturés

Le ruban ne sait aujourd'hui que du dégradé de couleur. Une texture étirée le long de la longueur ouvrirait les bords doux, les motifs et les gradients dessinés — il suffit d'un `u` de distance cumulée par point, puis de router le batch vers le chemin sprite (`SpriteBatch` accepte déjà un `uvRect` par instance) au lieu du chemin shape.

**Accroche :** le struct de segment et la boucle d'appariement du `TrailBatcher` ne changent pas ; seul le `u` s'ajoute côté `TrailNodeRenderer`, et `WebGPUSpriteBatch` porte déjà l'`uvRect` par instance.
