---
id: GAMEPLAY-91
status: vision
domain: gameplay
source: "[[prefab]]"
effort: M
verified: 2026-08-25
---

# Pooling d'instances de prefab

Listé en V2 dans `prefab.md` §10 sans note pour le porter : recycler les entités d'un prefab fréquemment instancié puis détruit — projectiles, impacts, particules — au lieu de passer par `createEntity`/`destroy` à chaque fois.

Deux points à consigner tant qu'ils sont frais, parce qu'ils décident si ce chantier est jouable.

**Le pooling entre en collision frontale avec le throw d'`addComponent`.** Recycler une entité veut dire rejouer un `build` sur une entité qui porte déjà les composants du tour précédent. Or `GameEntityHandle.addComponent` **lève** désormais quand des arguments seraient jetés sur un composant déjà présent (commit `5dbe4a4`) — c'était le correctif d'un bug silencieux, et il est juste. Un prefab qui fait `add(SpriteRender, sprite)` échouerait donc au second passage. Le pooling suppose soit un chemin de recyclage qui remet l'entité à nu avant le `build`, soit un mode « réinitialiser » distinct d'`addComponent`. Ce n'est pas un détail d'implémentation : c'est la première décision à prendre.

**Rien ne montre aujourd'hui que ça vaut le coup.** Le seul chiffrage d'allocation fait sur ce moteur (voir `GAMEPLAY-89`) mesurait une scène instanciant deux prefabs FX par frame, et `createEntity`/`destroy` n'apparaissait nulle part dans le profil — les poids lourds étaient ailleurs. Avant d'ouvrir ce chantier, **mesurer**, avec la méthode consignée dans `GAMEPLAY-89` : profileur d'allocation échantillonné, drapeaux GC activés, et surtout pas un delta `heapUsed`, qui a donné des résultats inversés deux fois.

Le pooling est aussi le genre d'optimisation qui **ajoute une classe de bugs** — état résiduel entre deux vies d'une entité — en échange d'un gain non démontré. À ne pas ouvrir sans un profil qui le réclame.

**Accroche :** commencer par la mesure, pas par le code. Si le profil ne montre rien, la bonne action est de fermer cette note.

**À rapprocher de :** [[GAMEPLAY-90-prefab-serialization]] — l'autre V2 de `prefab.md` §10, indépendante.
