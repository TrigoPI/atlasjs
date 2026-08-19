# Pièges extraits des 9 plans avant suppression (Tâche 1)

> Fichier de travail, transitoire — supprimé en T7 une fois les entrées ci-dessous consommées par T3 (hook WGSL),
> T4 (skill `atlas-verify-webgpu`) et T5 (`CLAUDE.md`). Ne rien commiter tant que ce fichier n'a pas été revu.
>
> Méthode : Step 1 (inventaire des 9 plans, 10 012 lignes confirmées), Step 2 (grep marqueurs explicites
> `piège|gotcha|attention|caveat|⚠|pitfall`), Step 3 (lecture des sections de vérification/récapitulatif),
> puis vérification systématique, pour chaque piège trouvé, de sa présence ou non dans un doc **permanent**
> (non `*-plan.md`) — seul ce qui ne survivrait qu'en mémoire d'agent ou dans un plan voué à disparaître
> justifie une entrée « à risque réel ». Les 6 pièges connus (§5 de la spec) sont repris intégralement même
> quand une partie de leur contenu s'est révélée déjà dupliquée ailleurs, car leur **destination réelle**
> (hook / skill / fichier `CLAUDE.md`) n'existe pas encore.

---

## 1. Éditer un `.wgsl` sans rebuild du backend sert l'ancien shader

- **Source :** `docs/debug/gizmos-plan.md:325-330` (« D'abord rebuilder le backend — c'est le piège qui coûte le plus de temps ici »). Contenu identique, en plus détaillé, déjà dupliqué dans `docs/debug/gizmos.md:353` (doc permanent) — donc le **texte** ne disparaît pas avec le plan, mais la **destination visée** (un hook exécutable) n'existe pas encore.
- **Destination :** hook (`PostToolUse`, cf. spec §6.1)
- **Texte exact à écrire :**

  Functional specification of the hook (to be translated into a `.claude/settings.json` entry by T3, reusing the syntax of the existing `graphify` hook as a reference for shape):

  - Event: `PostToolUse`, matcher `Edit|Write`.
  - Guard: fires **only** if the touched file path ends with `.wgsl`. Never on `Read`, never on a `.ts`.
  - Action: `pnpm --filter @atlasjs/nebula-webgpu build` (a build scoped to the package, **not** `turbo build` nor `pnpm build` at the root).
  - Non-blocking: if the build fails, the hook reports the error and returns control; it does not lock the session.
  - Rationale to cite in the hook or its commit: apps consume `@atlasjs/nebula-webgpu` through its `exports` field → `./dist`, and the `.wgsl` is **inlined into `dist` at build time**. Restarting the dev server **is not enough**; HMR even less so.

---

## 2. Prettier doit rester scopé au fichier touché, jamais sur les `.md` de `docs/`

