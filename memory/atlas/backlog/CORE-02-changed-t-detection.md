---
id: CORE-02
status: todo
domain: core
source: "[[nexus-ecs]]"
effort: L
verified: 2026-08-19
---

# Détection de changement `Changed<T>`

Le `version` par store n'est aujourd'hui incrémenté que sur mutation **structurelle** (add/remove) et ne sert qu'au garde-fou fail-fast anti-mutation pendant l'itération d'une query — aucune API `Changed<T>` n'est exposée. Il reste à construire cette primitive : versionner aussi les écritures de valeur, pas seulement les changements structurels, puis l'exposer via l'API de query. C'est ce qui justifie un effort L plutôt que M — l'infrastructure `version` existante ne couvre que la moitié du problème.

**Accroche :** le compteur `version` déjà en place dans `ComponentStore`/`NexusQuery` donne la base à étendre.
