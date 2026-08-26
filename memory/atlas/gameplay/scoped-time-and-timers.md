---
status: planned
summary: "Échelle de temps par périmètre et timers de script : design validé, implémentation à venir en deux étapes (97 puis 96)."
---
# Temps périmétré et timers de script (`@atlasjs/gameplay`)

> **Statut : planifié.** Design validé, rien n'est implémenté. Couvre deux items de backlog
> qui ne sont séparables que dans cet ordre : [[GAMEPLAY-97-scoped-hitstop-timescale]]
> (l'échelle de temps par périmètre) puis [[GAMEPLAY-96-script-timers]] (les timers, qui
> consomment le `dt` défini par la première). Ferme aussi
> [[APP-15-attack-chain-reset-ignores-hitstop]], mécaniquement.

---

## 1. Problème

Le moteur n'a **qu'une seule horloge**. `TimeControl` (`packages/core/src/public/engine/TimeControl.ts:4-12`)
expose un `scale` global, appliqué par `Engine.startLoop` au `rawDt` avant d'alimenter
les trois lanes (`packages/core/src/public/engine/Engine.ts:254-264`). Il n'existe aucun
moyen de ralentir un sous-arbre.

Or le hitstop de mêlée doit figer l'attaquant et sa victime **sans** figer la caméra :
mettre `scale` à 0 gèlerait le shake déclenché sur le même impact
(`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:156`). Conséquence : `TimeApi`
(`packages/gameplay/src/scripting/services/TimeApi.ts:5-16`) n'a **aucun appelant** dans
le monorepo, et l'app a écrit son propre gel — deux fois, de deux façons divergentes.

Côté attaquant (`SwordScript.ts:134-138`), `hitstopRemaining` suspend l'horloge d'attaque
et rien d'autre. Côté victime (`combat/HurtReactionScript.ts:91-104`), le même décompte
suspend le knockback **et** met l'`Animator` en pause à l'entrée (`:125-127`) puis le
reprend à la sortie (`:102`). Deux gels, deux périmètres, une seule intention.

Deux défauts en découlent.

**Latent — la désynchronisation d'une frame.** Les deux valeurs viennent de la même source
(`SwordScript.ts:154` → `MeleeHitResolver.ts:46,60` → `HurtboxScript.ts:74` →
`HurtReactionScript.ts:123`), mais rien ne garantit qu'elles démarrent sur la même frame :
`HurtReactionScript` ne détecte le coup qu'en comparant `hurtbox.hitCount` dans son propre
`onUpdate` (`:78-81`). La victime réagit dans la même frame **uniquement** parce que
l'ennemi est instancié après le joueur et son épée (`ArenaScene.ts:41-53`), donc plus loin
dans l'ordre d'itération de `ScriptManager`. Inverser l'ordre de spawn décale la victime
d'une frame, et aucun test ne le verrait.

**Actif — la fenêtre de combo.** `AttackChain.onUpdate`
(`scripts/weapon/attacks/AttackChain.ts:70-72`) accumule `elapsedSinceBegin` en temps mur,
alors que le seuil qu'il alimente (`:85-90`) est comparé à une durée d'attaque mesurée sur
l'horloge **gelée** de `SwordScript`. Détail complet dans
[[APP-15-attack-chain-reset-ignores-hitstop]].

Second problème, indépendant mais lié : **`AtlasScript` n'offre aucune planification
temporelle.** `ScriptLifecycle` (`packages/gameplay/src/scripting/core/ScriptLifeCycle.ts:3-12`)
déclare huit hooks, aucun ne concerne le temps. Résultat mesuré dans `dino-brawl` :
**dix horloges écrites à la main dans sept scripts**, sur deux patrons seulement. Le cas
révélateur est `PlayerAnimationScript` : son champ `clock` est déclaré (`:28`), initialisé
(`:40`), incrémenté (`:49`), remis à zéro (`:57`) — et **jamais lu**. Quatre occurrences,
aucune lecture. Un accumulateur anonyme ressemble à tous les autres ; un chronomètre nommé
aurait rendu l'oubli impossible à écrire.

---

## 2. Décisions

