---
id: PHYSICS-03
status: vision
domain: physics
source: "[[character-controller]]"
effort: M
verified: 2026-08-20
---

# Character controller piloté par système (multi-movers)

Le character controller actuel est script-driven : chaque script appelle `move(delta)` sur son propre token, et `PhysicsPushSystem` ne fait que créer le `CharacterControllerRef` manquant. Si plusieurs movers doivent un jour coexister avec une résolution centralisée (modèle Godot `move_and_slide` orchestré par un système dédié plutôt que par autant de scripts indépendants), l'architecture actuelle ne le permet pas.
