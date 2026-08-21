# Cues d'attaque — sons multiples & multi-hit par phase (`apps/dino-brawl`)

> **Statut : ✅ implémenté & vérifié navigateur.** Donne à `AttackTimeline` un canal d'événements (« cue ») posé sur les phases, avec deux consommateurs : l'audio (plusieurs sons dans une même attaque) et le re-armement de la fenêtre de touche de `MeleeHitResolver` (toucher le même ennemi plusieurs fois dans une même attaque). Ajoute au passage l'override d'impact par attaque, deux easings à `@atlasjs/math`, une attaque `LungeAttack`, et corrige un bug de `ThrustAttack`.
> Prérequis de lecture : le pipeline d'attaque existant — `apps/dino-brawl/src/game/scripts/weapon/attacks/` (`WeaponAttack`, `TimelineAttack`, `AttackTimeline`, `AttackChain`) et `apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts`.

---

## 1. Contexte & besoin

Le combo rapière (`apps/dino-brawl/src/game/content/weapons/rappierSwordCombo.ts`) enchaîne un `ThrustAttack` sec et un `ThrustChainAttack` qui pique trois fois d'affilée. Deux limites bloquent le feeling :

- **Un son par attaque.** `WeaponAttack.begin()` appelle `playClip()` une fois, au démarrage. La rafale de trois piques ne produit donc qu'un seul `woosh` — les deux piques suivantes sont muettes.
- **Un hit par attaque et par ennemi.** `MeleeHitResolver` mémorise les cibles déjà touchées dans un `Set<Entity>` vidé par `beginSwing()`, appelé une seule fois depuis `SwordScript.startAttack()`. La rafale de trois piques n'inflige donc **qu'un** hit à un ennemi resté dans la hitbox.

Racine commune : **la timeline n'a aucun moyen d'exprimer « il se passe quelque chose à cet instant »**. `AttackTimeline.sample(t, out)` est une fonction d'échantillonnage pure, et `begin()` est le seul point d'événement de tout le pipeline.

Le combo cible, arrêté avec l'auteur :

| Maillon | Attaque | Rôle |
| --- | --- | --- |
| 1 | `ThrustAttack` | pique sèche et rapide, un hit |
| 2 | `ThrustChainAttack` | rafale de piques, pitch montant, **un hit par pique** |
| 3 | `LungeAttack` *(nouveau)* | fente finisher : longue portée, lente, un seul hit qui claque |

## 2. Décision clé : un canal de cue unique, deux consommateurs

Plutôt que deux mécanismes séparés (une piste audio + un réglage de multi-hit), la phase porte **un** événement dont l'audio et le combat sont deux lectures.

```ts
export type AttackCueSound = {
  clip?: AudioClip;
  pitch?: number;
  volume?: number;
};

export type AttackCue = {
  sound?: AttackCueSound;
  rearmHits?: boolean;
};

export type AttackPhase = {
  name: string;
  duration: number;
  angleOffset?: AttackTween;
  radiusScale?: AttackTween;
  scale?: AttackTween;
  cue?: AttackCue;
};
```

Conséquence directe sur la rafale : chaque phase `thrust` déclare `cue: { sound: { pitch }, rearmHits: true }`. Le son **et** le hit tombent au même instant, celui de l'extension visible de la lame. Le rythme des dégâts est calé sur l'animation par construction, pas par un réglage de durée à faire coïncider à la main.

