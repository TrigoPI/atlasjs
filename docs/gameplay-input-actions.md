# Système d'actions nommées (Phase 2) — `@atlasjs/input` + `@atlasjs/gameplay`

> **Statut : validé (non implémenté).** Phase 2 de l'input dans le scripting, suite de `gameplay-input-scripting.md` (Phase 1 = polling bas-niveau via façade `InputApi`, livrée). Objectif : une abstraction haut-niveau façon [Unity Input System](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.19/manual/QuickStartGuide.html) — des **actions nommées** (`jump.isPressed()`, `move.readValue()`) plutôt que des touches en dur dans la logique de jeu.
>
> **Cadrage : MVP en lecture (polling), mais architecturé extensible** — les événements, interactions (hold/tap), processors, control schemes, gamepad et l'éditeur ne sont **pas** dans ce premier jet, mais le modèle laisse des coutures propres pour les ajouter sans refonte (voir §7 et §8).

## Contexte

La Phase 1 expose le device brut aux scripts : `this.input = this.getService(InputApi)` → `this.input.isDown(Key.D)`. C'est suffisant pour prototyper mais couple la logique de jeu aux touches physiques. La Phase 2 introduit une **indirection** : la logique lit des **actions** (`move`, `jump`, `fire`), et un **binding** relie chaque action à un ou plusieurs contrôles physiques. Rebinder, gérer plusieurs joueurs ou plusieurs devices devient une affaire de données, pas de code.

`InputApi` (Phase 1) **reste valable** pour l'input brut ; le système d'actions se construit **par-dessus** le même service `Input`, sans le casser.

## Décisions validées avec l'auteur

1. **MVP polling, extensible.** Premier jet : lecture par polling (`isDown`, `isPressed`, `isReleased`, `readValue`). Pas d'événements/interactions/processors/schemes/gamepad/éditeur, mais le modèle de données et le runtime sont conçus pour les accueillir (§7).

2. **System d'échantillonnage par-frame.** Un `PlayerInputSystem` échantillonne chaque frame au stage **`Early`** de la lane `update` (anchor 200) — après que le backend DOM a rempli l'état de la frame, **avant** les scripts (`Logic`, 300), et le `endFrame()` du backend nettoie les fronts en `Late` (900). Chaque action stocke `current` + `previous` → fronts corrects **au niveau action** (pas seulement touche). C'est la couture où événements/interactions se brancheront.

3. **Authoring = descripteur data + `get(name)` typé.** Les maps sont définies comme **donnée sérialisable** via `defineActions({...})` et des builders de binding. Le script récupère des handles typés par `map.get("jump")` (nom faux → **erreur compile**). Aligné avec la direction sérialisation/éditeur du moteur (cf. `material-graph-serialization.md`).

4. **Layering device-agnostic.** Le moteur d'actions (modèle + runtime + sampling) vit dans **`@atlasjs/input`**, **pur** (aucun ECS, aucun scheduler) → testable seul et réutilisable hors gameplay. L'intégration ECS (composant `PlayerInput` + `PlayerInputSystem`) vit dans **`@atlasjs/gameplay`**.

5. **Trois natures d'action en V1 : Button, Value, Vector2.**
   - `ButtonAction` : `isDown()` = **maintenu**, `isPressed()` = **pressé cette frame** (front descendant), `isReleased()` = **relâché cette frame** (front montant).
   - `ValueAction` : `readValue(): number` (touche 0/1 ou axe 1D −1/0/1).
   - `Vector2Action` : `readValue(): Vec2` (+ getters `x`/`y`).

6. **Diagonales brutes (pas de normalisation) en V1.** Un composite WASD en diagonale renvoie `(1, 1)`, pas `(0.707, 0.707)`. La normalisation viendra comme **processor** optionnel (§7).

7. **Vocabulaire backend cohérent sur les deux couches.** `ButtonAction` reprend exactement le vocabulaire de la façade Phase 1 / du backend : `isDown` = maintenu, `isPressed` = front descendant (pressé cette frame), `isReleased` = front montant (relâché cette frame). Aucune divergence de nommage entre `InputApi` et les actions.

8. **`PlayerInput` = composant Nexus brut (pas de façade).** Aucune autorité à router (contrairement à `Transform2DComponent`) ; son API publique est `get(name)` + `enabled`. Les handles d'action (`ButtonAction`…) **sont** l'API curée de lecture. Pas de troisième concept.

