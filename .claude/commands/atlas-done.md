---
description: Clôturer une feature terminée — plan, backlog, statut du doc de design, index
---

Clôture de la feature correspondant au plan : $ARGUMENTS

Si aucun plan n'est nommé, lister `docs/plans/*.md` et demander lequel clôturer.

Dérouler dans l'ordre. **Ne pas passer à l'étape suivante si la précédente échoue.**

1. **Vérifier que le travail est réellement terminé.** Exécuter les tests du périmètre concerné et constater le résultat. Si un test échoue, s'arrêter ici et le dire — ne rien clôturer sur une hypothèse.
2. **Extraire les pièges survivants du plan, avant toute suppression.** Un plan exécuté contient souvent la seule trace écrite d'un piège qui a coûté des heures. Le relire en entier et router ce qui survit :
   - piège **mécanique et transverse** (une commande à lancer, un flag, un comportement de build) → hook, skill, ou le `CLAUDE.md` le plus proche de ce qu'il protège ;
   - **caveat de design** (incompréhensible hors de son système) → le doc de design du système concerné.

   Si le plan n'en contient aucun, le dire explicitement plutôt que de sauter l'étape en silence. C'est la seule étape irréversible de cette procédure : ce qui n'est pas extrait ici disparaît avec le plan.
3. **Corriger le doc de design** de la feature : statut → implémenté, avec la portée réelle livrée et ce qui reste hors périmètre.
4. **Créer les notes** correspondant aux V2 et hors-périmètre annoncés par la feature, avec `status`, `domain`, `source`, `effort` et `verified` à la date du jour. On crée **avant** de fermer, pour qu'aucun instant ne voie l'ancien contenu disparu et le nouveau pas encore écrit.
5. **Fermer les notes de backlog couvertes** : les supprimer de `docs/backlog/`. Le vocabulaire de statut n'a pas de valeur `done` — un item terminé quitte le backlog. Si une partie seulement est livrée, le reste vit dans une note `todo` distincte (créée à l'étape 4), jamais en reliquat dans une note fermée.
6. **Supprimer le plan** dans `docs/plans/`.
7. **Régénérer les index** : `pnpm docs:index`.
8. **Clore les tâches** correspondantes, et consigner la clôture dans le journal de progression s'il en existe un.
9. **S'arrêter.** Ne rien commiter : la revue et le commit appartiennent à l'utilisateur. Présenter un résumé de ce qui a changé.
