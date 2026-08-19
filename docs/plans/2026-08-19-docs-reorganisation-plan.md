# Réorganisation de `docs/` — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ramener `docs/` sous 10 000 lignes, transformer les pièges d'outillage récurrents en garde-fous exécutables, et remplacer le backlog monolithique par des notes atomiques exploitables dans Obsidian.

**Architecture:** Trois chantiers indépendants exécutés dans un ordre contraint. (1) Extraction puis outillage : les pièges deviennent des hooks Claude Code, une skill et des règles `CLAUDE.md` de proximité. (2) Dégraissage : suppression des 9 plans exécutés, descente des designs app-local, correction des statuts mensongers. (3) Backlog : migration en notes atomiques à frontmatter typé, avec un index régénéré par script. L'ordre est contraint parce que l'extraction (T1) doit précéder toute suppression (T7).

**Tech Stack:** Node 26 (`node --test` natif, aucune dépendance ajoutée), pnpm 10 / Turborepo, hooks Claude Code (`PostToolUse`, `SessionStart`), prettier, Obsidian ≥ 1.9.

**Spec source :** [`../2026-08-19-docs-reorganisation-design.md`](../2026-08-19-docs-reorganisation-design.md)

## Global Constraints

- **Aucun commit automatique.** Chaque tâche s'arrête sur des modifications **non commitées**. La revue et le commit appartiennent à l'utilisateur. Une tâche = un commit utilisateur.
- **Aucune dépendance npm ajoutée.** Le script d'index est du Node nu ; les tests utilisent `node --test`.
- **Aucun fichier de `packages/` ou `apps/*/src/` n'est modifié**, hormis la création de `CLAUDE.md` (T5) et de `apps/dino-brawl/CLAUDE.md` (T5).
- **Ne jamais reformater un `.md` avec prettier.** Les docs ne sont pas maintenus par prettier ; un passage reformate tableaux et blocs de code (c'est le défaut corrigé en T2).
- **`.claude/settings.local.json` ne doit pas être touché.** Il porte le hook `graphify` de l'utilisateur et n'est pas versionné. Tous les hooks de ce plan vont dans `.claude/settings.json`, qui **est** versionné.
- **Vocabulaire de statut du backlog : `todo` · `partial` · `vision`.** Jamais `done` — un item terminé quitte le backlog.
- Les docs restent en **français**, le code et les identifiants en **anglais**.
- Format d'ID de backlog : `<DOMAIN>-<nn>` avec `nn` sur 2 chiffres. Domaines : `CORE` `RENDER` `GAMEPLAY` `PHYSICS` `ASSETS` `DEBUG` `AUDIO` `APP`.

---

## Structure des fichiers

**Créés :**

| Fichier | Responsabilité |
| --- | --- |
| `.claude/hooks/prettier-touched.mjs` | Formater le seul `.ts`/`.tsx` qui vient d'être écrit |
| `.claude/hooks/wgsl-rebuild.mjs` | Rebuild ciblé de `@atlasjs/nebula-webgpu` après édition d'un `.wgsl` |
| `.claude/hooks/plan-reminder.mjs` | Signaler au démarrage qu'un plan traîne dans `docs/plans/` |
| `.claude/skills/atlas-verify-webgpu/SKILL.md` | Procédure de vérification navigateur WebGPU |
| `.claude/commands/atlas-done.md` | Clôture de feature |
| `apps/dino-brawl/CLAUDE.md` | Règles locales à l'app (typecheck) |
| `scripts/lib/frontmatter.mjs` | Parser de frontmatter YAML minimal — **une seule responsabilité** |
| `scripts/lib/frontmatter.test.mjs` | Tests du parser |
| `scripts/backlog-index.mjs` | Orchestration : lecture des notes → `_index.md` + `README.md` |
| `docs/README.md` | Index régénéré des docs |
| `docs/backlog/*.md` | ~55 notes atomiques |
| `docs/backlog/backlog.base` | Vue Obsidian |
| `docs/plans/` | Plans en cours (transitoire) |

**Modifiés :** `.claude/settings.json`, `.prettierignore`, `.gitignore`, `CLAUDE.md`, `packages/nebula-webgpu/CLAUDE.md`, `package.json`, les 4 docs à statut faux.

**Supprimés :** les 9 `*-plan.md`, `docs/backlog.md`.

**Déplacés :** 3 designs app-local vers `apps/dino-brawl/docs/`.

---

## Task 1 : Extraire les pièges des 9 plans

**Files:**
- Create: `docs/plans/pieges-extraits.md` (fichier de travail, supprimé en T7)

**Interfaces:**
- Produces: l'inventaire consommé par T3 (hook WGSL), T4 (skill), T5 (`CLAUDE.md`). Chaque entrée a la forme `piège → destination → texte exact à écrire`.

Sans cette tâche, T7 détruit 10 012 lignes dont le contenu utile n'a pas été récupéré. **T7 ne peut pas démarrer avant que celle-ci soit validée.**

- [ ] **Step 1 : Lister les 9 plans et leur volume**

```bash
find docs -name '*-plan.md' -exec wc -l {} + | sort -rn
```

Attendu : 9 fichiers, 10 012 lignes au total.

- [ ] **Step 2 : Balayer les marqueurs explicites**

```bash
grep -rniE 'piège|gotcha|attention|caveat|⚠|pitfall|ne pas oublier|erreur fréquente' docs --include='*-plan.md'
```

Attendu : ~10 occurrences, concentrées sur `debug/gizmos-plan.md` (5), `dino-brawl-tiled-bridge-plan.md` (3), `gameplay/prefab-multi-entity-plan.md` (1), `audio-system-plan.md` (1).

- [ ] **Step 3 : Balayer les sections de vérification**

Les marqueurs sous-estiment : les procédures de vérification n'en portent pas.

```bash
grep -rnE '^#{2,4} .*(érification|Vérif|Recap|Récapitulatif|Verification)' docs --include='*-plan.md'
```

Lire chaque section trouvée. `debug/gizmos-plan.md` en a une vers la ligne 2061.

- [ ] **Step 4 : Écrire l'inventaire**

Créer `docs/plans/pieges-extraits.md`. Une entrée par piège :

```markdown
## <titre court du piège>

- **Source :** `docs/<chemin>-plan.md:<ligne>`
- **Destination :** hook | skill | CLAUDE.md racine | CLAUDE.md package | CLAUDE.md app | doc de design | (jeté)
- **Texte exact à écrire :**

  <le texte final, prêt à copier tel quel dans la destination>
```

Les 6 pièges déjà connus (§5 de la spec) doivent y figurer. Tout piège **supplémentaire** trouvé aux steps 2-3 est ajouté. Un piège jugé périmé est listé avec `Destination : (jeté)` **et son motif** — rien ne disparaît en silence.

- [ ] **Step 5 : Contrôle de complétude**

```bash
grep -c '^## ' docs/plans/pieges-extraits.md
```

Attendu : **≥ 6**. Si le compte est inférieur à 6, les 6 pièges de la spec §5 n'ont pas tous été repris — reprendre le step 4.

- [ ] **Step 6 : Arrêt pour revue**

Ne rien commiter. Présenter l'inventaire à l'utilisateur : c'est le seul moment où l'on peut encore constater qu'un piège manque avant que les plans soient détruits.

---

## Task 2 : Prettier — hook ciblé et `docs/` protégé

**Files:**
- Create: `.claude/hooks/prettier-touched.mjs`
- Modify: `.claude/settings.json`, `.prettierignore`

**Interfaces:**
- Produces: `.claude/settings.json` avec une clé `hooks.PostToolUse` que T3 et T6 viendront compléter.

- [ ] **Step 1 : Reproduire le défaut**

```bash
pnpm exec prettier --check "docs/**/*.md" | tail -5
```

Attendu : **échec**, plusieurs docs signalés comme non formatés. C'est la preuve qu'un `pnpm format` à la racine (qui cible `**/*.{ts,tsx,md}`) les réécrirait tous.

- [ ] **Step 2 : Protéger les docs**

Ajouter à la fin de `.prettierignore` :

```
# Docs: hand-written, never reformatted (tables and code blocks churn)
/docs/
apps/*/docs/
```

- [ ] **Step 3 : Vérifier la protection**

```bash
pnpm exec prettier --check "docs/**/*.md"
```

Attendu : `All matched files use Prettier code style!` — les fichiers sont désormais ignorés.

- [ ] **Step 4 : Écrire le hook**

`.claude/hooks/prettier-touched.mjs` :

```js
import { execFileSync } from "node:child_process";

const raw = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
});

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? "";
if (!/\.tsx?$/.test(filePath)) process.exit(0);

try {
  execFileSync("pnpm", ["exec", "prettier", "--write", filePath], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 15000,
  });
  console.log(`[prettier] ${filePath}`);
  process.exit(0);
} catch (error) {
  console.error(
    `[prettier] failed on ${filePath}\n${error.stderr ?? error.message ?? ""}`,
  );
  process.exit(2);
}
```

- [ ] **Step 5 : Tester le hook hors Claude Code**

```bash
echo '{"tool_input":{"file_path":"packages/core/src/index.ts"}}' | node .claude/hooks/prettier-touched.mjs
```

Attendu : `[prettier] packages/core/src/index.ts`, code de sortie 0.

```bash
echo '{"tool_input":{"file_path":"docs/backlog.md"}}' | node .claude/hooks/prettier-touched.mjs; echo "exit=$?"
```

Attendu : **aucune sortie**, `exit=0`. Le hook doit ignorer les `.md`.

- [ ] **Step 6 : Déclarer le hook**

`.claude/settings.json` — préserver `enabledPlugins` :

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/prettier-touched.mjs"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7 : Valider le JSON**

```bash
node -e "const s=require('./.claude/settings.json'); if(!s.enabledPlugins) throw new Error('enabledPlugins perdu'); console.log('OK', Object.keys(s.hooks))"
```

Attendu : `OK [ 'PostToolUse' ]`.

- [ ] **Step 8 : Arrêt pour revue et commit utilisateur**

---

## Task 3 : Hook de rebuild WGSL

**Files:**
- Create: `.claude/hooks/wgsl-rebuild.mjs`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: la clé `hooks.PostToolUse` créée en T2 — on **ajoute** une entrée au tableau `hooks`, on ne le remplace pas.

C'est le piège le plus coûteux du projet : les apps importent les packages via `exports` → `./dist`, et le WGSL est inliné dans `dist` **au build**. Éditer `src/shaders/*.wgsl` sans rebuild laisse servir l'ancien shader ; redémarrer le dev server ne suffit pas, le HMR encore moins.

- [ ] **Step 1 : Localiser les shaders concernés**

```bash
find packages -name '*.wgsl' | head && echo "---" && node -e "console.log(require('./packages/nebula-webgpu/package.json').name)"
```

Attendu : des `.wgsl` sous `packages/nebula-webgpu/src/shaders/`, et le nom `@atlasjs/nebula-webgpu`.

- [ ] **Step 2 : Écrire le hook**

`.claude/hooks/wgsl-rebuild.mjs` :

```js
import { execFileSync } from "node:child_process";

const raw = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
});

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? "";
if (!filePath.endsWith(".wgsl") || !filePath.includes("packages/nebula-webgpu/"))
  process.exit(0);

try {
  execFileSync("pnpm", ["--filter", "@atlasjs/nebula-webgpu", "build"], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 180000,
  });
  console.log(`[wgsl] rebuild @atlasjs/nebula-webgpu OK (${filePath})`);
  process.exit(0);
} catch (error) {
  console.error(
    `[wgsl] REBUILD FAILED after editing ${filePath}. ` +
      `dist still serves the old shader.\n${error.stdout ?? ""}${error.stderr ?? error.message ?? ""}`,
  );
  process.exit(2);
}
```

Le `exit(2)` sur un `PostToolUse` remonte `stderr` à l'agent sans annuler l'édition : il est informé de l'échec, la session n'est pas verrouillée — c'est le comportement « non bloquant » exigé par la spec §6.1.

- [ ] **Step 3 : Vérifier la garde d'extension**

```bash
echo '{"tool_input":{"file_path":"packages/core/src/index.ts"}}' | node .claude/hooks/wgsl-rebuild.mjs; echo "exit=$?"
```

Attendu : **aucune sortie**, `exit=0`. Aucun build ne doit être déclenché par un `.ts`.

- [ ] **Step 4 : Vérifier la garde de package**

```bash
echo '{"tool_input":{"file_path":"apps/webgpu/shaders/test.wgsl"}}' | node .claude/hooks/wgsl-rebuild.mjs; echo "exit=$?"
```

Attendu : **aucune sortie**, `exit=0`. Un `.wgsl` hors de `packages/nebula-webgpu/` ne doit déclencher aucun build — sinon un futur package `.wgsl` (backend WebGL, module 3D) rebuilderait `nebula-webgpu` au lieu de lui-même.

- [ ] **Step 5 : Vérifier le chemin nominal**

```bash
echo '{"tool_input":{"file_path":"packages/nebula-webgpu/src/shaders/shape_instanced.wgsl"}}' | node .claude/hooks/wgsl-rebuild.mjs; echo "exit=$?"
```

Attendu : `[wgsl] rebuild @atlasjs/nebula-webgpu OK (...)`, `exit=0`.

- [ ] **Step 6 : Prouver que le rebuild agit réellement sur `dist`**

C'est le cœur du piège : il ne suffit pas que le hook s'exécute, il faut que `dist` change.

Le build (`tsdown`) produit du **`.mjs`**, pas du `.js`, et inline chaque shader dans un module de même nom : `src/shaders/X.wgsl` → `dist/shaders/X.mjs`. La paire est donc déterministe, pas à deviner.

```bash
WGSL=packages/nebula-webgpu/src/shaders/shape_instanced.wgsl
DIST=packages/nebula-webgpu/dist/shaders/shape_instanced.mjs
shasum "$DIST"
printf '\n// hook-probe\n' >> "$WGSL"
echo "{\"tool_input\":{\"file_path\":\"$WGSL\"}}" | node .claude/hooks/wgsl-rebuild.mjs
shasum "$DIST"
```

Attendu : les deux sommes **diffèrent**, et la seconde contient la sonde (`grep -c 'hook-probe' "$DIST"` vaut 1). Si elles sont identiques, le hook n'a pas rebuildé — c'est un échec de la tâche, pas un fichier mal choisi.

`//` est un commentaire valide en WGSL : la sonde n'empêche pas le shader de compiler.

- [ ] **Step 7 : Restaurer le shader sonde**

```bash
git checkout -- packages/nebula-webgpu && git status --short packages/nebula-webgpu
```

Attendu : sortie vide.

- [ ] **Step 8 : Ajouter le hook aux réglages**

Ajouter une seconde entrée dans le tableau `hooks` de l'objet `matcher: "Edit|Write"` existant :

```json
{
  "type": "command",
  "command": "node .claude/hooks/wgsl-rebuild.mjs"
}
```

- [ ] **Step 9 : Valider**

```bash
node -e "const s=require('./.claude/settings.json'); const h=s.hooks.PostToolUse[0].hooks; console.log(h.length, h.map(x=>x.command))"
```

Attendu : `2` et les deux commandes.

- [ ] **Step 10 : Arrêt pour revue et commit utilisateur**

---

## Task 4 : Skill `atlas-verify-webgpu`

**Files:**
- Create: `.claude/skills/atlas-verify-webgpu/SKILL.md`

**Interfaces:**
- Consumes: les entrées de `docs/plans/pieges-extraits.md` (T1) marquées `Destination : skill`.

- [ ] **Step 1 : Écrire la skill**

`.claude/skills/atlas-verify-webgpu/SKILL.md` :

```markdown
---
name: atlas-verify-webgpu
description: Use when verifying a rendering change in the browser for AtlasJS (apps/webgpu or apps/dino-brawl) — covers the WGSL rebuild requirement, WebGPU compile errors that never surface as console errors, and RAF throttling that produces a black canvas with zero errors.
---

# WebGPU browser verification (AtlasJS)

Four pitfalls make browser verification misleading on this project. Ignoring them produces either a false negative, or an unfounded "it works".

## 1. Rebuild the backend after any `.wgsl` edit

Apps import packages through their `exports` field → `./dist`, and the `.wgsl` is **inlined into `dist` at build time**.

```bash
pnpm --filter @atlasjs/nebula-webgpu build
```

Restarting the dev server **is not enough**. HMR even less so. A `PostToolUse` hook does this automatically, but if the edit comes from elsewhere (git checkout, manual edit), the rebuild is the operator's responsibility.

## 2. A WGSL compile error is not a console error

It comes out as **`warn`** (`Error while parsing WGSL:`), then gets drowned under `Invalid RenderPipeline … due to a previous error` repeated at 60 fps.

- Read the console **without** the `onlyErrors` filter.
- For the exact error reliably, compile the shader in the page and read `getCompilationInfo()`.

## 3. `apps/dino-brawl` is throttled out of the foreground

Its loop runs on RAF: if the browser panel isn't in the foreground, you get a **black canvas at 0 fps with no error at all**. Bring the tab to the front before judging anything.

Programmatic canvas readback (`drawImage`/`getImageData`) returns empty for the same reason. It works on `apps/webgpu`, whose loop is a `setInterval`.

## 4. `fwidth` and non-uniform control flow

No `if` depending on `params` **before** a call to `fwidth`: it's a derivative builtin, WGSL forbids calling it in non-uniform control flow, and the shader then refuses to compile. Applies to any future extension (rounded corners, feather).

## Verification order

1. `pnpm --filter @atlasjs/nebula-webgpu build` if a `.wgsl` has changed.
2. Open the preview, **tab in the foreground**.
3. Read the **entire** console, not just the errors.
4. Confirm the render with a screenshot; never conclude from an empty readback without first ruling out throttling.
```

- [ ] **Step 2 : Vérifier le frontmatter**

```bash
head -4 .claude/skills/atlas-verify-webgpu/SKILL.md
```

Attendu : un bloc `---` avec `name:` et `description:`. Le `name` doit correspondre exactement au nom du dossier.

- [ ] **Step 3 : Vérifier la couverture**

Confronter la skill aux entrées `Destination : skill` de `docs/plans/pieges-extraits.md`. Toute entrée non couverte est ajoutée.

- [ ] **Step 4 : Arrêt pour revue et commit utilisateur**

---

## Task 5 : Pièges routés vers les `CLAUDE.md`

**Files:**
- Create: `apps/dino-brawl/CLAUDE.md`
- Modify: `CLAUDE.md`, `packages/nebula-webgpu/CLAUDE.md`

**Interfaces:**
- Consumes: les entrées `Destination : CLAUDE.md *` de `docs/plans/pieges-extraits.md` (T1).

Règle de placement : le piège vit **au plus près** de ce qu'il protège. Un piège spécifique à une app ne pollue pas le prompt de tout le repo.

- [ ] **Step 1 : Créer `apps/dino-brawl/CLAUDE.md`**

```markdown
# apps/dino-brawl

## Type-check

A bare `tsc --noEmit` **is a no-op in this app**: it doesn't pick up the right configuration and checks nothing. Always:

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json
```

## Render loop

The loop runs on RAF, so it's throttled when the browser panel isn't in the foreground: black canvas, 0 fps, no error. See the `atlas-verify-webgpu` skill before concluding a render is broken.
```

- [ ] **Step 2 : Vérifier que le no-op est réel**

```bash
cd apps/dino-brawl && pnpm exec tsc --noEmit; echo "nu=$?"; pnpm exec tsc --noEmit -p tsconfig.app.json; echo "app=$?"; cd ../..
```

Attendu : les deux invocations n'ont pas le même comportement. Si `tsc --noEmit` nu vérifiait réellement l'app, la règle serait fausse — le signaler plutôt que d'écrire une consigne inexacte.

- [ ] **Step 3 : Ajouter la règle `import type` au `CLAUDE.md` racine**

Sous les *AI Agent Guidelines* :

```markdown
- **Import type-only symbols with `import type`.** In app and script files, a value import for a type (`import { GameEntity }`) passes `tsc --noEmit` — the type is erased at type-check time — but **breaks at runtime** under Vite/esbuild: `SyntaxError: … does not provide an export named 'GameEntity'`, black screen. Verify in the browser, not just with `tsc`.
```

- [ ] **Step 4 : Ajouter la règle `fwidth` au `CLAUDE.md` de nebula-webgpu**

```markdown
## WGSL

- **No `if` depending on `params` before a call to `fwidth`.** `fwidth` is a derivative builtin: WGSL forbids calling it from non-uniform control flow, and the shader refuses to compile. Constraint to respect for any extension of the shapes shader (rounded corners, feather).
- After any `.wgsl` edit, `dist` must be rebuilt — a `PostToolUse` hook takes care of this.
```

- [ ] **Step 4bis : Ajouter la règle `Transform2D` au `CLAUDE.md` de gameplay**

`Transform2D` existe dans **deux** packages et les deux sont légitimes — c'est un piège d'import, pas une erreur à corriger. Ajouter à `packages/gameplay/CLAUDE.md` :

```markdown
## Import pitfalls

- **`Transform2D` exists in two distinct packages.** `@atlasjs/math` carries the raw TRS values (used by `Mat3.fromTransform2D`); `@atlasjs/gameplay` carries the ECS component (LEVEL 1). To build a `WorldTransform2D` in a test, or for any matrix computation outside the ECS, use the one from **`@atlasjs/math`**. The `@atlasjs/gameplay` component is reserved for the ECS world (systems, `world.addComponent`).
```

- [ ] **Step 5 : Vérifier la couverture**

```bash
grep -c 'Destination : CLAUDE' docs/plans/pieges-extraits.md
```

Chaque entrée doit avoir une destination réelle dans l'un des **quatre** fichiers (`CLAUDE.md` racine, `apps/dino-brawl/CLAUDE.md`, `packages/nebula-webgpu/CLAUDE.md`, `packages/gameplay/CLAUDE.md`).

- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 6 : Clôture de feature — `docs/plans/`, hook de rappel, `/atlas-done`

**Files:**
- Create: `docs/plans/.gitkeep`, `.claude/hooks/plan-reminder.mjs`, `.claude/commands/atlas-done.md`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: la clé `hooks` de `.claude/settings.json` (T2, T3) — on **ajoute** une clé `SessionStart` frère de `PostToolUse`.
- Produces: la commande `/atlas-done`, invoquée manuellement, qui appellera `pnpm docs:index` (défini en T9).

Le hook détecte et rappelle ; la commande exécute. Une commande seule n'empêche pas l'oubli ; un hook seul ne sait pas faire le travail.

- [ ] **Step 1 : Écrire le hook de rappel**

`.claude/hooks/plan-reminder.mjs` :

```js
import { existsSync, readdirSync } from "node:fs";

const dir = "docs/plans";
if (!existsSync(dir)) process.exit(0);

const plans = readdirSync(dir).filter((name) => name.endsWith(".md"));
if (plans.length === 0) process.exit(0);

console.log(
  `Plan(s) en cours dans docs/plans/ : ${plans.join(", ")}. ` +
    `Si le chantier correspondant est termine, derouler /atlas-done pour cloturer ` +
    `(supprimer le plan, mettre a jour le backlog et le statut du doc de design).`,
);
```

Propriété recherchée : le rappel **s'éteint tout seul** quand le plan est supprimé. Il ne peut donc pas devenir un bruit permanent qu'on apprend à ignorer.

- [ ] **Step 2 : Vérifier les deux états du hook**

```bash
node .claude/hooks/plan-reminder.mjs
```

Attendu : le rappel mentionnant `2026-08-19-docs-reorganisation-plan.md` (ce plan est dans `docs/plans/`).

```bash
mkdir -p /tmp/atlas-probe && cd /tmp/atlas-probe && node "$OLDPWD/.claude/hooks/plan-reminder.mjs"; echo "exit=$?"; cd "$OLDPWD"
```

Attendu : **aucune sortie**, `exit=0` — pas de `docs/plans/`, donc silence.

- [ ] **Step 3 : Déclarer le hook**

Ajouter à `.claude/settings.json`, à côté de `PostToolUse` :

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node .claude/hooks/plan-reminder.mjs"
      }
    ]
  }
]
```

- [ ] **Step 4 : Valider le JSON**

```bash
node -e "const s=require('./.claude/settings.json'); console.log(Object.keys(s.hooks), s.hooks.SessionStart.length)"
```

Attendu : `[ 'PostToolUse', 'SessionStart' ] 1`.

- [ ] **Step 5 : Écrire la commande**

`.claude/commands/atlas-done.md` :

```markdown
---
description: Clôturer une feature terminée — plan, backlog, statut du doc de design, index
---

Clôture de la feature correspondant au plan : $ARGUMENTS

Si aucun plan n'est nommé, lister `docs/plans/*.md` et demander lequel clôturer.

Dérouler dans l'ordre. **Ne pas passer à l'étape suivante si la précédente échoue.**

1. **Vérifier que le travail est réellement terminé.** Exécuter les tests du périmètre concerné et constater le résultat. Si un test échoue, s'arrêter ici et le dire — ne rien clôturer sur une hypothèse.
2. **Corriger le doc de design** de la feature : statut → implémenté, avec la portée réelle livrée et ce qui reste hors périmètre.
3. **Fermer les notes de backlog couvertes** : les supprimer de `docs/backlog/`. Le vocabulaire de statut n'a pas de valeur `done` — un item terminé quitte le backlog. Si une partie seulement est livrée, créer une note `todo` distincte pour le reste plutôt que de laisser un reliquat dans une note fermée.
4. **Créer les notes** correspondant aux V2 et hors-périmètre annoncés par la feature, avec `status`, `domain`, `source`, `effort` et `verified` à la date du jour.
5. **Supprimer le plan** dans `docs/plans/`.
6. **Régénérer les index** : `pnpm docs:index`.
7. **Clore les tâches** correspondantes.
8. **S'arrêter.** Ne rien commiter : la revue et le commit appartiennent à l'utilisateur. Présenter un résumé de ce qui a changé.
```

- [ ] **Step 6 : Vérifier la présence de la commande**

```bash
ls .claude/commands/ && head -3 .claude/commands/atlas-done.md
```

Attendu : `atlas-done.md` avec son frontmatter `description`.

- [ ] **Step 7 : Arrêt pour revue et commit utilisateur**

---

## Task 7 : Supprimer les plans, descendre les designs app-local

**Files:**
- Delete: les 9 `*-plan.md`, `docs/plans/pieges-extraits.md`
- Move: 3 designs vers `apps/dino-brawl/docs/`

**Interfaces:**
- Consumes: `docs/plans/pieges-extraits.md` (T1) — **doit être validé** avant cette tâche.

⚠️ **Porte de sécurité : ne pas démarrer si T1 n'a pas été revue et approuvée.** C'est la tâche destructrice.

- [ ] **Step 1 : Vérifier que l'extraction a bien eu lieu**

```bash
test -f docs/plans/pieges-extraits.md && grep -c '^## ' docs/plans/pieges-extraits.md
```

Attendu : un compte **≥ 6**. Si le fichier est absent, **arrêter** : T1 n'a pas été faite.

- [ ] **Step 2 : Vérifier que l'arbre de travail est propre**

```bash
git status --short
```

Les seules modifications attendues sont celles des tâches précédentes, déjà commitées par l'utilisateur. Un arbre encombré rend la suppression difficile à relire.

- [ ] **Step 3 : Descendre les 3 designs app-local**

```bash
mkdir -p apps/dino-brawl/docs
git mv docs/dino-brawl-cleanup.md apps/dino-brawl/docs/cleanup.md
git mv docs/dino-brawl-tiled-bridge.md apps/dino-brawl/docs/tiled-bridge.md
git mv docs/2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-design.md apps/dino-brawl/docs/spawn-prefab-sheet-cleanup.md
ls apps/dino-brawl/docs/
```

Attendu : `cleanup.md`, `spawn-prefab-sheet-cleanup.md`, `tiled-bridge.md`.

- [ ] **Step 4 : Supprimer les 9 plans**

```bash
git rm docs/audio-system-plan.md docs/audio-variation-plan.md \
       docs/dino-brawl-cleanup-plan.md docs/dino-brawl-tiled-bridge-plan.md \
       docs/2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-plan.md \
       docs/debug/gizmos-plan.md docs/gameplay/prefab-multi-entity-plan.md \
       docs/physics/character-controller-plan.md docs/rendering/sort-point-anchor-plan.md
```

- [ ] **Step 5 : Supprimer le fichier de travail de T1**

```bash
rm docs/plans/pieges-extraits.md
touch docs/plans/.gitkeep
```

Le contenu utile vit désormais dans les hooks, la skill et les `CLAUDE.md`.

- [ ] **Step 6 : Réparer les liens cassés**

```bash
grep -rn 'dino-brawl-cleanup\|dino-brawl-tiled-bridge\|2026-08-12-dino-brawl\|-plan\.md' docs CLAUDE.md apps/*/CLAUDE.md packages/*/CLAUDE.md 2>/dev/null | grep -v 'docs/plans/2026-08-19'
```

Attendu à terme : **aucune sortie**. Chaque référence trouvée est soit repointée vers `apps/dino-brawl/docs/`, soit supprimée si elle visait un plan.

- [ ] **Step 7 : Mesurer le gain**

```bash
find docs -name '*.md' -exec wc -l {} + | tail -1
```

Attendu : environ **10 500 lignes** — départ à 21 232 (spec et plan de ce chantier inclus), moins 10 012 de plans et 702 de designs descendus.

Le seuil de 10 000 de la spec n'est **pas encore atteint à ce stade** : il le sera en T19, après suppression de ce plan (1 413 lignes) et de `docs/backlog.md` (258), déduction faite des ~800 lignes de notes créées. La marge finale est mince — si un lot produit beaucoup plus de 55 notes, c'est le seuil qu'il faut rediscuter, pas les notes qu'il faut tronquer.

- [ ] **Step 8 : Arrêt pour revue et commit utilisateur**

---

## Task 8 : Corriger les 4 statuts mensongers

**Files:**
- Modify: `docs/gameplay/audio.md`, `docs/rendering/canvas-resize.md`, `docs/physics/character-controller.md`, `docs/physics/collision-layer.md`

Ces docs déclarent un statut contredit par le code. Tant qu'ils mentent, la migration du backlog (T10-T17) partirait de fausses prémisses.

**Règle absolue : le statut se constate dans le code, jamais dans un autre doc ni dans une mémoire.**

- [ ] **Step 1 : `gameplay/audio.md` — vérifier**

```bash
ls packages/audio/src 2>/dev/null && grep -rn 'AudioSource\|AudioSystem\|AudioApi' packages/gameplay/src --include='*.ts' -l | head
```

Si le package et les systèmes existent : le doc dit « non implémenté » à tort.

- [ ] **Step 2 : `gameplay/audio.md` — corriger**

Remplacer l'en-tête de statut par le fait constaté, en nommant ce qui a été vérifié :

```markdown
> Statut : **implémenté**. Backend `@atlasjs/audio` (`AudioEngine`/`AudioLoader`/`AudioPlugin`) + intégration gameplay (`AudioSource`/`AudioSystem`/`AudioApi`). Extensions V2 → `../backlog/`.
```

- [ ] **Step 3 : `rendering/canvas-resize.md` — vérifier**

```bash
grep -rn 'resize' packages/nebula/src --include='*.ts' | grep -i 'renderer\|autoResize\|ResizeObserver' | head
```

- [ ] **Step 4 : `rendering/canvas-resize.md` — corriger** selon le constat. `CLAUDE.md` le dit implémenté, le doc dit « prêt pour plan » : trancher **par le code**, puis aligner les deux.

- [ ] **Step 5 : `physics/character-controller.md` — vérifier**

```bash
git branch -a | grep -i 'tilemap-collision'
grep -rn 'KinematicCharacterController\|CharacterController' packages/gameplay/src --include='*.ts' -l | head
```

Attendu : implémenté sur une branche **non mergée** dans `dev`. Le statut correct n'est ni « non implémenté » ni « implémenté ».

- [ ] **Step 6 : `physics/character-controller.md` — corriger**

```markdown
> Statut : **implémenté sur la branche `feat/claude/tilemap-collision`, non mergé dans `dev`.** Le code existe et fonctionne ; il n'est pas dans la ligne principale.
```

- [ ] **Step 7 : `physics/collision-layer.md` — ajouter un statut**

Ce doc de 1 807 lignes n'en a aucun. Vérifier puis écrire l'en-tête, sur le modèle des autres docs.

- [ ] **Step 8 : Contrôle global**

```bash
for f in $(find docs -name '*.md' ! -path 'docs/plans/*'); do head -8 "$f" | grep -qiE 'statut|status' || echo "SANS STATUT: $f"; done
```

Attendu : aucune sortie hors `docs/backlog.md` (supprimé en T17) et `docs/README.md` (créé en T18).

- [ ] **Step 9 : Arrêt pour revue et commit utilisateur**

---

## Task 9 : Script d'index — parser et génération

**Files:**
- Create: `scripts/lib/frontmatter.mjs`, `scripts/lib/frontmatter.test.mjs`, `scripts/backlog-index.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseFrontmatter(text)` → `{ data: Record<string,string>, body: string }`, consommé par `backlog-index.mjs`. La commande `pnpm docs:index`, consommée par `/atlas-done` (T6) et par chaque lot (T10-T17).

Le parser est isolé du générateur : c'est la seule partie qui a une logique non triviale, donc la seule qui mérite des tests.

- [ ] **Step 1 : Écrire le test qui échoue**

`scripts/lib/frontmatter.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "./frontmatter.mjs";

test("extrait les paires cle/valeur et le corps", () => {
  const input = `---
id: RENDER-02
status: todo
---

# Titre

Corps.`;
  const { data, body } = parseFrontmatter(input);
  assert.equal(data.id, "RENDER-02");
  assert.equal(data.status, "todo");
  assert.match(body, /# Titre/);
});

test("retire les guillemets des valeurs", () => {
  const { data } = parseFrontmatter('---\nsource: "[[renderer-architecture]]"\n---\n');
  assert.equal(data.source, "[[renderer-architecture]]");
});

test("renvoie un objet vide sans frontmatter", () => {
  const { data, body } = parseFrontmatter("# Pas de frontmatter\n");
  assert.deepEqual(data, {});
  assert.match(body, /Pas de frontmatter/);
});

test("ignore un deux-points dans la valeur", () => {
  const { data } = parseFrontmatter("---\nnote: voir a: cet endroit\n---\n");
  assert.equal(data.note, "voir a: cet endroit");
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
node --test scripts/lib/frontmatter.test.mjs
```

Attendu : **ÉCHEC** — `Cannot find module './frontmatter.mjs'`.

- [ ] **Step 3 : Implémenter le parser**

`scripts/lib/frontmatter.mjs` :

```js
export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { data: {}, body: text };

  const end = text.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: text };

  const block = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};

  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key) continue;
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["'](.*)["']$/, "$1");
    data[key] = value;
  }

  return { data, body };
}
```

- [ ] **Step 4 : Vérifier le succès**

```bash
node --test scripts/lib/frontmatter.test.mjs
```

Attendu : `# pass 4`, `# fail 0`.

- [ ] **Step 5 : Écrire le générateur**

`scripts/backlog-index.mjs` :

```js
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const BACKLOG_DIR = "docs/backlog";
const DOCS_DIR = "docs";
const STATUS_ORDER = ["todo", "partial", "vision"];
const STATUS_LABEL = { todo: "📋 à faire", partial: "🔶 partiel", vision: "💭 vision" };

function readBacklog() {
  if (!existsSync(BACKLOG_DIR)) return [];
  return readdirSync(BACKLOG_DIR)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => {
      const { data } = parseFrontmatter(readFileSync(join(BACKLOG_DIR, name), "utf8"));
      return { file: name, ...data };
    });
}

function renderBacklogIndex(items) {
  const domains = [...new Set(items.map((item) => item.domain ?? "?"))].sort();
  const lines = [
    "# Backlog — index",
    "",
    "> Fichier **généré** par `pnpm docs:index`. Ne pas éditer à la main.",
    "",
    `Total : **${items.length}** items.`,
    "",
  ];

  for (const domain of domains) {
    const group = items
      .filter((item) => item.domain === domain)
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          String(a.id).localeCompare(String(b.id)),
      );
    lines.push(`## ${domain}`, "");
    lines.push("| ID | Item | Statut | Effort | Vérifié |", "| --- | --- | --- | --- | --- |");
    for (const item of group) {
      const title = item.file.replace(/\.md$/, "");
      lines.push(
        `| ${item.id ?? "?"} | [${title}](${item.file}) | ${STATUS_LABEL[item.status] ?? item.status} | ${item.effort ?? "?"} | ${item.verified ?? "—"} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function readDesignDocs() {
  const folders = readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !["backlog", "plans"].includes(entry.name))
    .map((entry) => entry.name)
    .sort();

  return folders.map((folder) => ({
    folder,
    docs: readdirSync(join(DOCS_DIR, folder))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => {
        const head = readFileSync(join(DOCS_DIR, folder, name), "utf8").split("\n").slice(0, 8);
        const statusLine = head.find((line) => /statut|status/i.test(line)) ?? "";
        const status = statusLine.replace(/[>*`]/g, "").replace(/^\s*statut\s*:\s*/i, "").trim();
        return { name, status: status.slice(0, 90) || "—" };
      }),
  }));
}

