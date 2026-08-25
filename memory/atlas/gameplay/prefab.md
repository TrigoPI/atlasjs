# Prefab & Instantiation — design

> **Statut : ✅ implémenté** (shippé sur `dev`).
> Domaine : `@atlasjs/gameplay`. Débloque la création d'entités **depuis un script** à l'exécution (projectiles, ennemis, effets), via des **prefabs code-first typés**.

---

## 1. Problème

Aujourd'hui, créer une entité est **exclusivement impératif et côté app** : des « spawn functions »
(`apps/dino-brawl/src/game/spawn/spawnPlayer.ts`, `spawnSword.ts`) font
`nexus.createEntity()` → `addComponent(e, Type, ...args)` → **mutation de l'instance retournée**
(`render.sortingOrder = …`, `transform.scale.set(…)`) → `nexus.setParent(child, parent)` →
`scriptManager.attach(e, Script, props)`.

Le trou : côté script (`AtlasScript` / `RuntimeScriptContext`), un script ne peut agir que sur **sa
propre** entité ou sur une entité **déjà existante** (`getEntity`). **Aucun moyen de créer une entité
nouvelle.** Un gameplay qui doit faire apparaître ce qui n'existe pas encore (tirer un projectile,
faire spawn un ennemi) est donc impossible depuis la couche script.

La difficulté centrale du modèle : un composant n'est pas « type + data ». C'est
`addComponent(Type, ...argsCtor)` **puis** mutation de l'instance, et certains arguments sont des
**ressources déjà chargées** (`Sprite`, `SpriteSheet`, clips) obtenues en **async**. Un prefab doit
donc séparer « préparer une fois (async) » de « instancier N fois (sync, bon marché) ».

## 2. Décisions structurantes

| Axe | Décision | Justification |
| --- | --- | --- |
| **Forme du prefab** | Code-first typé (closures), **non sérialisable** | Cohérent avec la philosophie du repo (sérialisation/éditeur = V2 partout). Gère `add + mutation` nativement, capture les assets chargés par closure, typage complet. |
| **Portée** | **Mono-racine** (une entité + ses composants/scripts) | Le cas d'usage n°1 est le projectile. Les prefabs multi-entités avec **références internes** (dino + ombre d'un bloc) sont le vrai gros morceau → V2. |
| **Config par instance** | **Params typés** sur le prefab | `definePrefab<TParams>({ build(entity, params) })` ; `instantiate(prefab, params)` exige les params, qui coulent dans `build`. Aucune hypothèse `Transform` câblée dans le moteur (`position` vit dans les params). |
| **Companion** | `destroy` **inclus** dans le périmètre | Un projectile qui ne meurt jamais est inutile ; instancier sans détruire est un demi-feature. |

## 3. Le modèle `Prefab`

Un prefab est une **valeur JS** décrivant un `build`, paramétrée par le type de sa config par instance.

```ts
type Prefab<TParams = void> = {
  readonly name?: string;
  build(entity: EntityBuilder, params: TParams): void;
};

function definePrefab<TParams = void>(def: {
  name?: string;
  build(entity: EntityBuilder, params: TParams): void;
}): Prefab<TParams>;
```

`definePrefab` est un simple constructeur d'identité typé (il retourne `def` scellé). Sa valeur est le
**typage** : `TParams` est inféré et propagé jusqu'au site d'appel de `instantiate`.

### `EntityBuilder`