| Question | Décision | Écartée |
| --- | --- | --- |
| Comment un périmètre porte son échelle | Composant hérité par le sous-arbre, résolu **à la lecture** en remontant la chaîne de parents, avec mémo par frame | Une passe de propagation racines → feuilles comme les transforms ; des canaux nommés sans hiérarchie |
| Qui obéit à l'échelle | Les scripts et l'`Animator` | Les traînées, les afterimages, le shake de caméra et le rendu — qui gardent le `dt` brut |
| Surface `TimeApi` | La primitive (`scaleOf` / `setScale` / `clearScale`) **et** le sucre `freeze` | La primitive seule ; `freeze` seul |
| Portée de la livraison 97 | Moteur **et** migration complète de `dino-brawl` | Moteur seul ; migration à l'identique conservant la désynchro |
| Lane des timers | La lane variable seulement | Un choix explicite par timer ; les deux lanes via `runLifecycle` |
| Primitives de timer | `stopwatch` · `countdown` · `every` · `cancel` | `after`, qui n'a aucun site d'usage aujourd'hui |

Deux de ces choix méritent leur justification.

**Résolution à la lecture plutôt que propagation.** La note 97 proposait de réutiliser le
mécanisme de `TransformPropagationSystem` (`packages/gameplay/src/systems/TransformPropagationSystem.ts:18-29`
pour la collecte des racines, `:42-73` pour la récursion) et posait son coût comme
« à arbitrer avant de s'engager » : une seconde passe par frame sur toute la forêt. La
résolution paresseuse évite entièrement cette passe, et surtout elle **coûte zéro quand la
feature n'est pas utilisée** — ce qui est l'état par défaut du moteur et le restera pour la
majorité des frames. La profondeur réelle des hiérarchies du jeu est de 2 à 3 niveaux, et
le mémo borne le pire cas à une remontée par entité et par frame.

**`after` est écarté.** Une fois 97 livré, les deux hitstops manuels disparaissent et il
reste huit des dix horloges de `dino-brawl`. Leur cartographie sur l'API esquissée par la
note 96 donne : 2 comptes à rebours, 1 répétition, **4 accumulateurs lus comme un temps
écoulé**, 1 code mort, et **0 callback à retardement**. Le patron le plus fréquent était le
seul non couvert, et la primitive proposée n'avait aucun appelant. `after` reste
ajoutable le jour où un site le réclame — [[GAMEPLAY-103-auto-destroy-component]] est le
candidat naturel.

---

## 3. Architecture — échelle de temps par périmètre

### 3.1 Le composant

```ts
TimeScale { value: number }   // via defineScriptComponent, clampé à >= 0
```

Posé sur une entité, il vaut pour **tout son sous-arbre**. L'imbrication multiplie : une
entité sous deux ancêtres porteurs subit le produit des deux échelles, ce qui compose
naturellement avec le `scale` global déjà appliqué en amont par `Engine.startLoop`. Une
échelle à 0 gèle, une échelle à 0,5 ralentit de moitié, 1 est le temps réel.

### 3.2 La résolution

Un `TimeScaleManager`, côté `gameplay`, derrière le token `TIME_SCALE_MANAGER` — le montage
est celui de `CameraManager`/`CameraApi`, imposé par une contrainte du framework : un
`ScriptService` est adossé à **un seul** token (`packages/gameplay/src/scripting/core/ScriptService.ts:8-23`),
donc `TimeApi`, aujourd'hui sur `TIME` (dans `core`), ne peut pas atteindre le monde. Le
manager délègue le `scale` global au `TimeControl` de `core` et porte le reste.

```ts
scaleOf(entity: Entity): number
```

remonte la chaîne de parents en multipliant les `TimeScale` rencontrés, avec un mémo
`Map<Entity, number>` vidé en début de frame.

**Le court-circuit est la partie qui compte.** Une seule requête `world.query(TimeScale)`
par frame ; si elle est vide, `scaleOf` rend `1` sans parcourir quoi que ce soit et sans
toucher au mémo. Aucun crochet d'ajout/retrait de composant à maintenir : l'information est
recalculée une fois par frame, au même endroit que la purge du mémo.

### 3.3 Les consommateurs

| Consommateur | `dt` |
| --- | --- |
| `ScriptManager.update` → `onUpdate` | `dt * scaleOf(entityId)` |
| `AnimatorSystem` | `dt * scaleOf(entity)` par entité animée |
| `CameraSyncSystem` (shake) | brut |
| `TrailRenderSystem`, `AfterimageRenderSystem` | brut |
| Lane `render`, lane `fixed` | brut |

L'`Animator` est dans le périmètre parce que c'est lui qui fait disparaître le
`pause()`/`resume()` manuel de `HurtReactionScript` : un gel devient un vrai gel, animation
comprise. Le shake reste hors périmètre parce que c'est exactement ce que la note 97
exige — la caméra doit continuer de bouger pendant que les combattants sont figés.

La lane fixe est hors périmètre pour cette livraison : `onFixedUpdate()` ne reçoit aucun
`dt` aujourd'hui, et la physique passe par rapier, qui ne sait pas ralentir un corps
isolément.

