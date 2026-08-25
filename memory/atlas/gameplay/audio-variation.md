---
status: implemented
summary: "Variation audio implémentée : pitch sur AudioSource et helpers de random côté code de jeu."
---
# Audio V1.1 — variation (pitch appliqué + random côté code)

> **Statut : implémenté.** Suite du [système audio v1](audio.md). Le bouton **`pitch`** (playbackRate) existe au même niveau que `volume` (`AudioSource.pitch` → `AudioSystem` → `Voice`/`AudioEngine`), et les deux helpers purs (`randomRange`, `pickRandom`) existent dans `@atlasjs/utils`, consommés côté jeu par `apps/dino-brawl/src/game/prefabs/fx/RunningAudioPrefab.ts` pour rouler la variation **depuis le code de jeu** — pas en dur dans le composant.
> Prérequis de lecture : [`audio.md`](audio.md) (le split backend `@atlasjs/audio` / intégration ECS `@atlasjs/gameplay`, `AudioSource` + `AudioSystem` + `AudioApi`, le couple `Voice`/`AudioVoice`).

---

## 1. Contexte & besoin

Le système audio v1 sait jouer des SFX one-shots + de la musique en boucle avec **volume** par source et master. Il manque la **variation** : dix pas de course qui jouent le même clip au même pitch au même volume sonnent morts et robotiques.

Le besoin v1.1, formulé par l'auteur :

- **Random de pitch** — chaque lecture varie légèrement de hauteur/vitesse.
- **Random de volume** — chaque lecture varie légèrement d'intensité (déjà possible aujourd'hui, cf. §5).
- **Sélection aléatoire de clip** — piocher un clip parmi un jeu de variantes (`grass01..04`) à chaque lecture.

**Contrainte d'auteur, structurante :** le random doit se **contrôler en code** (prefab / script), exactement comme dans `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` où le `build` d'un prefab fait déjà `audio.volume = Math.random() * 0.05 + 0.05`. **Pas de champ de range natif au composant** (`pitchMin`/`pitchMax`, auto-roll dans le système) : l'auteur veut garder la main.

## 2. Décision clé : le moteur expose des boutons, le random vit dans le code

Le moteur reste sur des **boutons appliqués et déterministes**. Toute la génération aléatoire vit dans le code de jeu, via des helpers purs.

- **Zéro `Math.random` dans le backend audio** — `@atlasjs/audio` reste SSR-safe et testable en node, cohérent avec l'`AudioEngine` v1 (injectable, sans jsdom).
- **Zéro `Math.random` dans `@atlasjs/math`** — la classe `MathUtils` reste une pure fonction numérique déterministe. Tout le non-déterminisme est isolé dans **un seul** module `random` de `@atlasjs/utils`, frontière propre.
- Le composant `AudioSource` gagne un champ `pitch` (donnée pure appliquée, comme `volume`) — **pas** de range.

C'est le pattern `spawnPlayer` étendu : un bouton `pitch` que l'auteur affecte lui-même (`audio.pitch = randomRange(0.9, 1.1)`), au même titre que `audio.volume`.

## 3. Le seul vrai manque moteur : le bouton `pitch`

### 3.1 Sémantique

`pitch` mappe **directement** sur `AudioBufferSourceNode.playbackRate` (un multiplicateur), modèle « magnétophone » (tape-style), identique au `pitch` d'Unity/Godot :

| `pitch` | effet |
| --- | --- |
| `1` | normal (défaut) |
| `2` | +1 octave **et** ×2 vitesse |
| `0.5` | −1 octave **et** ½ vitesse |

