---
id: GAMEPLAY-88
status: todo
domain: gameplay
source: "[[input-scripting]]"
effort: S
verified: 2026-08-25
---

# `getService` sur un service absent donne un message inexploitable

`ScriptService` (`packages/gameplay/src/scripting/core/ScriptService.ts:21`) résout son backend au constructeur : `this.provided = services.get(ctor.token)`. Quand le token n'est pas fourni, `ServiceRegistry.get` (`packages/core/src/public/engine/ServiceRegistry.ts:22`) lève `Service not found: Symbol(AUDIO_ENGINE)` — exact, mais muet sur ce qu'il faut faire.

Repéré en rendant `AUDIO_ENGINE` optionnel (`3093174`, GAMEPLAY-73). Ce commit a soigné le chemin `AudioSource` : un `play()` sans `AudioPlugin` lève désormais un message qui nomme l'import et l'appel `engine.use` à écrire. Mais le **second** chemin d'accès au même moteur n'a pas été traité : un script qui fait `this.getService(AudioApi)` dans un projet sans `AudioPlugin` reçoit toujours le message brut. Trois scripts de `dino-brawl` en dépendent (`WeaponAttack.ts:56`, `HurtReactionScript.ts:64`, `PlayerDashScript.ts:73`), dans une app qui fournit bien le plugin — le trou est donc latent, pas actif.

La difficulté est que `ScriptService` est **générique sur le token** : on ne peut pas y écrire un message propre à l'audio sans casser l'abstraction, et le traiter côté `AudioApi` demanderait du travail avant `super()`. C'est une décision de conception, pas une correction mécanique.

Trois pistes, à départager :
- un champ statique optionnel sur la façade (`static readonly missingMessage?: string`) que `ScriptService` utilise s'il existe — chaque façade décrit son propre remède, l'abstraction reste générique ;
- un message générique mais actionnable dans `ScriptService`, du type « aucun service sous *token* : le plugin qui le fournit n'est probablement pas installé » — moins précis, coût nul, couvre toutes les façades d'un coup ;
- faire porter le remède au token lui-même, ce qui supposerait d'enrichir le type `ServiceToken` côté `core` — le plus large, et il déborde de gameplay.

La deuxième est probablement le bon rapport valeur/coût, la première si on veut viser juste. À noter que la même remarque vaut pour `InputApi`, `CameraApi` et `TimeApi` : c'est le contrat de `getService` qui est en cause, pas l'audio.

**Accroche :** `packages/gameplay/src/scripting/core/ScriptService.ts:21` — un seul site à changer quelle que soit la piste retenue.

**À rapprocher de :** le commit `3093174` — il a traité l'autre chemin d'accès au même moteur, et c'est le contraste entre les deux messages qui rend celui-ci visible.
