---
id: RENDER-10
status: vision
domain: rendering
source: "[[shapes]]"
effort: M
verified: 2026-08-19
---

# Remplissage gradient / texture des shapes

Aucun symbole `gradient`/`Gradient` n'existe dans le code : `fs_main` retourne toujours une `in.color` uniforme, sans sampling de texture sur les shapes. Il reste à concevoir le modèle de remplissage (gradient et/ou texture) avant de pouvoir le câbler dans le shader.
