---
status: implemented
summary: "Animation de sprite implémentée : composant Animator et AnimatorSystem poussant la frame courante."
---
# Animation de sprite — `Animator` + `AnimatorSystem` (`@atlasjs/gameplay`)

> **Statut : implémenté.** Câble l'animation de sprite dans la voie gameplay : un composant `Animator` (clips nommés, `play(name)`) piloté par un `AnimatorSystem` qui pousse la frame courante dans `SpriteRender`. Réutilise `SpriteSheet`/`Frame`/`SpriteAnimation` de `@atlasjs/nebula` ; la seule modif nebula est de rendre `SpriteAnimation` piloté par `dt`.
> Prérequis de lecture : `memory/atlas/rendering/sprites.md` (le `Sprite` asset + `SpriteRenderSystem` sur lesquels on se branche), `memory/atlas/gameplay/scripting-components.md` (les deux niveaux de composants), `memory/atlas/core/scheduling.md` (lanes/stages).

---

## 1. Contexte

`@atlasjs/nebula` fournit déjà les briques d'animation dans `animations/` :

- **`SpriteSheet`** — texture + `Frame`s nommées, helpers `fromGrid`/`fromAutoGrid`.
- **`Frame`** — `texture: Texture2D` + `rect: Bound`.
- **`SpriteAnimation`** — `frames: Frame[]` + `fps` + `loop` + `play/pause/resume/stop` + `getCurrentFrame()`.

Mais ces briques sont **inaccessibles depuis la voie gameplay**. Dans le pipeline gameplay, le nœud nebula (`graphics/SpriteNode`) est **détenu en interne** par `SpriteRenderSystem` (monté par entité, projeté depuis `SpriteRender` chaque frame — cf. `memory/atlas/rendering/sprites.md`). Or `SpriteAnimation.updateAndApply(spriteNode)` pousse **directement dans un nœud nebula**, en s'appuyant sur une **`Clock` wall-clock interne**. Résultat : aucun moyen propre de faire vivre une animation à travers le modèle de données gameplay, et le temps d'animation ignore le `dt` du moteur (pause, timescale, déterminisme).

Il manque donc **un composant + un système côté gameplay** qui tick l'animation active et fait suivre le rendu via le canal existant.

## 2. Insight central : réutiliser le swap de `Sprite`

`SpriteRenderSystem.resolveNode` gère **déjà** le changement de `Sprite` asset :

- même instance → no-op ;
- texture différente → recréation du nœud ;
- **même texture, rect différent → `setSourceRect`** (pas de recréation).

Une animation = une suite de `Frame`s **sur la même texture** avec des `rect` différents. Donc l'animator n'a qu'à **assigner un `Sprite` asset correspondant à la frame courante dans `SpriteRender.sprite`** : le swap est absorbé gratuitement par le chemin existant, sans toucher `SpriteRenderSystem`.

