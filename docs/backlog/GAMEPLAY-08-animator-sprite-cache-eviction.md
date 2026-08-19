---
id: GAMEPLAY-08
status: vision
domain: gameplay
source: "[[sprite-animation]]"
effort: S
verified: 2026-08-19
---

# Eviction du cache `Map<Frame, Sprite>` de l'Animator

`AnimatorSystem.spriteCache` ne fait jamais `.delete()` : le cache grandit sans borne tant qu'une scène ne décharge pas ses assets à chaud. Il reste à lui adjoindre une politique d'éviction.

**À rapprocher de :** [[RENDER-04-resource-lifecycle-eviction]] — même problème de cache sans éviction, côté renderer.