### 3.4 Gel n'est pas désactivation

Un script gelé reçoit `onUpdate(0)` et **continue de tourner** : il peut lire l'input,
détecter un impact, décider de se relâcher. Seul son *temps* s'arrête. Cela le distingue
d'un `setEnabled(false)`, qui le retire de la boucle.

Corollaire à assumer explicitement dans la migration : **ce qui est recalculé sans `dt`
n'est pas gelé.** L'angle de visée en est l'exemple — il dérive de la position de la souris,
pas d'une intégration temporelle, et continuera donc de suivre le curseur pendant le gel.
`SwordScript` gèle aujourd'hui cet angle à la main (`frozenAimAngle`, `:134-137`) et devra
continuer de le faire, en lisant l'état de gel via `scaleOf` plutôt que via un compteur
propre.

### 3.5 L'API

```ts
class TimeApi extends ScriptService<TimeScaleManager> {
  get scale(): number;                                  // global, inchangé
  set scale(value: number);

  scaleOf(entity: Entity): number;                      // échelle effective
  setScale(entity: Entity, value: number): void;
  clearScale(entity: Entity): void;

  freeze(seconds: number, ...entities: Entity[]): void;
}
```

L'entité est toujours explicite : un `ScriptService` est construit à partir du seul
`ServiceRegistry` (`packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts:41`) et
ne connaît donc pas le script appelant. Un script passe `this.entityId`.

`freeze` met 0 sur chaque entité, décompte, puis **restaure la valeur précédente** — pas 1,
pour ne pas écraser un ralenti déjà en place.

Le décompte tourne sur le `dt` **global** de la frame, jamais sur le `dt` du périmètre :
une échelle à 0 gèlerait son propre décompte et ne se relâcherait jamais. Effet de bord
voulu et cohérent : une pause globale (`scale = 0`) suspend aussi les hitstops en cours.

Le caractère **variadique** de `freeze` est ce qui tue le défaut latent de la §1 —
l'attaquant gèle les deux camps dans le même appel, sur la même frame, sans dépendre de
l'ordre d'itération des scripts.

---

## 4. Architecture — timers de script

### 4.1 Où ils vivent

Un tableau de timers porté par le `ScriptInstanceRecord`
(`packages/gameplay/src/scripting/core/core-types.ts:9-17`), avancé dans
`ScriptManager.update(dt)` avec **le même `dt` scopé** que `onUpdate`, et **juste avant**
l'appel à `onUpdate` — pour qu'un script qui lit `.done` ou `.elapsed` dans sa frame voie
l'état de cette frame et non de la précédente.

L'annulation se fait dans `tearDownScript`
(`packages/gameplay/src/scripting/runtime/ScriptManager.ts:384-417`), au même endroit que
`onDestroy` : **un timer ne survit jamais à son script.**

### 4.2 Les primitives

```ts
protected stopwatch(): Stopwatch;                       // .elapsed  .reset()
protected countdown(seconds: number): Countdown;        // .remaining .elapsed .done .reset(s?)
protected every(seconds: number, cb: () => void): Repeater;  // .interval (mutable) .reset()
protected cancel(handle: TimerHandle): void;
```

`stopwatch` et `countdown` sont **passifs** : ils avancent, le script les lit. `every` est
le seul à rappeler du code, et son callback passe par la même mise en quarantaine que les
autres phases — s'il lève, le script est désactivé et l'erreur journalisée, exactement comme
dans `runLifecycle` (`ScriptManager.ts:276-283`).

**Pourquoi `Repeater` porte un `interval` mutable et un `reset()`.** Son unique site
d'usage, `MovementEmitterScript.ts:38-56`, a un intervalle qui change à chaud — `walkInterval`
ou `runInterval` selon que le bouton de course est enfoncé — et remet son horloge à zéro dès
que le joueur s'arrête. Un intervalle figé à la création ne s'y branche pas. Les deux membres
sont donc dictés par le seul appelant, pas par anticipation.

**Rattrapage de `every` :** au plus **un déclenchement par frame**, le reste conservé
(`elapsed -= interval`, borné à un intervalle). Pas de rafale de callbacks après une frame
longue ou un onglet en arrière-plan, et pas de dérive de phase accumulée.

### 4.3 Un gel gèle les timers

Les timers consommant le `dt` scopé, un `freeze` suspend le cooldown de dash et les i-frames
de l'entité gelée. C'est le comportement que la note 96 réclame explicitement : *« un
cooldown de dash qui continue de couler pendant un hitstop recrée exactement le bug
d'`AttackChain` »*. C'est aussi la raison pour laquelle 96 ne peut pas être livré avant 97 —
poser l'API des timers d'abord reviendrait à figer le mauvais `dt` dans la signature.

