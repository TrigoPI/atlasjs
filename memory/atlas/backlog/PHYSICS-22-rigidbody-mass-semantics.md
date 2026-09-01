---
id: PHYSICS-22
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-09-01
---

# `RigidBody2D.mass` ne veut pas dire la même chose des deux côtés du pont

`PhysicsPushSystem` appelle `body.setMass(rigidBody.mass)` **à chaque frame**. Côté `RapierRigidBody`, `setMass` délègue à **`setAdditionalMass`** — une masse *ajoutée* par-dessus celle que rapier calcule depuis la densité des colliders attachés. Ce n'est pas la masse totale, et `getMass()` ne la reflète même pas.

Sondé sur le vrai backend :

```
masse sans collider                    : 0
masse avec un collider 10×10 densité 1 : 100
après setMass(5)                       : 100     <- inchangé
```

**Re-sondé le 2026-09-01 : le tableau ci-dessus est incomplet, et sa conclusion trop dure.**
`Collider2D.density` vaut **0 par défaut**, et avec une densité nulle la masse dérivée vaut 0,
donc `setMass` devient de fait autoritatif — mesuré `base 0` → `setMass(5)` → **5**. Avec une
densité de 1, `setMass(5)` ne laisse pas non plus la masse inchangée : il l'**additionne**,
`0.080` → **5.080**. L'écart avec la sonde d'origine vient probablement du `step()` — la mesure
ci-dessus lit la masse après un pas, l'autre la lisait sans doute avant que rapier ait recomposé
ses propriétés de masse. Conséquence pratique : dans la configuration par défaut du dépôt,
`RigidBody2D.mass` **fonctionne** comme masse totale, et ne ment qu'à partir du moment où une
densité non nulle entre en jeu. La sémantique reste à trancher, mais l'urgence baisse.

Le faux moteur, lui, stocke et rend la valeur telle quelle : `mass` y est parfaitement autoritatif. Le contrat du composant est donc **implémenté dans le double et pas dans le backend réel**, et il est intestable — c'est le point n°6 de l'audit [[PHYSICS-20-audit-physics-fake-fidelity]].

Ce n'est pas un patch du double : il faut **décider ce que `RigidBody2D.mass` signifie**, et les deux réponses sont défendables.

- **Masse totale.** Le sens intuitif pour un auteur de jeu, et celui que le faux applique déjà. Impose de désactiver le calcul par densité côté rapier (`setDensity(0)` sur les colliders, ou `setAdditionalMassProperties`), donc de faire de `Collider2D.density` un champ mort ou de trancher sa priorité.
- **Masse additionnelle.** Fidèle à rapier, cohérent avec `density` qui reste utile, mais alors le nom ment : il faudrait `additionalMass`, et documenter que la masse effective d'un body dépend de ses colliders.

Contrainte à ne pas perdre de vue : `memory/atlas/gameplay/gameplay-redesign.md` §4 promet un « sync `mass`/`type` ». Le `type` a été traité par `dbe53cb`, la `mass` est donc la moitié restante de cette promesse — et elle est aujourd'hui écrite chaque frame pour un effet nul.

**Accroche :** trancher la sémantique d'abord, écrire la spec côté `packages/rapier` ensuite (elle prouvera le comportement réel), et n'ajuster le double qu'en dernier. Dans l'ordre inverse on figerait dans le faux une sémantique que le backend ne tient pas — exactement le motif que l'audit a documenté quatre fois.

**À rapprocher de :** `PHYSICS-17` (`inertia.setBodyType`), **livré** dans la PR #6 et donc sorti du backlog — c'était l'autre moitié du même « sync `mass`/`type` ». Le `type` est désormais tranché ; la sémantique de `mass`, non.
