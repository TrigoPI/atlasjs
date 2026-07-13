# Refonte du scheduling d'AtlasJS

> **Statut : en cours d'implémentation.** Document de design + suivi. On implémente une phase à la fois (voir la checklist en bas) ; chaque case est cochée après validation.

## Context

Le cœur de la boucle de jeu (`packages/core/src/public/engine`) est le maillon faible du moteur. L'audit a mis en évidence **deux systèmes de scheduling concurrents** (le `Scheduler` du core + le `SystemScheduler` de Nexus) que `GameplayPlugin` réconcilie à la main, plus **4 bugs latents** qui font que des contrats publics ne s'exécutent jamais :

1. `ScriptManager.fixedUpdate()` n'est jamais appelé → `AtlasScript.onFixedUpdate` ne se déclenche jamais.
2. Tout le pipeline gameplay (7 systèmes sur 8) tourne en lane `update` **variable** alors que la physique step en lane `fixed` → couplage cassé, non-déterministe.
3. Les steps du scheduler ne peuvent pas être retirés (`onUpdate/…` retournent `void`) → les `uninstall` fuient (ex. `NebulaPlugin.unsubscribe` toujours `null`, `EditorPlugin` ne peut pas retirer picking/gizmo).
4. `input.clear()` est enregistré en **début** de frame (`UPDATE_INPUT_BEGIN`) → les edges `isPressed/isReleased` sont effacés avant que le moindre système ne les lise.

En plus : `RapierPhysicsWorld.step()` ignore `fixedDelta` (Rapier intègre son 1/60 interne), le rendu n'a pas d'alpha d'interpolation, `Plugin.order` est un entier magique vestigial, et un plugin dont une dépendance manque fait **hang le boot indéfiniment** (aucun timeout, aucune détection de cycle).

**Décisions validées avec l'auteur :** (a) refonte complète en un plan cohérent ; (b) ordonnancement par **étapes nommées + contraintes `before`/`after`** (fin du hack `priority+id`) ; (c) architecture **rollback-ready** (pas de snapshot/netcode maintenant) ; (d) ajout de **vitest** pour verrouiller l'ordre d'exécution et le déterminisme. Nexus redevient un **pur data-store** : l'ordonnancement vit dans une seule autorité, le `Scheduler` du core.

**Résultat visé :** une seule autorité d'ordonnancement, déterministe et extensible ; un fixed-step propre piloté par `fixedDelta` ; des plugins à dépendances déclarées avec boot topologique et erreurs claires ; des steps/systèmes ajoutables/retirables à chaud et groupables (sets), notamment pour le mode éditeur.

---

## Modèle d'ordonnancement retenu

**Lane → Stage → contraintes.** Ordre grossier = liste ordonnée d'**étapes nommées** par lane (vocabulaire fermé, relu en core). Ordre fin = `before`/`after` optionnels, résolus par tri topologique **dans une étape** (edges inter-étapes interdits, erreur claire). Départage final : ordre d'insertion (stable). Ordre effectif = `(stageIndex, topoWithinStage, insertionSeq)`.

Pourquoi pas les priorités numériques : le `priority + id` déborde de bande sans garde-fou (gizmo `700 + id`), n'exprime aucune relation ("après l'ECS" = "un nombre plus grand"), et couple tous les packages aux littéraux `PRIORITY.*`. Pourquoi pas du before/after pur : sous-contraint, messages d'erreur illisibles. Les étapes nommées donnent la sémantique + le garde-fou ; `before`/`after` absorbe le fin.

**Tradeoff assumé :** les étapes sont un enum fermé par lane — ajouter une étape grossière est un changement core (volontaire : force le passage par un vocabulaire relu plutôt que des nombres magiques).

### Nouvelle API `Scheduler` (`packages/core/src/public/engine/types/Scheduler.types.ts`)

