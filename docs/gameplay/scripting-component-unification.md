# Unification du vocabulaire de composants de script (`@atlasjs/gameplay`)

> **Statut : design (à implémenter).** Phase A à faire maintenant ; Phase B documentée pour une session future.
> Suite directe de [`scripting-components.md`](scripting-components.md) (modèle Unity `GetComponent`, façades LEVEL-2) et de [`gameplay-redesign.md`](gameplay-redesign.md) (source unique + autorité par type de corps).
>
> Prérequis de lecture : `scripting-components.md`, `gameplay-redesign.md` (§4 pont physique).

---

## 1. Contexte & problème

Le scripting expose aujourd'hui **deux familles de composants** que l'auteur mélange dans un même script :

- **LEVEL-2, façades** (`scripting/components/`, suffixe `*Component`) : `Transform2DComponent`, `RigidBody2DComponent`, `SpriteRendererComponent`.
- **LEVEL-1, bruts** (`components/`, sans suffixe) : `Animator`, `PlayerInput`.

Extrait réel de [`TestScript`](../../apps/sandbox/src/game/scripts/TestScript.ts) :

```ts
this.transform      = this.addComponent(Transform2DComponent);        // LEVEL-2
this.rigidbody      = this.addComponent(RigidBody2DComponent);        // LEVEL-2
this.spriteRenderer = this.addComponent(SpriteRendererComponent, s);  // LEVEL-2
this.animator       = this.addComponent(Animator, clips, "idle");     // LEVEL-1
const actions       = this.addComponent(PlayerInput, controls);       // LEVEL-1
```

### Le vrai smell : la frontière façade/raw est arbitraire

La règle affichée (CLAUDE.md package) est : *« une façade existe uniquement quand il y a du comportement moteur à cacher ; sinon le composant reste LEVEL-1 et le script l'utilise brut ».* **Le code viole cette règle sur 2 façades sur 3 :**

| Façade | Contenu réel | Verdict |
| --- | --- | --- |
| [`Transform2DComponent`](../../packages/gameplay/src/scripting/components/Transform2DComponent.ts) | routage d'autorité (`setPosition`→body dynamic), hiérarchie, world-matrix | **comportement réel → justifiée** |
| [`RigidBody2DComponent`](../../packages/gameplay/src/scripting/components/RigidBody2DComponent.ts) | 100 % `this.resolve().x` (passthrough) | **curation pure → injustifiée** |
| [`SpriteRendererComponent`](../../packages/gameplay/src/scripting/components/SpriteRendererComponent.ts) | 100 % `this.resolve().x` + sucre fluent | **curation pure → injustifiée** |

La douleur n'est **pas** « il existe des façades » — c'est que la frontière est incohérente : `SpriteRender` a une façade mais `Animator` non, sans raison de principe. Le compilateur custom futur unifiera la surface authored de toute façon ; d'ici là on veut une frontière **principielle** (façade ⇔ comportement réel) et un **vocabulaire uniforme**.

### Fuite observable (accessoire, à documenter)

Garder une réf LEVEL-1 (`this.animator`) vs une façade LEVEL-2 (`this.transform`) a une **sémantique de péremption opposée** : le raw est une instance vivante qui périme silencieusement si le composant est retiré/re-ajouté ; la façade re-résout et **throw** bruyamment. Invisible au pattern « addComponent en `onCreate`, jamais retiré », mais réel sous churn. Risque assumé (cf. §7).

### Bonus review — drift doc↔code

[`gameplay-redesign.md`](gameplay-redesign.md) §4 affirme que `PhysicsPullSystem` écrit `Transform2D` « pour dynamic **ET** kinematic ». Le code ([`PhysicsPullSystem`](../../packages/gameplay/src/systems/PhysicsPullSystem.ts)) fait `if (type !== "dynamic") return` → **dynamic uniquement**. À corriger (fait en Phase A, cf. §3.5).

---

## 2. Décisions validées avec l'auteur

