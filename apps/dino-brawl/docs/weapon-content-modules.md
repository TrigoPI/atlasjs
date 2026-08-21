# Dino Brawl — modules de contenu d'arme

> **Statut : implémenté.** Le combo de l'épée vit dans `src/game/content/weapons/swordCombo.ts` ; `spawnPlayer` ne fait plus que l'appeler.

Ce document couvre [APP-05](../../../docs/backlog/APP-05-sword-combo-declaration-in-spawn.md) : sortir la déclaration du combo de l'épée de `spawnPlayer`.

---

## 1. Problème

La composition du combo — un `AttackChain` de `ThrustAttack` / `SwingAttack` / `SpinAttack`, chacun avec son clip `woosh` et son pitch — était écrite en dur dans la prop `attack` passée à `createSwordPrefab`, au milieu de `spawnPlayer`. Deux conséquences :

- le site de spawn du joueur portait dix lignes qui ne parlent pas du joueur ;
- donner la même épée à un ennemi imposait de recopier ces dix lignes.

## 2. Contrainte de forme

`attack` est une **factory**, pas une structure de données : chaque attaque est un `AtlasScript` qui doit être attaché à l'entité de l'épée, et cette entité n'existe qu'au moment où le prefab est construit. Le module extrait reste donc une fonction de l'`EntityBuilder` — il ne peut pas devenir un objet déclaratif inerte.

Le contrat porte maintenant un nom, `WeaponAttackFactory`, déclaré dans `scripts/weapon/attacks/WeaponAttack.ts` à côté du type qu'il produit :

```ts
export type WeaponAttackFactory = (entity: EntityBuilder) => WeaponAttack;
```

`SwordPrefabProps.attack` et le retour de `createSwordCombo` s'y réfèrent tous les deux, au lieu de répéter la signature.

## 3. Solution

Un nouveau dossier `src/game/content/`, dont `weapons/swordCombo.ts` est le premier occupant :

```ts
export function createSwordCombo(clips: SwordComboClips): WeaponAttackFactory;
```

Le module reçoit ses trois `AudioClip` en dépendances (`{ thrust, swing, spin }`) et possède l'ordre des attaques ainsi que leurs pitches. Le site de spawn se réduit à :

```ts
attack: createSwordCombo({
  thrust: woosh1Sound,
  swing: woosh2Sound,
  spin: woosh3Sound,
}),
```

Le chargement des assets reste dans `spawnPlayer` : le module de contenu ne connaît pas l'`AssetsLoader`, seulement des clips déjà résolus. C'est ce qui le rend appelable depuis `spawnEnemy` — ou depuis un test — sans traîner l'infrastructure de chargement.

`SwordPrefab` est inchangé : le point d'extension existait déjà, seule la déclaration a bougé.

## 4. Pourquoi un dossier `content/` et pas `scripts/` ou `prefabs/`

Les trois dossiers du `game/` ont des rôles distincts, et le combo n'entre dans aucun des deux existants :

| Dossier | Rôle |
| --- | --- |
| `scripts/` | comportement par frame — ce qui varie dans le temps |
| `prefabs/` | composition d'entités — quels composants, quelle hiérarchie |
| `content/` | **déclarations de contenu** — quel loadout, quels réglages, quel ordre |

Mettre `swordCombo.ts` dans `scripts/weapon/attacks/` l'aurait rapproché des classes qu'il instancie, mais aurait remis du setup statique dans le dossier que [`cleanup.md`](cleanup.md) réserve au comportement. Le mettre dans `prefabs/weapon/` aurait mélangé des `definePrefab` et une factory qui n'en est pas une.

## 5. Tension avec le principe directeur de `cleanup.md`

[`cleanup.md`](cleanup.md) pose : « Un script = du comportement par frame. **La composition et la configuration initiale vivent dans la fonction de spawn.** » Extraire le combo hors de `spawnPlayer` va littéralement contre cette phrase, donc autant l'assumer explicitement.

Ce principe visait une cible précise : sortir le setup statique **des scripts**, où il se déguisait en comportement (`PlayerScript.onCreate` qui fait `setScale(3, 3)`, `WallScript.onCreate` qui appelle `addComponent`). La fonction de spawn était nommée comme la destination de ce setup parce qu'elle était, à l'époque, le seul endroit qui n'était pas un script.

Un module de contenu n'est pas un script : il n'a pas de cycle de vie, il ne tourne pas par frame, il est appelé une fois depuis le spawn. Il ne réintroduit donc pas le problème que le principe combattait. Ce qui se déplace, c'est la frontière de « la fonction de spawn » : elle reste le lieu où l'entité est **assemblée** (assets résolus, prefabs instanciés, hiérarchie posée), et cesse d'être le lieu où le contenu est **déclaré** dès que cette déclaration est réutilisable.

Formulation mise à jour, valable pour les deux chantiers :

> La fonction de spawn assemble l'entité et injecte ses dépendances. Ce qui est réutilisable d'une entité à l'autre se déclare dans `content/`. Aucun des deux n'appartient à un script.

## 6. Suite possible

- `spawnEnemy` peut désormais donner l'épée à un ennemi en appelant le même `createSwordCombo`.
- Une deuxième arme (autres pitches, autre ordre d'attaques) est un deuxième fichier dans `content/weapons/`, sans toucher ni `SwordPrefab` ni les sites de spawn existants.
