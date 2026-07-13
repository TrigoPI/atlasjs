# Refonte de l'ECS Nexus (`@atlasjs/nexus`)

> **Statut : implémenté (phases 0→7 terminées).** Migration `gameplay` restante (doc séparé). Document de design + suivi. Voir la checklist en bas.

## Context

`@atlasjs/nexus` est l'ECS du moteur (sparse-set par composant, entity recycling, query par intersection). Il est consommé par `@atlasjs/gameplay`. L'archi de base est saine, mais l'audit a relevé **un bug de correctness déjà déclenché en prod, une bombe à retardement sur le recyclage d'entités, et une double-indirection dans le hot path** qui plombe perf et ergonomie à la fois.

### Problèmes identifiés

1. **Mutation structurelle pendant l'itération → entités sautées (bug actif).** `NexusQuery.entities()` itère `for i in 0..baseStore.size` sur le tableau `dense` **vivant**. `TransformWriteRequestCleanupSystem` supprime le composant de base pendant l'itération → le swap-remove déplace le dernier élément à l'index courant → une entité sur deux est sautée. Le cleanup ne draine que partiellement chaque frame.

2. **Entités sans génération → stale handle / ABA.** `EntityManager` recycle les ids via freelist sans version. Un handle vers une entité détruite s'applique en silence à la nouvelle entité qui a hérité de l'id. Aggravé par les stores externes clés par entité côté gameplay (`runtimeBodiesStorage`) qui ne sont jamais nettoyés à la destruction (aucun événement de cycle de vie).

3. **Double-indirection dans le hot path.** Les systèmes font `world.query(A, B)` puis, pour chaque entité, `world.requireComponents(entity, A, B)` — ce qui re-résout les stores via `Map.get(componentID)` + re-vérifie `assertEntityExists`/`assertComponentData`, alloue un tableau (`.map` + spread) **par entité et par frame**. Or la query **tient déjà les stores**. Elle jette l'information la plus utile qu'elle possède.

4. **Overhead d'itération.** `entities()` est un générateur (coût du protocole itérateur par `yield`) et rappelle `baseStore.getEntities()` à chaque tour de boucle au lieu de hoister la référence. `query.size` est un getter O(n) qui a l'air O(1).

5. **Bugs mineurs / ergonomie.** `addComponent` logue `component.constructor.name` (`"Function"`) au lieu de `component.name`. `hasComponent` sur une entité morte throw au lieu de renvoyer `false`. Oublier `world.defineComponent(X)` produit une erreur cryptique au premier `addComponent`. `ComponentStore` est un wrapper 100 % pass-through sans valeur ajoutée. Pas de multi-world propre (état global `COMPONENT_TYPE_ID`).

## Décisions validées avec l'auteur

- **Cible perf : 1k–3k entités actives @ 60 fps** au minimum. Au-delà : sujet à réflexion ultérieure.
- **Stockage : sparse-set + composants-classes** conservés. À cette échelle le pointer-chasing et le GC des instances sont négligeables ; SoA/archetype seraient de l'ingénierie payée en DX sans gain visible. **La migration future (archetype/SoA) doit rester indolore** — garantie par l'abstraction, pas par la représentation (cf. « Backend swappable »).
- **Command buffer** pour la mutation structurelle pendant une frame, avec **flush hybride** : auto aux sync points (fin de stage/lane, aligné sur `scheduling-redesign.md`) + `world.flush()` manuel disponible.
- **Mutation directe par défaut, buffer si besoin** (modèle EnTT/flecs). Le direct s'applique immédiatement (setup, spawn, éditeur, tests) ; `world.commands` défère quand on mute pendant une query. Un **garde-fou fail-fast** (compteur de version par store, vérifié par l'itérateur) transforme le bug silencieux actuel en erreur claire immédiate.
- **Query typée** yield-ant `(entity, ...composants)` : chemin d'accès **unique** pour les systèmes, zéro re-lookup.
- **Multi-world** : plusieurs `NexusWorld` isolés doivent coexister.
- **Priorité : perf brute d'abord**, ergonomie affinée en phase 2.

## Résultat visé

Un ECS où : les systèmes itèrent via une seule API (`world.query(...).each(...)`), sans jamais toucher le stockage ; les handles d'entité sont sûrs (générations) ; la mutation pendant itération est soit sûre (command buffer) soit signalée immédiatement (fail-fast) ; le backend de stockage est remplaçable sans toucher gameplay ; plusieurs worlds cohabitent.

---

## Modèle retenu

### 1. Générations d'entités

Un `Entity` reste un `number` branded, mais encode `index` (bits bas) + `génération` (bits hauts).