9. **Handles d'action persistants.** Les objets action vivent dans la `InputActionMap` ; le system les **mute en place** chaque frame. Le script garde une ref (`this.jump = actions.get("jump")` en `onCreate`) valable pour toute la vie de l'entité.

10. **Résolution paresseuse du service `Input`.** `PlayerInputSystem` résout `INPUT` via le `ServiceRegistry` (échec bruyant si absent), comme `getService` — `gameplay` ne déclare **pas** `INPUT` en `requires` (pas de couplage boot ; le system ne fait rien s'il n'y a aucune entité `PlayerInput`).

## Modèle retenu

### Authoring (`@atlasjs/input`) — descripteur data + typé

```ts
const controls = defineActions({
  jump: button().keys(Key.Space, Key.Enter),        // OR de touches
  fire: button().keys(Key.MouseLeft),
  throttle: value().key(Key.ShiftLeft),             // 0 | 1
  steer: value().axis(Key.A, Key.D),                // -1 | 0 | 1
  move: vector2().wasd(),                            // composite 2D ; ou .keys({ up, down, left, right })
});
// typeof controls : ActionMapDescriptor<{
//   jump: "button"; fire: "button"; throttle: "value"; steer: "value"; move: "vector2";
// }>
```

Les builders renvoient des **specs data** (nature + liste de bindings), pas des objets runtime. `defineActions` fige un descripteur sérialisable et porte au niveau type la map `nom → nature`, exploitée par `get`.

### Runtime (`@atlasjs/input`) — map + actions + sampling

```ts
export class InputActionMap<T extends ActionKinds> {
  public enabled: boolean;
  public constructor(descriptor: ActionMapDescriptor<T>) { /* instancie un handle par action */ }

  public get<K extends keyof T>(name: K): ActionFor<T[K]>;   // typé : ButtonAction | ValueAction | Vector2Action

  public update(input: Input, dt: number): void {            // stage Early
    if (!this.enabled) return;
    for (const action of this.actions) action.sample(input, dt); // roll previous←current, recompute current
  }
}
```

- `ButtonAction` : `current`/`previous: boolean`. `isDown() = current`, `isPressed() = current && !previous`, `isReleased() = !current && previous`. Actuation = OR des touches liées.
- `ValueAction` : `current`/`previous: number`. `readValue() = current`.
- `Vector2Action` : `current`/`previous: Vec2`. `readValue() = current`, `get x()`, `get y()`. Composite brut : `x = right−left`, `y = up−down`.

> `dt` est passé dès maintenant à `sample`/`update` (inutilisé en V1) : couture pour les interactions temporelles (hold/tap) sans changer la signature plus tard.

### Intégration ECS (`@atlasjs/gameplay`)

```ts
// composant Nexus brut
export class PlayerInput<T extends ActionKinds> {
  public readonly map: InputActionMap<T>;
  public constructor(descriptor: ActionMapDescriptor<T>) { this.map = new InputActionMap(descriptor); }
  public get<K extends keyof T>(name: K): ActionFor<T[K]> { return this.map.get(name); }
  public get enabled(): boolean { return this.map.enabled; }
  public set enabled(v: boolean) { this.map.enabled = v; }
}

// system, stage Early, résout INPUT en lazy
export class PlayerInputSystem implements NexusSystem {
  public constructor(private readonly services: ServiceRegistry) {}
  public update({ world, dt }: NexusSystemContext): void {
    const input = this.services.get(INPUT);                 // throw si InputPlugin absent
    world.query(PlayerInput).each((_, pi) => pi.map.update(input, dt));
  }
}
```

`GameplayPlugin` : `world.defineComponent(PlayerInput)` + `registerSystem(update, world, new PlayerInputSystem(engine.services), { name: "gameplay:player-input", stage: "Early" })`.

### Usage script (cible)

