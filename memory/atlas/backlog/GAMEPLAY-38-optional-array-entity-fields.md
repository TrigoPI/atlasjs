---
id: GAMEPLAY-38
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-19
---

# Champs entité optionnels et tableaux dans `AttachProps`

`AttachProps<P> = { [K in keyof P]: P[K] extends GameEntity ? Entity : P[K] }` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:25-27`) ne substitue un champ que si son type est exactement `GameEntity` : un `GameEntity | undefined` ou un `GameEntity[]` ne matche pas `extends GameEntity` et reste non transformé. Reste à généraliser ce mapping conditionnel (`NonNullable`, récursion sur les tableaux).
