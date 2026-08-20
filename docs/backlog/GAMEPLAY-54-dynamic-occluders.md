---
id: GAMEPLAY-54
status: vision
domain: gameplay
source: "[[occluder-ysort]]"
effort: L
verified: 2026-08-20
---

# Occluders dynamiques

Le modèle v1 suppose des occluders statiques : les instances et le `footY` d'un `OccluderStrip` sont bakés une fois au montage (`OccluderRenderSystem.resolveNode`) et jamais reconstruits. Faire bouger un occluder à l'exécution (porte, objet poussable) demanderait de rebâtir tuiles et `footY` en cours de partie — non supporté aujourd'hui.
