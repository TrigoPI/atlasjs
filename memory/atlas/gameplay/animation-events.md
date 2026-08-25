# Events d'animation — `Animator` (`@atlasjs/gameplay`)

> **Statut : implémenté.** Ajoute trois events au composant `Animator` : `started`, `finished`, `loop`. Extension incrémentale de `memory/atlas/gameplay/sprite-animation.md` (sort `onComplete` de sa liste V2 §10).
> Prérequis de lecture : `memory/atlas/gameplay/sprite-animation.md` (le composant `Animator` + `AnimatorSystem`), `packages/core` `EventBus` (pub/sub typé réutilisé ici).

---

## 1. Contexte & besoin

Un script veut réagir aux frontières d'un clip : jouer un son quand la marche boucle, enchaîner une anim quand une attaque non-loop se termine, déclencher un effet au démarrage d'un clip. Aujourd'hui `Animator` n'expose aucun point d'accroche — le stub `// event / callback plus tard` de nebula n'a jamais été câblé.

## 2. Décision clé : détection **côté gameplay**, nebula intouché

Tout est détectable depuis les getters existants de `AnimationPlayer`/`SpriteAnimation` — `getCurrentAnimationName()`, `getCurrentAnimation()`, `isPlaying()`, `getCurrentFrameIndex()` — donc **aucune modification de `@atlasjs/nebula`**.

| Alternative | Rejetée car |
|---|---|
| Émettre depuis `SpriteAnimation` (nebula) | Casse l'invariant « nebula lean / backend-agnostic ». Surtout : `SpriteAnimation` porte l'état de lecture **mutable** — des events dessus seraient liés à l'instance de clip, pas à l'entité (collision si deux entités partagent un clip). Les events appartiennent à l'`Animator`, per-entité. |
| Détecter dans `AnimatorSystem` | Rendrait l'`Animator` non testable seul et disperserait la logique. Le composant possède ses events. |

## 3. Surface API (sur `Animator`)

Réutilise l'`EventBus<TEvents>` de `@atlasjs/core` (pub/sub typé : `on`/`off`/`emit`/`clear`, retourne un `Unsubscribe`).

```ts
export type AnimatorEvents = {
  started: string;   // payload = nom du clip
  finished: string;
  loop: string;
};

public on<K extends keyof AnimatorEvents>(event: K, cb: (clip: string) => void): Unsubscribe;
public off<K extends keyof AnimatorEvents>(event: K, cb: (clip: string) => void): void;
```

- Payload = **nom du clip** (`string`) — zéro allocation, colle au phrasé `onAnimationFinished(clip)`.
- Multi-abonnés (l'`EventBus` gère un `Set` par event). `on` retourne un `Unsubscribe`.

### Sémantique des trois events

| Event | Déclencheur | Fréquence |
|---|---|---|
| `started` | Un clip devient le clip actif via `play(name)` **quand le nom change réellement**, ou est rejoué explicitement via `play(name, true)`. | Une fois par switch (ou par replay explicite). No-op si `play(name)` vise le clip déjà actif sans `restart` (cohérent avec `AnimationPlayer.play`). |
| `finished` | Un clip **non-loop** atteint sa dernière frame (front `playing` true→false pendant `tick`). | **Une seule fois** ; pas de répétition sur les ticks suivants. Jamais pour un clip en boucle. |
| `loop` | Un clip en boucle **boucle** (wrap d'index : `nowIndex < prevIndex` alors que `playing` reste vrai). | À **chaque** cycle. |

## 4. Mécanique de détection

- **`play(name, restart = false)`** : compare `getCurrentAnimationName()` avant/après `player.play(name, restart)` → si le nom courant change **ou** si `restart` est demandé, `emit("started", current)`.
- **`tick(deltaMs)`** : capture `(wasPlaying, prevIndex)` sur le clip courant, délègue à `player.tick`, relit `(nowPlaying, nowIndex)` :
  - `wasPlaying && !nowPlaying` → `emit("finished", name)`
  - sinon si `nowPlaying && nowIndex < prevIndex` → `emit("loop", name)`

Émission **synchrone** dans le tick. L'`AnimatorSystem` tourne après les scripts (stage `Logic`, `after` scripts), donc les callbacks voient un état cohérent. `EventBus.emit` copie la liste des listeners avant l'itération → sûr si un callback (dé)s'abonne ou appelle `play()`.

## 5. Points assumés (documentés, non résolus)

- Le `play(initial)` du **constructeur** n'émet pas `started` (il appelle `player.play` directement, et aucun abonné n'existe encore — le script s'abonne après `addComponent` en `onCreate`).
- Un `tick` géant sautant plusieurs cycles ne compte qu'**un** wrap (coalescing, comme Unity). Un wrap exact `0 → 0` (delta = durée pile) n'est pas détecté.
- Pas de fuite mémoire : les listeners vivent dans l'`EventBus` de l'instance `Animator` ; entité détruite → `Animator` + bus GC'd avec les closures du script (lui aussi détruit). Aucun registre global.

## 6. Tests (TDD)

`packages/gameplay/test/animator.test.ts` (bloc `describe("Animator events")`) :

- `started` émis avec le nom du clip sur switch ; **pas** émis sur `play(name)` du clip déjà actif.
- `finished` émis **une seule fois** quand un clip non-loop atteint sa dernière frame ; **jamais** pour un clip en boucle.
- `loop` émis à chaque wrap d'un clip en boucle ; **pas** pour un non-loop.
- `off` désabonne ; plusieurs abonnés sur le même event sont tous appelés.

## 7. Hors périmètre (reste V2 → `memory/atlas/backlog/`)

Events de **frame** (le stub nebula reste), state machine / transitions, blend trees, payload enrichi (`{ clip, frame, loopCount }`). Le replay d'un clip non-loop terminé, lui, est couvert depuis par `Animator.play(name, true)`.
