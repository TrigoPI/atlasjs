---
id: APP-09
status: vision
domain: app
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# I-frames pendant le dash

Rendre le dash réellement défensif : invulnérabilité sur sa durée, pour en faire une esquive et plus seulement un outil de mobilité.

**Bloqué, et c'est le point important :** il n'existe aujourd'hui **aucun vecteur de dégâts vers le joueur**. `PlayerPrefab` n'attache pas de `HurtboxScript` (seuls les ennemis en ont, sur un enfant sensor), et `EnemyPrefab` n'attache aucun script d'attaque — les ennemis sont des punching-balls passifs. Implémenter les i-frames maintenant produirait du code strictement inobservable : impossible à valider dans le navigateur, vérifiable seulement par un test unitaire artificiel.

**Accroche :** la plomberie est déjà posée par [`APP-08`](APP-08-player-dash.md). `HurtboxScript.grantInvincibility(duration)` est public, et `PlayerDashScript` accepte une prop optionnelle `hurtbox?: HurtboxScript` qu'il alimente si elle est fournie. Le jour où le joueur reçoit une hurtbox, une seule ligne dans `PlayerPrefab` branche la feature. Ce qui reste à faire est donc en amont : hurtbox joueur, attaque ennemie, et de quoi voir le résultat.
