---
id: CORE-06
status: todo
domain: core
source: "[[scoped-time-and-timers]]"
effort: S
verified: 2026-08-27
---

# Aucun plugin ne `provides` `TIME`, donc personne ne peut le `requires`

`Engine` fournit `TIME` lui-même, dans son constructeur (`packages/core/src/public/engine/Engine.ts:78`), **hors** du graphe `provides`/`requires` des plugins. Le service existe donc bien au démarrage, mais aucun plugin ne le déclare.

Conséquence : ajouter `TIME` au `requires` d'un plugin lève `MissingDependencyError` au boot. Ce n'est pas théorique — c'est arrivé pendant l'implémentation de [[scoped-time-and-timers]] : la ligne semblait correcte, et elle a fait échouer **222 des 468 tests** d'un coup. Le contournement est `services.wait(TIME)` dans `install`, ce que fait `GameplayPlugin`, mais rien ne le documente ni ne l'impose.

Le défaut est **latent et piégeux** : la déclaration paraît juste, le service est réellement disponible, et l'échec est total plutôt que localisé.

**Accroche :** deux issues. Faire déclarer `TIME` par un plugin noyau implicite, ce qui rend le graphe honnête ; ou refuser explicitement `TIME` dans `requires` avec un message qui renvoie vers `services.wait`. La seconde est un garde-fou, la première une correction.
