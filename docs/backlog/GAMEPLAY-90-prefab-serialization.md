---
id: GAMEPLAY-90
status: vision
domain: gameplay
source: "[[prefab]]"
effort: L
verified: 2026-08-25
---

# Sérialisation des prefabs (`PrefabAsset`, loader, remap de références)

Trois docs listent cet item en V2 sans qu'aucune note ne le porte : `prefab.md` §10, `exposed-script-variables.md` §11, `prefab-multi-entity.md` §9. Cette note est leur point de convergence.

Ce qu'il faudrait : un `PrefabAsset` chargeable depuis un fichier, son loader, et le remap des références internes au sous-arbre — un prefab qui contient une prop `GameEntity` pointant vers un de ses propres enfants doit voir cette référence recâblée à l'instanciation, pas pointer sur l'entité du modèle.

**Le blocage est unique, et il est structurel.** `Prefab.build` est une **closure opaque** (`packages/gameplay/src/scripting/core/Prefab.ts`) : `definePrefab` capture une fonction JavaScript arbitraire, que rien ne peut inspecter ni rejouer depuis des données. Il n'existe donc **aucun chemin incrémental** vers la sérialisation — il faudrait un second modèle, déclaratif, décrivant l'arbre en données plutôt qu'en code, et les deux modèles devraient coexister ou l'un remplacer l'autre. C'est ce qui fait de cet item un `L` et non un `M`, et ce qui explique qu'il traîne dans trois docs sans avancer.

**L'introspection statique est un corollaire, pas un item séparé.** `prefab.md` §10 la liste à part — pouvoir lister les composants et scripts d'un prefab sans l'instancier. C'est exactement le même blocage : une closure ne se lit pas. En faire une note autonome créerait un doublon qui dérivera de celle-ci. Elle est traitée ici, et elle tombe gratuitement le jour où le modèle déclaratif existe.

À trancher avant d'ouvrir le chantier : est-ce que le besoin réel est *la sérialisation* (charger un prefab depuis un fichier, donc un éditeur en ligne de mire) ou seulement *l'introspection* (outillage, gizmos, debug) ? La seconde est nettement moins chère si on accepte une déclaration parallèle et facultative, du type métadonnées posées à côté de la closure — le même geste que `registerScriptMetadata` pour les scripts. La première impose le modèle complet.

**Accroche :** `packages/gameplay/src/scripting/core/Prefab.ts` — la forme de `Prefab.build` est la seule vraie décision ; tout le reste en découle.

**À rapprocher de :** [[GAMEPLAY-91-prefab-instance-pooling]] — l'autre V2 de `prefab.md` §10, indépendante de celle-ci.