```ts
export type Lane = "fixed" | "update" | "render";

export type StepContext = {
  dt: number;      // fixedDelta en lane fixed ; frame dt en update/render
  alpha: number;   // 1 en fixed & update ; acc/fixedDelta en render (interpolation)
  tick: number;    // compteur fixe monotone (ancre rollback)
  frame: number;   // compteur de frame monotone
  elapsed: number; // secondes depuis le start (performance.now)
};

export type StepFn = (ctx: StepContext) => void;

export type StepSpec = {
  name: string;                          // unique dans la lane
  stage: string;                         // étape déclarée de la lane cible
  before?: string | readonly string[];
  after?: string | readonly string[];
  enabled?: boolean;                     // défaut true
};

export interface StepHandle {
  readonly name: string;
  readonly lane: Lane;
  remove(): void;
  setEnabled(enabled: boolean): void;
}
```

`LaneScheduler.add(fn, spec): StepHandle` remplace `onUpdate/onFixedUpdate/onRender`. La lane garde une `Map<name, …>` + un flag `dirty` et un `CompiledStep[]` caché ; **compile paresseuse** au premier `runLane` après mutation (on arrête de trier à chaque `add`). `compile()` : bucket par étape → DAG `before`/`after` intra-étape → tri de Kahn amorcé par ordre d'insertion → concaténation ; cycle → `SchedulerCycleError` avec le chemin. `runLane` itère en sautant `enabled === false`, zéro allocation par frame.

### Vocabulaire d'étapes (`Priority.ts` → `Stages.ts`)

```ts
export const FIXED_STAGES = [
  "PreSim", "ScriptFixed", "PhysicsRequest",
  "PhysicsStep", "PhysicsWriteback", "Cleanup",
] as const;
export const UPDATE_STAGES  = ["Early", "Logic", "Editor"] as const;
export const RENDER_STAGES  = ["PreRender", "Main", "Overlays", "Debug"] as const;
```

### Sets / groupes (mode éditeur, scènes)

```ts
export interface StepSet {
  readonly name: string;
  add(lane: Lane, fn: StepFn, spec: StepSpec): StepHandle;
  enable(): void; disable(): void;  // toggle play/edit à coût nul (steps restent enregistrés)
  remove(): void;                   // retire tous les steps du set
}
```
`Scheduler.createSet(name)`. Le set mémorise chaque handle distribué.

---

## Boucle moteur révisée (`Engine.ts`)

Ordre : **fixed (×N) → update → render+alpha**. `scene.update` devient un step enregistré (`update/Logic`, `name: "scene:update"`) — plus de second point d'entrée inline. Input : `beginFrame()` en début, `endFrame()` (= l'ancien `clear()`) en fin.

```ts
this.acc += dt; let steps = 0;
while (this.acc >= this.fixedDelta && steps < this.maxSubSteps) {
  this.time.tick++;
  this.scheduler.runLane("fixed", ctx(this.fixedDelta, /*alpha*/ 1));
  this.acc -= this.fixedDelta; steps++;
}
const alpha = this.acc / this.fixedDelta;
this.scheduler.runLane("update", ctx(dt, 1));
this.time.frame++;
this.scheduler.runLane("render", ctx(dt, alpha));
this.input?.endFrame();
```

Factoriser le bloc fixe en `Engine.advanceFixed(n)` : c'est **le seul seam** qui garde le rollback-netcode possible (un driver netcode appellera `advanceFixed` avec un snapshot d'input par tick, hors RAF) sans le construire aujourd'hui.

---

## Plugins : dépendances déclarées + boot topologique (`Plugin.ts`, `Engine.boot`)

Supprimer `order?`/`setOrder`. Déclarer le contrat DI déjà implicite dans `services.wait`/`provide` :

```ts
protected constructor(id: string, deps: {
  provides?: readonly ServiceToken<unknown>[];
  requires?: readonly ServiceToken<unknown>[];
} = {})
```

`boot()` : (1) map `token → provider` depuis les `provides` (doublon → throw) ; (2) chaque `requires` sans provider → **`MissingDependencyError`** (fix du hang) ; (3) tri de Kahn sur les edges provider→consumer (cycle → **`DependencyCycleError`**) ; (4) `install()` dans l'ordre topo ; (5) `Promise.race` avec timeout de boot (~10 s) → throw si un `deferred` ne résout jamais ; (6) assertion post-install : chaque `provides` déclaré est bien dans le registry.