| Alternative | Rejetée car |
| --- | --- |
| Piste de cues séparée à timestamps absolus (`cues: [{ at: 0.12, … }]`) | Deuxième axe temporel à garder synchronisé avec les durées de phase : changer une `thrustDuration` désynchronise silencieusement les cues. Les phases **sont** déjà le découpage rythmique de l'attaque ; une phase se coupe en deux si un cue doit tomber en son milieu. |
| Cooldown temporel par cible sur `MeleeHitResolver` (`hitCooldown`) | Découplé de l'animation : continue de toucher pendant le `recover`, et le nombre de hits dépend du temps passé dans la hitbox plutôt que du nombre de piques. Un seul réglage, mais un rythme de dégâts non lisible à l'écran. |
| Cue **et** cooldown, tous deux configurables | Deux systèmes qui se recouvrent, à comprendre et régler ensemble, pour un besoin que le cue couvre seul. |
| Events d'`Animator` (`docs/gameplay/animation-events.md`) | Les attaques ne sont pas jouées par un `Animator` — la pose est calculée procéduralement par `AttackTimeline`. Aucun clip d'animation sur lequel s'accrocher. |

## 3. `AttackTimeline` reste pur

`sample(t, out)` **ne gagne aucun effet de bord** : un outil de debug ou un test doit pouvoir échantillonner n'importe quel `t`, dans n'importe quel ordre, sans déclencher de son. La collecte de cues est donc une requête explicite sur un intervalle :

```ts
public get hasSoundCue(): boolean;
public collectCues(fromT: number, toT: number, out: AttackCue[]): void;
```

- `collectCues` pousse dans `out` le cue de chaque phase dont le `start` tombe dans `]fromT, toT]` — borne basse exclusive, borne haute inclusive, pour qu'un `advance` par frame ne rejoue ni ne saute jamais un cue.
- Une frame longue qui franchit plusieurs phases pousse **tous** les cues franchis, dans l'ordre chronologique.
- Zéro allocation : `out` est un tableau possédé et vidé par l'appelant.
- `hasSoundCue` est calculé une fois dans le constructeur (aucune phase ne peut être ajoutée après coup).

## 4. `TimelineAttack` devient l'émetteur

```ts
public begin(): void;             // curseur à -1, puis super.begin()
public advance(t: number): void;  // collecte ]curseur, t], joue les sons, mémorise le rearm
public get rearmsHits(): boolean; // vrai tant que le dernier advance() a franchi un cue rearmHits
```

- Le curseur initialisé à `-1` par `begin()` fait partir la phase à `start = 0` au **premier** `advance()`. `SwordScript` incrémente son horloge avant d'échantillonner, donc le premier `t` vu est `dt`, jamais `0` : sans sentinelle négative, le cue de la première phase ne partirait jamais.
- Résolution du son d'un cue, avec repli sur l'attaque : `cue.sound.clip ?? this.clip`, `cue.sound.pitch ?? this.pitch`, `cue.sound.volume ?? this.volume`. Un `cue: { sound: {} }` rejoue donc simplement le clip de l'attaque, sans rien redéclarer.
- `rearmsHits` reflète le **dernier** `advance()` et retombe à `false` au suivant. Plusieurs cues `rearmHits` franchis dans la même frame valent un seul re-armement : c'est un booléen, pas un compteur.

### 4.1 Qui pilote le son : la timeline gagne

`WeaponAttack.begin()` passe par un hook surchargeable :

```ts
protected playsClipOnBegin(): boolean; // WeaponAttack → true
```

`TimelineAttack` le surcharge par `!this.getTimeline().hasSoundCue`. Une attaque qui déclare au moins un cue sonore devient **seule maîtresse de son audio** ; la rafale place donc un cue sur ses trois piques, la première à `t = 0`, sans double-son. `defaultSwordCombo` ne déclare aucun cue → `playsClipOnBegin()` reste `true` → comportement strictement inchangé.

L'alternative « les cues sont des sons en plus » a été écartée : elle obligerait la rafale à ne déclarer des cues que sur les piques 2 et 3, déclaration asymétrique et piège à double-son permanent.

### 4.2 La base reste utilisable sans timeline

`WeaponAttack` fournit `advance(t): void` en no-op et `rearmsHits → false`. Une attaque non-timeline (par exemple un futur `AttackChain` imbriqué, ou une attaque scriptée) reste un `WeaponAttack` valide sans rien implémenter.