- **Source :** `docs/debug/gizmos-plan.md:19` (formulation la plus complète : « jamais `--write` sur tout le repo, jamais sur les `.md` : `docs/*.md` n'est pas maintenu par prettier dans ce repo »). Règle identique répétée mot pour mot dans les **8 autres plans** (`audio-variation-plan.md:15-16`, `audio-system-plan.md:21`, `dino-brawl-cleanup-plan.md:342`, `2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-plan.md:23`, `gameplay/prefab-multi-entity-plan.md:19`, `rendering/sort-point-anchor-plan.md:17`, `physics/character-controller-plan.md` via la contrainte globale, `debug/gizmos-plan.md:2039` pour `docs/backlog.md` spécifiquement).
- **Constat additionnel (vérifié directement dans le repo, pas dans un plan) :** `package.json` définit `"format": "prettier --write \"**/*.{ts,tsx,md}\""` et `.prettierignore` actuel (racine) ne liste **pas** `docs/` ni `apps/*/docs/` — seulement `node_modules/`, `dist/`, `build/`, `out/`, `coverage/`, `.turbo/`, `graphify-out/`, `.superpowers/`, `pnpm-lock.yaml`, `*.log`. Un `pnpm format` à la racine reformate donc aujourd'hui tous les docs (confirme le risque décrit en spec §6.2, correctif associé).
- **Destination :** hook (`PostToolUse`, cf. spec §6.2) **+** correctif `.prettierignore` (racine)
- **Texte exact à écrire :**

  Functional specification of the hook:

  - Event: `PostToolUse`, matcher `Edit|Write`.
  - Guard: `.ts` / `.tsx` only. **Never** `.md`.
  - Action: `prettier --write` on **the single touched file** (never a repo-wide pass).

  `.prettierignore` fix (root) — add these two lines:

  ```
  docs/
  apps/*/docs/
  ```

---

## 3. `tsc --noEmit` nu ne typecheck rien dans `apps/dino-brawl`

- **Source :** `docs/debug/gizmos-plan.md:1944` (« `tsc --noEmit` sans `-p tsconfig.app.json` est un no-op dans cette app (il ne typecheck rien) — toujours passer le projet »). Corroboré par l'usage systématique de `-p tsconfig.app.json` / `--filter dino-brawl exec tsc --noEmit -p tsconfig.app.json` dans `dino-brawl-tiled-bridge-plan.md:23,1333` et partout où l'app est typechecker dans les 9 plans.
- **Destination :** `CLAUDE.md` app (`apps/dino-brawl/CLAUDE.md`, à créer — n'existe pas encore)
- **Texte exact à écrire :**

  ```markdown
  # AGENTS.md — apps/dino-brawl

  - **A bare `tsc --noEmit` is a no-op in this app** — it type-checks nothing. Always pass the project explicitly:
    `pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json` (never `tsc -b`, which would emit artifacts next to the sources).
  ```

---

## 4. `import type` obligatoire pour les symboles type-only (Vite / `verbatimModuleSyntax`)

- **Source :** `docs/dino-brawl-tiled-bridge-plan.md:20` (« Piège Vite (vérifié) : dans les fichiers app, tout symbole *type-only* doit être importé via `import type` — sinon `tsc` passe mais Vite casse au runtime (écran noir). Les valeurs runtime (tokens `NEXUS`/`ASSET_MANAGER`, classes de composants, `Vec2`…) restent en import valeur. »). Répété à l'identique dans `debug/gizmos-plan.md:1936`, `audio-system-plan.md:1649`, `dino-brawl-cleanup-plan.md:17`, `2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-plan.md:19` (avec la liste la plus détaillée de symboles type-only vs valeur).
- **Constat :** le `CLAUDE.md` racine actuel ne porte **pas** cette règle générale — seule une occurrence ponctuelle existe, spécifique à `GameEntity`, dans la description de `docs/gameplay/exposed-script-variables.md`. La règle générale n'a donc aujourd'hui aucun foyer permanent hors des plans voués à suppression.
- **Destination :** `CLAUDE.md` racine
- **Texte exact à écrire :**

  ```markdown
  - **`import type` is mandatory for every *type-only* symbol** in application files (`verbatimModuleSyntax: true`): a *value* import of a type-only symbol compiles fine under `tsc --noEmit` but breaks Vite at runtime (black screen, no compile error). Runtime tokens and values (e.g. `NEXUS`, `ASSET_MANAGER`, component classes, `Vec2`) stay as normal imports — only the type/value distinction matters, not whether the symbol comes from an `@atlasjs/*` package.
  ```

---

## 5. Pièges de vérification navigateur WebGPU (warn ≠ error, RAF throttlée, readback vide, port du harness)

- **Source :** `docs/debug/gizmos-plan.md:335` — texte complet : « Deux pièges d'environnement observés : (1) le port annoncé par le harness peut différer de celui que Vite choisit réellement (lire `preview_logs` et naviguer sur le port de Vite) ; (2) une erreur de compilation WGSL n'apparaît **pas** comme `error` console mais comme `warn` (`Error while parsing WGSL:` puis des `Invalid RenderPipeline … due to a previous error` répétés à 60 fps qui noient le message d'origine) — lire la console **sans** `onlyErrors`. Pour obtenir l'erreur exacte à coup sûr, compiler le shader dans la page et lire `getCompilationInfo()`. »
- **Constat :** le sous-point (2) et le fait « boucle RAF throttlée hors premier plan → canvas noir sans erreur, readback vide » sont **déjà dupliqués** dans `docs/debug/gizmos.md:355,359` (doc permanent, hors de portée de la suppression). Le sous-point (1) — **mismatch de port harness/Vite** — n'existe, lui, **nulle part ailleurs** : il disparaîtrait avec le plan si non extrait ici.
- **Destination :** skill (`atlas-verify-webgpu`, à créer — cf. spec §5/§1.3, la skill n'existe pas encore)
- **Texte exact à écrire :**

  ```markdown
  ## WebGPU verification pitfalls in this repo

  - **The port announced by the preview harness can differ from the port Vite actually picks** (port already taken → Vite picks another one). Always read `preview_logs` for the effective port before navigating, rather than trusting the port announced at startup.
  - **A WGSL compile error is not a console error.** It arrives as `warn` (`Error while parsing WGSL:`), then gets drowned out by `Invalid RenderPipeline … due to a previous error` repeated at 60 fps. Read the console **without** the `onlyErrors` filter. To get the exact error reliably: compile the shader in the page and read `getCompilationInfo()`.
  - **The RAF loop is heavily throttled when the tab/panel isn't in the foreground** (`apps/dino-brawl`): a black canvas at 0 fps **with no error at all**. Bring the tab to the foreground before judging. Programmatic canvas readback (`drawImage`/`getImageData`) returns empty for the same reason; this issue does not exist on `apps/webgpu`, whose loop is a `setInterval`.
  ```

---

## 6. `fwidth` interdit en flux de contrôle non-uniforme (shaders de formes / WGSL)

- **Source :** `docs/debug/gizmos-plan.md:301` (formulation complète, avec le message d'erreur exact et le pourquoi des `select`). Contenu intégralement dupliqué, en plus détaillé encore, dans `docs/debug/gizmos.md:244-256,357` (doc permanent — le fond n'est pas en risque, seule la destination « CLAUDE.md de package » n'existe pas encore).
- **Destination :** `CLAUDE.md` package (`packages/nebula-webgpu/CLAUDE.md`, existe déjà — règle à y ajouter)
- **Texte exact à écrire :**

  ```markdown
  - **No `if` depending on `params` before a call to `fwidth`.** `fwidth` is a derivative builtin: WGSL forbids calling it from non-uniform control flow (`error: 'fwidth' must only be called from uniform control flow`). Compute the SDF and the derivative **unconditionally**, and express any decision that depends on `params` only through `select`. Applies to any future extension of a shapes shader (rounded corners, feather). Full detail: `docs/debug/gizmos.md` §6.2.
  ```

---

## 7. Le pane WebGPU sert une scène périmée sous HMR — redémarrer le dev server, pas de HMR

- **Source :** `docs/dino-brawl-cleanup-plan.md:25` (« Le pane WebGPU sert des scènes *stales* sous HMR → **redémarrer le dev server, pas de HMR** »). Répété à l'identique dans `2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-plan.md:27`, dans `dino-brawl-tiled-bridge-plan.md:1346` (qui ajoute la technique de sonde `window.__scene` pour inspecter les nodes), et dans `gameplay/prefab-multi-entity-plan.md:712` (« gotcha connu : HMR sert une scène périmée sur WebGPU »).
- **Constat :** contrairement aux pièges 1 et 6, celui-ci **n'est dupliqué dans aucun doc permanent** du repo — il ne vit que dans les 4 plans ci-dessus (tous supprimés en T7) et dans la mémoire privée de l'utilisateur (`sandbox-browser-verify-gotchas`, non versionnée). Perte réelle si non extrait ici.
- **Destination :** skill (`atlas-verify-webgpu`, à créer — entrée additionnelle à la §5)
- **Texte exact à écrire :**

  ```markdown
  - **HMR sometimes serves a stale WebGPU scene.** At the slightest doubt about what's displayed after a change, restart the dev server (`preview_stop` then `preview_start`) rather than trusting HMR. To inspect the actual scene state without restarting, stash a reference via `window.__scene` and query it from the console/`javascript_tool`.
  ```

---

## 8. `Transform2D` existe dans deux packages distincts (`@atlasjs/math` vs `@atlasjs/gameplay`)

- **Source :** `docs/debug/gizmos-plan.md:23` (« Piège de nommage : `Transform2D` existe dans **deux** packages — `@atlasjs/math` (valeurs TRS brutes, utilisé par `Mat3.fromTransform2D`) et `@atlasjs/gameplay` (le composant ECS). Les tests utilisent celui de **math** pour fabriquer un `WorldTransform2D`. »).
- **Constat :** absent de `docs/debug/gizmos.md` (vérifié — aucune mention de la collision de nom entre les deux `Transform2D`) et absent de `packages/gameplay/CLAUDE.md` / `packages/math/CLAUDE.md` (ce dernier n'existe pas). C'est une **contrainte de modèle spécifique** (quel `Transform2D` utiliser selon qu'on écrit un test ou du code de composant), incompréhensible hors du contexte gizmos/gameplay — pas un piège d'outillage transverse. Elle **resterait perdue** si non extraite : ni le hook, ni la skill, ni aucun `CLAUDE.md` prévu par T3/T4/T5 ne la couvre.
- **Destination :** `CLAUDE.md` package (`packages/gameplay/CLAUDE.md`, existe déjà). **Reroutage décidé par le contrôleur** : « lequel des deux symboles homonymes importer » est un piège mécanique transverse (nature 1), pas un caveat de design propre aux gizmos. Couvert par T5.
- **Texte exact à écrire :**

  ```markdown
  **Naming pitfall.** `Transform2D` exists in two distinct packages: `@atlasjs/math` (raw TRS values, used by `Mat3.fromTransform2D`) and `@atlasjs/gameplay` (the ECS component, LEVEL 1). To build a `WorldTransform2D` in a test (or any matrix computation outside the ECS), use the one from **`@atlasjs/math`**; the `@atlasjs/gameplay` component stays reserved for the ECS world (systems, `world.addComponent`).
  ```

---

## 9. Assertions `localIndex` non-flippées du plan Tiled (obsolètes)

- **Source :** `docs/dino-brawl-tiled-bridge-plan.md:13` (marqueur `⚠️`, « Correction post-implémentation (row-flip Tiled↔Atlas) ») et les blocs de code / assertions `localIndex` non-flippées des Task 2 et Task 5 de ce même plan, que ce marqueur cite explicitement comme obsolètes.
- **Constat :** le plan affirmait à tort que l'index local Tiled == l'index linéaire Atlas « sans flip ». Ce n'est pas un piège à router vers un hook, une skill ou un `CLAUDE.md` : c'est une erreur corrigée en cours de route. La formule correcte (`localIndex = (rows-1 - tiledRow)*columns + col`) vit déjà, avec son contexte complet, dans le doc de design permanent `docs/dino-brawl-tiled-bridge.md` §5.1. Rien d'utile ne disparaît avec la suppression du plan — seules les assertions de code périmées, propres au plan lui-même, disparaissent.
- **Destination :** (jeté)
- **Motif :** contenu obsolète déjà remplacé par la version correcte dans un doc permanent ; le recopier ferait perdurer une formule fausse sans qu'aucune destination n'en ait besoin.

---

### Pièges vérifiés et déjà en sécurité (aucune entrée nécessaire)

Pour mémoire (pas des entrées à part entière — rien à extraire, le texte survit déjà dans un doc permanent) :

- **Pinceau immediate-mode mutable** (`gizmos.borderWidth`/`color` non réinitialisé entre producteurs, `debug/gizmos-plan.md:1766,1936` §Récapitulatif) : déjà documenté dans `docs/debug/gizmos.md:330-332` (permanent).
- **Les 5 caveats de design déjà routés par la spec** (ordre `onCreate` vs `getScript`, désync `TProps` ↔ metadata, `Vec2` backend live mutable, fronts d'input ambigus en lane `fixed`, shear dans la décomposition `Mat3`) : vérifiés présents dans leurs docs permanents respectifs — `docs/gameplay/exposed-script-variables.md:499,501`, `docs/gameplay/input-scripting.md:355` (Vec2), `docs/gameplay/input-scripting.md:52,173,358` (fronts fixed), `docs/gameplay/entity-hierarchy.md:170` (shear Mat3). Conformément à la Nature 2 de la spec §5, ils restent dans leur doc de design — aucune action.

Un seul piège trouvé aux steps 2-3 a été jugé périmé au sens strict (contenu faux/obsolète à jeter) : les assertions de code non-flippées du plan Tiled, listées en entrée 9 ci-dessus avec `Destination : (jeté)`.
