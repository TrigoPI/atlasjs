---
status: planned
summary: "Renommage de docs/ en memory/atlas/, backlog piloté par Obsidian Bases, et mémoire agent rapatriée dans le vault."
---

# Vault `memory/atlas`

> **Statut : design validé, non implémenté.** Réorganise `docs/` en vault Obsidian nommé, remplace les index générés par des Bases, et rapatrie la mémoire agent (jusqu'ici hors dépôt) dans le vault.

## 1. Pourquoi

Trois coûts constatés dans l'organisation actuelle de `docs/` :

1. **`backlog/_index.md` est une seconde source de vérité.** 140 lignes de tableau régénérées par `scripts/backlog-index.mjs`, périmées dès qu'une note change sans que `pnpm docs:index` soit relancé. Le core-plugin Obsidian `bases` est déjà activé dans le vault et produit la même vue, live.
2. **La colonne « Statut » du README est une heuristique fragile.** `describeDoc` grep `/statut|status/i` dans les 8 premières lignes d'un doc, nettoie les backticks, échappe les `|`, puis tronque à 90 caractères en reculant pour ne pas couper au milieu d'un lien markdown — une centaine de lignes de code pour reconstruire un champ qui devrait être du frontmatter.
3. **La mémoire agent vit hors du dépôt.** 17 notes dans `~/.claude/projects/…/memory/`, non versionnées, invisibles pour l'auteur du projet, sans lien possible vers les docs de design.

Les IDs de backlog (`APP-09`) sont **conservés** : leur bureaucratie (unicité, double présence nom de fichier + frontmatter) est réelle, mais ils servent de handle en conversation, ce qu'un slug seul ne remplace pas.

## 2. Arborescence cible

```
memory/
└── atlas/                 ← racine du vault (.obsidian/ ici)
    ├── README.md          ← écrit à la main : carte du vault
    ├── backlog.base
    ├── design-docs.base
    ├── claude-memory.base
    ├── vault.md           ← ce document
    ├── backlog/           ← 140 notes, frontmatter inchangé
    ├── plans/             ← transitoire (supprimé par /atlas-done)
    ├── claude/            ← mémoire agent
    ├── core/ gameplay/ rendering/ physics/ assets/ debug/
    └── .obsidian/
```

`memory/` n'est qu'un dossier conteneur ; la racine du vault Obsidian est `memory/atlas/`. Le déplacement se fait par `git mv docs memory/atlas`, ce qui préserve l'historique. La structure interne étant identique, les 150 wikilinks et la quasi-totalité des liens relatifs survivent sans modification.

## 3. Backlog piloté par Bases

Les notes de backlog ne changent pas : `<ID>-<slug>.md` dans `backlog/`, frontmatter `id` / `status` / `domain` / `effort` / `verified` / `source`.

`backlog/_index.md` est supprimé, remplacé par `backlog.base` :

| Vue | Contenu |
| --- | --- |
| Par domaine | groupé sur `domain`, trié par `status` puis `id` — équivalent live de l'index actuel |
| À faire | `status = todo`, trié par `effort` |
| Vision | `status = vision`, séparé du travail réel |
| Périmés | trié sur `verified` croissant ; filtre « plus de 90 jours » si les formules de date le permettent, sinon tri seul |

La vue « Périmés » est le gain que le générateur ne pouvait pas offrir : `verified` est aujourd'hui un champ que rien ne surface.

## 4. Docs de design : statut en frontmatter

Les 31 docs de design gagnent :

```yaml
---
status: implemented        # implemented | partial | planned
shipped: 2026-08-23        # optionnel
summary: "Une ligne, écrite à la main."
---
```

`domain` n'est **pas** dupliqué : la Base le déduit du dossier.

La ligne prose existante (`> **Statut : implémenté**…`) **reste dans le corps** : elle porte la nuance (portée réellement livrée, hors-périmètre, branche) et est trop riche pour une cellule de tableau. Le `summary` d'une ligne est ce qui rend `design-docs.base` lisible, là où le README tronquait en milieu de phrase.

`scripts/backlog-index.mjs`, `scripts/backlog-index.test.mjs` et le script npm `docs:index` sont supprimés, ainsi que `scripts/lib/frontmatter.mjs` et son test — `backlog-index.mjs` en est le seul consommateur.

## 5. Mémoire agent dans le vault

Les 17 notes de `~/.claude/projects/-Users-AlexisEnSah-Desktop-Node-atlas/memory/` migrent dans `memory/atlas/claude/`. Elles sont déjà au format Obsidian (frontmatter + `[[wikilinks]]`) ; seule transformation : le bloc `metadata:` imbriqué est aplati en propriétés de premier niveau, que Bases sait lire. `MEMORY.md` devient `claude/index.md`.

Un hook `SessionStart` (`.claude/hooks/claude-memory.mjs`) affiche le contenu de `claude/index.md` au démarrage, remplaçant le chargement automatique perdu en sortant du dossier géré par le harness. Le hook **n'imprime jamais les notes entières** — une ligne par note, le détail est lu à la demande.

L'ancien dossier est vidé et son `MEMORY.md` remplacé par un pointeur d'une ligne vers le vault. Sans cela, deux mémoires coexistent et divergent, ce que cette réorganisation cherche précisément à supprimer.

## 6. Ce que la migration doit réparer

| Ce qui casse | Volume |
| --- | --- |
| Liens `](../../…)` sortant du vault (un niveau de plus) | 11 liens, 4 fichiers |
| Mentions `` `docs/xxx` `` à l'intérieur du vault | 72 |
| `CLAUDE.md` racine + 6 `CLAUDE.md` de packages/apps | ~15 lignes |
| `.gitignore`, `.prettierignore` | 6 lignes |
| `.claude/hooks/plan-reminder.mjs` (chemin `docs/plans`) | 1 ligne |
| `.claude/commands/atlas-done.md` (chemins + étape « régénérer les index », disparue) | réécriture partielle |
| `graphify-out` (1634 nœuds portant `docs/`) | `graphify update .` |

## 7. Vérification

- Passe de contrôle des liens sur tout le vault : aucune cible morte, wikilinks comme liens relatifs.
- `pnpm test` vert à la racine. Attention : `turbo run test` ne parcourt que les packages, il n'a **jamais** exécuté `scripts/*.test.mjs` — leur suppression est donc invisible pour lui, et ne constitue pas une preuve. Les tests supprimés sont lancés une dernière fois à la main (`node --test scripts/`) avant retrait, pour vérifier qu'on ne jette pas du rouge sous le tapis.
- Hook `SessionStart` **exécuté pour de vrai**, pas supposé fonctionnel.
- Les trois `.base` ouverts dans Obsidian et constatés non vides.

## 8. Hors périmètre

- `apps/dino-brawl/docs/` reste hors du vault, comme aujourd'hui.
- Aucun renommage de note de backlog, aucune suppression d'ID.
- Aucun changement du vocabulaire de statut du backlog (`todo` / `partial` / `vision`).
