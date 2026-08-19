# Réorganisation de `docs/` — pièges outillés, backlog Obsidian, clôture de feature

> **Statut : design validé, à implémenter.**
> Portée : `docs/`, `CLAUDE.md` (racine + packages + apps), `.claude/settings.json`, `.claude/skills/`, `.claude/commands/`, `.gitignore`, `.prettierignore`, `scripts/`.
> Aucun code moteur (`packages/`, `apps/src`) n'est modifié par ce chantier.

---

## 1. Contexte

`docs/` compte **41 fichiers / 19 550 lignes** et a cessé d'être navigable.

| Constat | Mesure |
| --- | --- |
| Plans d'implémentation déjà exécutés | **9 fichiers, 10 012 lignes — 51 % du volume** |
| Docs non référencés dans `CLAUDE.md` (orphelins) | **19** |
| Docs applicatifs mélangés aux docs moteur | 6 fichiers (`dino-brawl-*`, `2026-08-12-*`) = 3 designs + 3 plans |
| Items de backlog | ~110, dans **deux formats incompatibles** (28 en tableaux avec ID, 82 en puces sans ID) |
| Statuts de docs **contredits par la réalité** | **4 confirmés** (cf. §1.2) |

### 1.1. Le `CLAUDE.md` est devenu un index qui dérive

`CLAUDE.md` porte **31 descriptions de docs**. Chaque doc ajouté sans mise à jour de l'index devient invisible — c'est le mécanisme exact qui a produit les 19 orphelins. Un index doit vivre à côté des fichiers qu'il indexe, pas dans un fichier d'instructions.

### 1.2. Les statuts déclarés ne sont pas fiables

| Doc | Statut déclaré | Réalité |
| --- | --- | --- |
| `gameplay/audio.md` | « design validé, non implémenté » | Shippé sur `dev` le 2026-08-11 |
| `rendering/canvas-resize.md` | « validé, prêt pour plan » | `CLAUDE.md` dit « implémenté » |
| `physics/character-controller.md` | « conçu, non implémenté » | Implémenté sur `feat/claude/tilemap-collision`, non mergé |
| `physics/collision-layer.md` | *aucun statut* | Phase 1 shippée |

**Conséquence structurante :** la migration du backlog ne peut pas faire confiance aux en-têtes. Chaque item est vérifié **contre le code**. C'est le poste de coût principal du chantier — devant tous les déplacements de fichiers réunis.

### 1.3. Les pièges d'outillage ne sont écrits nulle part d'exécutable

Six pièges transverses vivent soit au fond d'un doc de design, soit uniquement dans la mémoire d'agent. Le plus coûteux (rebuild WGSL) est décrit dans `debug/gizmos.md` comme « le piège qui a coûté le plus de temps sur cette feature » — il a donc déjà battu une règle écrite une fois.

---

## 2. Non-objectifs

- Réécrire le contenu des docs de design implémentés. On corrige les statuts, pas la prose.
- Introduire un niveau `docs/design/`. Cela casserait 31 renvois plus tous les liens inter-docs pour un gain cosmétique.
- Traduire quoi que ce soit. Les docs restent en français, le code en anglais.
- Migrer les items terminés. Un item fait quitte le backlog (cf. D4).
- Ajouter une dépendance npm. Le script d'index est du Node nu.

---

## 3. Décisions de design

| # | Décision | Justification |
| --- | --- | --- |
| **D1** | Les 9 plans sont **supprimés** après extraction des pièges | 51 % du volume, jamais relus ; git conserve l'historique |
| **D2** | Les plans futurs vivent dans **`docs/plans/`**, contrat explicite : transitoire | Rend le caractère jetable structurel plutôt que conventionnel (suffixe `-plan`) |
| **D3** | Un piège **mécaniquement détectable** devient un **hook**, jamais une ligne de doc | Une règle écrite a déjà perdu contre le piège WGSL |
| **D4** | `status` du backlog n'a que 3 valeurs : `todo` · `partial` · `vision`. **Pas de `done`** | Le doc de design porte ce qui est fait ; c'est le mélange des deux qui a produit un backlog citant encore `@Expose` |
| **D5** | Une note de backlog = un fichier, frontmatter typé, `source` en **wikilink** | Seule granularité que Obsidian sait filtrer et afficher en graphe |
| **D6** | Champ **`verified`** obligatoire (date de confrontation au code) | Antidote direct au §1.2 : un item sans `verified` récent est suspect par construction |
| **D7** | L'index vit dans **`docs/README.md`**, `CLAUDE.md` n'en garde qu'un pointeur | Supprime le mécanisme de dérive du §1.1 |
| **D8** | Clôture de feature = **hook qui détecte** + **commande qui exécute** | Une commande n'empêche pas l'oubli ; un hook ne sait pas faire le travail |