## 5. Câblage : `AttackChain` puis `SwordScript`

`AttackChain` forwarde `advance(t)` et `rearmsHits` vers l'attaque courante, exactement comme il forwarde déjà `duration` et `sample`.

Dans `SwordScript.updateAttackingState`, juste après `this.attackClock += dt` :

```ts
this.attack.advance(this.attackClock);

if (this.attack.rearmsHits) {
  this.armResolver();
}

this.attack.sample(this.attackClock, this.pose);
```

`armResolver()` est un privé qui appelle `beginSwing(knockback, hitstop)` avec les valeurs résolues du §6 ; `startAttack()` l'appelle aussi, ce qui laisse un seul point de vérité.

**L'ordre est structurant** : le re-armement doit précéder le `getResolver().resolve(...)` de la même frame, sinon le hit de la pique part une frame trop tard — visible à 60 fps sur des phases de 50 ms.

## 6. Impact par attaque

`knockback`, `hitstopDuration` et `shake` vivent aujourd'hui sur `SwordScript`, donc identiques pour les trois maillons du combo : une fente finisher frapperait exactement comme une pique. C'est le levier qui manque le plus au feeling.

`WeaponAttack` gagne deux props optionnelles exposées, `knockback?` et `hitstop?`, forwardées par `AttackChain` depuis l'attaque courante. `SwordScript` prend l'override quand il existe et retombe sinon sur sa propre valeur, à la fois pour construire le `HitInfo` et pour armer son `hitstopRemaining`.

Deux pièges d'implémentation, tous deux dans du code existant :

- **`MeleeHitResolver` reçoit `knockback` et `hitstop` une fois, au constructeur**, et le résolveur est mis en cache par `getResolver()`. Un override par attaque impose donc de porter ces deux valeurs sur `beginSwing(knockback, hitstop)` — déjà appelé à chaque re-armement — et de laisser le constructeur ne prendre que la source de cibles.
- **`SwordScript.startAttack()` appelle aujourd'hui `beginSwing()` *avant* `this.attack.begin()`.** Or c'est `AttackChain.begin()` qui sélectionne le maillon courant : lire l'override avant, c'est lire celui de l'attaque **précédente**. `startAttack()` doit donc appeler `this.attack.begin()` d'abord, puis armer le résolveur.

`shake` reste sur `SwordScript` : le spec ne l'inclut pas.

## 7. Easings

`@atlasjs/math` n'expose que `Easing.inOutQuad` et `Easing.outCubic`. Une détente de fente demande une courbe plus raide. Ajout de deux méthodes statiques à la classe existante :

- `outQuint` — détente qui part comme une balle et s'écrase en fin de course.
- `outBack` — léger dépassement en fin de phase, pour l'overshoot de la fente.

Purement additif, aucune signature touchée. **`pnpm --filter @atlasjs/math build` est obligatoire** après l'ajout : `apps/dino-brawl` résout `@atlasjs/math` par son champ `exports` → `./dist` et continuerait de voir l'ancienne API.

## 8. Contenu : les attaques

### 8.1 `ThrustChainAttack` — paramétrable et sonore

L'implémentation actuelle est trois paires `thrust`/`hold` copiées-collées, `thrustCount` figé à 3 en dur. Elle devient une boucle sur des props exposées :

- `thrustCount` (défaut `3`) — nombre de piques.
- `pitchStep` (défaut `0.08`) — incrément de pitch par pique ; c'est ce qui donne le crescendo, la lame monte en hauteur à mesure qu'elle accélère.
- `radiusStep` (défaut `0`) — incrément optionnel de portée par pique.
- Chaque phase `thrust` porte `cue: { sound: { pitch: basePitch + index * pitchStep }, rearmHits: true }`.
- Une unique phase `recover` en fin de boucle.

Résultat : `thrustCount` piques = `thrustCount` sons = `thrustCount` hits sur un même ennemi.

### 8.2 `LungeAttack` — la fente (nouveau fichier)

