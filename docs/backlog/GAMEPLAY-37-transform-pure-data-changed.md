---
id: GAMEPLAY-37
legacyId: B3
status: vision
domain: gameplay
source: "[[scripting-components]]"
effort: L
verified: 2026-08-19
---

# `Transform` en donnée pure via `Changed<T>` (B3)

`setPosition` (`packages/gameplay/src/scripting/components/Transform.ts`) écrit toujours en temps réel (`world.requireComponent(...).position.set(...)` + téléport physique direct) : aucun canal `Changed<T>` n'existe pour découpler l'écriture du script de sa propagation. Reste à tuer cette dernière façade au profit d'un composant donnée pure, avec un canal explicite (`rigidBody.teleport()` ou composant-commande `Teleport`) pour le cas `dynamic`, où une écriture `Transform` brute serait clobberée le frame suivant par le pull physique.

**Bloqué par :** [[CORE-02-changed-t-detection]] et [[GAMEPLAY-30-script-compiler]] — le primitif `Changed<T>` n'existe pas encore, et le doc source demande explicitement de ne pas démarrer ce chantier avant le compilateur (B2).