```ts
import { AtlasScript, PlayerInput, Transform2DComponent } from "@atlasjs/gameplay";
import { ButtonAction, Vector2Action, defineActions, button, vector2, Key } from "@atlasjs/input";

const controls = defineActions({
  jump: button().keys(Key.Space),
  move: vector2().wasd(),
});

export class Player extends AtlasScript {
  private transform!: Transform2DComponent;
  private jump!: ButtonAction;
  private move!: Vector2Action;

  private readonly speed: number = 250;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    const actions = this.addComponent(PlayerInput, controls);
    this.jump = actions.get("jump");
    this.move = actions.get("move");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    if (v.x !== 0 || v.y !== 0) this.transform.translate(v.x * this.speed * dt, v.y * this.speed * dt);
    if (this.jump.isPressed()) { /* saut : front, une seule frame */ }
  }
}
```

## Réorganisation des packages

```
packages/input/src/public/
  actions/                          ← nouveau (moteur d'actions, pur)
    defineActions.ts                # authoring + ActionMapDescriptor + types (ActionKinds, ActionFor)
    bindings.ts                     # builders button()/value()/vector2() + specs data
    InputActionMap.ts               # runtime map + update(input, dt)
    ButtonAction.ts  ValueAction.ts  Vector2Action.ts
    index.ts
  ... (Input, Key, Pointer, etc. inchangés)

packages/gameplay/src/
  components/PlayerInput.ts          ← nouveau composant Nexus brut
  systems/PlayerInputSystem.ts       ← nouveau system (stage Early)
  ...
```

`@atlasjs/input` exporte le moteur d'actions ; `@atlasjs/gameplay` exporte `PlayerInput` et ré-exporte au besoin les types d'action (comme `Key` en Phase 1).

## Coutures d'extensibilité (vides/minimales en V1, à ne pas fermer)