`services.wait` reste inchangé : validé + installé dans l'ordre, sa promesse résout toujours.

---

## SceneContext ordonnançable (`scene/SceneContext.ts`, `SceneManager.ts`)

Ajouter `scheduler: StepSet` (set scoppé à la scène, auto-retiré à `destroy()`). `SceneManager` crée un set par scène active et le passe dans le contexte → scènes first-class, sans cas spécial.

---

## Fixed-step déterministe

- `PhysicsWorld.step()` → **`step(dt: number)`** (`packages/inertia/src/PhysicsWorld.ts`) ; `InertialPlugin` enregistre en `fixed/PhysicsStep` et appelle `world.step(ctx.dt)` (toujours `fixedDelta`).
- `RapierPhysicsWorld.step(dt)` : `this.world.timestep = dt; this.world.step();` — Rapier intègre le pas fixe, plus son 1/60 interne. **`fixedDelta` uniquement** au call site (dt variable casserait déterminisme + stabilité du solveur).
- `FrameClock` monotone dans `packages/core/src/private` (`tick`, `frame`, `elapsed`, `acc` via `performance.now`). Interdire `Date.now` dans la lane fixe : la sim doit être fonction pure de `(tick, fixedDelta, snapshot input)`.

> À dire clairement : sous le driver RAF (clamp dt 0.25 + `maxSubSteps` qui *drop* du temps), la sim n'est **pas** bit-exact entre machines. Le design est *rollback-ready* (seam `advanceFixed` + sim sans wall-clock), pas *déterministe aujourd'hui*.

---

## Re-classification des systèmes (`GameplayPlugin.ts`)

Supprimer `SystemScheduler` et le `update()` monolithique ; enregistrer chaque système via un adaptateur `registerSystem(lane, world, system, spec)` (nouveau fichier `packages/gameplay/src/registerSystem.ts`) qui narrow `StepContext → {world, dt}` :

- `fixed/ScriptFixed` : `scriptManager.fixedUpdate`
- `fixed/PhysicsRequest` : ScriptTransformRequest → RigidBody2DRequest → RigidBody2D(create) → TransformRequestResolve (chaînés par `after`)
- `fixed/PhysicsWriteback` : RigidBodyWriteBack → ScriptTransformFeedback
- `fixed/Cleanup` : TransformWriteRequestCleanup
- `update/Logic` : `scriptManager.update`
- `render/Main` : SpriteRenderSystem

Garder tous les `StepHandle` pour `uninstall`.

---

## Fichiers touchés (résumé)

- **core** : `types/Scheduler.types.ts` (nouveaux types) ; `Scheduler.ts` (réécriture lanes→stages→topo, `add→StepHandle`, `createSet`, `runLane`, compile paresseuse) ; `Priority.ts`→`Stages.ts` ; `Plugin.ts` (`provides`/`requires`) ; `Engine.ts` (boucle, boot topo, `advanceFixed`, `scene:update`) ; `private/FrameClock.ts` ; `scene/SceneContext.ts` + `SceneManager.ts`.
- **nexus** : supprimer `NexusScheduler.ts` + export ; `NexusSystem`/`NexusSystemContext` conservés ; `NexusPlugin` déclare `provides: [NEXUS]`.
- **gameplay** : `registerSystem.ts` ; `GameplayPlugin.ts` (re-lanes + `provides/requires` + handles).
- **input** : `InputPlugin.ts` (retirer le `onUpdate(clear)`, `provides:[INPUT]`) ; `Input`/`BackendInput` : ajouter `beginFrame()`/`endFrame()`.
- **inertia** : `PhysicsWorld.step(dt)` ; `InertialPlugin` (lane `fixed/PhysicsStep`, handle, `provides`).
- **rapier** : `RapierPhysicsWorld.step(dt)` (`world.timestep = dt`).
- **nebula** : `NebulaPlugin` en `render/Main` + handle + `provides`.
- **editor** : `StepSet` "editor", picking/gizmo en `update/Editor` (`after` au lieu de `id:1`), `uninstall → set.remove()`, `requires/provides`.
- **apps/sandbox** : rien (le shim de compat couvre la phase 0) ; vérifier que `TestScript.onFixedUpdate` se déclenche désormais.

