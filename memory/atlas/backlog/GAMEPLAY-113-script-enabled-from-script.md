---
id: GAMEPLAY-113
status: todo
domain: gameplay
effort: S
verified: 2026-09-04
---

# Activer / désactiver un script depuis un script

`ScriptManager.setEnabled(script, enabled)` et `isEnabled(script)` existent et sont respectés par la boucle de cycle de vie, mais rien ne les expose à un script : `ScriptContext` ne porte pas le manager, et `GameEntity.getScript()` rend l'instance sans moyen de la suspendre. Un script qui doit neutraliser un autre script de la même entité en est réduit à lui faire lire un état.

**Accroche :** `ScriptManager.setEnabled` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:152`) est déjà écrit et testé ; il manque le point d'entrée sur `GameEntity` ou `AtlasScript`. Le cas réel : dans `apps/bump-royal`, le mouvement et le squish du joueur lisent tous deux `PlayerFallScript.isFalling` pour rendre la main pendant une chute.
