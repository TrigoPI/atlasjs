---
status: implemented
shipped: 2026-08-25
summary: "Renommage de docs/ en memory/atlas/, backlog piloté par Obsidian Bases, et mémoire agent rapatriée dans le vault."
---

# Vault `memory/atlas`

> **Statut : implémenté** (livré le 2026-08-25). Livré en entier : `docs/` est devenu le vault Obsidian `memory/atlas/` (`git mv`, historique préservé), les deux index générés sont remplacés par trois Bases (`backlog.base`, `design-docs.base`, `claude-memory.base`) et un `README.md` écrit à la main, les 31 docs de design portent leur statut en frontmatter, et la mémoire agent — 16 notes plus `claude/index.md` — vit dans `memory/atlas/claude/`, injectée au démarrage de session par `.claude/hooks/claude-memory.mjs`. `scripts/backlog-index.mjs`, ses tests, `scripts/lib/frontmatter.*` et le script npm `docs:index` sont supprimés ; `scripts/check-vault-links.mjs` les remplace comme filet de vérification. **Hors périmètre, laissés en l'état :** les 3 wikilinks morts préexistants de `backlog/` (`CORE-08` → `GAMEPLAY-76-scriptmanager-dispose-leaks-scripts`, `PHYSICS-18` et `PHYSICS-22` → `PHYSICS-17-inertia-set-body-type`).

## 1. Pourquoi

Trois coûts constatés dans l'ancienne organisation de `docs/` :

1. **`backlog/_index.md` est une seconde source de vérité.** 185 lignes régénérées par `scripts/backlog-index.mjs` pour 139 items, périmées dès qu'une note change sans que `pnpm docs:index` soit relancé. Le core-plugin Obsidian `bases` est déjà activé dans le vault et produit la même vue, live.
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
    ├── backlog/           ← 139 notes, frontmatter inchangé
    ├── plans/             ← transitoire (supprimé par /atlas-done)
    ├── claude/            ← mémoire agent
    ├── core/ gameplay/ rendering/ physics/ assets/ debug/
    └── .obsidian/