- **Bindings = liste** par action dès le modèle (multi-binding déjà supporté ; un binding composite est un binding de la liste).
- **Processors** : un pipeline optionnel `processors: Processor[]` par binding/action (vide en V1). Cible : `normalize` (diagonales), `deadzone`, `invert`, `scale`.
- **Interactions** (hold/tap/multi-tap) : `sample(input, dt)` reçoit déjà `dt` et conserve `current`/`previous` → un évaluateur d'interactions se greffe sur le sampling sans toucher l'API de lecture.
- **Événements** (`started`/`performed`/`canceled`) : le sampling détecte déjà la transition `previous → current` ; un émetteur d'événements se branche là, l'API polling restant disponible en parallèle.
- **Devices / control schemes** : les bindings référencent `Key` en V1 ; abstraire en « control path » device-agnostic plus tard. Multi-joueur local (assignation de device) = extension du scheme.
- **enable/disable** de map : `enabled` respecté par le system dès la V1 (les action maps Unity s'activent/désactivent).

## Limites & manques connus de la V1 (backlog Phase 2+)

> Explicitement hors périmètre de ce premier jet — à traiter dans des itérations ultérieures.

- **Pas d'événements/callbacks** — polling uniquement. `action.performed += cb` viendra avec l'émetteur branché sur les transitions.
- **Pas d'interactions** — hold, tap, slow/multi-tap, press-point non gérés (une action est actuée ou non, sans notion de durée/pattern).
- **Pas de processors** — donc **diagonales non normalisées**, pas de deadzone/invert/scale/sensibilité. Assumé pour V1.
- **Pas de gamepad / axes analogiques** — seul le device clavier/souris (`Key`, incl. `MouseLeft/Right`) est adressable. Pas de sticks/gâchettes analogiques, pas de vibration.
- **Pas de souris comme source de Vector2** — `mousePosition`/`mouseDelta`/`scroll` restent via `InputApi` (Phase 1) ; pas encore de binding `pointer delta → Vector2Action`.
- **Pas de control schemes ni d'assignation de device** — multi-joueur local = plusieurs descripteurs distincts à la main (ex. WASD vs flèches), pas de commutation clavier↔gamepad.
- **Pas de rebinding runtime** — les bindings sont figés à la définition ; pas d'API `PerformInteractiveRebinding`.
- **Pas de (dé)sérialisation d'asset** — le descripteur est *conçu* sérialisable (data pure) mais aucun load/save JSON n'est fourni ; pas d'éditeur.
- **Pas d'action `passthrough` vs `button` vs `value` au sens Unity** (action type / control type) — la nature est portée par le builder, sans les subtilités de « initial state check » d'Unity.
- **Sampling dans la lane `update` seulement** — lire les actions dans `onFixedUpdate` a le même caveat que la Phase 1 (fronts par-frame `update`). Recommander la lecture dans `onUpdate`. Un sampling `fixed`-déterministe (netcode) n'est pas traité.
- **`readValue()` sur `Vector2Action` renvoie le `Vec2` interne vivant** — un script pourrait le muter (cohérent avec `Transform2DComponent.position`). Cloner allouerait par frame → non retenu.
- **Typage de `get` via composant générique** — `PlayerInput<T>` doit propager `T` à travers `addComponent`. Si les génériques de composant se heurtent au registre Nexus, repli : `get(name: string)` non typé + helper typé dérivé du descripteur. À valider au Checkpoint 3.

## Plan d'implémentation (checkpoints — chacun vert : `tsc --noEmit` + tests)

> Un commit par checkpoint. Typecheck via `tsc --noEmit` (jamais `tsc -b` sur les packages — cf. l'incident d'artefacts émis en Phase 1). Build réel = `tsdown` → `dist`.

- **Checkpoint 1 — Modèle data + authoring (`input`).** `defineActions`, builders `button()`/`value()`/`vector2()`, types `ActionMapDescriptor<T>`/`ActionKinds`/`ActionFor`. Aucune logique runtime. **Tests** : structure des specs (bindings collectés), typage de `defineActions` (nature par nom), `vector2().wasd()` == `.keys({...})`.

- **Checkpoint 2 — Runtime map + actions (`input`).** `InputActionMap` + `ButtonAction`/`ValueAction`/`Vector2Action` + `sample(input, dt)`/`update`. **Tests purs** (service `Input` factice, aucun ECS/DOM) : button maintenu vs fronts, OR multi-binding, value 0/1 + axe −1/0/1, vector2 composite brut (diagonale = (1,1)), roll `previous←current`, `enabled=false` gèle l'état.

- **Checkpoint 3 — `PlayerInput` + `PlayerInputSystem` (`gameplay`).** Composant brut + system stage `Early` + câblage `GameplayPlugin` (`defineComponent` + `registerSystem`). Résolution lazy de `INPUT`. Valider le typage de `get` (ou appliquer le repli, §8). **Tests harness** : le system met à jour les actions par-entité ; `addComponent(PlayerInput, desc).get("jump")` renvoie le handle attendu ; deux `PlayerInput` avec descripteurs différents restent indépendants.

- **Checkpoint 4 — Exports + intégration sandbox.** Exports publics (`input` : moteur d'actions ; `gameplay` : `PlayerInput`). Migrer `TestScript` sur `PlayerInput` + actions (`move`/`jump`). Vérif **runtime dans la preview** (mouvement WASD via action `move`, front `jump`). Documenter le caveat `onFixedUpdate`.

## Invariants d'implémentation (à ne pas régresser)

- **`@atlasjs/input` reste pur** — le moteur d'actions ne dépend d'aucun ECS/scheduler. Seule l'intégration (`PlayerInput`/`PlayerInputSystem`) connaît Nexus/gameplay.
- **Handles persistants, mutés en place.** Ne pas re-créer les objets action par frame ni par `get` : le script garde des refs stables ; le system met à jour l'état interne.
- **Vocabulaire cohérent avec le backend.** `isDown` = maintenu, `isPressed`/`isReleased` = fronts (cette frame) — mêmes noms et sémantique que `InputApi` (Phase 1) et le backend. Ne pas introduire de divergence (`wasPressedThisFrame`, `isPressed=held`, etc.).
- **Résolution `INPUT` paresseuse + bruyante.** Pas de `requires: [INPUT]` sur `GameplayPlugin` ; le system throw si le service manque quand il y a des `PlayerInput`.
- **`dt` traverse le sampling** même inutilisé — ne pas le retirer « parce qu'il ne sert pas » : c'est la couture interactions.

## Points ouverts / risques

- **Typage `get` (§8, dernier point)** — risque principal ; repli identifié.
- **Sens de l'axe Y du composite** — `up = +y`. Le sens monde (Y haut/bas) dépend du renderer ; laissé au consommateur (comme aujourd'hui dans `TestScript`).
- **`value().axis(neg, pos)` quand les deux touches sont pressées** — convention : `pos` et `neg` s'annulent → `0` (comme le composite). À figer au Checkpoint 2.
