---
id: GAMEPLAY-33
status: vision
domain: gameplay
source: "[[exposed-script-variables]]"
effort: M
verified: 2026-08-19
---

# (Dé)sérialisation des valeurs exposées et des refs d'entité

`registerScriptMetadata`/`ScriptMetadata.ts` restent purement en mémoire (`WeakMap`) : aucune (dé)sérialisation des valeurs de champs exposés, ni des références d'entité, vers ou depuis une scène ou un prefab sur disque. Une ref d'entité sérialisée suppose en particulier des ids d'entité stables cross-session, à lier au futur chantier d'assets référencés par id.
