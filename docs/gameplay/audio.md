# Système audio — `@atlasjs/audio`

> **Statut : implémenté.** Backend `@atlasjs/audio` (`AudioEngine`/`AudioLoader`/`AudioPlugin`) + intégration gameplay (`AudioSource`/`AudioSystem`/`AudioApi`), câblés dans `GameplayPlugin`. Lecture de sons (SFX one-shots + musique/ambiance en boucle) avec volume par source et volume master. Spatial reporté en V2 (§10, → backlog).
> Prérequis de lecture : `docs/assets/asset-system.md` (le couple `Asset`/`Resource` + `AssetManager` + loaders par type, calqué ici), `docs/gameplay/sprite-animation.md` (le couple composant `Animator` + `AnimatorSystem`, calqué par `AudioSource` + `AudioSystem`), `docs/gameplay/input-scripting.md` (le split composant `PlayerInput` + service `InputApi`, calqué par `AudioSource` + `AudioApi`).

---

## 1. Contexte & besoin

Le moteur a la physique, le renderer, le scripting, les animations, les prefabs et l'ECS — mais **aucun son**. C'est le dernier pilier classique de moteur de jeu absent. `apps/dino-brawl` (un jeu de baston) est muet : pas de bruit de coup, pas de musique, pas de pas de course.

Le v1 vise le « petit système audio complet » suffisant pour un jeu réel :