**Encodage multiplicatif (pas de BigInt).** `entityIndex`/`entityGeneration` sont appelés sur le hot path (`store.has` par entité × par composant), donc on évite BigInt : `index` capé à 21 bits (2 097 152 slots), génération sur le reste, le tout tient sous `Number.MAX_SAFE_INTEGER`.

```ts
const ENTITY_INDEX_BITS = 21;
const ENTITY_INDEX_CAPACITY = 1 << ENTITY_INDEX_BITS; // 2_097_152

function makeEntity(index: number, generation: number): Entity {
  return (generation * ENTITY_INDEX_CAPACITY + index) as Entity;
}
function entityIndex(e: Entity): number { return e % ENTITY_INDEX_CAPACITY; }
function entityGeneration(e: Entity): number { return Math.floor(e / ENTITY_INDEX_CAPACITY); }
```

`EntityManager` conserve `generations[index]`, `alive[index]` (bit occupé) et une freelist `freeIndices`. `create()` réutilise un slot libre (génération inchangée, déjà incrémentée au destroy) ou en alloue un neuf. `destroy(e)` passe `alive[index] = false`, incrémente `generations[index]`, et remet `index` dans la freelist. `has(e)` = `alive[index] && generations[index] === entityGeneration(e)`. Un handle périmé échoue proprement au lieu de lire des données fantômes.

Les `SparseSet` indexent `sparse` par `entityIndex(e)` (compact, borné par le pic d'entités vivantes) mais stockent l'`Entity` complète dans `dense` : l'égalité `dense[i] === entity` rejette donc aussi les handles périmés au niveau du store — sûreté bonus, y compris pour les stores externes non nettoyés côté gameplay.

> Les stores/sparse-sets s'indexent par `entityIndex(e)` (l'index bas), pas par le number packé — le sparse reste compact et borné par le pic d'entités vivantes.

### 2. Backend de stockage swappable

C'est ce qui rend la migration SoA/archetype indolore. On introduit une interface de store ; `SparseSetStore` en est l'implémentation actuelle. `ComponentStore` cesse d'être un wrapper mort et devient **ce seam** (+ point d'accroche des événements de cycle de vie).

```ts
export interface IComponentStore<T = any> {
  readonly size: number;
  readonly version: number;              // incrémenté à chaque mutation structurelle
  has(entity: Entity): boolean;
  get(entity: Entity): T | undefined;
  set(entity: Entity, component: T): void;
  delete(entity: Entity): boolean;
  getEntities(): ReadonlyArray<Entity>;  // dense (Entity complètes), pour l'itération de query
  entities(): IterableIterator<Entity>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[Entity, T]>;
}
```

`version` n'est incrémenté que sur changement **structurel** (ajout/suppression), pas sur écrasement d'une valeur existante — c'est ce que le garde-fou de la Phase 3 échantillonne pour détecter une mutation pendant itération. `SparseSet.set` renvoie désormais un booléen (inséré vs écrasé) pour alimenter ce compteur.

Les systèmes ne voient jamais cette interface : ils passent par `query`. Demain, un `ArchetypeStore` ou un `SoAStore` (adossé à des `Float32Array`) remplace `SparseSetStore` sans toucher gameplay.

### 3. Query typée (chemin d'accès unique)

La query connaît déjà ses stores → elle tend les composants directement, sans re-lookup ni allocation par entité.

```ts
// Signature typée : le tuple de composants est inféré des types passés.
query<T extends object[]>(...types: ComponentList<T>): Query<T>;

export interface Query<T extends object[]> {
  each(fn: (entity: Entity, ...components: T) => void): void; // chemin chaud, non-générateur
  [Symbol.iterator](): Iterator<[Entity, ...T]>;              // confort : for...of destructuré
  count(): number;                                            // ex-`size`, explicitement O(n)
  has(entity: Entity): boolean;
}
```

Usage cible (remplace `query + requireComponents`) :

```ts
world.query(RigidBody2D, Transform2D).each((entity, rb, tr) => {
  runtime.setMass(rb.mass); // rb, tr déjà résolus depuis les dense arrays, zéro re-lookup
});
```

`each` hoiste `getEntities()`/les stores une fois, boucle en `for` classique, et lit chaque composant via `store.get(entity)` (une seule résolution par store/entité, `undefined` = absent). Pas de générateur sur le chemin chaud. **Zéro alloc par entité** : les composants sont rassemblés dans un tableau `args` **réutilisé** entre les itérations, et `fn.apply(undefined, args)` le lit en place (pas de spread qui réallouerait). L'itérateur `[Symbol.iterator]` (confort `for...of`) alloue un tuple par entité — c'est le chemin non-chaud, assumé.

