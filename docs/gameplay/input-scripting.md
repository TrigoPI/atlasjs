# Input dans le scripting — façade de service `InputApi` (Phase 1) + actions nommées (Phase 2)

> **Statut : implémenté** (les deux phases livrées).
> - **Phase 1** — accès aux services depuis les scripts : `ScriptService<TService>` générique + façade `InputApi` (polling clavier/souris global). Voir `packages/gameplay/src/scripting/core/ScriptService.ts`, `packages/gameplay/src/scripting/services/InputApi.ts` + tests `script-service*.test.ts`, `input-api.test.ts`.
> - **Phase 2** — actions nommées façon [Unity Input System](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.19/manual/QuickStartGuide.html) : `defineActions`/`button()`/`vector2()`/`InputActionMap` (`@atlasjs/input`) + intégration ECS `PlayerInput` + `PlayerInputSystem` (`@atlasjs/gameplay`). Voir `packages/input/src/public/actions/`, `packages/gameplay/src/components/PlayerInput.ts`, `packages/gameplay/src/systems/PlayerInputSystem.ts` + tests `actions.test.ts`, `action-runtime.test.ts`, `player-input.test.ts` ; utilisé dans `apps/dino-brawl` (`TestScript.ts`).
>
> Suite de `docs/gameplay/scripting-components.md` (accès aux composants depuis les scripts).

## Vue d'ensemble — une seule histoire « input scripting »

Ce chantier donne aux scripts un accès à l'input, en deux temps qui forment un continuum :

1. **Phase 1 — l'input brut.** Un script atteint le **service** `Input` global (clavier/souris) via une **façade curée** `InputApi`, sans statique global et sans exposer le service backend. C'est suffisant pour prototyper mais couple la logique de jeu aux touches physiques (`this.input.isDown(Key.D)`).

2. **Phase 2 — les actions nommées.** Une **indirection** : la logique lit des **actions** (`move`, `jump`, `fire`) et un **binding** relie chaque action à un ou plusieurs contrôles physiques. Rebinder, gérer plusieurs joueurs ou plusieurs devices devient une affaire de données, pas de code.

Les deux couches coexistent : `InputApi` **reste valable** pour l'input brut ; le système d'actions se construit **par-dessus** le même service `Input`, sans le casser. Le vocabulaire est **cohérent** sur les deux couches (`isDown` = maintenu, `isPressed` = front descendant cette frame, `isReleased` = front montant cette frame).

---

## Phase 1 — Accès aux services depuis les scripts (`InputApi`)

### Contexte

Le framework de script (`AtlasScript` + `ScriptContext` + `RuntimeScriptContext`) n'exposait initialement **que l'accès aux composants** Nexus (raw + façades `ScriptComponent`). Un script n'avait **aucun moyen d'atteindre un service** de l'engine (`ServiceRegistry`). Or l'input clavier/souris vit dans un **service** global (`Input`, token `INPUT`, package `@atlasjs/input`), alimenté par `InputPlugin` (backend DOM → `Set` down/pressed/released, `endFrame()` au stage `Late` de la lane `update`).

Objectif : permettre à un script de lire l'input, **sans statique global** (rester multi-engine / testable) et **sans exposer le service backend** au script (préserver la séparation backend ↔ scripting, exactement comme `Transform` enveloppe le moteur `Transform2D`).

### Tension résolue