---

## 4. Arborescence cible

```
docs/
  README.md                      NOUVEAU — index unique, régénéré
  backlog/                       NOUVEAU — ~55 notes atomiques
    _index.md                    régénéré par script
    backlog.base                 vue Obsidian (kanban par statut)
    RENDER-02-text-rendering.md
    GAMEPLAY-11-frame-events.md
  plans/                         NOUVEAU — plans en cours, transitoires
    .gitkeep
  core/ rendering/ gameplay/ physics/ assets/ debug/    inchangés
apps/dino-brawl/docs/            NOUVEAU — 3 designs app-local
scripts/
  backlog-index.mjs              NOUVEAU — régénère README.md + _index.md
```

Mouvements :

1. **Suppression** des 9 `*-plan.md` (−10 012 lignes), après étape 0.
2. **Descente** des **3 designs** `dino-brawl-*` / `2026-08-12-*` vers `apps/dino-brawl/docs/` ; leurs **3 plans** sont supprimés comme les autres (D1). Ces designs se déclarent eux-mêmes « App-local (`apps/dino-brawl`) ». La convention existe déjà : 5 packages portent leur propre `CLAUDE.md`.
3. **Création** de `docs/README.md`, `docs/backlog/`, `docs/plans/`.

---

## 5. Routage des pièges

Deux natures, deux destinations opposées.

**Nature 1 — pièges d'outillage** (transverses, mécaniques) :

| Piège | Destination |
| --- | --- |
| Éditer un `.wgsl` sans rebuild du backend → ancien shader servi ; redémarrer le dev server ne suffit pas | **Hook** `PostToolUse` (§6.1) |
| Formatage prettier des `.ts` touchés | **Hook** `PostToolUse` (§6.2) |
| `tsc --noEmit` nu dans dino-brawl est un no-op → `-p tsconfig.app.json` | `apps/dino-brawl/CLAUDE.md` (à créer) |
| `import type` obligatoire pour les symboles type-only sous Vite (`tsc` passe, runtime casse en écran noir) | `CLAUDE.md` racine |
| Erreur de compilation WGSL émise en `warn`, invisible sous `onlyErrors` ; boucle RAF throttlée hors premier plan (canvas noir, zéro erreur) ; readback programmatique vide pour la même raison | **Skill** `atlas-verify-webgpu` |
| `fwidth` interdit en flux de contrôle non-uniforme (vaut pour toute extension du shader : coins arrondis, feather) | `packages/nebula-webgpu/CLAUDE.md` |

**Nature 2 — caveats de design.** Ordre `onCreate` vs `getScript`, désync `TProps` ↔ metadata, `Vec2` backend live mutable, fronts d'input ambigus en lane `fixed`, shear dans la décomposition `Mat3`. **Ils restent dans leur doc de design** : hors contexte, ils ne veulent rien dire.

---

## 6. Hooks