```

`memory/` n'est qu'un dossier conteneur ; la racine du vault Obsidian est `memory/atlas/`. Le déplacement se fait par `git mv docs memory/atlas`, ce qui préserve l'historique. La structure interne étant identique, les 151 wikilinks et la quasi-totalité des liens relatifs survivent sans modification.

## 3. Backlog piloté par Bases

Les notes de backlog ne changent pas : `<ID>-<slug>.md` dans `backlog/`, frontmatter `id` / `status` / `domain` / `effort` / `verified` / `source`.

`backlog/_index.md` est supprimé, remplacé par `backlog.base` :

| Vue | Contenu |
| --- | --- |
| Par domaine | groupé sur `domain`, colonnes `id` / nom / `status` / `effort` / `verified` — équivalent live de l'index généré |
| À faire | `status = todo` **ou** `partial`, groupé par `effort` |
| Vision | `status = vision`, séparé du travail réel |
| Périmés | `verified` de plus de 90 jours **ou** absent, avec une colonne calculée `staleness` (jours écoulés) |

La vue « À faire » filtre bien sur deux statuts : 139 notes se répartissent en 95 `todo`, 39 `vision` et **5 `partial`**, et un item à moitié fait reste du travail à faire. Sur `todo` seul, ces cinq-là n'apparaissaient que dans la vue groupée.

La vue « Périmés » est le gain que le générateur ne pouvait pas offrir : `verified` est aujourd'hui un champ que rien ne surface. Les formules de date de Bases suffisent — pas besoin de se rabattre sur un tri seul.

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

Deux liens de ces notes ne survivent pas à l'import et sont repointés à la main : un wikilink `[[CLAUDE.md]]` vers un fichier qui vit **hors** du vault et qu'aucun vault ne peut résoudre, et un chemin relatif qui remontait jusqu'au dossier personnel pour atteindre l'ancien arbre `docs/`. Une note écrite hors du vault n'a pas de base relative fiable : il faut relire ses liens à l'entrée, pas seulement son frontmatter.

Un hook `SessionStart` (`.claude/hooks/claude-memory.mjs`) affiche le contenu de `claude/index.md` au démarrage, remplaçant le chargement automatique perdu en sortant du dossier géré par le harness. Le hook **n'imprime jamais les notes entières** — une ligne par note, le détail est lu à la demande.

L'ancien dossier est vidé et son `MEMORY.md` remplacé par un pointeur d'une ligne vers le vault. Sans cela, deux mémoires coexistent et divergent, ce que cette réorganisation cherche précisément à supprimer.

## 6. Ce que la migration doit réparer

Volumes constatés au déplacement, pas estimés :

| Ce qui casse | Volume |
| --- | --- |
| Liens `](../../…)` sortant du vault (un niveau de plus) | 11 liens, 4 fichiers |
| Mentions `` `docs/xxx` `` à l'intérieur du vault | 106, dans 28 fichiers |
| `CLAUDE.md` racine + 6 `CLAUDE.md` de packages/apps | 22 lignes |
| `.gitignore` (4 lignes), `.prettierignore` (1) | 5 lignes |
| `.claude/hooks/plan-reminder.mjs` (le chemin **et** le message affiché) | 2 lignes |
| `.claude/commands/atlas-done.md` (chemins + étape « régénérer les index », disparue) | réécriture partielle |
| `package.json` (script `docs:index`) | 1 ligne |
| Renvois vers `backlog/_index.md`, que sa suppression rend morts | 3 docs |
| Liens des notes de mémoire importées, relatifs à un emplacement hors vault | 2 liens |
| `graphify-out` (1634 nœuds portant `docs/`) | `graphify update .` |

Les trois lignes `package.json`, renvois vers `backlog/_index.md` et liens des notes de mémoire sont celles que le design n'avait pas vues. Les deux dernières ont ceci de commun qu'elles créent des liens morts **après** l'étape qui les provoque, pas pendant : supprimer un index généré casse ce qui le citait, importer une note écrite ailleurs importe ses liens avec elle. Les Bases n'ayant pas d'ancres, les renvois vers `_index.md#domaine` perdent leur ancre et nomment le domaine en toutes lettres.

## 7. Vérification

- Passe de contrôle des liens sur tout le vault, wikilinks comme liens relatifs : `node scripts/check-vault-links.mjs memory/atlas`. Le critère n'est **pas** « zéro lien mort » — le vault en portait 8 avant qu'on y touche, dont 3 wikilinks de backlog vers des notes supprimées, hors périmètre. On compare à cette empreinte, pas à zéro.
- Le vérificateur **masque les blocs et les spans de code** avant de chercher des liens. Sans ça il lit les exemples des docs — et surtout ceux du plan de migration, qui cite les liens morts qu'il décrit — comme de vrais liens, et la mesure ne mesure plus rien.
- `pnpm test` vert à la racine. Attention : `turbo run test` ne parcourt que `apps/*` et `packages/*`, il n'a **jamais** exécuté `scripts/*.test.mjs` ni `.claude/hooks/*.test.mjs` — leur suppression lui est invisible et son vert ne prouve rien à leur sujet. Les tests racine se lancent à la main, **fichier par fichier** : `node --test scripts/check-vault-links.test.mjs .claude/hooks/claude-memory.test.mjs`. Sous Node 26.3, passer un répertoire (`node --test scripts/`) le charge comme un module et échoue sur un `'test failed'` qui ne dit rien de l'état du code. Les tests qu'on supprime sont lancés une dernière fois ainsi avant retrait, pour vérifier qu'on ne jette pas du rouge sous le tapis.
- Hook `SessionStart` **exécuté pour de vrai**, pas supposé fonctionnel.
- Les trois `.base` ouverts dans Obsidian et constatés non vides.

## 8. Hors périmètre

- `apps/dino-brawl/docs/` reste hors du vault, comme aujourd'hui.
- Aucun renommage de note de backlog, aucune suppression d'ID.
- Aucun changement du vocabulaire de statut du backlog (`todo` / `partial` / `vision`).
