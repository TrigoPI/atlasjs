---
id: APP-07
status: todo
domain: app
source: "[[weapon-attack-cues]]"
effort: S
verified: 2026-08-21
---

# Aucune validation des props numériques des `TimelineAttack`

Toute la famille (`ThrustAttack`, `SwingAttack`, `SpinAttack`, `ThrustChainAttack`, `LungeAttack`) accepte n'importe quelle valeur injectée sans garde. Un `thrustCount` négatif produit une timeline sans phase de frappe, un `thrustCount: 2.5` boucle trois fois, une durée de phase à `0` fait coïncider deux `start` — ce dernier cas rabat plusieurs cues `rearmHits` sur un seul re-armement de frame. Rien ne casse bruyamment, le contenu se comporte juste autrement qu'écrit.

**Accroche :** angle mort partagé par les cinq attaques, donc traitable une seule fois dans `TimelineAttack` ou `AttackTimeline` plutôt que classe par classe.