Déclarés dans **`.claude/settings.json`** (versionné ; `settings.local.json` ne l'est pas et porte déjà le hook `graphify`, qui doit rester intact).

### 6.1. Rebuild WGSL

- **Événement** : `PostToolUse`, matcher `Edit|Write`.
- **Garde** : ne fait rien si le chemin touché ne finit pas par `.wgsl`. Jamais sur `Read`, jamais sur `.ts`.
- **Action** : `pnpm --filter @atlasjs/nebula-webgpu build` — build ciblé, **pas** un `turbo build` complet.
- **Non bloquant** : en cas d'échec, il rapporte et rend la main. Il ne verrouille pas la session.

### 6.2. Prettier ciblé

- **Événement** : `PostToolUse`, matcher `Edit|Write`.
- **Garde** : uniquement `.ts` / `.tsx`. **Jamais** de `.md`.
- **Action** : `prettier --write` sur **le seul fichier touché**. Jamais un passage repo-wide.

**Correctif associé** — `pnpm format` cible `**/*.{ts,tsx,md}` et `docs/` n'est pas dans `.prettierignore` : un `pnpm format` à la racine reformate aujourd'hui tous les docs (churn massif sur les tableaux et les blocs de code). **Ajouter `docs/` et `apps/*/docs/` à `.prettierignore`** transforme une règle tenue de mémoire en garantie outillée.

### 6.3. Rappel de plan en cours

- **Événement** : `SessionStart`.
- **Action** : si `docs/plans/` contient au moins un `*.md`, injecter un rappel nommant le(s) plan(s) et pointant vers `/atlas-done`.
- **Propriété recherchée** : le rappel **disparaît de lui-même** dès que le plan est supprimé. Il ne peut donc pas se transformer en bruit permanent.

---

## 7. Clôture de feature — commande `/atlas-done`

Fichier : `.claude/commands/atlas-done.md`. Argument optionnel : le nom du plan.

Procédure :

1. **Vérifier** que le travail est réellement terminé — tests du périmètre exécutés, résultat constaté. Aucune étape suivante si cette vérification échoue.
2. **Extraire les pièges survivants du plan**, avant toute suppression : outillage mécanique → hook / skill / `CLAUDE.md` de proximité ; caveat de design → doc de design du système. Absence de piège à déclarer explicitement.
3. **Corriger le doc de design** : statut → implémenté, avec la portée réelle et ce qui reste.
4. **Créer les notes** pour les V2 / hors-périmètre annoncés par la feature.
5. **Fermer les notes de backlog** couvertes : suppression (D4). Ce qui reste vit dans la note `todo` créée à l'étape 4, jamais en reliquat dans une note fermée.
6. **Supprimer** le plan dans `docs/plans/`.
7. **Régénérer** `docs/README.md` et `docs/backlog/_index.md` (§9).
8. **Clore les tâches** correspondantes.
9. **S'arrêter là.** Rien n'est commité : la revue et le commit restent à l'utilisateur.

L'étape 2 est ajoutée après revue : sans elle, `/atlas-done` détruirait le plan sans que ses pièges aient été routés — exactement la perte que ce chantier corrige à la main en étape 0 (§11). C'est la seule étape irréversible de la procédure.

Les étapes 5 et 7 dépendent d'une infrastructure posée par les étapes 4 et 5 du plan de migration (§11). Tant qu'elle n'existe pas, la commande opère sur `docs/backlog.md` et saute la régénération **en le signalant** — seule exception tolérée à la règle d'arrêt sur échec, et jamais pour un test qui échoue.

---

## 8. Schéma du backlog

Vault Obsidian = **`docs/`**, de sorte que notes de backlog et docs de design partagent le même graphe.

`docs/backlog/RENDER-02-text-rendering.md` :

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

| Champ | Valeurs | Rôle |
| --- | --- | --- |
| `id` | `<DOMAIN>-<nn>` | Référence stable en commit / branche / discussion |
| `legacyId` | ancien ID, optionnel | `shapes.md` dit « backlog A1 clos », d'autres citent `B4`, `E3` — sans ce champ ces renvois cassent |
| `status` | `todo` · `partial` · `vision` | Voir D4 |
| `domain` | `core` `rendering` `gameplay` `physics` `assets` `debug` `audio` `app` | Groupement et filtre |
| `source` | wikilink | Crée l'arête dans le graph view |
| `effort` | `S` · `M` · `L` | Choix de la prochaine tâche |
| `verified` | date ISO | Voir D6 |

### 8.1. Exception : items app-local

Deux designs app-local sont « validés, non implémentés » (`dino-brawl-cleanup`, `dino-brawl-tiled-bridge`) : ils produisent donc de vrais items de backlog. Leurs notes vivent dans `docs/backlog/` comme les autres (`domain: app`), mais leur design source est **hors du vault** (`apps/dino-brawl/docs/`).

Pour ces notes seulement, `source` est un **lien markdown relatif** au lieu d'un wikilink. Conséquence assumée : pas d'arête dans le graph view pour ces deux items. L'alternative — élargir le vault à la racine du repo — ferait entrer `node_modules`, `packages/` et `graphify-out/` dans le graphe, ce qui coûte bien plus que deux arêtes manquantes.

Conventions de liens : `source` et `Bloqué par` en **wikilink** (arêtes du graphe) ; les liens entre docs de design restent en **markdown standard** — Obsidian les suit, et GitHub reste lisible.

`Bloqué par` est ce qui transforme une liste en graphe exploitable (ex. le post-processing dépend du seam `RenderTarget`).

---

## 9. Index régénéré — `scripts/backlog-index.mjs`

Node nu, **aucune dépendance ajoutée**. Lit le frontmatter de `docs/backlog/*.md` et réécrit :

- `docs/backlog/_index.md` — items groupés par domaine, triés par statut puis id.
- `docs/README.md` — index des docs de design par dossier, avec leur statut, plus un renvoi vers le backlog.

Exposé en `pnpm docs:index`, appelé par `/atlas-done` (§7.6).

**Raison d'être :** un index tenu à la main dérive — c'est précisément la maladie soignée par ce chantier (§1.1). Le régénérer est la seule façon de ne pas reproduire la cause.

Une vue `backlog.base` (Obsidian ≥ 1.9, natif, sans plugin) fournit le kanban par statut. Elle est **complémentaire** de `_index.md`, pas un substitut : `_index.md` reste lisible sur GitHub et hors Obsidian.

---

## 10. Obsidian

- **Vault** = `docs/`.
- `.obsidian/` **versionné**, à l'exception de `workspace.json`, `workspace-mobile.json` et `cache` → ajoutés au `.gitignore`. La vue partagée est commune, la disposition de fenêtres reste personnelle.

---

## 11. Plan de migration

Une étape = un commit. L'ordre est contraignant : l'étape 0 précède toute suppression.

| # | Étape | Contenu |
| --- | --- | --- |
| **0** | Extraire les pièges | Balayer les 9 plans, sortir les pièges survivants. Aucune suppression à ce stade. |
| **1** | Câbler les garde-fous | Hooks §6.1/6.2/6.3, skill `atlas-verify-webgpu`, commande `/atlas-done`, `apps/dino-brawl/CLAUDE.md`, règles dans les `CLAUDE.md` de package, `.prettierignore`. |
| **2** | Dégager & déplacer | Suppression des 9 plans, descente des 3 designs app-local, création de `docs/plans/`. |
| **3** | Corriger les statuts | Les 4 docs du §1.2, vérifiés contre le code. |
| **4** | Tri + migration backlog | Par lots (ci-dessous). |
| **5** | Index & Obsidian | `scripts/backlog-index.mjs`, `docs/README.md`, dégraissage du `CLAUDE.md`, `.obsidian/`, `.gitignore`. |

### Lots de l'étape 4

Rendering · Sprites & Assets · Shaders & Materials · Core (ECS + Scheduling) · Gameplay A (hiérarchie, caméra, input) · Gameplay B (scripting, prefab) · Gameplay C (tilemap, gizmos) · Audio & dette technique.

Par lot : un tableau `item → statut vérifié contre le code → garder / fusionner / jeter`, avec motif. **Validation utilisateur, puis** écriture des notes. Les items jetés figurent au rapport du lot : rien ne disparaît en silence.

Estimation post-tri : **~55 notes** pour ~110 puces d'origine (beaucoup sont des sous-points d'une même idée, certaines sont déjà faites).