Handle **lié à la racine déjà créée** par l'`Instantiator`, exposant exactement la surface de spawn
actuelle (coût d'apprentissage nul) :

```ts
interface EntityBuilder {
  readonly entity: Entity;
  add(type, ...args): instance;   // = world.addComponent(root, type, ...args) → on mute l'instance
  attach(Script, ...props): script; // = scriptManager.attach(root, Script, ...props)
  child(buildFn): EntityBuilder;    // ajouté après la v1 — voir prefab-multi-entity.md
}
```

- **`add`** réutilise **le même dispatch que `GameEntity.addComponent`** (token de composant → API/proxy ;
  composant brut → instance brute). En pratique le corps de `build` mute l'instance retournée
  (`render.sortingOrder = …`, `transform.scale.set(…)`), exactement comme les spawn functions.
  Si le composant est **déjà présent**, l'instance existante est réutilisée — mais lui passer des
  arguments **lève** désormais, plutôt que de les jeter silencieusement.
- **`attach`** délègue à `scriptManager.attach(root, Script, props)` — même signature/typage que l'attach
  courant (props exposés typés via `AttachProps`/`ScriptMetadata`).
- la v1 était **mono-racine** (pas de création d'enfants dans le builder) ; `child()` — création
  d'entités filles auto-parentées + résolution des références internes — a été **livré depuis**
  (voir [`prefab-multi-entity.md`](prefab-multi-entity.md) et §10).

## 4. `instantiate` — l'API qui manque

Un seul moteur d'instanciation, le service **`Instantiator`**, exposé à **deux endroits** avec la
**même** logique (DRY) :

```ts
interface Instantiator {
  instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  destroy(entity: Entity): void;
}

type InstantiateOptions = { parent?: Entity };

type InstantiateArgs<TParams> = [TParams] extends [void]
  ? [params?: undefined, options?: InstantiateOptions]
  : [params: TParams, options?: InstantiateOptions];
```

> **Ergonomie des params.** Quand `TParams` est `void`, les params sont omis (`instantiate(prefab)`) ;
> sinon ils sont exigés (`instantiate(prefab, params)`). L'implémentation reprend l'astuce de tuple
> conditionnel déjà utilisée par `ScriptManager.attach` (`AttachArgs`) pour rendre l'argument
> optionnel-ou-requis selon le type. Le site d'appel reste `instantiate(prefab, params, options?)`.

**Déroulé de `instantiate` :**

1. `const root = world.createEntity()` (immédiat).
2. Construire l'`EntityBuilder` lié à `root` (wrappe `world` + `scriptManager`).
3. `prefab.build(builder, params)`.
4. Si `options.parent` → `world.setParent(root, options.parent)` (pur ECS, aucune hypothèse `Transform`).
5. Retour : `createGameEntity(root, world, scriptManager)`.

Les étapes 3 et 4 tournent sous `try`/`catch` : si `build` (ou `setParent`) lève, `instantiate`
**détruit la racine déjà créée** (`this.destroy(root)`) puis re-propage l'erreur — aucune entité
à moitié construite ne survit à un `build` fautif.

**Retour = `GameEntity`** — cohérent avec le modèle cross-entity : l'appelant obtient
`getScript` / `getComponent` / `destroy` sur la nouvelle entité, et son id brut reste accessible.

### Exposition

- **Côté script** — premier-classe sur `AtlasScript` (parallèle Unity `Instantiate(...)`) :
  ```ts
  const bullet: GameEntity = this.instantiate(BulletPrefab, { position, direction });
  ```
- **Côté scène / composition root** — via le service :
  ```ts
  services.get(INSTANTIATOR).instantiate(BulletPrefab, { … });
  ```

### Timing & sûreté structurelle (résolu)

- `createEntity` + `add` sont **immédiats** ; les scripts attachés partent en `pendingCreate` → leur
  `onCreate` se déclenche au prochain `flushCreates` du `ScriptManager` (latence ~1 frame, **exactement**
  la sémantique `attach` actuelle). Parallèle Unity : `Instantiate` crée l'objet tout de suite, `Start`
  au frame suivant.
- **Safe pendant l'update des scripts** : les scripts tournent dans leur propre step du scheduler, hors
  itération d'une `query().each()`. `attach` mute la `Map` des records du `ScriptManager`, mais le
  nouveau record est `isCreated = false` donc ignoré par la boucle d'update en cours. Aucune
  ré-entrance de `onUpdate` le même frame.

## 5. `destroy` — companion

Nécessaire pour clore le cycle de vie (durée de vie d'un projectile). Deux surfaces :

```ts
this.destroy();          // AtlasScript : détruit SA propre entité
otherEntity.destroy();   // GameEntity : détruit cette entité
```

**Contrainte** rappelée par l'ECS (`NexusWorld`, vérifié) : `destroyEntity` est **immédiat + récursif**
(détruit les enfants, détache du parent, retire tous les composants en émettant `onRemove`, détruit
l'entité) ; sa version **différée** est `world.commands.destroy` (flush au `Sync`). Il n'existe **aucun
événement générique « entité détruite »** — seulement `onRemove` **par composant**. Donc le nettoyage
des scripts d'une entité détruite doit être **explicite**.

**Déroulé de `destroy(entity)` (différé) :**

1. Marcher le **sous-arbre** capturé *maintenant* (`entity` + descendants via `world.getChildren`,
   récursif — les listes d'enfants sont encore valides).
2. Pour chaque nœud du sous-arbre : `scriptManager.destroyEntityScripts(node)` — déjà différé
   (`pendingDestroy` → `onDestroy` au prochain `flushDestroys`).
3. `world.commands.destroy(entity)` — différé, récursif au `Sync`.

**Localisation.** `destroy` est **auto-suffisant sur `GameEntity`** : il n'a besoin que de `(world,
resolver)`, que le handle possède déjà. Cela impose une **extension minimale** de l'interface
`ScriptResolver` (déjà passée à `createGameEntity`) : ajouter `destroyEntityScripts(entity)`, implémenté
par `ScriptManager` (qui enfile chaque record de l'entité via `destroyById`). Ainsi :
- `GameEntity.destroy()` = marche du sous-arbre + `resolver.destroyEntityScripts(node)` + `world.commands.destroy(entity)`.
- `AtlasScript.destroy()` = `this.self.destroy()` (le `RuntimeScriptContext` détient déjà `self: GameEntity`).
- `Instantiator.destroy(entity)` = `createGameEntity(entity, world, scriptManager).destroy()` (même corps).

**Idempotence.** Détruire deux fois est un no-op : `ScriptManager.destroyById` garde déjà l'état
`isDestroyed` ; la commande `world.commands.destroy` doit **tolérer une entité déjà absente au flush**
(garde `world.exists` au flush, ou au moment de l'enfilage). Ce point de robustesse est explicité pour
le plan.

## 6. Comment un prefab atteint un script (+ assets async)

**Zéro nouvelle machinerie async.** Un `Prefab` est une valeur construite **après** le chargement des
assets (comme les spawn functions aujourd'hui), puis **passée comme prop exposé** — le
`[SerializeField] prefab` de Unity :

```ts
// scene.onCreate (async) — le prefab est bâti APRÈS le load
const sprite = await assets.load<Sprite>(bulletSpriteAsset);
const bulletPrefab = makeBulletPrefab(sprite);                 // factory app : capture le sprite par closure
scriptManager.attach(player, ShooterScript, { bulletPrefab }); // déclaré ScriptMetadata.field()
```

- Un `Prefab<T>` traverse `AttachProps` / `injectProps` **intact** (c'est une valeur ordinaire ; seul le
  kind `entity` subit une transformation `Entity → GameEntity`). Déclaré via `ScriptMetadata.field()`,
  il n'émet pas le warning « prop non exposé ».
- **Factory côté app** (`makeBulletPrefab(sprite): Prefab<Params>`) plutôt que `definePrefab` au niveau
  module : l'asset est async, donc le prefab **ne peut pas** être un singleton de module. La factory
  capture les ressources chargées → **chargé une fois, instancié N fois, sans coût async par tir**.

## 7. Placement & câblage

Tout dans **`@atlasjs/gameplay`** (le prefab câble le monde ECS + le `ScriptManager` + les tokens de
composants — pile la responsabilité de composition de ce package).

- **Nouveau dossier `packages/gameplay/src/prefab/`** : `definePrefab`, `PrefabEntityBuilder`,
  `Instantiator`. Barrel réexporté par `src/index.ts`. Les **types** (`Prefab`, `InstantiateOptions`,
  `InstantiateArgs`, `EntityBuilder`) vivent depuis dans `src/scripting/core/` — `ScriptContext` et
  `AtlasScript` les référencent et ne doivent pas dépendre de `src/prefab/` — et sont réexportés par
  `src/prefab/` pour que le point d'entrée public reste inchangé.
- **`ScriptContext` + `AtlasScript`** gagnent `instantiate(...)` et `destroy()`.
  `RuntimeScriptContext.instantiate` **résout `INSTANTIATOR` paresseusement via `services`**
  (`this.services.get(INSTANTIATOR)`), ce qui **casse le cycle** `ScriptManager ↔ Instantiator` sans
  couplage de constructeur ; `RuntimeScriptContext.destroy` délègue à `this.self.destroy()`.
- **`ScriptResolver`** (dans `scripting/core`) : ajouter `destroyEntityScripts(entity)` (implémenté par
  `ScriptManager`). `GameEntity` gagne `destroy()`.
- **`GameplayPlugin`** fournit `INSTANTIATOR = new Instantiator(world, scriptManager)` dans le
  `ServiceRegistry` (comme `SCRIPT_MANAGER`). Nouveau token dans `tokens.ts`.

Aucune dépendance nouvelle entre packages ; aucun cycle introduit.

## 8. Exemple complet (dague lancée)

```ts
// game/prefabs/daggerPrefab.ts
type DaggerParams = { position: Vec2; direction: Vec2 };

export function makeDaggerPrefab(sprite: Sprite): Prefab<DaggerParams> {
  return definePrefab({
    name: "dagger",
    build(entity, params) {                          // entity = EntityBuilder lié à la racine
      const transform = entity.add(Transform2D);
      transform.position.copyFrom(params.position);
      transform.scale.set(1.5, 1.5);

      const render = entity.add(SpriteRenderer, sprite);
      render.sortingLayer = SortingLayer.Entities;
      render.sortingOrder = SortingOrder.Sword;

      const body = entity.add(RigidBody);
      body.type = "kinematic";

      const collider = entity.add(Collider2D, { type: "box", width: 24, height: 8 });
      collider.layer = CollisionLayers.Player;
      collider.collidesWith = CollisionLayers.World;

      entity.attach(DaggerScript, {                  // direction = par tir ; speed/lifetime = constantes du prefab
        direction: params.direction,
        speed: 600,
        lifetime: 2,
      });
    },
  });
}
```

```ts
// game/scripts/DaggerScript.ts
export class DaggerScript extends AtlasScript<{ direction: Vec2; speed: number; lifetime: number }> {
  private readonly direction: Vec2;
  private readonly speed: number;
  private readonly lifetime: number;
  private transform: Transform;
  private age: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.age = 0;
  }

  public onUpdate(dt: number): void {
    this.transform.position.add(this.direction.clone().mult(this.speed * dt));
    this.age += dt;
    if (this.age >= this.lifetime) this.destroy();   // despawn
  }
}

registerScriptMetadata(DaggerScript, {
  exposed: {
    direction: ScriptMetadata.field({ required: true }),
    speed: ScriptMetadata.field({ required: true }),
    lifetime: ScriptMetadata.field({ required: true }),
  },
});
```

```ts
// game/scripts/ShooterScript.ts — le trou rebouché
export class ShooterScript extends AtlasScript<{ daggerPrefab: Prefab<DaggerParams> }> {
  private readonly daggerPrefab: Prefab<DaggerParams>;
  private input: InputApi;
  private transform: Transform;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.transform = this.requireComponent(Transform);
  }

  public onUpdate(): void {
    if (this.input.isPressed(Key.Space)) {
      this.instantiate(this.daggerPrefab, {
        position: this.transform.worldPosition.clone(),
        direction: new Vec2(1, 0),
      });
    }
  }
}

registerScriptMetadata(ShooterScript, {
  exposed: { daggerPrefab: ScriptMetadata.field({ required: true }) },
});
```

## 9. Invariants — à ne pas casser

- **Le prefab reste une valeur pure code-first.** Pas de sérialisation, pas de registry global, pas
  d'I/O dans `definePrefab`. Les assets sont capturés par closure via une factory app.
- **`instantiate` n'assume rien du `Transform`.** `position` vit dans les params ; seule
  `options.parent` (pur ECS) touche la structure. Un prefab sans `Transform2D` reste instanciable.
- **`EntityBuilder` réutilise le dispatch existant.** `add` = le dispatch de `GameEntity.addComponent`
  (token → API, composant → instance) ; `attach` = `ScriptManager.attach`. Ne pas redéclarer un
  chemin d'ajout parallèle.
- **`instantiate` / `destroy` sont différés-compatibles.** `onCreate` des scripts spawnés au prochain
  `flushCreates` ; `destroy` différé (scripts via `pendingDestroy`, entité via `world.commands.destroy`
  au `Sync`). Ne jamais détruire immédiatement une entité en plein `onUpdate`.
- **Pas de cycle de construction.** `RuntimeScriptContext` résout `INSTANTIATOR` via `services` à la
  demande, jamais par injection de constructeur.
- **`destroy` nettoie les deux niveaux.** Entité (+ composants + enfants, via le monde) **et** scripts
  (via `resolver.destroyEntityScripts` sur tout le sous-arbre). Idempotent.

## 10. Hors périmètre (V2)

- **Prefabs multi-entités avec enfants inline** — ✅ **implémenté** via `EntityBuilder.child(buildFn)`
  (voir [`prefab-multi-entity.md`](prefab-multi-entity.md)) : enfants créés synchronement dans le
  `build`, références internes câblées par capture directe du `.entity` du handle retourné (pas de
  remap). Le **remap de références sérialisées** (prefab JSON / éditeur) reste V2.
- **Sérialisation JSON / éditeur / `PrefabAsset`** (modèle deux-phases Asset↔Resource :
  `PrefabAsset` → `PrefabLoader` → `Prefab`) — comme le reste du repo, l'éditeur/serialisation est V2.
- **Introspection statique** (« lister les composants d'un prefab sans l'instancier ») — nécessite un
  modèle data ; non requis par le cas d'usage runtime.
- **Pooling d'instances** (réutiliser les entités détruites pour les projectiles très fréquents) —
  optimisation ; le chemin `instantiate`/`destroy` reste la sémantique de référence.
- **`onCreate` synchrone à l'instanciation** (parallèle exact du `Awake` Unity) — v1 conserve la
  sémantique `attach` différée existante ; à réévaluer si un besoin d'init-avant-fin-de-frame émerge.
