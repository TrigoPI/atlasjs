---
id: APP-16
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# `runningSpeed` ment d'un facteur 2 sur la vitesse réelle

`PlayerMovementScript` expose `runningSpeed` comme prop requise (`apps/dino-brawl/src/game/scripts/player/PlayerMovementScript.ts:18, 22, 64`), puis la double en dur au moment de s'en servir : `this.boost.isDown() ? this.runningSpeed * 2 : this.walkingSpeed` (`:50-52`). Le prefab renseigne `walkingSpeed: 200` et `runningSpeed: 205` (`apps/dino-brawl/src/game/prefabs/player/PlayerPrefab.ts:89-93`). La vitesse effective en course est donc 410 contre 200 en marche — un peu plus du double — alors que le réglage lisible suggère un boost de 2,5 %.

Le coût est celui d'une valeur exposée qui ne veut pas dire ce qu'elle dit. Les deux nombres quasi identiques du prefab donnent l'impression d'un réglage volontairement fin, arbitré au game-feel ; ce sont en réalité des vestiges, sans rapport avec ce que la boucle applique. Quiconque veut retoucher la course depuis le prefab — le seul endroit prévu pour ça — obtient un résultat au double de son intention, et une correction naïve (« passons de 205 à 220 ») déplace la vitesse réelle de 410 à 440. Le facteur `* 2` est par ailleurs la seule constante de gameplay du script qui ne soit pas exposée, ce qui la rend invisible depuis le prefab.

Le correctif est mécanique : supprimer le `* 2` en `:51` et porter la valeur réelle, 410, dans `PlayerPrefab.ts:91`. Le comportement est alors identique à l'octet près, et la prop redevient honnête. Une variante consisterait à exposer un `runMultiplier` en plus de la vitesse, mais elle ajoute un réglage là où un seul nombre suffit.

Aucun test ne fige la valeur actuelle : `playerMovementScript.test.ts` déclare bien `RUNNING_SPEED = 205` (`apps/dino-brawl/test/game/scripts/player/playerMovementScript.test.ts:14`) et l'injecte (`:113`), mais **aucune assertion ne porte sur le chemin boosté** — les deux cas de déplacement vérifiés le sont en marche (`:136`, `:181`), et le seul test qui presse `boost` attend zéro déplacement parce qu'un dash est en cours (`:159-167`). La suite restera donc verte quoi qu'on change, dans un sens comme dans l'autre. Le défaut est **actif** : il se manifeste à chaque course dans la partie livrée. Comme la correction ne change rien au game-feel si la valeur est portée fidèlement mais tout si elle ne l'est pas, elle demande une vérification navigateur, pas seulement une suite verte.

**Accroche :** `apps/dino-brawl/src/game/scripts/player/PlayerMovementScript.ts:51` — le facteur en dur. Une assertion sur le chemin boosté, ajoutée avant le changement, verrouillera les 410 px/s et rendra la suite capable d'attraper la régression.
