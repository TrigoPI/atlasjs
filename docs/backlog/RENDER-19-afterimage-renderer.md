---
id: RENDER-19
status: todo
domain: rendering
source: "[[trails]]"
effort: M
verified: 2026-08-24
---

# AfterimageRenderer (ghosting de sprite)

Estamper des copies fanées du sprite d'une entité derrière elle, look très utilisé en pixel-art pour les dashs. **Ce n'est pas un trail** : pas de ruban continu, pas de courbe de largeur le long d'un chemin — c'est une feature voisine et distincte, à ne pas confondre avec `TrailRenderer`.

**Accroche :** rien à inventer côté rendu — le chemin sprite instancié existant suffit, chaque copie étant une instance de plus avec son propre `tint`.

**En cours** — design validé dans [`afterimages.md`](../rendering/afterimages.md), livré avec [`APP-08`](APP-08-player-dash.md) sur la branche `feat/app-08-player-dash`.
