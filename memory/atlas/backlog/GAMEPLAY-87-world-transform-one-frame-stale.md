---
id: GAMEPLAY-87
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: M
verified: 2026-08-25
---

# `worldPosition` peut renvoyer une valeur vieille d'une frame

`TransformPropagationSystem` écrit `WorldTransform2D` au stage **`Late`**, et les scripts lisent au stage **`Logic`** de la frame suivante. Un script qui mute son `Transform2D` pendant `Logic` — via `setPosition`, `translate`, `setRotation`… — puis lit `worldPosition` dans la même frame obtient donc la composition calculée à la frame **précédente**, pas celle qui correspond à l'état courant. Sur une hiérarchie qui bouge, l'écart est d'une frame de déplacement, ce qui suffit à décaler une résolution de touche ou un accessoire équipé.

Distinct du bug corrigé par `9a4f4e9`, qui traitait le cas où **aucun** cache n'existe (entité créée dans la frame courante, ancêtres purement ignorés). Ce ticket porte sur le cas nominal, cache présent mais périmé. Le correctif de `9a4f4e9` n'aggrave rien — le chemin nominal est inchangé — mais il crée une asymétrie contre-intuitive : pendant sa frame de création une entité lit une composition **fraîche**, et dès le premier `Late` passé elle lit un cache potentiellement vieux d'une frame.

Piste de correctif peu coûteuse, relevée en corrigeant le ticket précédent : le token `Transform` est le **point d'écriture unique** des transforms locaux — `setPosition`, `setRotation`, `setScale`, `translate`, `rotate` passent tous par `requireComponent(entity, Transform2D)` dans `src/scripting/components/Transform.ts`. Un compteur de version incrémenté à l'écriture, comparé à une version stockée sur `WorldTransform2D`, permettrait à `worldMatrix` de retomber sur la composition d'ancêtres — qui existe et est correcte depuis `9a4f4e9` — quand le cache est détecté périmé. Aucun changement de scheduler, coût nul quand rien ne bouge.

Attention avant de s'engager : le point d'écriture n'est unique que **pour les scripts**. Un système ou du code applicatif qui mute `Transform2D` directement via `world.requireComponent(...)` contournerait le compteur, et la péremption resterait invisible dans ce cas — à inventorier avant, sous peine d'une fausse garantie. L'alternative grossière (dupliquer ou réordonnancer la passe de propagation en fin de `Logic`) coûte une passe complète par frame et est à éviter tant que le compteur est jouable.

**Accroche :** `src/scripting/components/Transform.ts` — les cinq mutateurs du token, et la branche cache de `worldMatrix`. Écrire d'abord le test qui échoue : muter la position d'un parent dans un `onUpdate`, puis lire `worldPosition` sur son enfant dans la même frame.
