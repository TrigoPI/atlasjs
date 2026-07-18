# Registre de métadonnées de script — `registerScriptMetadata` (`@atlasjs/gameplay`)

> **Statut : design (à implémenter).** Remplace la voie `@Expose()` (décorateur stage-3 + `Symbol.metadata` + Babel) par un **registre plain-JS** alimenté par une fonction explicite `registerScriptMetadata(Ctor, metadata)`, unique source de vérité runtime des champs exposés. Débloque des métadonnées d'éditeur riches (via le futur compilateur), supprime la dépendance Babel, et aligne le runtime sur la vision compilateur d'Atlas.
>
> Prérequis de lecture : `docs/gameplay/exposed-script-variables.md` (le mécanisme `@Expose` actuel qu'on remplace), `docs/gameplay/scripting-components.md` (`AtlasScript`, façades, `attach`).

---

## 1. Contexte et motivation

Le système `@Expose()` actuel (cf. `exposed-script-variables.md`) enregistre les champs injectables d'un script via un **décorateur de champ stage-3**, avec métadonnées portées par `Symbol.metadata`. Il fonctionne, mais il porte un coût structurel disproportionné par rapport à ce qu'il capture réellement :

- Le décorateur ne capture **que le nom du champ** (`ExposeOptions` est vide). Il ne peut pas capturer le **type** (`Sprite`, `assetKind`…) sans `emitDecoratorMetadata`/`reflect-metadata`, explicitement rejetés.
- La syntaxe stage-3 impose **Babel** (`@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators`) dans vitest **et** dans chaque application, car esbuild/oxc/tsdown ne transpilent pas ces décorateurs.
- Elle impose un **polyfill `Symbol.metadata`** top-level fragile (ordre d'évaluation ESM) et une gestion **clone-on-own-write** du piège d'héritage du prototype metadata.
- Risque acté (backlog) : `EXPOSED = Symbol()` module-local — writer (`@Expose`) et reader (`getExposedFields`) doivent venir de la **même** instance de module ; casse si un graphe mélange `src` et `dist`.

### Vision cible (compilateur custom)

À terme, un compilateur TypeScript custom passera sur les scripts pour :

1. réécrire `addComponent<T>(a, b)` → `addComponent(T, a, b)` ;
2. **générer** `registerScriptMetadata(Script, { exposed: { … } })` avec les types complets extraits à la compilation (ce qu'un décorateur runtime ne peut pas faire).

Dans ce monde, le décorateur runtime `@Expose` est **redondant** : le compilateur produit une forme plus riche. La décision est donc de **pivoter dès maintenant** le runtime vers `registerScriptMetadata` comme unique source de vérité, et de faire de `@Expose` un pur marqueur compile-time **que seul le futur compilateur manipulera**.

### Décisions actées (ce document)

1. **Tuer Babel maintenant.** Plus aucune syntaxe décorateur dans les scripts aujourd'hui. On écrit `registerScriptMetadata(Script, { … })` à la main. Le compilateur réintroduira `@Expose()` plus tard et gèrera lui-même la syntaxe.
2. **Schéma par champ minimal + type extensible.** Le runtime stocke ce dont il a besoin (noms de champs + `required?`). `ExposeFieldMetadata` reste ouvert à l'extension : le compilateur/éditeur ajouteront `kind`/`assetKind`/`runtimeType`/`tooltip`/… sans casser l'API. On ne fige **pas** de schéma éditeur spéculatif.
3. **Validation = warn minimal.** `injectProps` émet un `logger.warn` si un champ `required` n'a pas de valeur fournie, et si une clé de `props` n'est pas exposée. **Jamais de throw** (ne casse pas le jeu). Le reste (éditeur, throw strict) reste au backlog.
4. **Héritage fusionné.** `getScriptMetadata(Child)` fusionne les métadonnées parent→enfant via la chaîne de prototypes des constructeurs, préservant le comportement actuel — sans le piège de pollution.
5. **Pas de nouveau package.** Le code reste dans `@atlasjs/gameplay` (`scripting/core`). La discipline de découplage (`scripting/core`+`runtime` ne dépendent que des packages **foundational** `@atlasjs/nexus`, `@atlasjs/core` et `@atlasjs/utils` — ce dernier pour le logging) est maintenue pour rendre une future extraction `@atlasjs/scripting` triviale, mais l'extraction n'est **pas** faite ici (YAGNI : un seul consommateur aujourd'hui). `@atlasjs/utils` est un utilitaire feuille (pas de cycle vers nexus/core), donc l'arête `scripting → utils` reste propre pour l'extraction.

---

## 2. Design

### 2.1 API publique — `scripting/core/ScriptMetadata.ts` (nouveau)

```ts
export interface ExposeFieldMetadata {
  required?: boolean;
  // Extensible. Le compilateur/éditeur ajouteront (sans breaking change) :
  //   kind?, assetKind?, runtimeType?, tooltip?, range?, step?, category? …
}

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}

export function registerScriptMetadata(
  ctor: Function,
  metadata: ScriptMetadata,
): void;

export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined;

export function getExposedFields(
  ctor: Function,
): Map<string, ExposeFieldMetadata>;
```

- `registerScriptMetadata` écrit l'entrée **propre** du constructeur dans le registre (n'inclut que les champs déclarés par cette classe).
- `getScriptMetadata` retourne la métadonnée **fusionnée** (héritage inclus, cf. 2.3), ou `undefined` si aucun ancêtre n'a de metadata.
- `getExposedFields` est une commodité au-dessus de `getScriptMetadata` : retourne une **copie** (`Map`) des champs exposés fusionnés (isolation de l'appelant). Utile aux tests et aux consommateurs externes (futur éditeur) ; `ScriptManager.injectProps` consomme directement `getScriptMetadata` (il lui faut `required`, cf. 2.4).

### 2.2 Registre

```ts
const REGISTRY: WeakMap<Function, ScriptMetadata> = new WeakMap();
```

- Backing store module-local, **clés = constructeurs**. `WeakMap` → pas de fuite mémoire (une classe déchargée libère son entrée).
- **Risque src/dist du backlog éliminé** : plus de `Symbol` partagé writer↔reader. `registerScriptMetadata` et `getScriptMetadata` sont deux fonctions du même module ; tant qu'un consommateur importe l'un et l'autre depuis `@atlasjs/gameplay`, ils partagent le `REGISTRY`. (Le risque théorique « deux copies du module gameplay » demeure comme pour n'importe quel singleton de module, mais n'est plus spécifique à un `Symbol` — c'est le cas nominal d'un package publié.)

### 2.3 Héritage (fusion parent→enfant)

`getScriptMetadata(ctor)` remonte la chaîne statique des constructeurs et fusionne :

```ts
export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined {
  const chain: Function[] = [];
  let current: Function | null = ctor;
  while (current && current !== Function.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }

  let merged: Record<string, ExposeFieldMetadata> | undefined;
  // du plus ancêtre au plus dérivé : l'enfant écrase le parent par champ
  for (let i = chain.length - 1; i >= 0; i--) {
    const own: ScriptMetadata | undefined = REGISTRY.get(chain[i]);
    if (own === undefined) continue;
    merged = { ...(merged ?? {}), ...own.exposed };
  }

  return merged === undefined ? undefined : { exposed: merged };
}
```

- Comportement identique à `@Expose` aujourd'hui : `Child` hérite des champs de `Base` ; `Base` n'est **jamais** pollué (chaque ctor a son entrée propre isolée dans le `WeakMap`) ; `GrandChild` fusionne toute la chaîne ; une sous-classe sans metadata propre hérite du parent.
- **Sans le piège** : plus de clone-on-own-write. La fusion est calculée à la lecture, jamais écrite dans le store.
- Écrasement **par champ** (l'enfant peut redéclarer un champ du parent avec d'autres options).

### 2.4 Injection + validation — `scripting/runtime/ScriptManager.ts`

`ScriptManager` gagne un `Logger` (`createLogger("ScriptManager")`, `@atlasjs/utils` déjà en dépendance). `injectProps` devient :

```ts
private injectProps(
  instance: AtlasScript,
  ScriptType: ScriptConstructor,
  props?: object,
): void {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ScriptType);
  const exposed: Record<string, ExposeFieldMetadata> = metadata?.exposed ?? {};
  const source: Record<string, unknown> = (props ?? {}) as Record<string, unknown>;
  const target: Record<string, unknown> = instance as unknown as Record<string, unknown>;

  for (const field in exposed) {
    if (field in source) {
      target[field] = source[field];
    } else if (exposed[field].required === true) {
      this.logger.warn(
        `[ScriptManager] "${ScriptType.name}" exposes required field "${field}" but no value was provided.`,
      );
    }
  }

  for (const key in source) {
    if (!(key in exposed)) {
      this.logger.warn(
        `[ScriptManager] prop "${key}" provided to "${ScriptType.name}" is not exposed and was ignored.`,
      );
    }
  }
}
```

- **On n'assigne que les champs exposés** (discipline inchangée) ; une clé de `props` non exposée est ignorée **et signalée**.
- **Warn, jamais throw.** Un warn est émis quand : (a) un champ `required` n'a pas de valeur ; (b) une clé fournie n'est pas exposée.
- **Cas nominal silencieux** : script sans metadata et sans props (`attach(e, Script)`) → `exposed = {}`, `source = {}`, aucune boucle ne warn.
- Injection **avant `onCreate`** (inchangé — via la file `pendingCreate`).

### 2.5 `AtlasScript` et `attach` — inchangés

- `AtlasScript<TProps>` générique + phantom `__props` : **inchangés** (typage de `attach`).
- `ScriptManager.attach(entity, Script, ...props)` + `PropsOf`/`PropsOfArgs` : **inchangés**.
- **Double déclaration acceptée (transitoire)** : les champs injectables sont déclarés dans le générique `AtlasScript<{ … }>` (pour le type de `attach`) **et** dans `registerScriptMetadata` (pour le runtime), sans lien automatique. C'est inhérent tant que le compilateur n'existe pas ; il générera les deux à terme. Risque déjà acté au backlog.

### 2.6 Suppressions

- `scripting/core/Expose.ts` — **supprimé** (décorateur, `ExposeOptions`, `ExposedMetadata`, `FieldDecorator`, `getExposedFields` legacy).
- `scripting/core/SymbolMetadata.ts` — **supprimé** (polyfill `Symbol.metadata`, `getCtorMetadata`).

`ExposedMetadata` (type) disparaît ; `ScriptManager` consomme désormais `Map<string, ExposeFieldMetadata>` / `ScriptMetadata`.

---

## 3. Toolchain — Babel dégagé

Puisqu'aucun script n'utilise plus de syntaxe décorateur, la chaîne Babel devient inutile.

| Fichier | Action |
| --- | --- |
| `packages/gameplay/vitest.config.ts` | retirer le plugin `@rolldown/plugin-babel` (le bloc `plugins`) |
| `packages/gameplay/package.json` | retirer devdeps `@babel/plugin-proposal-decorators`, `@rolldown/plugin-babel` |
| `apps/sandbox/vite.config.ts` | retirer `babel(...)` + le cast `as unknown as PluginOption` + l'import ; `react()` reste |
| `apps/sandbox/package.json` | retirer devdeps babel correspondantes |
| `tsconfig.base.json` | `"ESNext.Decorators"` dans `lib` devient inutile ; **laissé en place** (inoffensif, `Symbol.metadata` peut rester référencé par d'autres libs). Retrait optionnel, non bloquant. |
| `apps/sandbox/tsconfig.app.json` | idem : `"ESNext.Decorators"` laissé, `erasableSyntaxOnly` conservé |

> Note : le `dist` de gameplay (tsdown) ne change pas de nature — gameplay n'appliquait déjà aucun décorateur dans son source (cf. `exposed-variables` §2.3). La seule différence est qu'il n'y a plus de décorateur **nulle part**.

---

## 4. Migration `apps/sandbox`

`apps/sandbox/src/game/scripts/TestScript.ts` :

- Retirer l'import `Expose` et les 4 `@Expose()`.
- Ajouter l'import `registerScriptMetadata` et, après la classe :

```ts
registerScriptMetadata(TestScript, {
  exposed: {
    sprite: { required: true },
    clips: { required: true },
    speed: { required: true },
    controls: { required: true },
  },
});
```

- Les champs restent des soft-private `readonly` avec `!` (toujours injectés).

`apps/sandbox/src/game/EcsScene.ts` : **inchangé** (l'appel `attach(player1, TestScript, { sprite, speed, controls, clips })` fonctionne à l'identique).

---

## 5. Tests (TDD, harness `packages/gameplay/test/helpers/harness.ts`)

### `test/script-metadata.test.ts` (remplace `test/expose.test.ts`)

- `registerScriptMetadata` + `getExposedFields` : enregistre les champs **sans instancier** ; deux scripts distincts n'ont pas de fuite mutuelle ; classe sans metadata → `Map` vide ; la `Map` retournée est une **copie** (mutation externe sans effet sur le registre).
- **Héritage** : `Child` = `{base, a, b}`, `Base` reste `{base}` ; `GrandChild` fusionne toute la chaîne ; sous-classe sans metadata propre hérite du parent ; l'enfant peut écraser un champ du parent (`required` différent).

### `test/exposed-injection.test.ts` (réécrit sans `@Expose`)

- Injecte chaque champ exposé **avant** `onCreate` (assert dans `onCreate`).
- Une clé de `props` non exposée n'est **jamais** assignée.
- Script sans metadata → comportement inchangé, `attach(e, S)` sans 3ᵉ argument.

### `test/script-metadata-validation.test.ts` (nouveau)

- Champ `required: true` sans valeur fournie → **un warn** (logger stubbé/espionné), **pas de throw**, le champ reste `undefined`.
- Clé de `props` non exposée → **un warn**, le champ n'est pas assigné.
- Script sans metadata + sans props → **aucun warn**.

### Typage (inchangé, régression)

- `attach(e, TestScript)` sans props → **erreur compile** ; `attach(e, EmptyScript)` sans props → OK.

### Intégration (inchangé)

- `TestScript` reçoit ses props, pose `SpriteRender` + `Animator` dans `onCreate`, l'entité rend la frame courante après quelques `frame()`.

---

## 6. Hors périmètre (reste / va au backlog)

- **Métadonnées d'éditeur riches** (`kind`, `assetKind`, `runtimeType`, `tooltip`, `range`, `category`) — le type est prêt à les accueillir, mais elles seront **générées par le compilateur** ; rien n'est figé ici.
- **Compilateur TypeScript custom** (réécriture `addComponent`, génération de `registerScriptMetadata`, réintroduction de `@Expose()` comme marqueur) — projet distinct, futur.
- **Validation stricte avec throw** ; **inspecteur d'éditeur**.
- **(Dé)sérialisation** des valeurs exposées (scène/prefab sur disque).
- **Extraction `@atlasjs/scripting`** — déclenchée le jour où l'éditeur/compilateur devient un consommateur hors gameplay ; discipline de découplage maintenue d'ici là.
- **Lien automatique `TProps` ↔ metadata** (élimination de la double déclaration) — viendra avec le compilateur.

---

## 7. Ordre d'implémentation suggéré

1. `scripting/core/ScriptMetadata.ts` : registre `WeakMap`, `registerScriptMetadata`, `getScriptMetadata` (fusion héritage), `getExposedFields` + tests unitaires (dont héritage).
2. Supprimer `Expose.ts` + `SymbolMetadata.ts` ; mettre à jour `scripting/core/index.ts`.
3. `ScriptManager` : logger + `injectProps` réécrit (warn) + tests injection & validation.
4. Retirer Babel : `vitest.config.ts` + `package.json` gameplay ; `tsc --noEmit` + `pnpm --filter @atlasjs/gameplay test` verts ; `pnpm --filter @atlasjs/gameplay build`.
5. Migrer `apps/sandbox` : `TestScript` (`registerScriptMetadata`), retirer Babel de `vite.config.ts` + `package.json`.
6. Validation visuelle `apps/sandbox` (le dino s'anime, injection de bout en bout, aucun warn parasite).
