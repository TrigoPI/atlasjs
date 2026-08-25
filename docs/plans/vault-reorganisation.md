# Réorganisation du vault `memory/atlas` — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déplacer `docs/` en `memory/atlas/` (vault Obsidian nommé), remplacer les deux index générés par des fichiers Bases, et rapatrier la mémoire agent dans le vault avec un hook `SessionStart`.

**Architecture :** Le déplacement est fait par `git mv` (historique préservé, structure interne identique donc liens relatifs internes intacts). Un vérificateur de liens écrit **avant** le déplacement sert de filet : on relève une empreinte des liens morts avant, et on exige la même après. Les Bases sont introduites avant la suppression du générateur, pour qu'aucun commit ne laisse le dépôt sans index.

**Tech Stack :** Node 26 (ESM, `node:test`), Obsidian Bases (fichiers `.base`, YAML), hooks Claude Code (`.claude/settings.json`), `graphify`.

## Global Constraints

- **Spec de référence :** `docs/vault.md` (deviendra `memory/atlas/vault.md` en Task 2).
- **Racine du vault : `memory/atlas/`** — `.obsidian/` y vit. `memory/` n'est qu'un dossier conteneur.
- **Ne rien commiter automatiquement.** Chaque task se termine par un commit **proposé** à l'utilisateur, qui relit et commite lui-même. Cf. `CLAUDE.md` racine.
- **Les `.md` du vault ne sont pas maintenus par prettier** (`.prettierignore` contient `/docs/`, qui devient `/memory/`). Ne jamais reformater un doc existant : éditions sémantiques uniquement.
- **Les IDs de backlog sont conservés.** Aucune note de `backlog/` n'est renommée, aucun frontmatter de backlog n'est modifié.
- **Ne pas toucher au `README.md` de la racine du dépôt** : c'est le boilerplate Turborepo, ses occurrences de « docs » désignent une app Next.js d'exemple, pas ce vault.
- **Ne pas toucher à `.claude/settings.local.json`** : ses chemins `docs/` sont un cache d'autorisations historique, inerte.
- **Vocabulaire de statut inchangé** : backlog `todo` / `partial` / `vision` ; docs de design `implemented` / `partial` / `planned`.
- **Ne rien inventer.** Un champ dont la valeur n'est pas connue (`shipped` d'un doc qui ne donne pas de date) est **omis**, jamais deviné.

---

### Task 1 : Vérificateur de liens du vault

Filet de sécurité du déplacement. Écrit **avant** de bouger quoi que ce soit, pour pouvoir comparer avant/après.

**Files:**
- Create: `scripts/check-vault-links.mjs`
- Test: `scripts/check-vault-links.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `checkLinks(vaultDir): Array<{file: string, target: string, kind: "relative" | "wikilink"}>`, seul symbole importé par le test ; `listFiles(dir): string[]` est exporté pour l'usage interne du CLI. CLI : `node scripts/check-vault-links.mjs <vaultDir>`, sortie 1 s'il existe au moins un lien mort.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `scripts/check-vault-links.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLinks } from "./check-vault-links.mjs";

