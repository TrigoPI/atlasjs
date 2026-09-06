---
id: NETWORK-03
status: todo
domain: network
source: "[[state-sync]]"
effort: M
verified: 2026-09-06
---

# Reconnexion, dérive d'horloge et sockets oisives

Trois trous ouverts par la V1, tous inoffensifs en localhost et pas ailleurs. Le `t` d'une
`InputFrame` est estimé depuis une horloge ancrée sur `welcome.tick` : sur une longue partie
elle peut dériver jusqu'à mettre le client en extrapolation permanente ou très en retard, et
seul `resync()` corrige — appelé uniquement sur `visibilitychange`, sans garde de dérive.
Une socket connectée qui n'envoie jamais `hello` garde sa connexion TCP indéfiniment. Et une
socket coupée ne se rétablit pas : il n'y a pas de reconnexion.

**Accroche :** `SnapshotBuffer.resync(now)` existe et fait déjà le bon travail ; il lui manque
un déclencheur autre que l'onglet qui revient au premier plan. Un ping/pong donnerait à la fois
le RTT pour dimensionner le délai de rendu et le battement pour détecter les sockets mortes.
