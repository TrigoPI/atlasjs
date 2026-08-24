---
id: APP-08
status: todo
domain: app
source: "[[afterimages]]"
effort: M
verified: 2026-08-24
---

# Dash du joueur dans dino-brawl

Le joueur n'a que deux régimes de déplacement, marche et sprint (`boost` sur `Space`), tous deux à vitesse continue. Il manque un dash : une ruée courte, directionnelle et à cooldown, sur `Shift`, qui affiche la frame `11` de la sheet dino et laisse derrière elle des copies fanées du dino via [`AfterimageRenderer`](RENDER-19-afterimage-renderer.md).

Mécanique retenue : direction capturée à l'appui (`move`, à défaut le sens de `flipX`) puis **verrouillée**, distance et durée fixes parcourues par une progression normalisée passée à `character.move()`, cooldown compté depuis le début du dash, woosh au déclenchement. Le dash reste disponible pendant une attaque à l'épée — pas de couplage vers `SwordScript`.

**Accroche :** le point dur n'est pas le mouvement mais l'arbitrage. Il n'existe aucun arbitrage entre les scripts du joueur : `PlayerMovementScript`, `PlayerAnimationScript` et `HurtReactionScript` lisent l'input et déplacent le personnage chacun de leur côté. Le dash s'y insère par le pattern déjà en place dans le repo — un script injecté en prop dans un autre (`hurtbox: HurtboxScript`, `hitbox: SwordHitboxScript`) — plus l'ordre d'attache dans le prefab, que `ScriptManager` respecte via l'ordre d'insertion de sa `Map`. Design complet dans [`afterimages.md`](../rendering/afterimages.md) §5.