function makeVault(files) {
  const root = mkdtempSync(join(tmpdir(), "vault-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("signale un lien relatif mort", () => {
  const root = makeVault({ "a/one.md": "voir [deux](../b/two.md)" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "relative");
  assert.equal(dead[0].target, "../b/two.md");
});

test("accepte un lien relatif valide, ancre comprise", () => {
  const root = makeVault({
    "a/one.md": "voir [deux](../b/two.md#section)",
    "b/two.md": "# Deux",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("accepte un lien relatif vers un dossier", () => {
  const root = makeVault({ "a/one.md": "voir [b](../b/)", "b/two.md": "x" });
  assert.deepEqual(checkLinks(root), []);
});

test("signale un wikilink mort", () => {
  const root = makeVault({ "a/one.md": "voir [[trois]]" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "wikilink");
  assert.equal(dead[0].target, "trois");
});

test("resout un wikilink par nom de base, avec alias et ancre", () => {
  const root = makeVault({
    "a/one.md": "[[two|Deux]] et [[two#Section]] et [[two.md]]",
    "b/two.md": "# Deux",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("resout un wikilink vers un fichier non-markdown du vault", () => {
  const root = makeVault({ "a/one.md": "[[backlog.base]]", "backlog.base": "views: []" });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore les URL externes et les ancres pures", () => {
  const root = makeVault({
    "a/one.md": "[web](https://example.com) [mail](mailto:x@y.z) [anchor](#section)",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("suit une cible qui sort du vault", () => {
  const root = makeVault({ "a/one.md": "[code](../../nulle-part.ts)" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "relative");
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
node --test scripts/check-vault-links.test.mjs
```

Attendu : ÉCHEC — `Cannot find module '.../check-vault-links.mjs'`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `scripts/check-vault-links.mjs` :

```js
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

const RELATIVE_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKILINK = /\[\[([^\]]+)\]\]/g;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#)/i;

export function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function wikilinkTarget(raw) {
  return raw.split("|")[0].split("#")[0].trim();
}

export function checkLinks(vaultDir) {
  const files = listFiles(vaultDir);
  const known = new Set();
  for (const file of files) {
    const name = basename(file);
    known.add(name);
    if (name.endsWith(".md")) known.add(name.slice(0, -3));
  }

  const dead = [];
  for (const file of files.filter((name) => name.endsWith(".md"))) {
    const text = readFileSync(file, "utf8");

    for (const [, target] of text.matchAll(RELATIVE_LINK)) {
      if (EXTERNAL.test(target)) continue;
      const path = decodeURI(target.split("#")[0]);
      if (!path) continue;
      if (!existsSync(resolve(dirname(file), path))) {
        dead.push({ file, target, kind: "relative" });
      }
    }

    for (const [, raw] of text.matchAll(WIKILINK)) {
      const target = wikilinkTarget(raw);
      if (!target) continue;
      if (!known.has(target)) dead.push({ file, target, kind: "wikilink" });
    }
  }
  return dead;
}

function main() {
  const vaultDir = process.argv[2] ?? "memory/atlas";
  const dead = checkLinks(vaultDir);
  for (const entry of dead) {
    console.log(`${entry.file} — ${entry.kind} mort : ${entry.target}`);
  }
  console.log(`check-vault-links — ${dead.length} lien(s) mort(s) dans ${vaultDir}`);
  process.exitCode = dead.length > 0 ? 1 : 0;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
```

- [ ] **Step 4 : Lancer le test pour le voir passer**

```bash
node --test scripts/check-vault-links.test.mjs
```

Attendu : `pass 8`, `fail 0`.

- [ ] **Step 5 : Relever l'empreinte AVANT déplacement**

```bash
node scripts/check-vault-links.mjs docs | tee $TMPDIR/vault-links-avant.txt
```

Le nombre peut être **non nul** — le vault n'a jamais été vérifié. **Ne rien corriger ici.** Ce fichier est la référence : après le déplacement, la liste devra être identique aux chemins près. Reporter le nombre exact dans le message de commit.

- [ ] **Step 6 : Commit (à proposer à l'utilisateur)**

```bash
git add scripts/check-vault-links.mjs scripts/check-vault-links.test.mjs
git commit -m "chore(docs): add a vault link checker before moving docs/"
```

---

### Task 2 : Déplacement `docs/` → `memory/atlas/`

Purement mécanique. Aucun contenu de note n'est réécrit hors chemins.

**Files:**
- Move: `docs/` → `memory/atlas/` (`git mv`, `.obsidian/` suit)
- Modify: 4 fichiers du vault (liens `../../`), les fichiers du vault citant `` `docs/…` `` (72 occurrences), `CLAUDE.md`, `packages/{core,nebula,nebula-webgpu,input,gameplay}/CLAUDE.md`, `apps/dino-brawl/CLAUDE.md`, `.gitignore`, `.prettierignore`, `.claude/hooks/plan-reminder.mjs`, `.claude/commands/atlas-done.md`, `scripts/backlog-index.mjs`

**Interfaces:**
- Consumes: `scripts/check-vault-links.mjs` (Task 1) et `$TMPDIR/vault-links-avant.txt`.
- Produces: le vault à `memory/atlas/`. Toutes les tasks suivantes travaillent sous ce chemin.

- [ ] **Step 1 : Déplacer**

```bash
mkdir -p memory && git mv docs memory/atlas && git status --short | head
```

Attendu : des lignes `R  docs/... -> memory/atlas/...`. Vérifier que `memory/atlas/.obsidian/` existe.

- [ ] **Step 2 : Re-profonder les 11 liens qui sortent du vault**

Ces liens montaient de 2 niveaux vers la racine du dépôt ; il leur en faut 3 désormais.

```bash
grep -rl '](\.\./\.\./' memory/atlas --include='*.md' | xargs sed -i '' 's#](\.\./\.\./#](../../../#g'
grep -rn '](\.\./\.\./\.\./' memory/atlas --include='*.md' | wc -l
```

Attendu : `11`.

- [ ] **Step 3 : Réécrire les mentions `docs/` internes au vault**

```bash
grep -rl '`docs/' memory/atlas --include='*.md' | xargs sed -i '' 's#`docs/#`memory/atlas/#g'
grep -rn '`docs/' memory/atlas --include='*.md' | wc -l
```

Attendu : `0`.

- [ ] **Step 4 : Réécrire les références externes**

```bash
sed -i '' 's#`docs/#`memory/atlas/#g; s#docs/README\.md#memory/atlas/README.md#g; s#(docs/#(memory/atlas/#g; s#docs/backlog/#memory/atlas/backlog/#g; s#docs/plans/#memory/atlas/plans/#g' \
  CLAUDE.md packages/core/CLAUDE.md packages/nebula/CLAUDE.md packages/nebula-webgpu/CLAUDE.md packages/input/CLAUDE.md packages/gameplay/CLAUDE.md apps/dino-brawl/CLAUDE.md .claude/commands/atlas-done.md
sed -i '' 's#^docs/\.obsidian#memory/atlas/.obsidian#' .gitignore
sed -i '' 's#^/docs/#/memory/#' .prettierignore
sed -i '' 's#join(repoRoot, "docs", "plans")#join(repoRoot, "memory", "atlas", "plans")#; s#docs/plans/#memory/atlas/plans/#' .claude/hooks/plan-reminder.mjs
sed -i '' 's#const BACKLOG_DIR = "docs/backlog";#const BACKLOG_DIR = "memory/atlas/backlog";#; s#const DOCS_DIR = "docs";#const DOCS_DIR = "memory/atlas";#' scripts/backlog-index.mjs
```

Puis relire chaque diff à l'œil (`git diff CLAUDE.md .gitignore .prettierignore .claude/`) et corriger à la main tout `docs/` restant qui désigne ce vault. **Laisser intacts** les `docs/` de `README.md` racine (boilerplate Turborepo), de `.claude/settings.local.json`, et `apps/dino-brawl/docs/` (hors vault, volontairement).

- [ ] **Step 5 : Vérifier que le générateur tourne toujours sur les nouveaux chemins**

```bash
pnpm docs:index && git diff --stat memory/atlas/README.md memory/atlas/backlog/_index.md
```

Attendu : la commande affiche `docs:index — 140 items de backlog, README régénéré.` et le diff est **vide ou limité aux chemins**. Un diff de contenu signifie qu'une note a été abîmée par un `sed` — s'arrêter et corriger.

- [ ] **Step 6 : Vérifier les liens contre l'empreinte**

```bash
node scripts/check-vault-links.mjs memory/atlas > $TMPDIR/vault-links-apres.txt; \
diff <(sed 's#^docs/##' $TMPDIR/vault-links-avant.txt) <(sed 's#^memory/atlas/##' $TMPDIR/vault-links-apres.txt)
```

Attendu : **aucune différence**. Toute ligne en `>` est un lien cassé par le déplacement — le réparer avant de continuer. Toute ligne en `<` est un lien réparé par accident : vérifier que ce n'est pas un faux positif du `sed`.

- [ ] **Step 7 : Commit (à proposer à l'utilisateur)**

```bash
git add -A
git commit -m "refactor(docs): move docs/ to the memory/atlas vault"
```

---

### Task 3 : `backlog.base`

**Files:**
- Create: `memory/atlas/backlog.base`

**Interfaces:**
- Consumes: le frontmatter des notes de `memory/atlas/backlog/` — `id`, `status` (`todo`/`partial`/`vision`), `domain` (`app`/`assets`/`audio`/`core`/`debug`/`gameplay`/`physics`/`rendering`), `effort` (`S`/`M`/`L`), `verified` (`AAAA-MM-JJ`).
- Produces: rien que d'autres tasks consomment ; la Task 5 retirera la clause d'exclusion de `_index.md` devenue inutile.

- [ ] **Step 1 : Écrire le fichier**

Créer `memory/atlas/backlog.base` :

```yaml
filters:
  and:
    - file.inFolder("backlog")
    - not:
        - 'file.name == "_index.md"'

formulas:
  staleness: 'if(verified, (today() - date(verified)).days, "")'

properties:
  id:
    displayName: "ID"
  status:
    displayName: "Statut"
  domain:
    displayName: "Domaine"
  effort:
    displayName: "Effort"
  verified:
    displayName: "Vérifié"
  formula.staleness:
    displayName: "Jours depuis vérif."

views:
  - type: table
    name: "Par domaine"
    groupBy:
      property: domain
      direction: ASC
    order:
      - id
      - file.name
      - status
      - effort
      - verified

  - type: table
    name: "À faire"
    filters:
      and:
        - 'status == "todo"'
    groupBy:
      property: effort
      direction: ASC
    order:
      - id
      - file.name
      - domain
      - verified

  - type: table
    name: "Vision"
    filters:
      and:
        - 'status == "vision"'
    groupBy:
      property: domain
      direction: ASC
    order:
      - id
      - file.name
      - effort
      - verified

  - type: table
    name: "Périmés"
    filters:
      and:
        - 'if(verified, (today() - date(verified)).days > 90, true)'
    order:
      - id
      - file.name
      - domain
      - status
      - verified
      - formula.staleness
```

- [ ] **Step 2 : Valider le YAML**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('memory/atlas/backlog.base')); print('vues:', [v['name'] for v in d['views']])"
```

Attendu : `vues: ['Par domaine', 'À faire', 'Vision', 'Périmés']`.

- [ ] **Step 3 : Vérifier que le vocabulaire du filtre correspond aux données**

```bash
grep -h '^status:' memory/atlas/backlog/*.md | sort | uniq -c
grep -h '^domain:' memory/atlas/backlog/*.md | sort | uniq -c
grep -h '^effort:' memory/atlas/backlog/*.md | sort | uniq -c
```

Attendu : uniquement `todo`/`partial`/`vision`, les 8 domaines listés plus haut, et `S`/`M`/`L`. Toute valeur hors vocabulaire signifie une note à corriger **ou** un filtre à élargir — le signaler, ne pas corriger en silence.

- [ ] **Step 4 : Faire ouvrir la Base dans Obsidian**

Demander à l'utilisateur d'ouvrir `backlog.base` et de confirmer que les quatre vues s'affichent et ne sont pas vides. **Cette étape ne peut pas être faite par l'agent** : rien hors d'Obsidian ne rend un `.base`. Ne pas déclarer la task terminée sur la seule validité du YAML.

- [ ] **Step 5 : Commit (à proposer à l'utilisateur)**

```bash
git add memory/atlas/backlog.base
git commit -m "feat(docs): add an Obsidian Base view over the backlog"
```

---

### Task 4 : Statut en frontmatter sur les docs de design + `design-docs.base`

La seule task qui demande du jugement plutôt que de la mécanique.

**Files:**
- Modify: les 31 docs de design de `memory/atlas/{assets,core,debug,gameplay,physics,rendering}/`
- Create: `memory/atlas/design-docs.base`

**Interfaces:**
- Consumes: la ligne prose `> Statut : …` en tête de chaque doc.
- Produces: frontmatter `status` / `shipped?` / `summary` sur chaque doc, lu par `design-docs.base` et, à partir de la Task 5, par le `README.md` écrit à la main.

- [ ] **Step 1 : Ajouter le frontmatter, doc par doc**

Chaque doc reçoit **en tête de fichier**, avant le titre :

```yaml
---
status: implemented
shipped: 2026-08-23
summary: "Une phrase, 120 caractères maximum, sans lien markdown."
---
```

Règles, sans exception :
- `status` — `implemented` pour les 30 docs dont la ligne prose dit « implémenté » ; `planned` pour `rendering/material-graph.md` seul (« design cadré, non implémenté »). Aucun doc n'est `partial` aujourd'hui ; la valeur existe pour la suite.
- `shipped` — **uniquement** si le doc donne une date explicite. Connus : `rendering/trails.md` → `2026-08-23`, `rendering/afterimages.md` → `2026-08-24`. Pour tous les autres, **omettre le champ**. Ne pas aller chercher une date dans `git log` : la date de commit n'est pas la date de livraison annoncée par le doc.
- `summary` — dérivé de la ligne prose existante, réduit à l'essentiel, entre guillemets doubles. Ne rien affirmer que la ligne prose n'affirme pas.
- **La ligne prose `> Statut : …` reste dans le corps, inchangée.** Elle porte la nuance (portée livrée, branche, hors-périmètre) ; le frontmatter ne la remplace pas, il la rend interrogeable.
- Ne rien reformater d'autre dans ces fichiers.

Exemple travaillé, `rendering/trails.md`. Ligne prose existante :

> `> Statut : **implémenté** (design validé et livré le 2026-08-23, mergé dans \`dev\`).`

Frontmatter à écrire, la ligne prose restant en place, inchangée :

```yaml
---
status: implemented
shipped: 2026-08-23
summary: "Ribbon de trail livré et mergé dans dev."
---
```

Contre-exemple, `gameplay/camera.md` : sa ligne prose ne donne **aucune** date, donc pas de champ `shipped`.

Liste exhaustive des 31 fichiers :

```
assets/asset-system.md
core/nexus-ecs.md
core/scheduling.md
debug/gizmos.md
gameplay/animation-events.md
gameplay/audio-variation.md
gameplay/audio.md
gameplay/camera.md
gameplay/entity-hierarchy.md
gameplay/exposed-script-variables.md
gameplay/gameplay-redesign.md
gameplay/input-scripting.md
gameplay/occluder-ysort.md
gameplay/prefab-multi-entity.md
gameplay/prefab.md
gameplay/scripting-components.md
gameplay/sprite-animation.md
gameplay/tilemap.md
gameplay/weapon-attack-cues.md
physics/character-controller.md
physics/collision-layer.md
rendering/afterimages.md
rendering/canvas-resize.md
rendering/material-graph.md
rendering/renderer-architecture.md
rendering/shaders-materials.md
rendering/shapes.md
rendering/sort-point-anchor.md
rendering/sorting-layers.md
rendering/sprites.md
rendering/trails.md
```

`memory/atlas/vault.md` a déjà son frontmatter (`status: planned`) et n'est pas dans cette liste.

- [ ] **Step 2 : Vérifier la couverture**

```bash
for f in $(find memory/atlas -name '*.md' -not -path '*/backlog/*' -not -path '*/plans/*' -not -name 'README.md' | sort); do
  head -1 "$f" | grep -q '^---$' || echo "SANS FRONTMATTER: $f"
done
grep -h '^status:' $(find memory/atlas -name '*.md' -not -path '*/backlog/*' -not -path '*/plans/*') | sort | uniq -c
```

Attendu : aucune ligne `SANS FRONTMATTER`. Le décompte porte sur 32 fichiers (les 31 docs de design + `vault.md`) et doit donner exactement **30 `implemented`** et **2 `planned`** — les deux `planned` étant `rendering/material-graph.md` et `vault.md`.

- [ ] **Step 3 : Écrire `design-docs.base`**

```yaml
filters:
  and:
    - 'file.ext == "md"'
    - not:
        - file.inFolder("backlog")
    - not:
        - file.inFolder("plans")
    - not:
        - file.inFolder("claude")
    - not:
        - 'file.name == "README.md"'

properties:
  status:
    displayName: "Statut"
  shipped:
    displayName: "Livré"
  summary:
    displayName: "Résumé"

views:
  - type: table
    name: "Par domaine"
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - file.name
      - status
      - shipped
      - summary

  - type: table
    name: "Non implémentés"
    filters:
      and:
        - 'status != "implemented"'
    order:
      - file.name
      - status
      - summary
```

- [ ] **Step 4 : Valider le YAML et faire ouvrir la Base**

```bash
python3 -c "import yaml; d=yaml.safe_load(open('memory/atlas/design-docs.base')); print('vues:', [v['name'] for v in d['views']])"
```

Attendu : `vues: ['Par domaine', 'Non implémentés']`. Puis demander à l'utilisateur de l'ouvrir dans Obsidian et de confirmer que « Non implémentés » ne contient que `material-graph.md` et `vault.md`.

- [ ] **Step 5 : Commit (à proposer à l'utilisateur)**

```bash
git add memory/atlas
git commit -m "feat(docs): promote design-doc status to frontmatter and add a Base view"
```

---

### Task 5 : `README.md` écrit à la main, suppression du générateur

**Files:**
- Modify: `memory/atlas/README.md` (cesse d'être généré), `memory/atlas/backlog.base`, `package.json`, `.claude/commands/atlas-done.md`
- Delete: `memory/atlas/backlog/_index.md`, `scripts/backlog-index.mjs`, `scripts/backlog-index.test.mjs`, `scripts/lib/frontmatter.mjs`, `scripts/lib/frontmatter.test.mjs`

**Interfaces:**
- Consumes: `backlog.base` (Task 3) et `design-docs.base` (Task 4) — les deux doivent exister avant cette task, sinon le dépôt se retrouve sans index.
- Produces: `/atlas-done` sans étape de régénération.

- [ ] **Step 1 : Lancer une dernière fois les tests qu'on va supprimer**

```bash
node --test scripts/
```

Attendu : vert. **Important :** `pnpm test` (`turbo run test`) ne parcourt que les packages et n'a **jamais** exécuté ces fichiers — leur suppression lui est invisible et ne prouve rien. C'est cette commande-ci qui atteste qu'on ne jette pas du rouge sous le tapis. Si elle est rouge, s'arrêter et le signaler.

- [ ] **Step 2 : Écrire le `README.md` à la main**

Remplacer intégralement `memory/atlas/README.md` par :

```markdown
# Vault `atlas`

Décisions d'architecture, designs, backlog et mémoire agent du moteur AtlasJS.
Ce fichier est écrit **à la main** — il n'est plus généré.

## Par où entrer

| | |
| --- | --- |
| [`backlog.base`](backlog.base) | Ce qui reste à faire, par domaine, par effort, et ce qui n'a pas été revérifié depuis longtemps |
| [`design-docs.base`](design-docs.base) | Les docs de design et leur statut |
| [`claude-memory.base`](claude-memory.base) | Ce que Claude retient de ce projet |
| [`vault.md`](vault.md) | Le design de ce vault lui-même |

## Domaines

`assets/` · `core/` · `debug/` · `gameplay/` · `physics/` · `rendering/`

Un doc de design par système, avec son statut en frontmatter et sa portée réelle
dans la ligne `> Statut :` en tête de corps.

## Conventions

- **Le backlog vit dans `backlog/`**, une note par item, `<ID>-<slug>.md`. Les IDs
  ne se réutilisent jamais, même après suppression d'une note. Pas de statut `done` :
  un item terminé quitte le backlog.
- **Les plans vivent dans `plans/`** et sont transitoires — `/atlas-done` les supprime
  à la clôture d'une feature.
- **`claude/` est la mémoire agent**, versionnée pour être relisable et corrigeable.
- **Rien n'est généré ici.** Les vues sont des Bases, calculées à l'ouverture.
- Ces `.md` ne sont pas maintenus par prettier : éditions sémantiques uniquement.
```

- [ ] **Step 3 : Supprimer le générateur et l'index généré**

```bash
git rm memory/atlas/backlog/_index.md scripts/backlog-index.mjs scripts/backlog-index.test.mjs scripts/lib/frontmatter.mjs scripts/lib/frontmatter.test.mjs
rmdir scripts/lib 2>/dev/null || true
```

Puis retirer la ligne `"docs:index": "node scripts/backlog-index.mjs"` de `package.json` (et la virgule de la ligne précédente).

- [ ] **Step 4 : Retirer la clause devenue inutile de `backlog.base`**

`_index.md` n'existe plus. Supprimer de `memory/atlas/backlog.base` :

```yaml
    - not:
        - 'file.name == "_index.md"'
```

Le bloc `filters` se réduit à :

```yaml
filters:
  and:
    - file.inFolder("backlog")
```

- [ ] **Step 5 : Mettre `/atlas-done` à jour**

Dans `.claude/commands/atlas-done.md` :
- Remplacer l'étape 7 (« **Régénérer les index** : `pnpm docs:index` ») par : « **Vérifier les liens** : `node scripts/check-vault-links.mjs memory/atlas`. Aucun lien mort ne doit apparaître. Il n'y a plus d'index à régénérer — `backlog.base` est calculé à l'ouverture. » Renuméroter les étapes suivantes.
- Dans l'étape 4, remplacer « Vérifie ce qui est déjà pris dans `memory/atlas/backlog/` » par une commande exacte : ``Vérifie les IDs déjà pris : `grep -h '^id:' memory/atlas/backlog/*.md | sort`. Aucun identifiant ne se réutilise, même si sa note a été supprimée.``
- Dans l'étape 3, ajouter : « Mettre à jour **le frontmatter** du doc (`status`, `shipped`, `summary`) **et** la ligne prose `> Statut :`. Les deux doivent raconter la même chose. »

- [ ] **Step 6 : Vérifier**

```bash
node scripts/check-vault-links.mjs memory/atlas
git grep -n "docs:index" -- . ':!memory' || echo "aucune reference residuelle a docs:index"
python3 -c "import yaml; yaml.safe_load(open('memory/atlas/backlog.base')); print('backlog.base OK')"
```

Attendu : aucun lien mort (le `README.md` référence trois `.base` qui doivent tous exister — `claude-memory.base` n'arrive qu'en Task 6, **donc un lien mort vers `claude-memory.base` est attendu ici** ; le noter et le lever en Task 6). Aucune référence résiduelle à `docs:index`. YAML valide.

- [ ] **Step 7 : Commit (à proposer à l'utilisateur)**

```bash
git add -A
git commit -m "refactor(docs): replace the generated indexes with hand-written entry points"
```

---

### Task 6 : Rapatrier la mémoire agent dans le vault

**Files:**
- Create: `memory/atlas/claude/index.md` + 16 notes, `memory/atlas/claude-memory.base`
- Source (lecture seule à cette étape) : `~/.claude/projects/-Users-AlexisEnSah-Desktop-Node-atlas/memory/`

**Interfaces:**
- Consumes: les 17 fichiers du dossier source.
- Produces: `memory/atlas/claude/index.md`, lu par le hook de la Task 7.

- [ ] **Step 1 : Copier les notes**

```bash
SRC=~/.claude/projects/-Users-AlexisEnSah-Desktop-Node-atlas/memory
mkdir -p memory/atlas/claude
cp $SRC/*.md memory/atlas/claude/
git mv memory/atlas/claude/MEMORY.md memory/atlas/claude/index.md 2>/dev/null || mv memory/atlas/claude/MEMORY.md memory/atlas/claude/index.md
ls memory/atlas/claude | wc -l
```

Attendu : `17`. **Copier, pas déplacer** : le dossier source n'est vidé qu'en Task 7, une fois ces copies commitées.

- [ ] **Step 2 : Aplatir le frontmatter des 16 notes**

Chaque note porte aujourd'hui :

```yaml
---
name: dino-brawl-typecheck-command
description: "…"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 39f1fdab-…
  modified: 2026-08-18T11:01:31.839Z
---
```

Le remplacer par :

```yaml
---
name: dino-brawl-typecheck-command
description: "…"
type: reference
modified: 2026-08-18
---
```

- `type` — remonté de `metadata.type`, valeurs `user` / `feedback` / `project` / `reference`. Bases ne lit pas commodément un bloc imbriqué ; c'est la seule raison de cette transformation.
- `modified` — remonté de `metadata.modified`, **tronqué au jour**. Si le champ est absent de la note source, **omettre** — ne pas prendre la mtime du fichier, qui est la date de la copie.
- `node_type` et `originSessionId` sont supprimés : internes au harness, sans objet dans un dépôt.
- **Le corps des notes n'est pas touché.** Elles utilisent déjà des `[[wikilinks]]`, qui résolvent dans le vault.

- [ ] **Step 3 : Convertir `index.md` en carte du vault**

`index.md` contient aujourd'hui des lignes `- [Titre](fichier.md) — accroche`. Convertir chaque lien en wikilink et ajouter un en-tête :

```markdown
# Mémoire de Claude sur AtlasJS

Ce que Claude retient de ce projet, une note par fait. Chargé au démarrage de
chaque session par `.claude/hooks/claude-memory.mjs` — **cette page seule**, pas
les notes, qui sont lues à la demande.

Corrige librement : une note fausse ici vaut une erreur répétée à chaque session.

- [[execution-cadence-preference]] — subagent-driven, une tâche à la fois, l'utilisateur commite chaque étape
- [[dino-brawl-typecheck-command]] — un `tsc --noEmit` nu dans l'app est un NO-OP ; exiger `-p tsconfig.app.json`
- [[vite-type-only-imports]] — les fichiers d'app doivent `import type` les symboles de type ; tsc passe, Vite casse
```

Une ligne par note, dans l'ordre du fichier source.

Reprendre les accroches existantes telles quelles ; ne réécrire que la syntaxe du lien.

- [ ] **Step 4 : Écrire `memory/atlas/claude-memory.base`**

```yaml
filters:
  and:
    - file.inFolder("claude")
    - not:
        - 'file.name == "index.md"'

properties:
  type:
    displayName: "Type"
  description:
    displayName: "Fait retenu"
  modified:
    displayName: "Écrit le"

views:
  - type: table
    name: "Par type"
    groupBy:
      property: type
      direction: ASC
    order:
      - file.name
      - description
      - modified

  - type: table
    name: "Tout"
    order:
      - file.name
      - type
      - description
      - modified
```

- [ ] **Step 5 : Vérifier**

```bash
python3 -c "import yaml; d=yaml.safe_load(open('memory/atlas/claude-memory.base')); print('vues:', [v['name'] for v in d['views']])"
grep -L '^type:' memory/atlas/claude/*.md | grep -v index.md || echo "toutes les notes ont un type"
grep -rn 'metadata:' memory/atlas/claude/ || echo "aucun frontmatter imbrique residuel"
node scripts/check-vault-links.mjs memory/atlas
```

Attendu : deux vues ; toutes les notes typées ; aucun `metadata:` résiduel ; **zéro lien mort** — le lien vers `claude-memory.base` laissé pendant en Task 5 est levé ici. Faire ouvrir la Base dans Obsidian.

- [ ] **Step 6 : Commit (à proposer à l'utilisateur)**

```bash
git add memory/atlas/claude memory/atlas/claude-memory.base
git commit -m "feat(docs): bring the agent memory into the vault"
```

---

### Task 7 : Hook `SessionStart` et bascule de la mémoire

**Ne commencer que si le commit de la Task 6 est fait.** Cette task supprime les originaux hors dépôt ; ils ne doivent exister nulle part ailleurs qu'en copie **commitée**.

**Files:**
- Create: `.claude/hooks/claude-memory.mjs`, `.claude/hooks/claude-memory.test.mjs`
- Modify: `.claude/settings.json`, `CLAUDE.md`
- Delete (hors dépôt) : les 16 notes de `~/.claude/projects/-Users-AlexisEnSah-Desktop-Node-atlas/memory/`, `MEMORY.md` remplacé par un pointeur

**Interfaces:**
- Consumes: `memory/atlas/claude/index.md` (Task 6).
- Produces: `renderMemory(repoRoot): string | null`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `.claude/hooks/claude-memory.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderMemory } from "./claude-memory.mjs";

test("renvoie null quand le vault n'a pas de memoire", () => {
  assert.equal(renderMemory(mkdtempSync(join(tmpdir(), "repo-"))), null);
});

test("renvoie le contenu de l'index quand il existe", () => {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  mkdirSync(join(root, "memory/atlas/claude"), { recursive: true });
  writeFileSync(join(root, "memory/atlas/claude/index.md"), "# Mémoire\n\n- [[une-note]] — accroche\n");
  const out = renderMemory(root);
  assert.match(out, /\[\[une-note\]\]/);
  assert.match(out, /memory\/atlas\/claude\//);
});

test("n'inclut jamais le corps des notes voisines", () => {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  mkdirSync(join(root, "memory/atlas/claude"), { recursive: true });
  writeFileSync(join(root, "memory/atlas/claude/index.md"), "- [[une-note]]\n");
  writeFileSync(join(root, "memory/atlas/claude/une-note.md"), "CORPS_QUI_NE_DOIT_PAS_SORTIR");
  assert.doesNotMatch(renderMemory(root), /CORPS_QUI_NE_DOIT_PAS_SORTIR/);
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
node --test .claude/hooks/claude-memory.test.mjs
```

Attendu : ÉCHEC — module introuvable.

- [ ] **Step 3 : Écrire le hook**

Créer `.claude/hooks/claude-memory.mjs` :

```js
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const INDEX = join("memory", "atlas", "claude", "index.md");

export function renderMemory(repoRoot) {
  const path = join(repoRoot, INDEX);
  if (!existsSync(path)) return null;
  return (
    `Mémoire de Claude sur ce projet (${INDEX}). Une ligne par note ; ` +
    `lire memory/atlas/claude/<nom>.md pour le détail avant d'agir dessus.\n\n` +
    readFileSync(path, "utf8").trim()
  );
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const output = renderMemory(repoRoot);
if (output) console.log(output);
```

- [ ] **Step 4 : Lancer le test pour le voir passer**

```bash
node --test .claude/hooks/claude-memory.test.mjs
```

Attendu : `pass 3`, `fail 0`.

- [ ] **Step 5 : Brancher le hook**

Dans `.claude/settings.json`, ajouter le hook à côté de `plan-reminder.mjs` :

```json
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/plan-reminder.mjs" },
          { "type": "command", "command": "node .claude/hooks/claude-memory.mjs" }
        ]
      }
    ]
```

- [ ] **Step 6 : Exécuter le hook pour de vrai**

```bash
node .claude/hooks/claude-memory.mjs | head -20
node .claude/hooks/claude-memory.mjs | wc -l
```

Attendu : l'en-tête suivi de la liste des notes. Le nombre de lignes doit rester de l'ordre de la vingtaine — s'il explose, le hook déverse autre chose que l'index et c'est un bug à corriger avant de continuer.

- [ ] **Step 7 : Vider la mémoire hors dépôt**

D'abord confirmer que les copies sont bien commitées :

```bash
git log --oneline -1 -- memory/atlas/claude
git status --short memory/atlas/claude
```

Attendu : un commit existe, aucune modification non commitée. **Si ce n'est pas le cas, s'arrêter ici.** Ensuite :

```bash
SRC=~/.claude/projects/-Users-AlexisEnSah-Desktop-Node-atlas/memory
rm $SRC/*.md
cat > $SRC/MEMORY.md <<'EOF'
La mémoire de ce projet vit désormais dans le dépôt, à `memory/atlas/claude/`,
et est injectée au démarrage par `.claude/hooks/claude-memory.mjs`.

Écrire toute nouvelle mémoire là-bas, une note par fait, et ajouter sa ligne
dans `memory/atlas/claude/index.md`. Ne rien écrire dans ce dossier-ci.
EOF
ls $SRC
```

Attendu : `MEMORY.md` seul.

- [ ] **Step 8 : Documenter la convention dans `CLAUDE.md`**

Ajouter à la section `docs/` de `CLAUDE.md` (racine), désormais consacrée au vault :

```markdown
`memory/atlas/claude/` est la mémoire de l'agent sur ce projet : une note par fait,
indexée dans `claude/index.md`, injectée au démarrage de session par
`.claude/hooks/claude-memory.mjs`. Toute nouvelle mémoire s'écrit **là** — jamais
dans le dossier `~/.claude/projects/…/memory/`, qui ne contient plus qu'un pointeur.
```

- [ ] **Step 9 : Commit (à proposer à l'utilisateur)**

```bash
git add .claude CLAUDE.md
git commit -m "feat(memory): load the vault-hosted agent memory at session start"
```

---

### Task 8 : Clôture — graphify et vérification d'ensemble

**Files:**
- Modify: `graphify-out/` (régénéré)
- Delete: `memory/atlas/plans/vault-reorganisation.md` (ce plan)
- Modify: `memory/atlas/vault.md` (statut → implémenté)

- [ ] **Step 1 : Rafraîchir le graphe**

```bash
graphify update .
grep -c '"docs/' graphify-out/graph.json || echo "0 noeud residuel sur docs/"
```

Attendu : plus aucun nœud portant `docs/` pour ce vault (`apps/dino-brawl/docs/` reste légitime — vérifier que les occurrences restantes sont bien celles-là).

- [ ] **Step 2 : Vérification d'ensemble**

```bash
node scripts/check-vault-links.mjs memory/atlas
node --test scripts/ .claude/hooks/
pnpm test
git grep -n "pnpm docs:index\|backlog/_index" -- . ':!memory/atlas/plans' || echo "aucune reference residuelle"
```

Attendu : zéro lien mort ; tests verts ; `pnpm test` vert ; aucune référence résiduelle à l'ancien système. Reporter la sortie réelle, pas un résumé.

- [ ] **Step 3 : Basculer le statut du doc de design**

Dans `memory/atlas/vault.md` : frontmatter `status: implemented`, `shipped:` à la date du jour, et la ligne prose `> **Statut : design validé, non implémenté.**` corrigée en `> **Statut : implémenté.**` avec la portée réellement livrée.

- [ ] **Step 4 : Supprimer le plan**

```bash
git rm memory/atlas/plans/vault-reorganisation.md
```

- [ ] **Step 5 : Commit (à proposer à l'utilisateur)**

```bash
git add -A
git commit -m "chore(docs): close out the vault reorganisation"
```
