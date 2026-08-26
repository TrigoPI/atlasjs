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