Nouveau `TimelineAttack` dans `apps/dino-brawl/src/game/scripts/weapon/attacks/LungeAttack.ts`, exporté depuis `attacks/index.ts`.

| Phase | Durée indicative | Contenu |
| --- | --- | --- |
| `windup` | ~0.12 s | armement en recul : `radiusScale → pullbackRadius`, léger `angleOffset`, `inOutQuad`. Cue sonore optionnel d'armement. |
| `extend` | ~0.06 s | détente : `radiusScale → lungeRadius` (large), `outQuint`. **Cue sonore**, et **pas** de `rearmHits` → un seul hit. |
| `hold` | ~0.06 s | pleine extension, fenêtre de touche généreuse. |
| `recover` | ~0.28 s | retour `radiusScale → 1`, `inOutQuad`. Lenteur assumée : c'est le coût du finisher. |

Toutes les durées et portées sont des props exposées, comme sur les attaques existantes. `knockback` et `hitstop` (§6) portent le poids du coup.

### 8.3 `rappierSwordCombo`

Trois maillons : `ThrustAttack` → `ThrustChainAttack` → `LungeAttack`, avec un `pitch` de base élevé conservé (feeling « rapière ») et le `thrust`/`swing` de clips actuels.

## 9. Caveats de conception

Quatre pièges de ce système, tous rencontrés pendant l'implémentation.

### 9.1 Une phase qui *maintient* ne doit rien déclarer

`AttackTimeline` reporte le `to` d'une phase dans la phase suivante qui ne déclare aucun tween sur ce canal. Une phase `hold` qui doit rester à pleine extension se déclare donc avec son seul `name` et sa `duration` — c'est le cas de `LungeAttack.hold`.

Y ajouter un `radiusScale` est au mieux redondant, au pire faux. Une version intermédiaire de `ThrustAttack` déclarait :

```ts
radiusScale: { from: this.thrustDuration, to: this.thrustRadius }
```

`thrustDuration` au lieu de `thrustRadius` : avec la config rapière, le `radiusScale` sautait de `3` à `0.05` à l'entrée du `hold` avant de ressortir — la lame se rétractait d'un coup contre le joueur en pleine extension. Deux tests existants attrapaient déjà la régression.

`ThrustChainAttack.hold` garde son bloc, lui : il rétracte réellement la lame de son rayon atteint vers `pullbackRadius` entre deux piques.

### 9.2 Le curseur de `TimelineAttack` est monotone

Un `advance(t)` dont le `t` est inférieur ou égal au curseur est **ignoré**, et ne recule pas le curseur. Sans cette garde, une horloge qui régresse rejoue les cues déjà franchis : `advance(0.05)` → `advance(0.15)` → `advance(0.08)` → `advance(0.12)` refaisait partir le cue à `0.1`, donc double son et double touche.

La correction naïve — reculer le curseur puis sortir — ne corrige rien : le prochain `advance` avant franchit à nouveau la même frontière. Seule la monotonie du curseur supprime le problème. `begin()` reste le seul point qui rembobine.

### 9.3 `rearmsHits` est un booléen, pas un compteur

Plusieurs cues `rearmHits` franchis dans une même frame valent **un seul** re-armement. Conséquence de gameplay réelle : à framerate effondré, une frame qui saute plusieurs phases `thrust` d'un coup ne place qu'**une** touche au lieu de trois, alors que les trois sons partent bien. Le choix est assumé — un compteur imposerait plusieurs `resolve()` dans la même frame — mais il faut le connaître avant de conclure à un bug de multi-hit sur une machine qui rame.

### 9.4 L'ordre d'armement dans `startAttack()`

`this.attack.begin()` doit précéder l'armement du résolveur, parce que c'est `AttackChain.begin()` qui sélectionne le maillon courant : armer d'abord lirait l'override d'impact de l'attaque **précédente**. Et le repli de `beginSwing` est nullish (`??`), pas de la véracité (`||`), pour qu'un `knockback: 0` ou un `hitstop: 0` explicite soit honoré au lieu d'être écrasé par le défaut de l'arme.