---

## 12. Risques

| Risque | Traitement |
| --- | --- |
| Un piège utile est perdu avec un plan supprimé | Étape 0 strictement avant étape 2 ; la suppression est un commit distinct, donc annulable seul |
| Le hook WGSL se déclenche trop souvent et devient pénible | Garde d'extension stricte, build filtré sur un seul package, non bloquant |
| Le tri jette un item encore pertinent | Validation par lot avant écriture, rapport des items jetés |
| `verified` se périme et le §1.2 se reproduit | `/atlas-done` réécrit `verified` à chaque clôture |
| La vue `.base` n'est lisible que dans Obsidian | `_index.md` markdown maintenu en parallèle, régénéré |
| Le hook prettier réécrit le fichier avec `--write` sans remonter le nouveau contenu à l'agent ; une édition suivante qui s'appuie sur le texte exact venant d'être écrit peut échouer si le reformatage (guillemets, retours à la ligne, points-virgules) change ce texte | Risque accepté et connu, à revisiter si des échecs d'édition inexpliqués apparaissent ; le rendre bloquant coûterait plus cher que le défaut qu'il évite |
| Deux éditions de `.wgsl` émises dans le même tour déclenchent deux hooks, donc deux `pnpm build` concurrents écrivant dans le même `dist`, sans verrou pour les sérialiser | Risque accepté, non mitigé ; l'échec serait un `dist` transitoirement incohérent, que la prochaine édition de shader répare ; à revisiter si une corruption est réellement observée — un verrou coûterait plus cher que le défaut qu'il évite |

---

## 13. Critères de succès

1. `docs/` sous **10 000 lignes** (contre 19 550).
2. **Zéro** doc orphelin : tout fichier de `docs/` apparaît dans `docs/README.md` régénéré.
3. Éditer un `.wgsl` déclenche le rebuild **sans intervention**.
4. Chaque note de backlog porte un `status` et un `verified` confrontés au code.
5. `CLAUDE.md` ne contient plus d'index de docs, seulement un pointeur.
6. Un `pnpm format` à la racine ne touche plus aucun `.md` de `docs/`.
