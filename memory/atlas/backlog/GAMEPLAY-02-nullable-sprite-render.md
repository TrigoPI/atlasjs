---
id: GAMEPLAY-02
status: todo
domain: gameplay
source: "[[sprites]]"
effort: S
verified: 2026-08-19
---

# `sprite` nullable sur le renderer

`SpriteRender.sprite` est requis au constructeur (`Sprite`, jamais `Sprite | null`), ce qui empêche de créer une entité avec un rendu de sprite différé ou temporairement vide. Il reste à rendre ce champ nullable et à faire suivre le système de rendu en conséquence.

**Accroche :** `SpriteRender.sprite` (`packages/gameplay/src/components/SpriteRender.ts:6,16`) est le point d'entrée du changement.
