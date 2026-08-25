---
description: Clôturer une feature terminée — plan, backlog, statut du doc de design, index
---

Clôture de la feature correspondant au plan : $ARGUMENTS

Si aucun plan n'est nommé, lister `memory/atlas/plans/*.md` et demander lequel clôturer.

Dérouler dans l'ordre. **Ne pas passer à l'étape suivante si la précédente échoue.**

1. **Vérifier que le travail est réellement terminé.** Exécuter les tests du périmètre concerné et constater le résultat. Si un test échoue, s'arrêter ici et le dire — ne rien clôturer sur une hypothèse.
2. **Extraire les pièges survivants du plan, avant toute suppression.** Un plan exécuté contient souvent la seule trace écrite d'un piège qui a coûté des heures. Le relire en entier et router ce qui survit :
   - piège **mécanique et transverse** (une commande à lancer, un flag, un comportement de build) → hook, skill, ou le `CLAUDE.md` le plus proche de ce qu'il protège ;
   - **caveat de design** (incompréhensible hors de son système) → le doc de design du système concerné.

   Si le plan n'en contient aucun, le dire explicitement plutôt que de sauter l'étape en silence. C'est la seule étape irréversible de cette procédure : ce qui n'est pas extrait ici disparaît avec le plan.
3. **Corriger le doc de design** de la feature : statut → implémenté, avec la portée réelle livrée et ce qui reste hors périmètre. Mettre à jour **le frontmatter** du doc (`status`, `shipped`, `summary`) **et** la ligne prose `> Statut :`. Les deux doivent raconter la même chose.
4. **Créer les notes** correspondant aux V2 et hors-périmètre annoncés par la feature. On crée **avant** de fermer, pour qu'aucun instant ne voie l'ancien contenu disparu et le nouveau pas encore écrit.

   Une note par item, dans `memory/atlas/backlog/`, nommée `<ID>-<slug>.md` :

   ```markdown
   ---
   id: PHYSICS-01
   status: todo
   domain: physics
   source: "[[character-controller]]"
   effort: M
   verified: 2026-08-20
   ---

   # Titre de l'item

   Ce qu'il reste à faire, en une à trois phrases.

   **Accroche :** la brique déjà en place, s'il y en a une.
   ```

   - `id` — `<DOMAIN>-<nn>`, cohérent avec le nom du fichier. Vérifie les IDs déjà pris : `grep -h '^id:' memory/atlas/backlog/*.md | sort`. Aucun identifiant ne se réutilise, même si sa note a été supprimée.
   - `status` — `todo`, `partial` ou `vision`. **Jamais `done`** : un item terminé quitte le backlog.
   - `domain` — `core`, `rendering`, `gameplay`, `physics`, `assets`, `debug`, `audio` ou `app`.
   - `source` — wikilink vers le doc de design, sans chemin ni extension, entre guillemets. Si le doc vit **hors** du vault (`apps/*/docs/`), utilise un lien markdown relatif à la place. S'il n'y a aucun doc de design, omets le champ plutôt que d'inventer une cible.
   - `effort` — `S`, `M` ou `L`.
   - `verified` — la date du jour, au format `AAAA-MM-JJ`. C'est la date à laquelle le statut a été confronté **au code**.
   - `legacyId` — seulement si l'item portait un identifiant dans un ancien système de suivi.
   - `Bloqué par :` — seulement pour une dépendance avérée, `[[nom-de-fichier-complet]]`, cible vérifiée existante. En cas de doute, omets : une fausse dépendance est pire qu'une absente.
5. **Fermer les notes de backlog couvertes** : les supprimer de `memory/atlas/backlog/`. Le vocabulaire de statut n'a pas de valeur `done` — un item terminé quitte le backlog. Si une partie seulement est livrée, le reste vit dans une note `todo` distincte (créée à l'étape 4), jamais en reliquat dans une note fermée.
6. **Supprimer le plan** dans `memory/atlas/plans/`.
7. **Vérifier les liens** : `node scripts/check-vault-links.mjs memory/atlas`. Aucun lien mort ne doit apparaître. Il n'y a plus d'index à régénérer — `backlog.base` est calculé à l'ouverture.
8. **Clore les tâches** correspondantes, et consigner la clôture dans le journal de progression s'il en existe un.
9. **S'arrêter.** Ne rien commiter : la revue et le commit appartiennent à l'utilisateur. Présenter un résumé de ce qui a changé.
