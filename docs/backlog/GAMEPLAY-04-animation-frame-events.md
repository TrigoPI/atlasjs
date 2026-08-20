---
id: GAMEPLAY-04
status: todo
domain: gameplay
source: "[[sprite-animation]]"
effort: M
verified: 2026-08-19
---

# Events de frame sur l'animation

`SpriteAnimation` n'émet aucun événement au changement de frame, et `Animator` ne connaît que les événements de clip (`started`/`finished`/`loop`). Il reste à ajouter une émission par frame (au minimum l'index de frame courant) afin de permettre des callbacks synchronisés à l'anim, par exemple pour déclencher un effet sonore ou une hitbox à une frame précise.