---

## 5. Migration de `dino-brawl`

### 5.1 Étape 97 — les deux hitstops

| Site | Devient |
| --- | --- |
| `SwordScript.ts:76,134-138` `hitstopRemaining` | `time.freeze(hitstop, épée, ...victimes)` à la résolution |
| `SwordScript.ts:135-136` pose figée | conservée, mais conditionnée par `scaleOf` au lieu d'un compteur propre |
| `HurtReactionScript.ts:58,91-104` `hitstopRemaining` | supprimé |
| `HurtReactionScript.ts:102,125-127` `animator.pause()/resume()` | supprimé — l'`Animator` obéit au périmètre |
| `MeleeHitResolver.ts:39-66` | expose les victimes touchées ; il les connaît déjà (`struck`) |
| `AttackChain.ts:70-72` | **non touché** — script de l'épée, son `dt` tombe à 0 |

### 5.2 Étape 96 — les sept horloges vivantes

| Site | Devient |
| --- | --- |
| `PlayerDashScript.ts:56,101-103` cooldown | `countdown` |
| `HurtboxScript.ts:25,50-56` i-frames | `countdown` |
| `MovementEmitterScript.ts:46-55` intervalle | `every` |
| `SwordScript.ts:101` phase de flottement | `stopwatch` |
| `SwordScript.ts:140` `attackClock` | `stopwatch` + `reset()` sur `begin` |
| `AttackChain.ts:71` `elapsedSinceBegin` | `stopwatch` |
| `PlayerDashScript.ts:159` progression du dash | `stopwatch` |
| `PlayerAnimationScript.ts:28,40,49,57` | **supprimé** — jamais lu |

Les deux `hitstopRemaining` ayant disparu à l'étape précédente, il ne reste que sept
horloges des dix recensées, et la couverture est complète.

---

## 6. Vérification

Deux niveaux, les deux obligatoires avant de déclarer quoi que ce soit terminé.

**Tests de package** (`packages/gameplay/test/`, harness existant).

Pour 97, le test que la note dicte en premier : deux scripts sur deux sous-arbres, geler
l'un, vérifier que l'autre avance. Puis l'héritage par le sous-arbre, le produit à
l'imbrication, la restauration de la valeur **précédente** après `freeze`, le décompte de
`freeze` insensible à l'échelle du périmètre mais sensible au `scale` global, l'`Animator`
gelé, le shake **non** gelé, et le court-circuit qui rend 1 sans parcours quand aucun
`TimeScale` n'existe.

Pour 96 : avance sur le `dt` scopé, ordre timers-avant-`onUpdate`, `every` qui ne tire
qu'une fois sur une frame longue tout en conservant son reste, quarantaine sur un callback
qui lève, annulation à la destruction du script.

**Vérification navigateur** dans `dino-brawl`, via la skill `atlas-verify-webgpu`.

Le point critique : `defaultSwordCombo` ne déclare **aucun** hitstop — c'est précisément ce
qui rend APP-15 latent (`content/weapons/defaultSwordCombo.ts:26-32`, et le repli
`hitstopDuration` de `SwordScript.ts:44` vaut 0). Il faudra basculer sur `rappierSwordCombo`
(`content/weapons/rappierSwordCombo.ts:49`, `hitstop: 0.12`) ou passer un `hitstop` non nul
pour que le gel soit seulement **observable**, puis vérifier à l'écran que l'attaquant et sa
victime se figent ensemble tandis que le shake de caméra continue.

---

## 7. Séquencement

1. **GAMEPLAY-97** — composant, manager, consommateurs, `TimeApi`, migration des deux
   hitstops. Livré et commité seul.
2. **GAMEPLAY-96** — registre de timers, primitives, migration des sept horloges.

L'ordre inverse ne compile pas : 96 consomme le `dt` scopé introduit par 97.

À la clôture, [[APP-15-attack-chain-reset-ignores-hitstop]] quitte le backlog sans
traitement propre — la cause de fond ayant disparu.

---

## 8. Hors périmètre

- La lane fixe (`onFixedUpdate` n'a pas de `dt`) et la physique rapier.
- Les traînées et les afterimages, laissées sur le `dt` brut faute de pouvoir juger l'effet
  visuel avant de l'avoir vu. À rouvrir si le gel des FX manque à l'écran.
- `after(seconds, cb)`, sans site d'usage — voir §2.
- [[GAMEPLAY-06-animation-clip-timescale]], une échelle **par clip** d'animation, qui est
  une autre question que l'échelle par entité.