1. **Modèle cible (a) : le compilateur = sucre / codegen au-dessus du même runtime.** Ce qu'on écrit aujourd'hui est l'output qu'aurait produit le compilateur. Pas de langage distinct (on écarte le (b), style Svelte/DOTS). Les scripts restent des classes TS lisibles/débuggables, runnables **sans** compilateur.
2. **Frontière principielle : façade ⇔ comportement moteur réel.** Après nettoyage, il reste **exactement une** façade (`Transform`) — l'autorité + hiérarchie + world-matrix la justifient. Tout le reste = composant données pures, accédé brut.
3. **Vocabulaire uniforme dès maintenant.** L'auteur écrit `addComponent(X, …)` de façon homogène, **sans suffixe `*Component`**, sans distinction visible façade/raw. Obtenu par **nommage propre cohérent** — pas besoin de la machinerie token tout de suite (elle reste en B1, comme cible du compilateur).
4. **Option (a) pour les composants passthrough : accès champ brut.** Virer `RigidBody2DComponent`/`SpriteRendererComponent` fait perdre les setters fluent (`setColor`, `setMass`, `setSortingOrder`, `setFlip`). Accepté : l'auteur écrit `sr.color.set(...)`, `rb.mass = 1`. Les ergonomies fluent reviendront uniformément avec la couche token (B1) si souhaité.
5. **Autorité déjà dans les systèmes.** L'autorité par type de corps vit dans `PhysicsPushSystem`/`PhysicsPullSystem`, pas dans les façades passthrough — les virer ne touche pas l'autorité.
6. **`Transform` = donnée pure : reporté en Phase B (B3), via Nexus `Changed<T>`.** Nécessite un primitif ECS absent aujourd'hui + résoudre le « dragon » du téléport dynamic (cf. §5.3). Hors Phase A.

---

## 3. Phase A — maintenant (petit, sûr, shippable)

Objectif : frontière principielle + vocabulaire uniforme, **sans** nouveau primitif, **sans** compilateur, churn minimal.

### 3.1 Suppressions

- Supprimer `scripting/components/RigidBody2DComponent.ts`.
- Supprimer `scripting/components/SpriteRendererComponent.ts`.

### 3.2 La seule façade restante : `Transform`