---

## Migration par phases (sandbox verte à chaque étape)

On implémente **une phase à la fois** ; après validation de l'auteur, on coche la case et on commit avant de passer à la suivante.

- [x] **Phase 0 — Scheduler additif** : nouveau `Scheduler` (lanes/stages/sets/handles/`StepContext`) + façade de compat (`onUpdate/…(fn,{priority,id})` mappe `priority`→stage synthétique, wrap `(dt)→(ctx)`). Rien d'autre ne bouge, sandbox inchangée. _(vitest + 15 tests verts ; core build + monorepo OK.)_
- [ ] **Phase 1 — Boucle** : réorg Engine (fixed→update→render, alpha, compteurs, step `scene:update`, `FrameClock`).
- [ ] **Phase 2 — Boot topo** : `provides/requires` sur tous les plugins, tri topo + `MissingDependencyError`/`DependencyCycleError` + timeout de boot, `order` = no-op déprécié.
- [ ] **Phase 3 — Physics dt** : `PhysicsWorld.step(dt)` + `world.timestep = dt`.
- [ ] **Phase 4 — Re-lanes ECS** : split `GameplayPlugin` en étapes fixed/render + `scriptManager.fixedUpdate` branché.
- [ ] **Phase 5 — Suppr. `NexusScheduler`** : suppression fichier + export.
- [ ] **Phase 6 — Fix input** : `clear` → `endFrame`, ajout `beginFrame`/`endFrame`.
- [ ] **Phase 7 — Set éditeur + `SceneContext.scheduler`**.
- [ ] **Phase 8 — Retrait compat** : suppression de la façade `priority` et du `PRIORITY` numérique.
- [ ] **Tests vitest** : à glisser au fil des phases (Scheduler dès phase 0, Engine dès phase 1-2, déterminisme dès phase 4).

---

## Vérification

Aucun test n'existe aujourd'hui (build = tsdown + Turbo). Ajouter **vitest** + une tâche Turbo `test`.

- `packages/core/Scheduler.test.ts` : ordre des étapes ; topo `before`/`after` ; départage par insertion ; cycle → throw ; `remove`/`setEnabled` ; `StepSet.remove/disable`.
- `packages/core/Engine.test.ts` : driver temps injecté → ordre des lanes (fixed×N avant update avant render), valeur d'`alpha` sur les sous-steps, boot throw sur dep manquante/cyclique, pas de hang (timeout).
- `packages/gameplay/determinism.test.ts` : `PhysicsWorld` mocké → `advanceFixed` K ticks deux fois avec le même input scripté → transforms identiques + même ordre d'exécution par tick (garde-fou déterminisme/rollback).
- **Manuel** : `pnpm --filter sandbox dev`, vérifier rendu du sprite + feedback physique, et qu'un `onFixedUpdate` de script se déclenche (log). Vérifier qu'une dépendance retirée d'un plugin fait échouer le boot proprement.

---

## Risques / tradeoffs

1. **`StepFn` passe de `dt` à `ctx`** → touche tous les steps ; la façade phase 0 diffère la corvée, la phase 8 l'assume (un `dt` nu ne peut pas porter `alpha`/`tick`).
2. **Étapes = enum fermé** → nouvelle étape grossière = edit core (garde-fou volontaire).
3. **fixed-avant-update change le feel** : la logique variable/scène voit l'état post-sim dans la même frame ; à valider en sandbox (l'ordre inverse est défendable, mais celui-ci se marie au render interpolé).
4. **`provides`/`requires` peuvent dériver** de ce que fait `install` → mitigé par l'assertion post-install.
5. **`world.timestep` par step** n'est sûr que parce qu'on passe toujours `fixedDelta` — à enforcer au call site.
