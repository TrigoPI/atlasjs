# Accès input dans le scripting (`@atlasjs/gameplay`) — façade de service `InputApi`

> **Statut : validé (non implémenté).** Suite de `gameplay-scripting-components.md`. Ce document ajoute au framework de script un **accès aux services** de l'engine, exposé aux scripts via des **façades haut-niveau** (jamais le service backend brut), et livre la première façade concrète : `InputApi`, au-dessus du service `Input` de `@atlasjs/input`.
>
> Découpé en deux temps :
> - **Phase 1 (ce doc)** — polling clavier/souris global dans les scripts (`this.input = this.getService(InputApi)` → `this.input.isDown(Key.D)`).
> - **Phase 2 (esquisse §7, spec séparée à venir)** — actions nommées device-agnostic façon Unity Input System, via un composant **par-entité** `PlayerInput`.

## Contexte

Le framework de script (`AtlasScript` + `ScriptContext` + `RuntimeScriptContext`) n'expose aujourd'hui **que l'accès aux composants** Nexus (raw + façades `ScriptComponent`). Un script n'a **aucun moyen d'atteindre un service** de l'engine (`ServiceRegistry`). Or l'input clavier/souris vit dans un **service** global (`Input`, token `INPUT`, package `@atlasjs/input`), alimenté par `InputPlugin` (backend DOM → `Set` down/pressed/released, `endFrame()` au stage `Late` de la lane `update`).

Objectif : permettre à un script de lire l'input, **sans statique global** (rester multi-engine / testable) et **sans exposer le service backend** au script (préserver la séparation backend ↔ scripting, exactement comme `Transform2DComponent` enveloppe le moteur `Transform2D`).

## Tension résolue