Hauteur et vitesse sont **couplées** : c'est le comportement natif d'un buffer source Web Audio. Un pitch-shift indépendant de la vitesse (phase-vocoder) est **hors périmètre** (choix d'auteur). Guard : `Math.max(0, pitch)`, comme `volume` (un `playbackRate` ≤ 0 est invalide ; `0` = silence).

### 3.2 `@atlasjs/audio` (backend)

- **`PlaybackParams`** (nouveau type exporté) : `{ volume?: number; pitch?: number }`.
- **`AudioEngine.createVoice(clip, { loop, volume, mute, pitch })`** — pose `source.playbackRate.value = Math.max(0, pitch ?? 1)` à la création.
- **`AudioEngine.playOneShot(clip, params?: PlaybackParams)`** — applique `volume` **et** `pitch`. **Changement de signature** (cf. §6).
- **`AudioVoice.apply(volume, muted, pitch)`** / **`Voice`** — le pitch devient **live** (symétrique du volume) : `apply` re-pose `playbackRate.value` chaque frame. Le type `AudioVoice` et l'implémentation `Voice` sont mis à jour ; les fakes de test aussi.

### 3.3 `@atlasjs/gameplay` (intégration ECS)

- **`AudioSource`** : nouveau champ public `pitch: number` (défaut `1`) + `AudioSourceOptions.pitch?`.
- **`AudioSystem`** : passe `source.pitch` à `createVoice` (création) **et** dans `pushLiveState` (`voice.apply(source.volume, source.mute, source.pitch)`).
- **`AudioApi.playOneShot(clip, params?: PlaybackParams)`** — forward le nouvel objet d'options.

`volume` n'est **pas** touché (déjà appliqué live). Aucun champ de range n'est ajouté nulle part.

## 4. Les helpers : `@atlasjs/utils` module `random`

Nouveau module `packages/utils/src/random.ts`, exporté par le barrel :

```ts
export function randomRange(min: number, max: number, rng: () => number = Math.random): number;
export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T;
```

- `randomRange(min, max)` → `min + rng() * (max - min)`.
- `pickRandom(items)` → élément à `Math.floor(rng() * items.length)`. **Throw** sur tableau vide (piocher dans le vide est un bug d'appelant, pas un cas nominal).
- **`rng` injectable** (défaut `Math.random`) → testables en node **sans mocker le global**, même philosophie que l'`AudioEngine` SSR-safe. En jeu, l'auteur omet `rng`.

Ces helpers sont **génériques** (pas audio-spécifiques) et **optionnels** : pur sucre au-dessus de `Math.random`, jamais appelés par le moteur lui-même.

> `apps/dino-brawl` devra déclarer `@atlasjs/utils` en dépendance directe s'il ne l'a pas déjà (transitive aujourd'hui via `@atlasjs/gameplay`).

## 5. Résultat côté auteur (footstep du dino)

Le prefab `running_audio`, extrait depuis `spawnPlayer.ts` vers `apps/dino-brawl/src/game/prefabs/fx/RunningAudioPrefab.ts`, roule la variation dans son `build` :

```ts
const audio: AudioSource = entity.add(AudioSource, pickRandom([deps.sound]), {
  playOnAwake: true,
});
audio.volume = randomRange(0.5, 0.8);
audio.pitch  = randomRange(1, 1.2);
```

> Le jeu ne fournit pour l'instant qu'**un** clip d'herbe (`deps.sound`) : `pickRandom` est déjà câblé, sur un tableau d'un seul élément, prêt à recevoir `grass01..04`.

`RunningAudioPlayerScript` réinstancie ce prefab à chaque foulée → le `build` re-roll pitch, volume **et** clip sur chaque instance fraîche. Aucune nouvelle mécanique de re-trigger : le pattern « instancie un prefab par lecture » de l'auteur porte déjà la re-randomisation.

## 6. Changement de signature (breaking interne)

`AudioEngine.playOneShot(clip, volume?: number)` → `playOneShot(clip, params?: PlaybackParams)`.
Idem `AudioApi.playOneShot`. Rétro-compat en positionnel écartée : un objet d'options passe mieux à l'échelle (pitch aujourd'hui, `pan` demain).

**Rayon d'impact** (vérifié) : `AudioEngine`, `AudioApi`, le fake `packages/gameplay/test/helpers/fake-audio.ts`, et les tests qui l'exercent. **Aucune app** n'appelle `playOneShot` (dino-brawl passe par `AudioSource`). Migration triviale.

## 7. Hors périmètre (assumé)

Déjà au [backlog V2](../backlog.base), domaine `audio`, on n'y touche pas ici :

- `pan` / audio spatial 2D · fade / enveloppe (attaque-relâche) · filtres low/high-pass.
- bus de mixage / ducking · crossfade musiques · pooling de voix / cap de concurrence.

Et par choix d'auteur : **aucun champ de range natif** au composant, **aucun pitch-shift** découplé de la vitesse.

## 8. Tests & preuve

- **`@atlasjs/utils`** : `randomRange` (bornes, monotonie, `rng` injecté aux extrêmes 0 → `min`, ~1 → proche `max`) ; `pickRandom` (index déterministe via `rng`, throw sur vide).
- **`@atlasjs/audio`** : `createVoice` pose `playbackRate.value` depuis `pitch` ; `playOneShot(params)` applique volume + pitch ; `Voice.apply` met à jour `playbackRate` live ; défaut `pitch = 1`.
- **`@atlasjs/gameplay`** : `AudioSource.pitch` défaut `1` + option ; `AudioSystem` propage `pitch` à `createVoice` et via `apply`.
- **Preuve navigateur** (dino-brawl) : les pas de course varient audiblement en pitch/volume/clip ; console/logs propres.
