---
id: APP-05
status: todo
domain: app
source: "[cleanup](../../apps/dino-brawl/docs/cleanup.md)"
effort: S
verified: 2026-08-21
---

# Le combo de l'épée est déclaré dans `spawnPlayer`

La composition du combo — un `AttackChain` de `ThrustAttack` / `SwingAttack` / `SpinAttack` avec leurs trois clips `woosh` et leurs pitches — est écrite en dur dans `apps/dino-brawl/src/game/spawn/spawnPlayer.ts`, dans la prop `attack` passée à `createSwordPrefab`. Reste à l'extraire dans son propre module de contenu, pour que le site de spawn redevienne lisible et que la même arme soit donnable à un ennemi.

**Contrainte de forme :** `attack` est une factory `(entity: EntityBuilder) => WeaponAttack`, parce que chaque attaque est un `AtlasScript` qui doit être attaché à l'entité de l'épée. Le module ne peut donc pas être une simple structure de données déclarative — il reste une fonction de l'`EntityBuilder`, qui reçoit ses `AudioClip` en dépendances.

**Tension à trancher explicitement :** [`cleanup.md`](../../apps/dino-brawl/docs/cleanup.md) pose comme principe directeur que « la composition et la configuration initiale vivent dans la fonction de spawn ». Ce principe visait à sortir le setup statique des *scripts* ; un module de contenu dédié n'est pas un script, et l'objectif ici est la réutilisation plus la lisibilité. À dire dans le doc de design plutôt qu'à contourner en silence.

**Accroche :** la prop `attack` est déjà une factory injectée depuis le site de spawn, donc le point d'extension existe — il n'y a rien à changer dans `SwordPrefab`, seulement à déplacer la déclaration.