Comme `world.query` construit `stores` dans l'ordre des types demandés, `each` restitue les composants **dans l'ordre demandé** même si le base store (le plus petit) est un autre.

**Garde-fou fail-fast :** `each`/`entities`/l'itérateur capturent `baseStore.version` au début et le revérifient **à chaque tour** ; une mutation structurelle directe du store itéré lève une erreur explicite listant les composants concernés (« defer it with world.commands »). Le bug silencieux d'entités sautées devient un throw immédiat et actionnable.

### 4. Command buffer + flush hybride

```ts
export interface CommandBuffer {
  spawn(): Entity;                                          // immédiat (voir ci-dessous)
  destroy(entity: Entity): void;
  add<T, A extends unknown[]>(e: Entity, c: Component<T, A>, ...args: A): void;
  set<T, A extends unknown[]>(e: Entity, c: Component<T, A>, ...args: A): void;
  remove<T>(e: Entity, c: Component<T>): void;
}

class NexusWorld {
  readonly commands: CommandBuffer;   // mutations différées
  flush(): void;                       // applique le buffer ; appelé manuellement OU par le scheduler
  // addComponent/removeComponent/destroyEntity restent DIRECTS et immédiats hors itération
}
```

- **`spawn()` est immédiat** : créer une entité nue ne touche aucun store de composant, donc c'est sûr en pleine itération. Le handle est utilisable tout de suite (par les `add` différés qui suivent). Seules les mutations de composants/structure sont différées.
- **Direct** (`world.addComponent`, …) : appliqué tout de suite. Pour setup, spawn au chargement, éditeur, tests.
- **Différé** (`world.commands.add/set/remove/destroy`, …) : accumulé dans une file de thunks, rejoué au `flush()`. Pour la mutation pendant une query.
- **Flush hybride** : le scheduler flushe automatiquement aux sync points (fin de stage/lane) ; `world.flush()` reste disponible pour forcer dans un système précis. Le câblage auto est fait à la migration de gameplay (nexus fournit la primitive `flush()`).
- Ordre d'application déterministe = ordre d'enregistrement. `destroy` est idempotent (double-destroy dans un même flush toléré).
- **Pas de dépendance circulaire** : `NexusCommandBuffer` ne dépend pas de `NexusWorld` mais d'une interface minimale `CommandTarget` (les 6 opérations qu'il diffère). `NexusWorld` la satisfait structurellement et se passe lui-même (`new NexusCommandBuffer(this)`) — inversion de dépendance, le buffer ne connaît que ce qu'il touche.

### 5. Multi-world

Les `NexusWorld` sont isolés : chacun a ses `stores`, son `EntityManager`, son `CommandBuffer`. Les `ComponentID` restent **globaux et stables par classe** (un composant a le même id dans tous les worlds) — c'est le comportement voulu : chaque world garde une `Map<ComponentID, Store>` distincte, mais l'id d'un composant ne dépend pas du world.

On remplace l'état module-global mutable + le monkeypatch de la classe (`ctor.componentID`) par un `ComponentRegistry` explicite : une `Map<Component, ComponentID>` + un compteur encapsulé. Une instance partagée par défaut (`defaultComponentRegistry`) donne les ids stables inter-world ; `NexusWorld` l'accepte en paramètre de constructeur (`new NexusWorld(registry?)`, défaut = partagée) — donc **isolation totale des ids possible** en injectant un registre neuf (tests, hot-reload). Le type `ComponentData` et l'assertion `assertComponentData` disparaissent (plus de champ sur la classe).

**Auto-définition (livrée ici, avancée de la Phase 6) :** `getOrCreateStore` enregistre le composant à la première utilisation ; `findStore` renvoie `undefined` proprement pour un composant jamais utilisé. Plus besoin de `world.defineComponent(X)` explicite, et l'ancienne erreur cryptique `"not a valid ComponentData"` disparaît. `world.defineComponent` reste dispo (explicite + log).

**Cas sérialisation** (déféré, hors scope immédiat) : pour des ids stables entre process/versions, prévoir un registre par nom plutôt que par ordre d'insertion — noté ici pour ne pas s'enfermer.

### 6. Correctifs & ergonomie

