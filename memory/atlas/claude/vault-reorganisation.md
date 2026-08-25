---
name: vault-reorganisation
description: "docs/ became the memory/atlas Obsidian vault on 2026-08-25 — generated indexes replaced by Bases, agent memory moved into the repo behind a SessionStart hook"
type: project
modified: 2026-08-25
---

Livré le 2026-08-25 (branche `chore/memory-vault`, 8 tâches, subagent-driven). Suite directe de [[docs-reorganisation]], dont il supersède le mécanisme d'index. Design : `memory/atlas/vault.md`.

Ce qui a changé :

- **`docs/` est devenu `memory/atlas/`**, racine du vault Obsidian (`.obsidian/` y vit). 179 fichiers déplacés par `git mv`, historique préservé.
- **Les index générés sont morts.** `scripts/backlog-index.mjs`, ses tests, `scripts/lib/frontmatter.mjs` et le script npm `docs:index` sont supprimés ; `backlog/_index.md` aussi. Trois fichiers Bases les remplacent, calculés à l'ouverture : `backlog.base` (par domaine / à faire / vision / **périmés**, cette dernière filtrant sur `(today() - date(verified)).days > 90`), `design-docs.base`, `claude-memory.base`. `README.md` est désormais écrit à la main.
- **Les 31 docs de design portent `status` / `shipped?` / `summary` en frontmatter**, au lieu d'une ligne prose grepée par heuristique. La ligne prose reste dans le corps : elle porte la nuance que le frontmatter ne sait pas dire.
- **La mémoire agent a quitté `~/.claude/projects/…/memory/`** pour `memory/atlas/claude/`, versionnée donc relisable et corrigeable par l'utilisateur. Le dossier hors dépôt ne contient plus qu'un pointeur. Le chargement automatique perdu est remplacé par `.claude/hooks/claude-memory.mjs` (`SessionStart`), qui imprime **`claude/index.md` seul** — jamais le corps des notes.

**Why:** trois coûts. L'index généré était une seconde source de vérité, périmée entre deux `pnpm docs:index`. La colonne « Statut » du README venait d'une centaine de lignes de code qui grepaient une ligne de prose, échappaient les `|` et tronquaient sans couper au milieu d'un lien. Et la mémoire agent, hors dépôt, était invisible pour l'auteur du projet.

**How to apply:** écris toute nouvelle mémoire dans `memory/atlas/claude/`, une note par fait, **plus sa ligne dans `claude/index.md`** — une note absente de l'index n'est jamais chargée. Ne cherche plus à régénérer un index : il n'y en a pas. Avant de clore un chantier qui touche le vault, lance `node scripts/check-vault-links.mjs memory/atlas`.

**Le piège central, valable pour tout chantier de migration :** le critère de vérification n'est **jamais « zéro lien mort »** mais « **empreinte inchangée** ». Le vault en portait 8 avant qu'on y touche ; exiger zéro aurait envoyé réparer de la dette hors périmètre au milieu d'une migration. Relever l'empreinte **avant** de bouger quoi que ce soit, comparer après. Corollaire : un vérificateur naïf lit les exemples de code des documents comme de vrais liens — celui-ci masque blocs et spans de code, sans quoi un plan de migration qui *cite* les liens qu'il décrit produit 20 faux positifs qui noient les vrais.

Deux pièges mécaniques extraits vers leurs propres notes : [[node-test-directory-arg]] et [[pnpm-test-skips-repo-scripts]].

**La cause des liens morts, et le correctif :** les trois wikilinks morts que le vérificateur a exhumés (`GAMEPLAY-76` dans `CORE-08`, `PHYSICS-17` dans `PHYSICS-18` et `PHYSICS-22`) venaient tous de `/atlas-done`, qui supprimait une note **sans regarder qui la citait** — PR #3 et #6 ont fermé quatre items et laissé leurs renvois pendants. Corrigé des deux côtés le 2026-08-25 : les trois renvois disent maintenant que l'item a été livré et où (le renvoi porte une vraie information, on le réécrit, on ne le supprime pas), et l'étape 5 d'`/atlas-done` impose un `grep -rln "<ID>-<slug>" memory/atlas/` avant toute suppression, avec le vérificateur en garde-fou de sortie. **Le vault est à zéro lien mort depuis cette date** : toute cible morte qui apparaît vient de ce qu'on vient de faire.

**Reste ouvert :** `apps/dino-brawl/docs/weapon-content-modules.md` cite un `APP-05` dont l'identifiant a depuis été **réattribué** à une autre note — le renvoi ne pointe pas vers le vide mais vers le mauvais item, ce qui est pire et qu'aucun vérificateur de liens ne peut voir. Ce doc vit hors du vault.

Related: [[docs-reorganisation]], [[execution-cadence-preference]], [[run-prettier-before-staging]].
