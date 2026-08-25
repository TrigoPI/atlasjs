---
id: GAMEPLAY-78
status: todo
domain: gameplay
source: "[[scripting-components]]"
effort: S
verified: 2026-08-25
---

# Code mort et surface publique inutilisée dans le scripting (note groupée, trois points)

1. `ScriptManager.setEnabled(scriptId, enabled)` (`src/scripting/runtime/ScriptManager.ts:139-147`) n'a **aucun appelant possible** dans le monorepo — vérifié : `attach` retourne l'instance (`:113`), jamais le `ScriptID`, donc un consommateur n'a aucun moyen d'obtenir l'argument.
2. `ScriptInstanceRecord.scriptType` (`ScriptManager.ts:91`, déclaré `src/scripting/core/core-types.ts:10`) est écrit et **jamais relu** : ce sont les deux seules occurrences du symbole dans tout le repo.
3. `getExposedFields` (`src/scripting/core/ScriptMetadata.ts:55-62`) n'est plus utilisé que par `test/script-metadata.test.ts`, le paquet `editor` ayant été supprimé.

**Mise à jour du 2026-08-25 : les points 1 et 2 sont partiellement caducs depuis le commit `162b89a`.** L'isolation d'erreur de la boucle de scripts pose désormais `record.isEnabled = false` pour mettre en quarantaine un script qui a levé, et lit `record.scriptType.name` pour le nommer dans le message d'erreur. Donc : le champ `isEnabled` n'est plus constant et le garde `!record.isEnabled` de `runLifecycle` n'est plus mort ; `scriptType` a un lecteur. **L'option « supprimer `isEnabled` + `scriptType` » est donc morte** — ces deux champs portent maintenant un vrai comportement.

Ce qui reste, et qui a changé de nature : `setEnabled` est toujours inatteignable, mais c'est devenu un **manque** plutôt qu'un surplus. Un script mis en quarantaine par cette isolation d'erreur l'est **définitivement** — il n'existe aucune voie de retour, puisque la seule méthode capable de le réactiver exige un `ScriptID` que personne ne peut obtenir. Le correctif n'est plus « supprimer ou exposer », c'est **exposer** : retourner un handle depuis `attach`, ou ajouter une surcharge `setEnabled(instance, enabled)`.

Reste inchangé : décider explicitement pour `getExposedFields` — API d'outillage à conserver en vue d'un éditeur, ou à retirer du barrel.

**Accroche :** `ScriptManager.ts:139-147` — donner à `setEnabled` un argument que l'appelant peut réellement obtenir ; le point 3 se tranche séparément.

**À rapprocher de :** le commit `162b89a` (`fix(gameplay): isolate script failures so one throw cannot kill the frame`) — c'est lui qui a rendu `isEnabled` vivant et créé le besoin de réactivation.
