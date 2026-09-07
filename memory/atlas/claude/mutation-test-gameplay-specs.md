---
name: mutation-test-gameplay-specs
description: "Sur ce projet, une spec de gameplay ou de netcode passe souvent au vert sans rien observer — trois cas avérés en une série. Toujours casser le code exprès et vérifier que la spec tombe."
type: feedback
modified: 2026-09-06
---

**Écrire une spec sur ce moteur ne suffit pas : il faut prouver qu'elle peut échouer.** Sur la
seule série [[bump-royal-online-feature]], **trois specs sont nées vacues** et n'ont été rattrapées
que parce qu'on a muté le code exprès :

1. **Le canari « zéro erreur loggée ».** `vitest.config.ts` pose `__DEV__` à **`false`**, et c'est
   une vraie globale runtime, pas une substitution textuelle : `createLogger` renvoie alors un
   `Logger` **sans transport**, et `logger.error()` n'atteint jamais `console.error`. Un
   `vi.spyOn(console, "error")` ne peut donc littéralement pas se déclencher. Le harnais doit
   forcer `__DEV__` et `__CONSOLE_TRANSPORT__` à `true` avant le boot.
2. **Le dédoublonnage de dash réseau.** La spec dashait vers le bord ; le joueur tombait, et
   `PlayerMovementScript` remet `dashRequested` à `false` à chaque tick de chute — **la chute
   avalait le dash dupliqué**. Verte avec et sans le dédoublonnage. Corrigée en dashant vers le
   centre.
3. **Un `require` manquant sur un prefab.** Masqué par le fait que `ScriptManager` désactive un
   script fautif au lieu de propager.

Le point commun : la simulation a beaucoup de chemins qui **masquent** un bug plutôt que de le
révéler, et le scénario décrit par le test peut être exercé dans le seul ordre où le défaut est
invisible. C'est le même constat que [[scoped-time-and-timers-feature]].

**Comment appliquer :** pour toute spec qui porte une opinion (une règle de gameplay, un
dédoublonnage, un canari), casser la ligne qu'elle est censée protéger, relancer, **coller la
sortie d'échec dans le compte-rendu**, restaurer. Une spec dont on n'a pas vu l'échec ne compte
pas comme une vérification. Le formuler explicitement dans le prompt d'un sous-agent : ils le font
bien, mais seulement si on le demande.