- **Pas de statique global.** L'accès passe par le `ServiceRegistry` de l'engine (scoped à l'engine → multi-engine et injectable en test).
- **Input = global, pas par-entité.** Nexus n'a pas de resource/singleton : un backing de façade *composant* serait forcément par-entité, ce qui n'a aucun sens pour un clavier global en Phase 1. On introduit donc une **façade de service** (parallèle à la façade de composant), résolue depuis les services, qui n'ajoute **rien** à l'entité.
- **Séparation backend ↔ scripting.** `getService(InputApi)` retourne une **façade scripting curée** (`InputApi`), jamais l'interface `Input` backend. Le script ne peut pas atteindre `endFrame`/`clearAll`/`keys`/`pointer` internes.
- **Le vrai composant par-entité arrive en Phase 2** (`PlayerInput`), là où « par-joueur » prend son sens.

## Décisions validées avec l'auteur

1. **Façade de service, nouveau concept symétrique à `ScriptComponent`.** `ScriptComponent<TEngine>` déclare `static engine` (composant moteur backing) ; `ScriptService<TService>` déclare `static token` (token de service backing). Même philosophie : proxy apatride, re-résolution à chaque accès, API curée.

2. **Verbe dédié `getService`, sémantique *require* (throw si absent).** `this.input = this.getService(InputApi)`. Un service manquant (plugin non installé) est une erreur de configuration → **échec bruyant au boot/premier accès** (cohérent avec `ServiceRegistry.get` qui throw déjà, et avec `requireComponent`). Pas de variante `undefined`.

3. **Nommage backend conservé dans la façade (pas le vocabulaire Unity `getKey*`).** La façade expose `isDown` / `isPressed` / `isReleased` — mêmes noms que le service backend. Sémantique inchangée : `isDown` = maintenu, `isPressed` = front descendant cette frame, `isReleased` = relâché cette frame.

4. **Surface Phase 1 = clavier + souris.** Touches (`Key`, qui inclut `MouseLeft`/`MouseRight`) via `isDown`/`isPressed`/`isReleased`, plus souris : `mousePosition`, `mouseDelta`, `scrollDelta`. La façade **n'expose pas** `endFrame`/`clearAll`/`keys`/`pointer` bruts.

5. **Façade nommée `InputApi`, exportée depuis `@atlasjs/gameplay`.** Nom distinct de l'interface `Input` backend (`@atlasjs/input`) pour éviter toute confusion. `Key` est **ré-exporté** depuis `@atlasjs/gameplay` → un auteur de script importe tout d'un seul point : `import { AtlasScript, InputApi, Key } from "@atlasjs/gameplay"`.

6. **Façade apatride, re-résolution à chaque accès.** `getService` fabrique un nouveau wrapper à chaque appel (pattern « appel unique dans `onCreate`, l'utilisateur détient l'instance ») ; chaque méthode re-résout le service via le registre. Même invariant que les façades composant : aucun état d'instance au-delà de `(services)`.

7. **`gameplay` dépend de `input`.** Nouvelle dépendance `@atlasjs/gameplay` → `@atlasjs/input` (`workspace:*`). `input` ne dépend que de `@atlasjs/core`/`@atlasjs/math`/`@atlasjs/utils` → **pas de cycle**.

8. **Lire l'input dans `onUpdate`, pas `onFixedUpdate`.** Les scripts `onUpdate` tournent au stage `Logic` de la lane `update`, **avant** l'`endFrame` de l'input (stage `Late`) → `isPressed`/`isReleased` sont valides dans `onUpdate`. En `onFixedUpdate` (lane `fixed`, 0..N passes/frame) les fronts par-frame-update sont ambigus. Caveat documenté, pas de garde runtime.

## Modèle retenu

### Contrat façade↔service (`scripting/core/ScriptService.ts`)

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

export interface ScriptServiceCtor<TFacade, TService> {
  new (services: ServiceRegistry): TFacade;
  readonly token: ServiceToken<TService>;
}

export abstract class ScriptService<TService> {
  protected constructor(protected readonly services: ServiceRegistry) {}

  protected resolve(): TService {
    const ctor: ScriptServiceCtor<this, TService> = this
      .constructor as ScriptServiceCtor<this, TService>;
    return this.services.get(ctor.token); // throw si le service n'est pas fourni
  }
}
```

Garde bruyante (miroir de `ScriptComponent`) : une façade sans `static token` doit throw à la construction (message explicite « doit déclarer un `static token` »).

### Façade concrète (`scripting/services/InputApi.ts`)

```ts
import { Vec2 } from "@atlasjs/math";
import { Input as InputService, INPUT, Key } from "@atlasjs/input";

import { ScriptService } from "../core";

export class InputApi extends ScriptService<InputService> {
  public static readonly token = INPUT;

  public isDown(key: Key): boolean     { return this.resolve().isDown(key); }
  public isPressed(key: Key): boolean  { return this.resolve().isPressed(key); }
  public isReleased(key: Key): boolean { return this.resolve().isReleased(key); }

  public get mousePosition(): Vec2 { return this.resolve().pointer.position; }
  public get mouseDelta(): Vec2    { return this.resolve().pointer.delta; }
  public get scrollDelta(): number { return this.resolve().pointer.wheelDelta; }
}
```

> Surface **read-only curée**. Les mutateurs / lifecycle du backend (`endFrame`, `clearAll`, `keys`, `pointer` bruts) restent hors de portée du script. Les boutons souris passent par `isDown(Key.MouseLeft)` (déjà routés par le backend).

### Dispatch dans le contexte (`scripting/runtime/RuntimeScriptContext.ts`)

Nouvelle méthode `getService`, à côté du trio composant existant :

```ts
public getService<TFacade, TService>(
  type: ScriptServiceCtor<TFacade, TService>,
): TFacade {
  this.services.get(type.token); // valide tôt : throw si absent
  return new type(this.services); // wrapper apatride, à la demande
}
```

`RuntimeScriptContext` reçoit désormais `(entity, world, services)`.

### Surface `AtlasScript`

Ajout d'une méthode `getService`, déléguant au contexte :

```ts
public getService<TFacade, TService>(
  type: ScriptServiceCtor<TFacade, TService>,
): TFacade {
  return this.context.getService(type);
}
```

Reste inchangé : `getComponent`/`addComponent`/`requireComponent`/`removeComponent`/`hasComponent`, `entityId`, cycle de vie.

### Câblage services

`ServiceRegistry` threadé du plugin jusqu'au contexte :

- `GameplayPlugin.install` : `new ScriptManager(world, engine.services)`.
- `ScriptManager` : stocke `services`, le passe à `new RuntimeScriptContext(entityId, world, services)` dans `attach`.
- Aucun nouveau step scheduler, aucune nouvelle dépendance de plugin déclarée (le service `INPUT` est résolu paresseusement à l'exécution du script, pas au boot du plugin ; `getService` throw proprement si `InputPlugin` est absent).

### Exemple d'usage (sandbox)

```ts
import { AtlasScript, InputApi, Key, Transform2DComponent } from "@atlasjs/gameplay";

export class Player extends AtlasScript {
  private input!: InputApi;
  private transform!: Transform2DComponent;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.transform = this.addComponent(Transform2DComponent);
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

## Réorganisation `packages/gameplay/src`

```
src/
  scripting/
    core/
      AtlasScript.ts  ScriptContext.ts  ScriptLifeCycle.ts
      ScriptComponent.ts
      ScriptService.ts            ← nouveau (base + ScriptServiceCtor)
      index.ts
    components/                   # façades de composant (par-entité)
      Transform2DComponent.ts  RigidBody2DComponent.ts  SpriteRendererComponent.ts  index.ts
    services/                     ← nouveau, miroir de components/ pour les façades de service
      InputApi.ts  index.ts
    runtime/
      ScriptManager.ts  RuntimeScriptContext.ts  IncrementalScriptIdGenerator.ts  index.ts
    index.ts
  ...
```

`scripting/index.ts` ré-exporte `./services`. `src/index.ts` (barrel package) ré-exporte `InputApi` et **ré-exporte `Key`** depuis `@atlasjs/input`.

## Plan d'implémentation (checkpoints — chacun vert : `tsc` + tests)

> Un commit par checkpoint (l'auteur commit au fur et à mesure).

- **Checkpoint 1 — Dépendance + base framework.** Ajouter `@atlasjs/input` aux `dependencies` de `@atlasjs/gameplay` (`pnpm install`). Créer `scripting/core/ScriptService.ts` (base `ScriptService<TService>` + `ScriptServiceCtor` + garde `static token`). Exporter depuis `scripting/core/index.ts`. `tsc` gameplay vert. **Test** : `ScriptService` custom → `resolve()` renvoie le service fourni ; façade sans `static token` throw à la construction.

- **Checkpoint 2 — `getService` dans le contexte + `AtlasScript`.** Étendre `ScriptContext` (interface) avec `getService`. Threader `services` : `RuntimeScriptContext(entity, world, services)`, implémenter `getService` (valide + mint wrapper). Ajouter `AtlasScript.getService` (délégation). `ScriptManager(world, services)` stocke et forwarde. `GameplayPlugin` passe `engine.services`. `tsc` gameplay vert. **Test** : via un `NexusWorld` + `ServiceRegistry` de test, `getService(FakeFacade)` renvoie la façade ; throw si service absent ; deux appels → deux instances (apatride).

- **Checkpoint 3 — Façade `InputApi`.** Créer `scripting/services/InputApi.ts` (`static token = INPUT`, `isDown`/`isPressed`/`isReleased` + `mousePosition`/`mouseDelta`/`scrollDelta`) + `scripting/services/index.ts`. Câbler `scripting/index.ts`. `tsc` gameplay vert. **Test** : avec un service `Input` factice, chaque méthode délègue correctement (clavier + souris).

- **Checkpoint 4 — Exports publics + ré-export `Key`.** `src/index.ts` : exporter `InputApi`, `ScriptService`, `ScriptServiceCtor` ; **ré-exporter `Key`** (et éventuellement le type `Input` backend si utile) depuis `@atlasjs/input`. `tsc -b` (references) vert.

- **Checkpoint 5 — Intégration sandbox.** Écrire/adapter un script (`Player` ou `TestScript`) utilisant `this.getService(InputApi)` pour déplacer une entité au clavier. Vérifier au runtime (preview) : mouvement au clavier, souris. `tsc -b` sandbox vert. Documenter le caveat `onFixedUpdate` en commentaire de la façade ou du doc (pas de code).

## Invariants d'implémentation (à ne pas régresser)

- **Façade de service apatride.** Aucun état d'instance au-delà de `(services)`. `getService` fabrique un wrapper neuf à chaque appel ; chaque méthode re-résout via le registre. Ne pas cacher le service résolu dans un champ d'instance.
- **Le service backend ne fuit jamais au script.** `getService` retourne **toujours** la façade (`InputApi`), jamais le service `Input` brut. La façade n'expose pas la surface mutation/lifecycle du backend.
- **`ScriptService` ≠ `ScriptComponent`.** Deux familles distinctes : `static token` (service, résolu via `ServiceRegistry`, sans entité) vs `static engine` (composant, résolu via `world`, par-entité). Ne pas les fusionner ni router `getService` par `getComponent`.
- **Échec bruyant sur service absent.** `getService` throw si le token n'est pas fourni. Pas de dégradation silencieuse en `undefined`.
- **Lire l'input dans `onUpdate`.** Les fronts (`isPressed`/`isReleased`) sont fiables au stage `Logic` (avant `endFrame` au stage `Late`). `onFixedUpdate` = zone ambiguë.

## Direction Phase 2 (esquisse — spec séparée à venir)

Système d'actions nommées façon `UnityEngine.InputSystem` : abstraction haut-niveau au-dessus des inputs en dur.

- **Dans `@atlasjs/input`** — couche d'actions **device-agnostic** :
  - `InputAction` typée par sa nature : `button` (bool + fronts), `value` (scalaire, ex. axe/gâchette), `vector2` (Vec2, ex. déplacement).
  - `InputActionMap` — groupe d'actions (ex. « Gameplay », « UI »), activable.
  - **Bindings** : `Key`/bouton/molette → action ; **composites** (ex. 2D vector WASD → `Vec2`), modifiers.
  - **Control schemes** (clavier+souris / gamepad), rebinding runtime.
  - Asset **sérialisable** (aligné avec la direction sérialisation du moteur).
- **Dans `@atlasjs/gameplay`** — composant **par-entité** `PlayerInput` (analogue au `PlayerInput` MonoBehaviour d'Unity) : `this.actions = this.addComponent(PlayerInput, asset)`. C'est ici que le composant par-entité prend son sens (chaque joueur peut avoir son scheme/device). API script :
  ```ts
  if (this.actions.jump.isPressed()) { /* ... */ }
  this.transform.translate(this.actions.move.readValue().x * speed * dt, 0);
  ```
- La façade de service Phase 1 (`InputApi`) reste valable pour l'input « brut » ; le système d'actions se construit **par-dessus** le backend `input`, sans casser la Phase 1.

## Points ouverts / risques

- **`mousePosition`/`mouseDelta` renvoient le `Vec2` vivant du backend.** Un script pourrait le muter. Cohérent avec `Transform2DComponent.position` (renvoie aussi le live). Cloner allouerait à chaque accès — non retenu. À surveiller si ça pose problème.
- **`getService` mint un wrapper neuf à chaque appel.** Sans conséquence au pattern visé (appel unique en `onCreate`). Acceptable (apatride).
- **Caveat `onFixedUpdate`.** Documenté, pas de garde runtime. Réévaluer si un besoin réel d'input déterministe en lane `fixed` émerge (Phase 2 / netcode).
- **Ré-export de `Key` depuis gameplay** crée un point d'accès dupliqué (gameplay + input). Assumé : simplifie l'import côté script ; `Key` reste défini une seule fois dans `@atlasjs/input`.