- **SFX one-shots** fire-and-forget (coup, saut, impact) — déclenchés depuis un script, immédiats, sans entité.
- **Musique / ambiance en boucle** — data-driven, portée par une entité (compose avec les prefabs).
- **Volume** — par source **et** master global, avec mute global.
- **Déblocage autoplay** — géré par le moteur (politique navigateur : `AudioContext` suspendu tant qu'aucun geste utilisateur).
- **Pause auto** quand l'onglet perd le focus.

Le spatial (pan/atténuation), les bus de mixage, le crossfade et le pooling de voix sont **hors périmètre v1** (§10).

## 2. Décision clé : component-first façon Unity, service pour les one-shots

Le système reprend **exactement** le split que fait déjà `@atlasjs/input` (`PlayerInput` composant + `InputApi` service) et le modèle Unity (`AudioSource` component + `AudioSource.PlayOneShot`) :

- **`AudioSource`** (composant LEVEL-1, données pures) : une voix gérée **par entité** — clip, volume, loop, mute, playOnAwake + `play()`/`stop()`. La musique = une entité avec un `AudioSource { loop: true, playOnAwake: true }`.
- **`AudioEngine`** (service) : propriétaire **unique** de l'audio graph Web Audio ; joue les one-shots (immédiats, sans entité), tient le master gain, gère le déblocage et la pause d'onglet.
- **`AudioSystem`** : réconcilie l'état des `AudioSource` vers des voix Web Audio réelles chaque frame.
- **`AudioApi`** (façade script) : surface curée pour les scripts (`playOneShot`, `masterVolume`, `muted`).

| Alternative | Rejetée car |
|---|---|
| **Service-only** (tout via `AudioApi.playMusic`/`stopMusic`, zéro composant) | Casse la cohérence ECS/Unity : pas de source par entité, la musique n'est pas data-driven (pas de `playOnAwake`), et **ne compose pas avec les prefabs**. |
| **Component-only** (les one-shots aussi via un `AudioSource` transitoire sur une entité jetable) | Churn d'entités + pression GC + ergonomie pénible pour du fire-and-forget. |
| **`AudioContext` exposé hors du moteur** (le loader / le système créent leurs propres nœuds) | Disperse la propriété du graph audio. Un seul propriétaire (`AudioEngine`) = testable, teardown propre, encapsulation. |

## 3. Package & structure — split façon `@atlasjs/input`

**Frontière de package calquée sur `@atlasjs/input`** (cf. son `CLAUDE.md` : « This package stays ECS-free… The per-entity `PlayerInput` component + sampling system live in `@atlasjs/gameplay` »). Le **backend audio pur** vit dans un nouveau package `@atlasjs/audio` (ECS-free, réutilisable seul) ; l'**intégration ECS** (composant + système + façade) vit dans `@atlasjs/gameplay`, exactement comme `PlayerInput` / `PlayerInputSystem` / `InputApi`.

### `@atlasjs/audio` (nouveau, backend pur — **zéro nexus, zéro gameplay**)

Package plugin autonome, configs (`package.json` / `tsdown.config.ts` / `vitest.config.ts` / `tsconfig.json`) copiées verbatim de `@atlasjs/assets`. Déps `workspace:*` : `@atlasjs/core`, `@atlasjs/assets`, `@atlasjs/utils`.

```
packages/audio/
  src/
    index.ts                  barrel (API publique)
    tokens.ts                 AUDIO_ENGINE
    AudioPlugin.ts            backend wiring (loader + service)
    AudioEngine.ts            service — possède l'audio graph
    Voice.ts                  handle interne (source + gain), NON exporté
    assets/
      AudioClipAsset.ts       Asset      (type "audio")
      AudioClip.ts            Resource   (wrap AudioBuffer)
      AudioLoader.ts          AssetLoader<AudioClipAsset, AudioClip>
  test/*.test.ts
```

### `@atlasjs/gameplay` (extension — l'intégration ECS + scripting)

Ajoute une dép `@atlasjs/audio` (`workspace:*`), comme il dépend déjà de `@atlasjs/input`/`@atlasjs/nebula`/`@atlasjs/inertia`.

```
packages/gameplay/src/
  components/AudioSource.ts             LEVEL-1 (données pures)
  systems/AudioSystem.ts               NexusSystem (réconciliation)
  scripting/services/AudioApi.ts        façade ScriptService
  GameplayPlugin.ts                     ← câble AudioSource + AudioSystem (requires AUDIO_ENGINE)
```

Conventions de nommage respectées : `*Asset` / `*Loader` / resource nue (`AudioClip`) / `*System` / composant sans suffixe (`AudioSource`) / `*Api` / `*Plugin` / token SCREAMING_SNAKE (`AUDIO_ENGINE`). Dépendances : `@atlasjs/audio` → {core, assets, utils} ; `@atlasjs/gameplay` → `@atlasjs/audio` (**acyclique**, l'audio n'importe jamais gameplay).

## 4. Assets — même moule que `TextureAsset` / `TextureLoader`

```ts
// AudioClipAsset.ts — descripteur sérialisable
export class AudioClipAsset implements Asset {
  public readonly type: string = "audio";
  public readonly id: string;
  public readonly source: string;
  public constructor(source: string, options?: { id?: string }) {
    this.source = source;
    this.id = options?.id ?? `audio:${source}`;   // id déterministe dérivé de source
  }
}

// AudioClip.ts — resource runtime (le buffer décodé)
export class AudioClip implements Resource {
  public constructor(
    public readonly id: string,
    public readonly buffer: AudioBuffer,
  ) {}
  public get duration(): number { return this.buffer.duration; }
  public destroy(): void {}   // AudioBuffer = GC natif, rien à libérer explicitement
}

// AudioLoader.ts — fetch → arrayBuffer → decodeAudioData
export class AudioLoader implements AssetLoader<AudioClipAsset, AudioClip> {
  public readonly type: string = "audio";   // doit matcher AudioClipAsset.type
  public constructor(private readonly engine: AudioEngine) {}
  public async load(asset: AudioClipAsset): Promise<AudioClip> {
    const res: Response = await fetch(asset.source);
    const data: ArrayBuffer = await res.arrayBuffer();
    const buffer: AudioBuffer = await this.engine.decode(data);
    return new AudioClip(asset.id, buffer);
  }
}
```

- `decodeAudioData` fonctionne **même contexte suspendu** → les assets chargent sans attendre le geste utilisateur.
- Chargement : `assets.load(new AudioClipAsset("sfx/hit.wav"))`, exactement comme les sprites. Dédup + cache par `id` gérés par l'`AssetManager` existant.
- Le loader passe par `engine.decode(...)` plutôt que par un `AudioContext` brut → l'`AudioContext` reste encapsulé dans `AudioEngine` (calque : `TextureLoader` prend le `NebulaRenderer`, pas le device WebGPU nu).

## 5. `AudioEngine` (service) — seul propriétaire de l'audio graph

Encapsule **tout** Web Audio. Le ctor accepte un `AudioContext` injectable → testable avec un fake (défaut `new AudioContext()`).

```ts
export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;      // toutes les voix → master → destination
  private _masterVolume: number = 1;
  private _muted: boolean = false;
  private unlocked: boolean = false;

  public constructor(ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.installUnlockGesture();      // pointerdown/keydown/touchstart one-shot → ctx.resume()
    this.installVisibilityPause();    // onglet caché → suspend ; visible → resume (si unlocked)
  }

  public decode(data: ArrayBuffer): Promise<AudioBuffer> { return this.ctx.decodeAudioData(data); }

  public playOneShot(clip: AudioClip, volume: number = 1): void { /* source+gain → master, start, auto-disconnect on ended */ }
  public createVoice(clip: AudioClip, opts: { loop: boolean; volume: number; mute: boolean }): Voice { /* source+gain → master, start, retourne le handle */ }

  public get masterVolume(): number { return this._masterVolume; }
  public set masterVolume(v: number) { this._masterVolume = Math.max(0, v); this.applyMaster(); }
  public get muted(): boolean { return this._muted; }
  public set muted(b: boolean) { this._muted = b; this.applyMaster(); }

  public destroy(): void { /* retire listeners, stoppe voix, ctx.close() */ }
}
```

- **One-shot** = chemin immédiat, sans entité, zéro latence (les SFX de coup).
- **Master gain** = point unique pour volume/mute global (`applyMaster` écrit `master.gain = muted ? 0 : masterVolume`).
- **`Voice`** (`Voice.ts`, interne, **non exporté**) : `{ stop(); setVolume(v); setMute(b); finished: boolean }`. Un `AudioBufferSourceNode` (avec `loop`) + un `GainNode` par voix, routés vers `master`. `finished` est mis à `true` par le handler `onended`.

## 6. `AudioSource` (composant) + `AudioSystem` (réconciliation)

> `AudioSource` (`components/`) et `AudioSystem` (`systems/`) vivent dans **`@atlasjs/gameplay`** (cf. §3), câblés par `GameplayPlugin` (cf. §7).

**`AudioSource` = données pures** (LEVEL-1, comme `SpriteRender`). Ses méthodes ne mutent **que ses propres champs** → aucun couplage au moteur audio.

```ts
export class AudioSource {
  public clip: AudioClip | null;
  public volume: number = 1;
  public loop: boolean = false;
  public mute: boolean = false;
  public playOnAwake: boolean = false;
  private _command: "none" | "play" | "stop" = "none";   // dernière intention de la frame
  private _isPlaying: boolean = false;                    // reflété par le système

  public constructor(
    clip: AudioClip | null = null,
    opts?: { volume?: number; loop?: boolean; mute?: boolean; playOnAwake?: boolean },
  ) { /* … applique les défauts */ }

  public play(): this { this._command = "play"; return this; }   // (re)démarre depuis le début
  public stop(): this { this._command = "stop"; return this; }
  public get isPlaying(): boolean { return this._isPlaying; }
}
```

**`AudioSystem`** possède la map `AudioSource → Voice` et réconcilie chaque frame :

```ts
export class AudioSystem implements NexusSystem {
  private readonly voices: Map<AudioSource, Voice> = new Map();
  public constructor(private readonly audio: AudioEngine) {}

  public update({ world }: NexusSystemContext): void {
    this.sweepFinished();                       // voix terminées → source._isPlaying = false, drop
    world.query(AudioSource).each((_e: Entity, src: AudioSource) => {
      this.consumeCommand(src);                 // "play" → createVoice (stop l'ancienne) ; "stop" → voice.stop()
      this.pushLiveState(src);                  // volume & mute poussés à la voix vivante
    });
  }

  public release(src: AudioSource): void { /* stop + drop la voix — appelé par onRemove */ }
}
```

- **Lane / stage** : enregistré par `GameplayPlugin` sur `update` / **`Late`** (nom `"gameplay:audio"`), donc après tous les scripts en `Logic` → un `play()` appelé dans un script est honoré **la même frame**.
- **`playOnAwake`** : `world.onAdd(AudioSource, (_e, src) => { if (src.playOnAwake) src.play(); })` dans `GameplayPlugin`.
- **Entité détruite en pleine lecture** : `world.onRemove(AudioSource, (_e, src) => audioSystem.release(src))` → stop + disconnect, **zéro fuite** (même pattern `onRemove` que le reste de `GameplayPlugin`).
- **`_command`** consommé puis remis à `"none"` chaque frame. `play()` (re)démarre toujours depuis le début (parité Unity `Play()`), même si une voix tourne déjà.
- Le système **ignore `dt`** : Web Audio a son propre clock ; le système ne fait que réconcilier l'état (volume/mute live, start/stop).

## 7. `AudioApi` (façade, gameplay) + `AudioPlugin` (backend, audio) + wiring ECS (gameplay)

### `AudioApi` — `@atlasjs/gameplay/scripting/services/` (comme `InputApi`)

```ts
export class AudioApi extends ScriptService<AudioEngine> {
  public static readonly token = AUDIO_ENGINE;
  public playOneShot(clip: AudioClip, volume?: number): void { this.provided.playOneShot(clip, volume); }
  public get masterVolume(): number { return this.provided.masterVolume; }
  public set masterVolume(v: number) { this.provided.masterVolume = v; }
  public get muted(): boolean { return this.provided.muted; }
  public set muted(b: boolean) { this.provided.muted = b; }
}
```
Les scripts l'importent depuis `@atlasjs/gameplay` (comme `InputApi`) : `this.getService(AudioApi).playOneShot(clip)`.

### `AudioPlugin` — `@atlasjs/audio` (backend seul, ECS-free)

Ne fait **que** le backend : il n'a **aucune** notion d'ECS (calque `InputPlugin`).

```ts
super("audio-plugin", { requires: [ASSET_MANAGER], provides: [AUDIO_ENGINE] });
```

1. `const assets = await engine.services.wait(ASSET_MANAGER);`
2. `this.audio = new AudioEngine();` (installe unlock + visibility)
3. `assets.register(new AudioLoader(this.audio));`
4. `engine.services.provide(AUDIO_ENGINE, this.audio); this.deferred.resolve();`

`uninstall` : `this.audio.destroy()`. App : ajouter `.use(new AudioPlugin())` à la chaîne (ordre libre, topo-trié au boot).

### Wiring ECS — dans `GameplayPlugin.install` (`@atlasjs/gameplay`)

`GameplayPlugin` ajoute `AUDIO_ENGINE` à ses `requires`, puis (calque `PlayerInputSystem`/`AnimatorSystem`) :

1. `const audio = await engine.services.wait(AUDIO_ENGINE);`
2. `const audioSystem = new AudioSystem(audio);`
3. `world.defineComponent(AudioSource);` (ajouté à `defineComponents`)
4. `unsubs`: `world.onAdd(AudioSource, (_e, src) => { if (src.playOnAwake) src.play(); })`, `world.onRemove(AudioSource, (_e, src) => audioSystem.release(src))`.
5. `registerSystem(update, world, audioSystem, { name: "gameplay:audio", stage: "Late" });` (garder le `StepHandle`).

## 8. Flux de données (bout en bout)

- **SFX depuis un script** : la scène charge et stashe `const hit = await assets.load(new AudioClipAsset("sfx/hit.wav"))` ; le script appelle `this.getService(AudioApi).playOneShot(hit)` → `AudioEngine` crée source→gain→master, joue, se déconnecte sur `ended`. Immédiat.
- **Musique** : entité avec `AudioSource { clip: music, loop: true, playOnAwake: true }` (via `addComponent`, un **prefab**, ou `attach`) → `onAdd` déclenche `play()` → `AudioSystem` démarre une voix en boucle au stage `Late`.
- **Déblocage `AudioContext`** : le contexte naît **suspendu** (autoplay). `AudioEngine` pose des listeners `pointerdown`/`keydown`/`touchstart` one-shot → 1er geste → `ctx.resume()` + `unlocked = true` + listeners retirés. Les voix créées avant le déblocage démarrent au resume (comportement web standard).
- **Onglet perd le focus** : `visibilitychange` caché → `ctx.suspend()` (tout se met en pause) ; visible → `ctx.resume()` **si `unlocked`** (un retour de visibilité n'est pas un geste utilisateur au sens autoplay).

## 9. Erreurs & edge cases

- **Décodage échoué** (fichier/format invalide) : la promesse du loader rejette → `AssetManager` retire l'entrée de `loading` (retry permis), l'erreur remonte à `assets.load` (awaité par l'appelant). Même contrat que `TextureLoader`.
- **`clip === null` + `play()`** : `consumeCommand` no-op gardé (aucune voix créée).
- **Voix non-loop terminée** : `onended` met `voice.finished = true` → `sweepFinished` la balaie (`source._isPlaying = false`, disconnect).
- **Teardown plugin** : `AudioEngine.destroy()` stoppe toutes les voix, retire les listeners (unlock + visibility), `ctx.close()`.
- **Volume** : clampé `>= 0` (autorise le boost > 1), défaut `1`. `mute` force le gain à 0 sans écraser la valeur de `volume`.
- **`resume()` rejeté** (geste non fiable) : best-effort, l'erreur est avalée ; le prochain geste réessaiera (listeners retirés uniquement après un resume réussi).
- **Environnement sans `AudioContext`** (jsdom/node en test) : contexte **injectable** dans le ctor → fake en test (aucun `new AudioContext()` implicite hors navigateur).
- **Lecture same-frame de `isPlaying`** : un script qui fait `src.play()` puis lit `src.isPlaying` dans le **même** `onUpdate` voit encore `false` (le système réconcilie en `Late`, après `Logic`). Documenté, non bloquant (comportement analogue aux notes caméra 1-frame).

## 10. Hors périmètre v1 → `docs/backlog/_index.md#audio`

- **Audio spatial 2D** : pan + atténuation par distance via `Transform2D` + un `AudioListener` (sur la caméra/joueur), `PannerNode` Web Audio. `AudioSource` est déjà forward-compat (le système pourra lire `Transform2D` sans casser le modèle de données). Ouvre la porte 3D.
- **Pause/resume par source** : nécessite le tracking d'offset + recréation du `AudioBufferSourceNode` (les source nodes ne se pausent pas nativement). Le suspend global (`ctx.suspend()`, §8) couvre le besoin v1 (pause d'onglet / futur menu pause).
- **Bus / groupes de mixage** (master → sfx / music / ui) + **ducking** automatique.
- **Crossfade** entre musiques.
- **Pooling de voix / cap de concurrence** (Web Audio encaisse beaucoup de `AudioBufferSourceNode`, non urgent).
- **Refcount / eviction** des `AudioClip` (dépend du chantier `AssetManager` V2).
- **(Dé)sérialisation** des refs de clip (`AssetRef` par id) pour scène/prefab sur disque.

## 11. Tests (TDD, vitest, `test/*.test.ts`)

Unitaires, avec un **fake `AudioContext`** (pattern `FakeResource` / `CountingLoader` de `packages/assets/test`).

**`packages/audio/test/`** (backend) :

- **`AudioClipAsset`** : dérivation d'`id` (`audio:${source}`, override par `options.id`).
- **`AudioLoader.load`** : `fetch` + `decode` mockés → `AudioClip` porte le buffer + l'`id` de l'asset.
- **`AudioEngine`** : `playOneShot` câble source→master et démarre ; `masterVolume`/`muted` écrivent le master gain (mute → 0 sans perdre `volume`) ; geste de déblocage → `resume` appelé + listeners retirés ; `destroy` ferme le contexte + retire les listeners.

**`packages/gameplay/test/`** (intégration ECS) :

- **`AudioSource`** : `play()`/`stop()` positionnent le `_command` ; défauts du ctor.
- **`AudioSystem`** (avec un fake `AudioEngine`) : `playOnAwake` → voix créée ; `play()` puis update → voix démarrée ; `stop()` → voix stoppée ; `volume`/`mute` poussés live à la voix ; voix finie balayée → `isPlaying` false ; `release` (onRemove) libère la voix.
