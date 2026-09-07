---
id: GAMEPLAY-112
status: todo
domain: gameplay
effort: S
verified: 2026-09-01
---

# Le seam de test unitaire publié ne sait pas déclencher `onFixedUpdate`

`@atlasjs/gameplay/testing` — le seam **unitaire** publié pour les auteurs de jeu — expose
`createScriptHarness(Type, options)` dont la seule avance de temps est `advance(dt)`, et
`advance` fait exactement deux choses (`packages/gameplay/src/testing/createScriptHarness.ts:81-84`) :

```ts
advance: (dt: number): void => {
  context.advanceTimers(dt);
  script.onUpdate?.(dt);
},
```

**Rien n'y appelle `onFixedUpdate`.** Un script dont la logique vit sur la lane fixe est donc
**intestable au seam unitaire** — et la lane fixe est désormais l'emplacement **recommandé** pour un
modèle de vélocité (`onFixedUpdate` porte le `fixedDelta` brut et tourne avant `PhysicsRequest`, cf.
[[velocity-ownership]] §6). Ce n'est plus un cas de coin : c'est le chemin conseillé.

Seul `packages/gameplay/test/helpers/harness.ts` — le seam d'**intégration**, `Engine` réel, interne
au package — l'atteint, via `frame()`. Un auteur de jeu n'y a pas accès : `package.json` n'exporte
que `.` et `./testing`.

**Accroche :** `advance(dt)` est le **seul** endroit à étendre — soit un `fixedAdvance(dt)` explicite,
soit une option de pas fixe qui fasse tourner `onFixedUpdate` n fois puis `onUpdate` une fois, ce qui
reproduirait au passage la vraie asymétrie des deux lanes. Le guide du package
(`packages/gameplay/CLAUDE.md`) consigne déjà le trou voisin — **le seam unitaire ne peut pas non
plus observer la mise à l'échelle du temps**, `StubScriptContext` n'ayant pas de `TimeScaleManager` —
donc le paragraphe à compléter existe déjà.

**À rapprocher de :** [[GAMEPLAY-84-test-suite-hygiene]] (l'autre dette de la suite de tests du
package). Le même trou vu depuis l'app — `apps/bump-royal` sans infra de test — **est livré**
(2026-09-06, cf. [[state-sync]]) : l'app a désormais vitest et 149 specs. Mais elles ont dû piloter
un vrai `Engine`, précisément parce que le seam publié décrit ici ne sait pas déclencher
`onFixedUpdate`. Cet item reste donc entier, et il a maintenant un consommateur qui le contourne.
