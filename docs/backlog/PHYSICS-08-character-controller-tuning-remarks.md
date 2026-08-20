---
id: PHYSICS-08
status: vision
domain: physics
source: "[[character-controller]]"
effort: S
verified: 2026-08-20
---

# Affinements du character controller (résolution en lane fixed, collider solide-mais-silencieux)

Deux réglages fins notés dans le design mais jamais traités : résoudre le character controller dans la lane `fixed` plutôt que dans `update` supprimerait la latence d'un step fixe (aujourd'hui acceptée comme suffisante) ; et un flag permettant à un collider de la layer `World` de rester solide sans émettre d'événements de collision (aujourd'hui les deux sont couplés — tout collider `World` est à la fois solide et bruyant).