function renderReadme(sections, itemCount) {
  const lines = [
    "# Documentation AtlasJS",
    "",
    "> Fichier **généré** par `pnpm docs:index`. Ne pas éditer à la main.",
    "",
    "Le backlog vit dans [`backlog/`](backlog/) — **" +
      itemCount +
      "** items ouverts, index dans [`backlog/_index.md`](backlog/_index.md).",
    "",
    "Les plans d'implémentation en cours vivent dans [`plans/`](plans/) et sont **transitoires** : ils sont supprimés à la clôture de la feature (`/atlas-done`).",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.folder}`, "");
    lines.push("| Document | Statut |", "| --- | --- |");
    for (const doc of section.docs) {
      lines.push(`| [${doc.name}](${section.folder}/${doc.name}) | ${doc.status} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const items = readBacklog();
writeFileSync(join(BACKLOG_DIR, "_index.md"), renderBacklogIndex(items) + "\n");
writeFileSync(join(DOCS_DIR, "README.md"), renderReadme(readDesignDocs(), items.length) + "\n");
console.log(`docs:index — ${items.length} items de backlog, README régénéré.`);
```

- [ ] **Step 6 : Créer le dossier de backlog et lancer à vide**

```bash
mkdir -p docs/backlog && node scripts/backlog-index.mjs
```

Attendu : `docs:index — 0 items de backlog, README régénéré.` et la création de `docs/README.md` + `docs/backlog/_index.md`. Le script doit tolérer un backlog vide.

- [ ] **Step 7 : Vérifier sur une note factice**

```bash
cat > docs/backlog/RENDER-99-sonde.md <<'EOF'
---
id: RENDER-99
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: S
verified: 2026-08-19
---

# Sonde
EOF
node scripts/backlog-index.mjs && grep -c 'RENDER-99' docs/backlog/_index.md
rm docs/backlog/RENDER-99-sonde.md && node scripts/backlog-index.mjs
```

Attendu : `1 items`, puis `1` (la sonde apparaît), puis retour à `0 items`.

- [ ] **Step 8 : Exposer la commande**

Ajouter à `package.json` :

```json
"docs:index": "node scripts/backlog-index.mjs"
```

- [ ] **Step 9 : Vérifier**

```bash
pnpm docs:index
```

Attendu : la même ligne de sortie.

- [ ] **Step 10 : Arrêt pour revue et commit utilisateur**

---

## Procédure de lot (appliquée par T10 à T17)

Les huit tâches suivantes partagent cette procédure. Chacune fournit ses propres sections sources et ses propres commandes de vérification ; la procédure, elle, ne change pas.

1. **Extraire** les items des sections du lot dans l'ancien `docs/backlog.md`.
2. **Vérifier chaque item contre le code** — jamais contre un doc, jamais contre une mémoire. Un item dont l'implémentation existe est **jeté**, pas migré.
3. **Consolider** : les puces qui sont des sous-points d'une même idée fusionnent en un item. ~110 puces doivent produire ~55 notes.
4. **Présenter un tableau de tri** `item → statut vérifié → garder / fusionner / jeter → motif`, et **attendre la validation de l'utilisateur**.
5. **Écrire les notes** validées, une par fichier, au format du §8 de la spec. `verified` porte la date du jour.
6. **Régénérer** : `pnpm docs:index`.
7. **S'arrêter** pour revue et commit utilisateur.

Format d'une note (`docs/backlog/<ID>-<slug>.md`) :

```markdown
---
id: RENDER-02
legacyId: A2
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: L
verified: 2026-08-19
---

# Text rendering

Police bitmap/MSDF comme shader built-in `"text"` + glyph batch.

**Accroche :** se branche comme `Batcher` sur le seam `NodeRenderer` (E3).
**Bloqué par :** [[RENDER-07-node-renderer-seam]]
```

`legacyId` n'est renseigné que si l'item avait un ID dans les tableaux (`A2`, `B4`, `E3`…) : `rendering/shapes.md` dit « backlog A1 clos » et d'autres docs citent ces IDs.

**Exception app-local :** pour `domain: app`, le design source est hors du vault (`apps/dino-brawl/docs/`). `source` est alors un lien markdown relatif, pas un wikilink — pas d'arête dans le graphe, c'est assumé.

---

## Task 10 : Lot Rendering

**Files:**
- Create: `docs/backlog/RENDER-*.md`

**Sections sources :** `## Rendering` (5 items en tableau + 1 puce) et `### Shapes — suites naturelles` (6 puces) de `docs/backlog.md`.

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Rendering/,/^## Sprites/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier chaque item contre le code**

```bash
grep -rn 'RenderTarget\|PassDescriptor\|depthTest\|NodeRenderer' packages/nebula/src packages/nebula-webgpu/src --include='*.ts' -l
```

Les strokes sont **déjà faits** (livrés avec les gizmos) : tout item les demandant est jeté.

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (IDs `RENDER-01`…, `legacyId` = `A2`/`A3`/`A4`/`B1`/`B4`… selon l'original)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 11 : Lot Sprites & Assets

**Sections sources :** `## Sprites & Assets` (13 puces) et `### Animation — suites V2`.

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Sprites & Assets/,/^## Shaders/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
ls packages/assets/src 2>/dev/null; grep -rn 'AssetManager\|SpriteLoader\|TextureLoader' packages --include='*.ts' -l
```

`AssetManager` est signalé « à faire » par `rendering/sprites.md` mais livré par `assets/asset-system.md` : **c'est un doublon à jeter**, à confirmer par le code.

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`ASSETS-*`, `RENDER-*` selon le domaine réel)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 12 : Lot Shaders & Materials

**Sections sources :** `## Shaders & Materials` (8 puces) et `### Material graph` (💭 vision).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Shaders & Materials/,/^## Core/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
grep -rn 'ivec\|getBuiltinShader\|\.d\.ts' packages/nebula*/src --include='*.ts' -l
```

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`RENDER-*`). Tous les items de `material-graph.md` prennent `status: vision`.
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 13 : Lot Core (ECS + Scheduling)

**Sections sources :** `## Core` → `### ECS (Nexus)` et `### Scheduling` (6 puces).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Core/,/^## Gameplay — Entity/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
grep -rn 'Changed<\|archetype\|fixedDelta\|advanceFixed' packages/core/src packages/gameplay/src --include='*.ts' -l
```

La « Phase 3 (Physics dt) » de `core/scheduling.md` est déclarée pendante : confirmer par le code avant de la migrer.

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`CORE-*`)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 14 : Lot Gameplay A — hiérarchie, caméra, input

**Sections sources :** `## Gameplay — Entity hierarchy V2` (7), `## Gameplay — Caméra` (7 + 2), `## Gameplay — Input scripting` (8).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Gameplay — Entity hierarchy/,/^## Gameplay — Variables/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
grep -rn 'CameraManager\|screenToWorld\|TransformPropagationSystem\|InputActionMap' packages/gameplay/src packages/input/src --include='*.ts' -l
```

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`GAMEPLAY-*`)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 15 : Lot Gameplay B — scripting, prefab

**Sections sources :** `## Gameplay — Variables exposées de script` (5), `### Scripting — santé du code` , `## Gameplay — Modèle de composants de script` (3), `## Gameplay — Références d'entités` (5), `## Gameplay — Prefab` (2).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Gameplay — Variables/,/^## Debug/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
grep -rn 'registerScriptMetadata\|definePrefab\|Instantiator\|destroyEntityScripts' packages/gameplay/src --include='*.ts' -l
```

⚠️ Le backlog cite encore `@Expose`, **remplacé** par `registerScriptMetadata`. Tout item formulé en `@Expose` est soit reformulé, soit jeté — il ne peut pas être migré tel quel.

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`GAMEPLAY-*`)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 16 : Lot Gameplay C — tilemap, gizmos

**Sections sources :** `## Debug — Gizmos` (8), `## Gameplay — TileSet & TileMap` (10).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Debug — Gizmos/,/^## Audio/p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
ls packages/gizmos/src 2>/dev/null; grep -rn 'TileMapNode\|OccluderStrip\|ColliderGizmo\|borderWidth' packages --include='*.ts' -l
```

- [ ] **Step 3 : Tableau de tri, puis attendre la validation**
- [ ] **Step 4 : Écrire les notes** (`DEBUG-*`, `GAMEPLAY-*`)
- [ ] **Step 5 :** `pnpm docs:index`
- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 17 : Lot Audio, dette technique, app-local — et suppression de `docs/backlog.md`

**Sections sources :** `## Audio` (8), `## Dette technique`, `## Notes transverses`. Plus les items issus des designs app-local non implémentés (`apps/dino-brawl/docs/cleanup.md`, `tiled-bridge.md`, `spawn-prefab-sheet-cleanup.md`).

- [ ] **Step 1 : Extraire**

```bash
sed -n '/^## Audio/,$p' docs/backlog.md
```

- [ ] **Step 2 : Vérifier contre le code**

```bash
ls packages/audio/src 2>/dev/null; grep -rn 'AudioEngine\|AudioSource' packages --include='*.ts' -l
```

- [ ] **Step 3 : Traiter les items app-local**

Les 3 designs descendus en T7 sont « validés, non implémentés » : ils produisent de vrais items. Domaine `app`, et `source` en **lien markdown relatif** (hors du vault) :

```markdown
**Source :** [tiled-bridge](../../apps/dino-brawl/docs/tiled-bridge.md)
```

- [ ] **Step 4 : Tableau de tri, puis attendre la validation**
- [ ] **Step 5 : Écrire les notes** (`AUDIO-*`, `APP-*`)

- [ ] **Step 6 : Contrôle de complétude avant destruction**

```bash
grep -cE '^- |^\| [^-|]' docs/backlog.md
ls docs/backlog/*.md | grep -v '_index' | wc -l
```

Le second compte doit être d'environ **55**. Un écart marqué à la baisse signale des items perdus en route : reprendre le lot concerné **avant** le step 7.

- [ ] **Step 7 : Supprimer l'ancien backlog**

```bash
git rm docs/backlog.md
```

- [ ] **Step 8 : Réparer les renvois**

```bash
grep -rn 'backlog\.md' docs apps packages CLAUDE.md --include='*.md' | grep -v 'docs/plans/'
```

Chaque renvoi est repointé vers `docs/backlog/` ou `docs/backlog/_index.md`.

- [ ] **Step 9 :** `pnpm docs:index`
- [ ] **Step 10 : Arrêt pour revue et commit utilisateur**

---

## Task 18 : `docs/README.md` et dégraissage du `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`
- Regenerate: `docs/README.md`

`CLAUDE.md` porte 31 descriptions de docs. C'est ce mécanisme qui a produit 19 orphelins : un index tenu à la main dérive dès qu'un fichier est ajouté.

- [ ] **Step 1 : Régénérer l'index**

```bash
pnpm docs:index && head -30 docs/README.md
```

- [ ] **Step 2 : Vérifier qu'aucun doc n'est orphelin**

```bash
for f in $(find docs -name '*.md' ! -path 'docs/plans/*' ! -name 'README.md' ! -path 'docs/backlog/*'); do grep -q "$(basename $f)" docs/README.md || echo "ORPHELIN: $f"; done
```

Attendu : **aucune sortie**. C'est le critère de succès n°2 de la spec.

- [ ] **Step 3 : Remplacer les sections d'index du `CLAUDE.md`**

Supprimer les sections `### docs/rendering/`, `### docs/core/`, `### docs/gameplay/`, `### docs/assets/`, `### docs/debug/` et leurs listes. Les remplacer par :

```markdown
### `docs/`

Documents de design transverses et décisions d'architecture, rangés par domaine.

**L'index à jour est [`docs/README.md`](docs/README.md)** — il est régénéré par `pnpm docs:index`, ne le maintiens pas à la main ici.

**Tout ce qui reste à faire vit dans [`docs/backlog/`](docs/backlog/)** — une note par item, avec statut et date de vérification. Consulte-le avant d'entreprendre un changement : le design est peut-être déjà validé et en attente d'implémentation.

Les plans d'implémentation en cours vivent dans `docs/plans/` et sont **transitoires** : `/atlas-done` les supprime à la clôture de la feature.
```

- [ ] **Step 4 : Mesurer le dégraissage**

```bash
wc -l CLAUDE.md && grep -c 'docs/' CLAUDE.md
```

Attendu : un compte de renvois `docs/` **très inférieur à 31** (une poignée).

- [ ] **Step 5 : Vérifier qu'aucune instruction non-index n'a été perdue**

```bash
git diff CLAUDE.md | grep '^-' | grep -viE 'docs/(rendering|core|gameplay|assets|debug)|^\-\-\-|implémenté|design' | head -20
```

Relire chaque ligne supprimée qui n'est pas une description de doc. Les *AI Agent Guidelines* et les conventions de travail doivent rester intactes.

- [ ] **Step 6 : Arrêt pour revue et commit utilisateur**

---

## Task 19 : Obsidian — vault, vue, `.gitignore`

**Files:**
- Create: `docs/backlog/backlog.base`
- Modify: `.gitignore`

- [ ] **Step 1 : Ignorer l'état d'interface personnel**

Ajouter à `.gitignore` :

```
# Obsidian : etat d'interface personnel (le reste de .obsidian/ est versionne)
docs/.obsidian/workspace.json
docs/.obsidian/workspace-mobile.json
docs/.obsidian/cache
```

- [ ] **Step 2 : Créer la vue**

`docs/backlog/backlog.base` :

```yaml
filters:
  and:
    - file.inFolder("backlog")
    - status != null
views:
  - type: table
    name: Par statut
    order:
      - status
      - domain
      - id
    columns:
      - id
      - status
      - domain
      - effort
      - verified
```

- [ ] **Step 3 : Vérification utilisateur — requise**

⚠️ Le format `.base` d'Obsidian est récent et je ne peux pas le valider hors de l'application. **Demander à l'utilisateur d'ouvrir `docs/` comme vault et de confirmer que la vue s'affiche.** Si Obsidian rejette le fichier, corriger la syntaxe selon le message d'erreur, ou supprimer le `.base` : `_index.md` reste le mécanisme d'index principal et fonctionne sans lui.

- [ ] **Step 4 : Vérifier que l'état personnel est bien ignoré**

```bash
git status --short docs/.obsidian/ 2>/dev/null || echo "pas encore de .obsidian/"
```

Après ouverture du vault par l'utilisateur, `workspace.json` ne doit pas apparaître.

- [ ] **Step 5 : Supprimer ce plan**

Le chantier est terminé : le plan est transitoire, comme tout plan de `docs/plans/`. C'est le premier usage réel de la convention posée en T6.

```bash
rm docs/plans/2026-08-19-docs-reorganisation-plan.md
node .claude/hooks/plan-reminder.mjs; echo "exit=$?"
```

Attendu : **aucune sortie**, `exit=0` — le rappel s'est éteint tout seul.

- [ ] **Step 6 : Contrôle final des 6 critères de succès**

```bash
echo "1. Volume :" && find docs -name '*.md' -exec wc -l {} + | tail -1
echo "2. Orphelins :" && for f in $(find docs -name '*.md' ! -name 'README.md' ! -path 'docs/backlog/*'); do grep -q "$(basename $f)" docs/README.md || echo "  ORPHELIN $f"; done
echo "3. Hook WGSL :" && test -f .claude/hooks/wgsl-rebuild.mjs && echo "  OK"
echo "4. Notes sans verified :" && grep -L 'verified:' docs/backlog/*.md | grep -v _index || echo "  aucune"
echo "5. Renvois docs dans CLAUDE.md :" && grep -c 'docs/' CLAUDE.md
echo "6. Prettier ne touche plus les docs :" && pnpm exec prettier --check "docs/**/*.md"
```

Attendus : **(1)** < 10 000 lignes · **(2)** aucun orphelin · **(3)** `OK` · **(4)** `aucune` · **(5)** une poignée · **(6)** `All matched files use Prettier code style!`

- [ ] **Step 7 : Arrêt pour revue et commit utilisateur**
