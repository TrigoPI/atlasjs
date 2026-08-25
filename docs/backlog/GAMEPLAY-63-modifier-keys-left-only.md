---
id: GAMEPLAY-63
status: todo
domain: gameplay
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# `Key.Shift`, `Key.Ctrl` et `Key.Alt` ne captent que la touche de gauche

`packages/input/src/public/Key.ts` fait correspondre `Shift = "ShiftLeft"`, `Ctrl = "ControlLeft"` et `Alt = "AltLeft"`. Un jeu qui lie une action à `Key.Shift` ne répond donc pas au Shift **droit**, sans que rien dans le nom de l'entrée ne le laisse deviner.

Relevé en câblant le dash du joueur sur `Key.Shift` (voir [`afterimages.md`](../rendering/afterimages.md) §5) : c'est une action de gameplay courante, tenue en même temps que WASD, et un joueur gaucher ou habitué au Shift droit conclura simplement que le dash ne marche pas.

**Accroche :** trois pistes, à trancher. Renommer en `ShiftLeft`/`ShiftRight` etc. pour que le nom dise la vérité ; faire de `Key.Shift` un alias qui couvre les deux codes ; ou laisser l'enum tranquille et documenter. La deuxième demande que `ButtonAction`/`ValueAction` acceptent qu'une entrée logique corresponde à plusieurs `code` physiques — `ButtonAction` sait déjà le faire (`keys.some(...)`), mais `Vector2Composite` associe une seule `Key` par direction.