Chaque `Frame` (stable, issue d'un `SpriteSheet`) est mappée vers **un** `Sprite` asset mis en cache (`Map<Frame, Sprite>` au niveau système) → zéro allocation en régime, dédup entre entités partageant une sheet.

## 3. Décisions de design

| # | Décision |
|---|----------|
| Niveau composant | `Animator` = composant **LEVEL 1** (`components/`), utilisé **brut** par les scripts. Pas de façade : pas d'autorité à router (`play` = mutation), précédent `PlayerInput`. |
| Portée | **Clips nommés + `play(name)`**. Pas de state machine, blend tree, ni events (V2). |
| Source de temps | **`dt` du moteur** (secondes), converti en ms. Déterministe, respecte pause/timescale. Impose de rendre `SpriteAnimation` dt-driven. |
| Frame → rendu | Assignation de `SpriteRender.sprite` (swap absorbé par `SpriteRenderSystem`). Cache `Map<Frame, Sprite>` au niveau système. |
| Ordonnancement | `AnimatorSystem` en lane **`update`**, **après les scripts** (respecte un `play()` fait dans `onUpdate`), donc avant `SpriteRenderSystem` (`render/PreRender`) via l'ordre inter-lane `fixed→update→render`. |

## 4. Modification nebula : `SpriteAnimation` piloté par `dt`

Seul changement dans `@atlasjs/nebula`. Remplacer la `Clock` wall-clock interne par un **accumulateur `elapsedMs`** avancé explicitement.

```ts
export class SpriteAnimation {
  // ... frames, frameDuration (= 1000 / fps), loop, playing inchangés
  private elapsedMs: number;        // remplace la Clock

  public tick(deltaMs: number): void;   // NOUVEAU : avance l'anim de deltaMs si playing
  public getCurrentFrame(): Frame;       // inchangé
  public getCurrentFrameIndex(): number; // inchangé
  public isPlaying(): boolean;           // inchangé
  public getDuration(): number;          // inchangé
  public play(): void;                   // playing = true, elapsedMs = 0, index = 0
  public pause(): void;                  // playing = false (garde elapsedMs)
  public resume(): void;                 // playing = true (garde elapsedMs)
  public stop(): void;                   // playing = false, elapsedMs = 0, index = 0
}
```

- `tick(deltaMs)` : si `!playing`, no-op. Sinon `elapsedMs += deltaMs`, recalcule l'index (`floor(elapsedMs / frameDuration)`, `min(index, len-1)` si `!loop`, `index % len` sinon) ; si `!loop` et index au dernier → `playing = false`.
- **Migration `updateAndApply` + `Clock`** : `updateAndApply(spriteNode)` devient `updateAndApply(spriteNode, deltaMs)` (= `tick(deltaMs)` puis `spriteNode.setFrame(getCurrentFrame())`). L'import `Clock` de `@atlasjs/utils` disparaît. Appelants à migrer (confirmés par grep) : `AnimationPlayer.updateAndApply` (nebula) et l'appelant non-ECS de `dino-brawl` (passe `dt * 1000`).
- Le stub `// event / callback plus tard` (changement d'index) reste un point d'accroche V2.

### 4bis. `AnimationPlayer` (nebula) — réutilisé, rendu dt-driven

`AnimationPlayer` (`animations/AnimationPlayer.ts`) **fait déjà** la gestion de clips nommés : `add(name, anim)`, `setDefault(name)`, `play(name, restart?)` (déjà no-op si même nom sauf `restart`), `pause/resume/stop`, `getCurrentAnimationName`, `isPlaying`. On le **réutilise** au lieu de réimplémenter (principe « étendre l'existant »). Deux ajouts + une migration :

```ts
public tick(deltaMs: number): void;              // NOUVEAU : this.currentAnimation?.tick(deltaMs)
public getCurrentFrame(): Frame | undefined;     // NOUVEAU : this.currentAnimation?.getCurrentFrame()
public updateAndApply(sprite: SpriteNode, deltaMs: number): void;  // migré : ajoute deltaMs
```

## 5. `Animator` (LEVEL 1, `packages/gameplay/src/components/Animator.ts`)

Composant gameplay = **fine enveloppe autour d'un `AnimationPlayer`** (composition). Il ne réimplémente pas la gestion de clips ; il expose la surface dont le script et le système ont besoin.

```ts
import { AnimationPlayer, SpriteAnimation, Frame } from "@atlasjs/nebula";

export class Animator {
  private readonly player: AnimationPlayer;

  public constructor(clips: Record<string, SpriteAnimation>, initial?: string);

  public play(name: string, restart?: boolean): this;   // délègue à player.play(name, restart) — NO-OP si déjà actif et !restart
  public stop(): this;               // délègue à player.stop()
  public pause(): this;              // délègue à player.pause() — gèle la frame courante
  public resume(): this;             // délègue à player.resume()
  public get playing(): string | null;        // player.getCurrentAnimationName() ?? null
  public currentFrame(): Frame | null;         // player.getCurrentFrame() ?? null
  public tick(deltaMs: number): void;           // player.tick(deltaMs)
}
```

- Constructeur : ajoute chaque clip au `AnimationPlayer` ; si `initial` fourni, `player.play(initial)`.
- **`play(name)` no-op si déjà actif** : hérité de `AnimationPlayer.play` (ne redémarre pas une anim en cours) — sauf `play(name, true)`, qui rejoue le clip actif depuis sa première frame. Nom inconnu → throw (hérité de `AnimationPlayer.get`).
- `currentFrame()` retourne `null` si aucun clip actif → le système laisse `SpriteRender.sprite` intact (fallback sur le sprite statique).
- Composant **LEVEL 1** : `this.addComponent(Animator, clips, initial?)` retourne l'instance brute (dispatch non-façade), le script appelle `.play()` directement.

## 6. `AnimatorSystem` (`packages/gameplay/src/systems/AnimatorSystem.ts`)

```ts
export class AnimatorSystem implements NexusSystem {
  private readonly spriteCache: Map<Frame, Sprite>;   // dédup frame → Sprite asset

  public update({ world, dt }: NexusSystemContext): void {
    const deltaMs: number = dt * 1000;   // dt est en secondes (RafLoop)
    world.query(Animator, SpriteRender).each((entity, animator, spriteRender) => {
      animator.tick(deltaMs);
      const frame: Frame | null = animator.currentFrame();
      if (frame === null) return;
      const sprite: Sprite = this.spriteFor(frame);
      if (spriteRender.sprite !== sprite) {
        spriteRender.sprite = sprite;
      }
    });
  }

  private spriteFor(frame: Frame): Sprite {
    // get-or-create : new Sprite(frame.texture, { rect: frame.rect, pivot: frame.pivot })
  }
}
```

- `dt` est **déjà** exposé (`NexusSystemContext.dt`, passé par `registerSystem` : `system.update({ world, dt: ctx.dt })`). Aucun câblage supplémentaire.
- Le cache `Map<Frame, Sprite>` vit dans le système (partagé, dédup globale). Les `Frame`s sont stables (issues d'un `SpriteSheet`), donc clés stables.
- N'écrit que `SpriteRender.sprite` : **ne touche jamais** color/flip/visible/sortingOrder (contrôlés par le script).

## 7. Câblage `GameplayPlugin`

- **Définir** le composant `Animator` (comme les autres composants dans `install`).
- **Enregistrer** `AnimatorSystem` via `registerSystem(update, world, animatorSystem, { stage: "Logic", after: <step scripts> })` — après le `ScriptManager.update`, avant le rendu. Garder le `StepHandle` pour le retirer à l'`uninstall`.

## 8. Exports

- `@atlasjs/gameplay` `index.ts` : exporter `Animator`, et **re-exporter l'authoring** `SpriteSheet`, `SpriteAnimation`, `AnimationPlayer`, `Frame` (+ `SpriteAnimationOptions`, options grille) — pour qu'un jeu écrive tout contre `@atlasjs/gameplay` (comme le `Sprite` asset aujourd'hui). Confirmer que `@atlasjs/nebula` les exporte, sinon les exposer d'abord.

## 9. Tests (TDD, harness `test/helpers/harness.ts`)

- **`SpriteAnimation` (nebula, dt-driven)** :
  - `tick` avance d'une frame au passage de `frameDuration` ; sous le seuil → même frame.
  - `loop` : wrap au-delà du dernier index ; `!loop` : clamp au dernier + `isPlaying()` passe `false`.
  - `pause` gèle l'index ; `resume` reprend sans reset ; `stop` remet index 0 + non-playing.
- **`Animator` (gameplay)** :
  - `play("walk")` change `playing` ; `play("walk")` ré-appelé → **ne reset pas** l'anim ; nom inconnu → throw.
  - `currentFrame()` reflète le clip actif ; `null` si aucun.
- **`AnimatorSystem`** :
  - après N frames, `SpriteRender.sprite` = le `Sprite` de la frame courante ; même frame → **même référence `Sprite`** (cache).
  - switch de clip → frame/ sprite changent.
  - entité sans `Animator` → `SpriteRender` intouché.
- **Intégration harness** : entité `Transform2D + SpriteRender + Animator` ; après `frame()`s, le nœud monté a le `sourceRect` de la frame courante (l'anim traverse jusqu'au rendu).

## 10. Non-objectifs (V2 → `memory/atlas/backlog/`)

State machine / transitions, blend trees, **events de frame** (le stub existe), root motion, vitesse d'anim / timescale par clip, sérialisation d'un asset d'animation.

> **Events de clip (`started`/`finished`/`loop`) : implémenté** → voir `memory/atlas/gameplay/animation-events.md`. Détection côté gameplay (nebula intouché), `Animator.on`/`off` sur l'`EventBus` de core.

## 11. Ordre d'implémentation suggéré

1. Nebula : `SpriteAnimation` dt-driven (`tick`, accumulateur, retrait `Clock`) + `updateAndApply(node, deltaMs)` + tests. Puis `AnimationPlayer` (`tick`, `getCurrentFrame`, `updateAndApply(node, deltaMs)`). Migrer l'appelant non-ECS de `dino-brawl`. Rebuild `dist`.
2. Gameplay : `Animator` (LEVEL 1, enveloppe `AnimationPlayer`) + tests.
3. Gameplay : `AnimatorSystem` + cache `Map<Frame, Sprite>` + tests.
4. `GameplayPlugin` : définir composant + enregistrer système (stage/`after`, teardown).
5. Exports gameplay (+ re-export authoring) ; `tsc --noEmit`.
6. (Optionnel) démo `apps/dino-brawl/EcsScene` : sheet + `Animator` sur une entité, validation visuelle.
