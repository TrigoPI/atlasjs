---
id: GAMEPLAY-35
status: partial
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-19
---

# Déduplication des overloads `addComponent`/`getComponent`/`hasComponent`/`removeComponent`

`ComponentAccess.ts` factorise déjà le quatuor d'overloads en une interface unique, reprise par `ScriptContext` et `GameEntity`, mais les trois classes concrètes — `AtlasScript`, `RuntimeScriptContext`, `GameEntityHandle` (`GameEntity.ts`) — redéclarent encore chacune le quatuor verbatim. Reste à les faire converger sur `ComponentAccess` sans redéclaration.

Incertitude à lever avant de s'engager sur l'effort : on ne sait pas si TypeScript permet à une classe `implements ComponentAccess` (interface à overloads) de ne pas redéclarer les overloads tout en conservant la résolution de surcharge correcte au site d'appel via le type de la classe elle-même. Si ce n'est structurellement pas possible, la duplication restante serait irréductible sans changer de modèle — à vérifier par un essai de compilation avant de committer sur cet item.
