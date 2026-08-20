---
id: GAMEPLAY-39
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-19
---

# `getScripts(type)` pluriel sur une entité

`ScriptManager.getScript()` et `GameEntity.getScript` délèguent tous deux à la première instance `instanceof type` trouvée (`return record.instance as T`) : aucune variante ne renvoie toutes les instances d'un même type de script attachées à une entité. Reste à ajouter ce `getScripts(type)` pluriel.