## 10. Tests

`pnpm --filter dino-brawl test` (vitest). Le harnais existe déjà dans `apps/dino-brawl/test/game/scripts/weapon/attacks/weaponAttack.test.ts` : `FakeAudioApi` qui enregistre les appels `playOneShot`, et `injectField` pour injecter les props après construction. Rappel structurant : les props d'un script sont injectées **après** le constructeur, ce pour quoi `TimelineAttack.getTimeline()` construit sa timeline paresseusement au premier accès — un test doit donc injecter ses champs avant de lire `duration` ou d'appeler `advance`.

| Fichier | Couvre |
| --- | --- |
| `attackTimeline.test.ts` *(étendu)* | `collectCues` : borne basse exclusive / haute inclusive, plusieurs phases franchies en une frame, ordre chronologique, phase sans cue, `out` vidé par l'appelant. `hasSoundCue` vrai/faux. |
| `timelineAttack.test.ts` *(nouveau)* | `advance` joue les sons via `FakeAudioApi` avec les pitch/volume résolus (cue puis repli attaque) ; `rearmsHits` vrai sur la frame de franchissement et faux à la suivante ; `begin()` n'auto-play plus dès qu'un cue sonore existe, et auto-play toujours sinon. |
| `thrustChainAttack.test.ts` *(nouveau)* | nombre de phases pour `thrustCount` variés, un cue `rearmHits` par pique, pitch croissant de `pitchStep`, durée totale. |
| `lungeAttack.test.ts` *(nouveau)* | durée totale, `radiusScale` croissant sur `extend` puis constant sur `hold`, retour à 1 en fin de `recover`, un seul cue sonore, aucun `rearmHits`. |
| `attackChain.test.ts` *(étendu)* | forwarding de `advance` et `rearmsHits` vers l'attaque courante ; le `FakeAttack` existant gagne les deux membres. |
| `swordScript.test.ts` *(étendu)* | `beginSwing()` rappelé quand l'attaque signale `rearmsHits`, et l'override `knockback`/`hitstop` par attaque pris en compte. |

`pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json` pour le type-check (le `tsc --noEmit` nu est un no-op dans cette app).

## 11. Vérification navigateur — constat

Le rythme d'un combo ne se valide pas en test unitaire. Mesuré en jeu via la skill `atlas-verify-webgpu`, en instrumentant temporairement `TimelineAttack.fireCue` d'un `console.log` (sonde retirée depuis) :

```
ThrustChainAttack sound=2.50 rearm=true
ThrustChainAttack sound=2.62 rearm=true
ThrustChainAttack sound=2.74 rearm=true
LungeAttack       sound=1.60 rearm=false
```

Trois cues par rafale au pitch montant — exactement `THRUST_PITCH + index × pitchStep` — chacun re-armant la fenêtre de touche ; un seul cue pour la fente, sans re-armement. Zéro erreur console, tous les clips chargés dont `audio:woosh_3`.

**Condition de validité :** le pane navigateur doit être réellement *affiché*. Fronté mais réduit, le jeu tourne à 4 fps, où une attaque entière (0,23 s) se termine entre deux frames et où une attaque traverse le capteur sans le déclencher — rien n'y est observable. Affiché, la boucle atteint 60 fps et la mesure devient valide. Lire le compteur de fps à l'écran avant de conclure quoi que ce soit.

## 12. Hors scope

- `shake` par attaque (reste sur `SwordScript`).
- Cooldown de hit temporel par cible.
- Cues portant autre chose que du son et du re-armement (spawn de FX, root motion, dégâts variables) — le type `AttackCue` est extensible par ajout de champ optionnel le jour où le besoin arrive.
- Remontée du système d'attaques de `apps/dino-brawl` vers un package `@atlasjs/*`.
