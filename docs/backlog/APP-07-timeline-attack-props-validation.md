---
id: APP-07
status: todo
domain: app
source: "[[weapon-attack-cues]]"
effort: S
verified: 2026-08-24
---

# Aucune validation des props numériques des `TimelineAttack`

Toute la famille (`ThrustAttack`, `SwingAttack`, `SpinAttack`, `ThrustChainAttack`, `LungeAttack`) accepte n'importe quelle valeur injectée sans garde. Un `thrustCount` négatif produit une timeline sans phase de frappe, un `thrustCount: 2.5` boucle trois fois, une durée de phase à `0` fait coïncider deux `start` — ce dernier cas rabat plusieurs cues `rearmHits` sur un seul re-armement de frame. Rien ne casse bruyamment, le contenu se comporte juste autrement qu'écrit.

**Le même angle mort existe hors de la famille des attaques** (constaté le 2026-08-24 sur `PlayerDashScript`) : avec `duration: 0` et une frame à `dt` nul, la progression du dash vaut `0 / 0`, le pas devient `NaN` et le transform de l'entité est irrémédiablement `NaN` — le joueur disparaît sans une seule erreur. Probabilité faible (il faut une prop mal réglée *et* une frame nulle), mais c'est le pire mode de panne du lot, et il montre que le problème est celui des props de script en général, pas des timelines d'attaque.

**Accroche :** angle mort partagé par les cinq attaques, donc traitable une seule fois dans `TimelineAttack` ou `AttackTimeline` plutôt que classe par classe. Si la validation monte d'un cran — au niveau de `ScriptMetadata`, qui déclare déjà les props — elle couvrirait aussi les cas hors attaques comme celui du dash.