- Renommer la classe `Transform2DComponent` → `Transform` (et le fichier `Transform.ts`). Reste une sous-classe `ScriptComponent<Transform2D>` avec `static engine = Transform2D`. **Aucun changement de comportement** : autorité, hiérarchie, world-matrix, API fluent conservés (c'est la façade justifiée).
- Le dispatch existant (`prototype instanceof ScriptComponent` dans [`RuntimeScriptContext`](../../packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts)) reste **inchangé** : seul `Transform` emprunte désormais la branche façade ; tout le reste passe par la branche raw. Aucune machinerie nouvelle.

### 3.3 Noms de script propres & uniformes

Surface script-facing (exportée par `@atlasjs/gameplay`), tous sans suffixe :

| Nom de script | Backing moteur | Retour de `addComponent` | Nature |
| --- | --- | --- | --- |
| `Transform` | `Transform2D` | proxy `Transform` (API curée) | façade |
| `RigidBody` | `RigidBody2D` | `RigidBody2D` brut | alias |
| `SpriteRenderer` | `SpriteRender` | `SpriteRender` brut | alias |
| `Animator` | `Animator` | `Animator` brut | direct (déjà propre) |
| `PlayerInput` | `PlayerInput` | `PlayerInput<T>` brut (génériques préservés) | direct (déjà propre) |

- `RigidBody` / `SpriteRenderer` sont des **alias d'export** des composants moteur (`export { RigidBody2D as RigidBody }`, `export { SpriteRender as SpriteRenderer }`). Zéro wrapper → génériques et ctors préservés, `addComponent` renvoie le composant moteur brut.
- Le boundary script↔moteur devient le **boundary de nommage** : les scripts importent `Transform`/`RigidBody`/`SpriteRenderer`/`Animator`/`PlayerInput` ; les systèmes importent les composants moteur (`Transform2D`, `RigidBody2D`, `SpriteRender`, …). C'est exactement ce que la couche token (B1) formalisera.
- **Décision (validée)** : on garde les **alias propres** (`RigidBody`, `SpriteRenderer`). Surface un peu plus large (le nom moteur reste exporté pour les systèmes/usage avancé) mais noms de script homogènes, cohérents avec `Transform`, et prépare B1.

### 3.4 Migration `apps/sandbox`

Exemple — `TestScript.onCreate` (avant → après) :

```ts
// avant
this.transform      = this.addComponent(Transform2DComponent);
this.rigidbody      = this.addComponent(RigidBody2DComponent);
this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);
this.rigidbody.type = "kinematic";
this.rigidbody.setMass(1);

// après
this.transform      = this.addComponent(Transform);              // façade, inchangée
this.rigidbody      = this.addComponent(RigidBody);              // RigidBody2D brut
this.spriteRenderer = this.addComponent(SpriteRenderer, this.sprite); // SpriteRender brut
this.rigidbody.type = "kinematic";                              // champ brut
this.rigidbody.mass = 1;                                        // champ brut (plus de setMass)
```

- `WallScript` : `this.spriteRenderer.setColor(0,1,0,0.5).setSortingOrder(10)` → `sr.color.set(0,1,0,0.5); sr.sortingOrder = 10;`. `transform.setScale(...).setPosition(...)` **inchangé** (Transform garde le fluent).
- `SwordScript` : `this.spriteRenderer.setSortingOrder(10)` → `sr.sortingOrder = 10`. `transform.*` inchangé.
- Types de champ : `private spriteRenderer: SpriteRender;` (brut) au lieu de `SpriteRendererComponent`.

### 3.5 Docs & règle

- Réécrire la section « two component levels » du [CLAUDE.md package](../../packages/gameplay/CLAUDE.md) : *façade ⇔ comportement réel ; aujourd'hui = uniquement `Transform`.* Documenter l'asymétrie de péremption (§1). Mettre à jour l'exemple `PlayerInput` (toujours valide) et la liste `scripting/components/`.
- Corriger le drift dans [`gameplay-redesign.md`](gameplay-redesign.md) §4 : pull = **dynamic uniquement**.
- Ajouter en tête de `scripting-components.md` un renvoi vers ce doc (« façades passthrough supprimées, cf. scripting-component-unification.md »).

### 3.6 Tests

- `test/script-components.test.ts` : retirer les cas `RigidBody2DComponent`/`SpriteRendererComponent` façade ; garder `Transform` (renommée) ; ajouter un cas « composant données pures via nom de script (`SpriteRenderer`) → renvoie le composant moteur brut ».
- Vérifier `tsc --noEmit` gameplay + `pnpm --filter @atlasjs/gameplay test` + `tsc -b` sandbox verts.

### 3.7 Ce que Phase A ne fait PAS

- Pas de `defineScriptComponent` / machinerie token (→ B1).
- `Transform` reste une **façade** (proxy), pas de la donnée pure (→ B3).
- Pas de compilateur, pas d'`interface`, pas de `Changed<T>`.

---

## 4. Résultat après Phase A

- **Une seule** façade (`Transform`), pour une raison de principe limpide. La règle est enfin vraie.
- Vocabulaire homogène : `addComponent(X, …)` sans suffixe, façade invisible.
- Autorité intacte (dans les systèmes + le téléport synchrone de `Transform`).
- Base propre pour brancher le compilateur (B) : la surface authored est déjà ce qu'il émettrait.

---

## 5. Phase B — roadmap (documentée pour démarrage à froid)

> Trois chantiers indépendants, dans cet ordre logique. Chacun peut être une session dédiée.

### 5.1 B1 — Couche scripting-component uniforme (cible du compilateur)

**But** : remplacer le nommage/alias de Phase A par un modèle **token** unique, collapser le dispatch, et donner au compilateur une forme d'émission unique.

- `defineScriptComponent(engine, ops?)` → `ScriptComponentToken` :
  - **sans `ops`** : passthrough, `addComponent(token)` renvoie le composant moteur brut (identité) ;
  - **avec `ops`** : comportemental, renvoie un proxy apatride exposant `ops` (autorité/curation). `Transform` migre ici : ses méthodes (`setPosition`, `translate`, `setParent`, `worldPosition`, …) deviennent des `ops` (fonctions libres `(world, entity, …)`), la classe `Transform` disparaît au profit du token.
- `RuntimeScriptContext` : le dispatch `prototype instanceof ScriptComponent` est remplacé par « le token porte-t-il des `ops` ? ». Un seul chemin, plus de bifurcation façade/raw.
- Ré-ergonomiser en option : des `ops` fines de curation peuvent revenir pour `SpriteRenderer`/`RigidBody` (setters fluent) **uniformément**, si désiré — sans recréer une classe façade.
- Bénéfice : `PlayerInput<T>` reste passthrough (identité) → **génériques préservés** (le point qui avait tué la façade `PlayerInput`).

### 5.2 B2 — Le compilateur custom

Sur la surface B1, un compilateur TypeScript custom :

- réécrit `addComponent<T>(...args)` → `addComponent(T, ...args)` (injection du token runtime, syntaxe façon C# `GetComponent<T>()`) ;
- **génère** `registerScriptMetadata(Script, { exposed: { … } })` avec types complets (cf. [`script-metadata-registry.md`](script-metadata-registry.md)) ; réintroduit `@Expose()` comme **marqueur compile-time** (seul point retouchant la syntaxe décorateur) ;
- résout chaque référence de composant scripting (interface / token) → composant moteur, et **inline** la résolution token + `ops` → appels bruts directs, zéro dispatch runtime ;
- (optionnel) accepte une surface **interface** propre en authored, lowerée vers les composants bruts (l'`interface` n'a pas de runtime → cette variante rend le compilo obligatoire ; garder le token runtime pour rester runnable sans compilo).

Alignement métadonnées : le type `ExposeFieldMetadata` est déjà ouvert à l'extension (`kind`, `assetKind`, `runtimeType`, `tooltip`, `range`, `category`) — **généré par le compilateur**, cf. backlog.

### 5.3 B3 — `Transform` = donnée pure via Nexus `Changed<T>`

**But** : tuer la dernière façade. `Transform2D` devient donnée pure ; l'autorité reste par type de corps mais sans écriture-temps-réel dans un setter.

**Prérequis** : primitif `Changed<T>` dans Nexus (aujourd'hui [backlog ECS](../backlog.md), style Bevy — dirty-tick, **pas** snapshot de valeur, pour ne pas ré-introduire le bug « delta net » que le redesign a tué).

**Ce que `Changed<T>` permet proprement** :
- **kinematic/static** : le push écrit `Transform2D → body` chaque frame inconditionnellement aujourd'hui. `Changed<Transform2D>` → ne pousser que quand le script a bougé le transform. **Non-ambigu** : sur kinematic/static, le seul écrivain de `Transform2D` est le script (le pull n'y touche pas — cf. §1 bonus). Gain perf, zéro régression.

**⚠️ Le dragon — téléporter un dynamic** :
- Vérifié dans le code : sur un dynamic, le push **n'envoie pas** la position ; le pull écrit `Transform2D ← body` **chaque frame**. Donc une écriture brute `transform.position = …` sur un dynamic est **clobberée** le frame suivant.
- `Changed<Transform2D>` **ne peut pas** distinguer « le script a téléporté » de « le pull a écrit » (le pull marque changed à chaque frame). L'attribution par écrivain n'existe pas dans un `Changed<T>` global-tick.
- **Conséquence** : le téléport d'un dynamic **doit** passer par un canal explicite (pas une écriture de `Transform`). Options à trancher en B3 :
  - **(i)** méthode sur la surface rigidbody : `rigidBody.teleport(x, y)` → lowerée vers `body.setTranslation` (cohérent avec les vrais moteurs physiques : on ne téléporte pas un dynamic par son transform). **Reco.**
  - **(ii)** composant-commande `Teleport { x, y }` consommé puis retiré par le push (data-driven, ECS-friendly, plus verbeux).
  - **(iii)** `Changed` + valeur physique cachée pour attribuer — rejeté (= re-snapshot, la douleur qu'on a tuée).

**Helpers hiérarchie/world-matrix** (`worldPosition`, `setParent(worldPositionStays)`, `getChildren`, `parent`) : purs sur la donnée ECS, aucune autorité → **fonctions libres** (ex. `worldPosition(world, entity)`), pas une façade. Le compilateur les résout comme n'importe quelle op.

**Après B3** : plus aucune façade ; `Transform2D` = donnée pure ; autorité = systèmes (par type de corps) + canal de téléport explicite ; `Changed<T>` = optimisation kinematic/static.

---

## 6. Ordre d'implémentation Phase A (chaque étape verte : `tsc --noEmit` + tests)

> Cadence : pilotée par sous-agents, une tâche à la fois, l'auteur commite chaque étape.

1. **Supprimer les 2 façades passthrough** + retirer leurs exports (`scripting/components/index.ts`) + retirer les cas de test correspondants.
2. **Renommer `Transform2DComponent` → `Transform`** (classe + fichier + imports + tests). Vert.
3. **Alias d'export propres** (`RigidBody`, `SpriteRenderer`) au barrel `@atlasjs/gameplay` ; vérifier le trio (add/get/require) sur composant données pures via nom de script. Vert.
4. **Migrer `apps/sandbox`** (`TestScript`, `WallScript`, `SwordScript`) sur les noms propres + option (a) accès brut. `tsc -b` sandbox vert.
5. **Docs & règle** : CLAUDE.md package (règle façade ⇔ comportement), fix drift `gameplay-redesign.md` §4, renvoi depuis `scripting-components.md`.
6. **Vérif finale** : `tsc --noEmit` gameplay + `pnpm --filter @atlasjs/gameplay test` + `tsc -b` sandbox + build gameplay verts. Validation visuelle preview (le dino bouge/tourne au clavier+souris, mur statique, épée qui suit la souris).

---

## 7. Risques / points ouverts

- **Perte des setters fluent** (`setColor`/`setMass`/`setSortingOrder`/`setFlip`) — accepté (option a) ; revient en B1 si besoin.
- **Asymétrie de péremption** raw vs façade (§1) — assumée, à documenter, sans conséquence au pattern « addComponent en `onCreate` ».
- **Scripts tenant un composant brut** (`SpriteRender`, `RigidBody2D`) — cohérent avec `Animator`/`PlayerInput` déjà bruts ; écrire le raw d'un dynamic sans routage reste l'escape-hatch assumé du redesign.
- **B3 dépend d'un primitif Nexus non implémenté** (`Changed<T>`) + tranche le canal de téléport — ne pas démarrer B3 avant B1.