- **Pas de statique global.** L'accès passe par le `ServiceRegistry` de l'engine (scoped à l'engine → multi-engine et injectable en test).
- **Input = global, pas par-entité.** Nexus n'a pas de resource/singleton : un backing de façade *composant* serait forcément par-entité, ce qui n'a aucun sens pour un clavier global en Phase 1. On introduit donc une **façade de service** (parallèle à la façade de composant), résolue depuis les services, qui n'ajoute **rien** à l'entité.
- **Séparation backend ↔ scripting.** `getService(InputApi)` retourne une **façade scripting curée** (`InputApi`), jamais l'interface `Input` backend. Le script ne peut pas atteindre `endFrame`/`clearAll`/`keys`/`pointer` internes.
- **Le vrai composant par-entité arrive en Phase 2** (`PlayerInput`), là où « par-joueur » prend son sens.

### Décisions validées avec l'auteur

1. **Façade de service, concept symétrique à `ScriptComponent`.** `ScriptComponent<TEngine>` déclare `static engine` (composant moteur backing) ; `ScriptService<TService>` déclare `static token` (token de service backing). Même philosophie : proxy apatride, API curée.

2. **Verbe dédié `getService`, sémantique *require* (throw si absent).** `this.input = this.getService(InputApi)`. Un service manquant (plugin non installé) est une erreur de configuration → **échec bruyant au boot/premier accès** (cohérent avec `ServiceRegistry.get` qui throw déjà, et avec `requireComponent`). Pas de variante `undefined`.

3. **Nommage backend conservé dans la façade (pas le vocabulaire Unity `getKey*`).** La façade expose `isDown` / `isPressed` / `isReleased` — mêmes noms que le service backend. Sémantique inchangée : `isDown` = maintenu, `isPressed` = front descendant cette frame, `isReleased` = relâché cette frame.

4. **Surface Phase 1 = clavier + souris.** Touches (`Key`, qui inclut `MouseLeft`/`MouseRight`) via `isDown`/`isPressed`/`isReleased`, plus souris : `mousePosition`, `mouseDelta`, `scrollDelta`. La façade **n'expose pas** `endFrame`/`clearAll`/`keys`/`pointer` bruts.

5. **Façade nommée `InputApi`, exportée depuis `@atlasjs/gameplay`.** Nom distinct de l'interface `Input` backend (`@atlasjs/input`) pour éviter toute confusion. `Key` est **ré-exporté** depuis `@atlasjs/gameplay` → un auteur de script importe tout d'un seul point : `import { AtlasScript, InputApi, Key } from "@atlasjs/gameplay"`.

6. **Façade qui cache le service résolu au constructeur.** À la différence de `ScriptComponent` (qui re-résout à chaque accès parce qu'un composant peut être retiré/re-ajouté → risque de cache périmé), un **service n'est jamais retiré** (`ServiceRegistry` n'a pas d'`unprovide`, la référence est stable pour la vie de l'engine). La façade résout donc **une fois dans le constructeur** (`this.provided = services.get(token)`) et les méthodes lisent directement ce champ `protected readonly` — pas de `Map.get` par accès/frame, pas de méthode `resolve()`. `getService` fabrique quand même un nouveau wrapper à chaque appel (pattern « appel unique dans `onCreate`, l'utilisateur détient l'instance »). Le constructeur reste le point d'échec bruyant (throw si token absent ou service non fourni), donc `getService` n'a pas besoin de re-valider.

7. **`gameplay` dépend de `input`.** Dépendance `@atlasjs/gameplay` → `@atlasjs/input` (`workspace:*`). `input` ne dépend que de `@atlasjs/core`/`@atlasjs/math`/`@atlasjs/utils` → **pas de cycle**.

8. **Lire l'input dans `onUpdate`, pas `onFixedUpdate`.** Les scripts `onUpdate` tournent au stage `Logic` de la lane `update`, **avant** l'`endFrame` de l'input (stage `Late`) → `isPressed`/`isReleased` sont valides dans `onUpdate`. En `onFixedUpdate` (lane `fixed`, 0..N passes/frame) les fronts par-frame-update sont ambigus. Caveat documenté, pas de garde runtime.

### Modèle retenu

#### Contrat façade↔service (`scripting/core/ScriptService.ts`)

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

export interface ScriptServiceCtor<TFacade, TService> {
  new (services: ServiceRegistry): TFacade;
  readonly token: ServiceToken<TService>;
}

export abstract class ScriptService<TService> {
  protected readonly provided: TService;

  public constructor(services: ServiceRegistry) {
    const ctor: ScriptServiceCtor<this, TService> = this
      .constructor as unknown as ScriptServiceCtor<this, TService>;

    if (ctor.token === undefined) {
      throw new Error(/* doit déclarer un `static token` */);
    }

    this.provided = services.get(ctor.token); // throw si le service n'est pas fourni
  }
}
```

Garde bruyante (miroir de `ScriptComponent`) : une façade sans `static token` doit throw à la construction (message explicite « doit déclarer un `static token` »).

#### Façade concrète (`scripting/services/InputApi.ts`)

```ts
import { Vec2 } from "@atlasjs/math";
import { Input as InputService, INPUT, Key } from "@atlasjs/input";

import { ScriptService } from "../core";

export class InputApi extends ScriptService<InputService> {
  public static readonly token = INPUT;

  public isDown(key: Key): boolean     { return this.provided.isDown(key); }
  public isPressed(key: Key): boolean  { return this.provided.isPressed(key); }
  public isReleased(key: Key): boolean { return this.provided.isReleased(key); }

  public get mousePosition(): Vec2 { return this.provided.pointer.position; }
  public get mouseDelta(): Vec2    { return this.provided.pointer.delta; }
  public get scrollDelta(): number { return this.provided.pointer.wheelDelta; }
}
```

> Surface **read-only curée**. Les mutateurs / lifecycle du backend (`endFrame`, `clearAll`, `keys`, `pointer` bruts) restent hors de portée du script. Les boutons souris passent par `isDown(Key.MouseLeft)` (déjà routés par le backend).

#### Dispatch dans le contexte (`scripting/runtime/RuntimeScriptContext.ts`)

Méthode `getService`, à côté du trio composant existant :

```ts
public getService<TFacade, TService>(
  type: ScriptServiceCtor<TFacade, TService>,
): TFacade {
  return new type(this.services); // le constructeur résout + throw si absent
}
```

`RuntimeScriptContext` reçoit `(entity, world, services)`.

#### Surface `AtlasScript`

Méthode `getService`, déléguant au contexte :

```ts
public getService<TFacade, TService>(
  type: ScriptServiceCtor<TFacade, TService>,
): TFacade {
  return this.context.getService(type);
}
```

Reste inchangé : `getComponent`/`addComponent`/`requireComponent`/`removeComponent`/`hasComponent`, `entityId`, cycle de vie.

#### Câblage services

`ServiceRegistry` threadé du plugin jusqu'au contexte :

- `GameplayPlugin.install` : `new ScriptManager(world, engine.services)`.
- `ScriptManager` : stocke `services`, le passe à `new RuntimeScriptContext(entityId, world, services)` dans `attach`.
- Aucun nouveau step scheduler, aucune nouvelle dépendance de plugin déclarée (le service `INPUT` est résolu paresseusement à l'exécution du script, pas au boot du plugin ; `getService` throw proprement si `InputPlugin` est absent).

#### Exemple d'usage (dino-brawl)

```ts
import { AtlasScript, InputApi, Key, Transform } from "@atlasjs/gameplay";

export class Player extends AtlasScript {
  private input!: InputApi;
  private transform!: Transform;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.transform = this.addComponent(Transform);
  }

  public onUpdate(dt: number): void {
    if (this.input.isDown(Key.D)) this.transform.translate(100 * dt, 0);
    if (this.input.isDown(Key.A)) this.transform.translate(-100 * dt, 0);
    if (this.input.isPressed(Key.Space)) {
      // front descendant : déclenché une seule frame
    }
  }
}
```

### Invariants Phase 1 (à ne pas régresser)

- **Service caché au constructeur, pas re-résolu par accès.** Contrairement aux façades composant (re-résolution obligatoire car membership mutable), la façade de service cache `this.provided` au constructeur : un service ne se retire jamais, donc pas de péremption possible et pas de `Map.get` par frame. Ne **pas** transformer ça en re-résolution « pour s'aligner sur `ScriptComponent` » — la divergence est intentionnelle et reflète une vraie différence (service immuable vs composant mutable).
- **Le service backend ne fuit jamais au script.** `getService` retourne **toujours** la façade (`InputApi`), jamais le service `Input` brut.
- **`ScriptService` ≠ `ScriptComponent`.** Deux familles distinctes : `static token` (service, résolu via `ServiceRegistry`, sans entité) vs `static engine` (composant, résolu via `world`, par-entité). Ne pas les fusionner ni router `getService` par `getComponent`.
- **Échec bruyant sur service absent.** `getService` throw si le token n'est pas fourni. Pas de dégradation silencieuse en `undefined`.
- **Lire l'input dans `onUpdate`.** Les fronts (`isPressed`/`isReleased`) sont fiables au stage `Logic` (avant `endFrame` au stage `Late`). `onFixedUpdate` = zone ambiguë.

---

## Phase 2 — Actions nommées (`defineActions` + `PlayerInput`)

### Cadrage

**MVP en lecture (polling), mais architecturé extensible** — les événements, interactions (hold/tap), processors, control schemes, gamepad et l'éditeur ne sont **pas** dans ce premier jet, mais le modèle laisse des coutures propres pour les ajouter sans refonte (voir « Hors périmètre / V2 »).

La logique lit des **actions** nommées (`jump.isPressed()`, `move.readValue()`) plutôt que des touches en dur dans la logique de jeu.

### Décisions validées avec l'auteur

1. **MVP polling, extensible.** Premier jet : lecture par polling (`isDown`, `isPressed`, `isReleased`, `readValue`). Pas d'événements/interactions/processors/schemes/gamepad/éditeur, mais le modèle de données et le runtime sont conçus pour les accueillir.

2. **System d'échantillonnage par-frame.** Un `PlayerInputSystem` échantillonne chaque frame au stage **`Early`** de la lane `update` (anchor 200) — après que le backend DOM a rempli l'état de la frame, **avant** les scripts (`Logic`, 300), et le `endFrame()` du backend nettoie les fronts en `Late` (900). Chaque action stocke `current` + `previous` → fronts corrects **au niveau action** (pas seulement touche). C'est la couture où événements/interactions se brancheront.

3. **Authoring = descripteur data + `get(name)` typé.** Les maps sont définies comme **donnée sérialisable** via `defineActions({...})` et des builders de binding. Le script récupère des handles typés par `map.get("jump")` (nom faux → **erreur compile**). Aligné avec la direction sérialisation/éditeur du moteur (cf. `docs/rendering/material-graph.md`).

4. **Layering device-agnostic.** Le moteur d'actions (modèle + runtime + sampling) vit dans **`@atlasjs/input`**, **pur** (aucun ECS, aucun scheduler) → testable seul et réutilisable hors gameplay. L'intégration ECS (composant `PlayerInput` + `PlayerInputSystem`) vit dans **`@atlasjs/gameplay`**.

5. **Trois natures d'action en V1 : Button, Value, Vector2.**
   - `ButtonAction` : `isDown()` = **maintenu**, `isPressed()` = **pressé cette frame** (front descendant), `isReleased()` = **relâché cette frame** (front montant).
   - `ValueAction` : `readValue(): number` (touche 0/1 ou axe 1D −1/0/1).
   - `Vector2Action` : `readValue(): Vec2` (+ getters `x`/`y`).

6. **Diagonales brutes (pas de normalisation) en V1.** Un composite WASD en diagonale renvoie `(1, 1)`, pas `(0.707, 0.707)`. La normalisation viendra comme **processor** optionnel.

7. **Vocabulaire backend cohérent sur les deux couches.** `ButtonAction` reprend exactement le vocabulaire de la façade Phase 1 / du backend : `isDown` = maintenu, `isPressed` = front descendant (pressé cette frame), `isReleased` = front montant (relâché cette frame). Aucune divergence de nommage entre `InputApi` et les actions.

8. **`PlayerInput` = composant Nexus brut (pas de façade).** Aucune autorité à router (contrairement à `Transform`) ; son API publique est `get(name)` + `enabled`. Les handles d'action (`ButtonAction`…) **sont** l'API curée de lecture. Pas de troisième concept.

9. **Handles d'action persistants.** Les objets action vivent dans la `InputActionMap` ; le system les **mute en place** chaque frame. Le script garde une ref (`this.jump = actions.get("jump")` en `onCreate`) valable pour toute la vie de l'entité.

10. **Résolution paresseuse du service `Input`.** `PlayerInputSystem` résout `INPUT` via le `ServiceRegistry` (échec bruyant si absent), comme `getService` — `gameplay` ne déclare **pas** `INPUT` en `requires` (pas de couplage boot ; le system ne fait rien s'il n'y a aucune entité `PlayerInput`).

### Modèle retenu

#### Authoring (`@atlasjs/input`) — descripteur data + typé

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

#### Runtime (`@atlasjs/input`) — map + actions + sampling

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
- `Vector2Action` : `current`/`previous: Vec2`. `readValue() = current`, `get x()`, `get y()`. Composite brut : `x = right−left`, `y = down−up` (convention **Y-down** du moteur : W → `-1`, S → `+1`).

> `dt` est passé dès maintenant à `sample`/`update` (inutilisé en V1) : couture pour les interactions temporelles (hold/tap) sans changer la signature plus tard.

#### Intégration ECS (`@atlasjs/gameplay`)

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

#### Usage script (dino-brawl — `TestScript`)

```ts
import { AtlasScript, PlayerInput, Transform } from "@atlasjs/gameplay";
import { ButtonAction, Vector2Action, defineActions, button, vector2, Key } from "@atlasjs/input";

const controls = defineActions({
  jump: button().keys(Key.Space),
  move: vector2().wasd(),
});

export class Player extends AtlasScript {
  private transform!: Transform;
  private jump!: ButtonAction;
  private move!: Vector2Action;

  private readonly speed: number = 250;

  public onCreate(): void {
    this.transform = this.addComponent(Transform);
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

### Invariants Phase 2 (à ne pas régresser)

- **`@atlasjs/input` reste pur** — le moteur d'actions ne dépend d'aucun ECS/scheduler. Seule l'intégration (`PlayerInput`/`PlayerInputSystem`) connaît Nexus/gameplay.
- **Handles persistants, mutés en place.** Ne pas re-créer les objets action par frame ni par `get` : le script garde des refs stables ; le system met à jour l'état interne.
- **Vocabulaire cohérent avec le backend.** `isDown` = maintenu, `isPressed`/`isReleased` = fronts (cette frame) — mêmes noms et sémantique que `InputApi` (Phase 1) et le backend. Ne pas introduire de divergence (`wasPressedThisFrame`, `isPressed=held`, etc.).
- **Résolution `INPUT` paresseuse + bruyante.** Pas de `requires: [INPUT]` sur `GameplayPlugin` ; le system throw si le service manque quand il y a des `PlayerInput`.
- **`dt` traverse le sampling** même inutilisé — ne pas le retirer « parce qu'il ne sert pas » : c'est la couture interactions.

---

## Réorganisation des packages

```
packages/gameplay/src/
  scripting/
    core/
      AtlasScript.ts  ScriptContext.ts  ScriptLifeCycle.ts
      ScriptComponent.ts
      ScriptService.ts            ← Phase 1 (base + ScriptServiceCtor)
      index.ts
    components/                   # façades de composant (par-entité)
      Transform.ts  CharacterController.ts  index.ts
    services/                     ← Phase 1, miroir de components/ pour les façades de service
      InputApi.ts  index.ts
    runtime/
      ScriptManager.ts  RuntimeScriptContext.ts  IncrementalScriptIdGenerator.ts  index.ts
    index.ts
  components/PlayerInput.ts        ← Phase 2, composant Nexus brut
  systems/PlayerInputSystem.ts     ← Phase 2, system (stage Early)
  ...

packages/input/src/public/
  actions/                          ← Phase 2 (moteur d'actions, pur)
    defineActions.ts                # authoring + ActionMapDescriptor + types (ActionKinds, ActionFor)
    bindings.ts                     # builders button()/value()/vector2() + specs data
    InputActionMap.ts               # runtime map + update(input, dt)
    ButtonAction.ts  ValueAction.ts  Vector2Action.ts
    index.ts
  ... (Input, Key, Pointer, etc. inchangés)
```

`scripting/index.ts` ré-exporte `./services` ; `src/index.ts` (barrel `@atlasjs/gameplay`) ré-exporte `InputApi`, `PlayerInput` et **ré-exporte `Key`** depuis `@atlasjs/input`. `@atlasjs/input` exporte le moteur d'actions.

---

## Caveats / risques connus

- **`mousePosition`/`mouseDelta` (Phase 1) et `Vector2Action.readValue()` (Phase 2) renvoient un `Vec2` backend vivant, mutable.** Un script pourrait le muter. Cohérent avec `Transform.position` (renvoie aussi le live). Cloner allouerait à chaque accès/frame → non retenu. À surveiller si ça pose problème.
- **`getService`/`getComponent` mintent un wrapper frais à chaque appel.** Sans conséquence au pattern visé (appel unique en `onCreate`, l'utilisateur détient l'instance). Acceptable (apatride).
- **Ré-export de `Key` depuis gameplay** crée un point d'accès dupliqué (gameplay + input). Assumé : simplifie l'import côté script ; `Key` reste défini une seule fois dans `@atlasjs/input`.
- **Caveat `onFixedUpdate` (les deux phases).** Lire l'input/les actions dans `onFixedUpdate` a le même problème : les fronts (`isPressed`/`isReleased`) sont par-frame `update` (fiables au stage `Logic`, avant `endFrame` au stage `Late`). En lane `fixed` (0..N passes/frame), les fronts sont ambigus. Recommander la lecture dans `onUpdate`. Documenté, pas de garde runtime. Réévaluer si un besoin réel d'input déterministe en lane `fixed` émerge (netcode).
- **Sens de l'axe Y du composite** — `y = down−up`, donc `up = -y` : la convention **Y-down** du moteur, cohérente avec la caméra, le rendu et le tilemap. W renvoie `-1`, S renvoie `+1` ; un script peut donc appliquer `v.y` directement au monde sans l'inverser (comme dans `TestScript`).
- **`value().axis(neg, pos)` quand les deux touches sont pressées** — convention : `pos` et `neg` s'annulent → `0` (comme le composite).
- **Typage de `get` via composant générique** — `PlayerInput<T>` propage `T` à travers `addComponent` ; repli identifié si les génériques de composant se heurtent au registre Nexus (`get(name: string)` non typé + helper typé dérivé du descripteur).

---

## Hors périmètre / V2 (union dédupliquée)

> Explicitement hors du premier jet des deux phases — à traiter dans des itérations ultérieures. Les coutures listées en Phase 2 (bindings = liste, `dt` dans `sample`, transition `previous → current` détectée) sont laissées **ouvertes** pour accueillir ces extensions sans refonte.

- **Événements / callbacks** (`started`/`performed`/`canceled`) — polling uniquement en V1. Le sampling détecte déjà la transition `previous → current` ; un émetteur d'événements se branche là, l'API polling restant disponible en parallèle (`action.performed += cb`).
- **Interactions** (hold / tap / slow-tap / multi-tap / press-point) — non gérées ; une action est actuée ou non, sans notion de durée/pattern. `sample(input, dt)` reçoit déjà `dt` et conserve `current`/`previous` → un évaluateur d'interactions se greffe sur le sampling sans toucher l'API de lecture.
- **Processors** (deadzone, invert, scale/sensibilité, **normalisation des diagonales**) — pipeline optionnel `processors: Processor[]` par binding/action (vide en V1). Conséquence V1 assumée : diagonales composite non normalisées (`(1,1)`).
- **Gamepad / axes analogiques** — seul le device clavier/souris (`Key`, incl. `MouseLeft/Right`) est adressable. Pas de sticks/gâchettes analogiques, pas de vibration.
- **Souris comme source de `Vector2`** — `mousePosition`/`mouseDelta`/`scroll` restent via `InputApi` (Phase 1) ; pas encore de binding `pointer delta → Vector2Action`.
- **Control schemes / assignation de device / rebinding runtime** — les bindings référencent `Key` et sont figés à la définition. Multi-joueur local = plusieurs descripteurs distincts à la main (ex. WASD vs flèches), pas de commutation clavier↔gamepad, pas d'API `PerformInteractiveRebinding`. Abstraire en « control path » device-agnostic plus tard.
- **(Dé)sérialisation d'asset d'actions** — le descripteur est *conçu* sérialisable (data pure) mais aucun load/save JSON n'est fourni ; pas d'éditeur.
- **Distinction `passthrough` vs `button` vs `value` au sens Unity** (action type / control type) — la nature est portée par le builder, sans les subtilités d'« initial state check » d'Unity.
- **Sampling `fixed`-déterministe (netcode)** — le sampling ne vit que dans la lane `update` ; un échantillonnage déterministe en lane `fixed` n'est pas traité (voir caveat `onFixedUpdate`).