- Auto-`defineComponent` à la première utilisation (`getOrCreateStore` assigne l'id si absent) → plus d'erreur cryptique, `defineComponent` chaîné devient optionnel.
- `hasComponent(deadEntity, X)` → `false` (ne throw plus).
- Message d'erreur `addComponent` : `component.name`.
- `addComponent` accepte une instance existante en plus de `(ctor, ...args)`.
- Événements de cycle de vie (`onAdd`/`onRemove`) → cf. section 7.

### 7. Filtres de query & événements de cycle de vie

**Filtres (builder immuable sur la query).** La query connaît les stores de ses composants ; pour résoudre les stores ajoutés par les filtres, elle reçoit un `StoreResolver` (`(component) => IComponentStore | undefined`) — le même découplage que `CommandTarget`, elle ne dépend pas du world concret.

```ts
world.query(Position).without(Frozen).each((e, pos) => { ... });        // exclusion
world.query(Position).optional(Velocity).each((e, pos, vel) => { ... }); // vel: Velocity | undefined
world.query(Position).without(Frozen).optional(Velocity)                 // combinables
```

- `without(...types)` : filtre les entités qui possèdent l'un des composants exclus. Tuple yield **inchangé** (`Query<T>`). Composant exclu jamais utilisé → store absent → no-op.
- `optional(...types)` : n'affecte **pas** l'appartenance (le base store reste le plus petit des composants **requis**) ; ajoute au tuple des valeurs `U[K] | undefined`. Le paramètre générique de `Query` passe de `object[]` à `unknown[]` pour porter le `| undefined`.
- Les filtres retournent une **nouvelle** query configurée (les queries sont éphémères, une par frame).

**Événements de cycle de vie (médiés par le world, pas par le store).** `world.onAdd(Component, listener)` / `world.onRemove(Component, listener)` renvoient un `Unsubscribe`. Le world émet depuis `addComponent`/`setComponent` (insertion uniquement, pas sur écrasement) / `removeComponent` / `destroyEntity` (un `onRemove` par composant détruit). Les mutations différées émettent **au flush**. Coût nul sans listener (map vide court-circuitée). Garder la logique dans le world laisse `IComponentStore` inchangé.

> Ces événements sont la brique qui permettra (à la migration gameplay) de nettoyer automatiquement les stores externes clés par entité (ex. `runtimeBodiesStorage`) : un `onRemove(RigidBody2D, …)` supprime le body runtime associé.

---

## Plan d'implémentation (par phases, perf d'abord)

- **Phase 0 — Filet de sécurité.** Setup vitest sur `nexus` : tests qui verrouillent le bug de mutation-pendant-itération (doit devenir vert), le recyclage d'entités, l'intersection de query.
- **Phase 1 — Générations d'entités.** `EntityManager` + pack/unpack ; stores indexés par `entityIndex`. Rendre les handles périmés sûrs.
- **Phase 2 — Backend swappable.** Extraire `IComponentStore` ; `SparseSetStore` = impl actuelle ; `version` par store.
- **Phase 3 — Query typée + `each`.** Chemin chaud non-générateur, tuples typés, garde-fou fail-fast sur `version`. Migrer les usages internes.
- **Phase 4 — Command buffer + flush hybride.** `world.commands`, `world.flush()`, hook de flush auto dans le scheduler.
- **Phase 5 — Multi-world + registre.** `ComponentRegistry`, suppression de l'état module-global.
- **Phase 6 — Correctifs & ergo.** Auto-define, `hasComponent`, messages, `addComponent(instance)`.
- **Phase 7 (ergo) — Filtres `without`/optionnels, événements de cycle de vie.** Builder `without`/`optional` sur la query via `StoreResolver` ; `world.onAdd`/`onRemove` médiés par le world.

> `gameplay` n'est **pas** modifié dans ce doc. Sa migration (query typée, `world.commands` dans les systèmes de cleanup/request) fera l'objet d'un passage dédié une fois nexus stabilisé.

---

## Checklist

- [x] Phase 0 — vitest + tests de non-régression (mutation-pendant-itération, recyclage, intersection)
- [x] Phase 1 — générations d'entités
- [x] Phase 2 — `IComponentStore` + `SparseSetStore` + `version`
- [x] Phase 3 — query typée `each`/tuples + garde-fou fail-fast
- [x] Phase 4 — command buffer + flush hybride (`world.commands` + `world.flush()` ; câblage auto scheduler à la migration gameplay)
- [x] Phase 5 — multi-world + `ComponentRegistry` (+ auto-define livré en avance ; supprime aussi l'erreur tsc pré-existante de `define-component`)
- [x] Phase 6 — correctifs restants (`hasComponent` no-throw sur entité morte, message `component.name`, `addComponent(instance)`) — auto-define déjà fait en Phase 5
- [x] Phase 7 — filtres `without`/optionnels + événements de cycle de vie
- [ ] Migration `gameplay` (doc séparé)
