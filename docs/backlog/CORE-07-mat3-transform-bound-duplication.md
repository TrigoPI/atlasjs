---
id: CORE-07
status: todo
domain: core
effort: M
verified: 2026-08-25
---

# La primitive « AABB transformée par une matrice » est écrite deux fois dans deux paquets

`packages/gameplay/src/systems/utils/tilemap-geometry.ts:27-47` (`worldBoundToLocalBound`) et `packages/nebula/src/graphics/SpriteNode.ts:70-109` (`getWorldBound`) font exactement la même chose : transformer les 4 coins d'une AABB, puis prendre les min/max. C'est de la géométrie pure, qui n'a de raison de vivre ni dans un `systems/utils` gameplay ni dans un nœud nebula. Différence notable entre les deux : la version nebula est déjà déroulée et écrit dans un `out`, tandis que la version gameplay est la seule à **allouer** — 4 `Vec2` (`Mat3.transformPoint2` fait un `new Vec2` par coin, `Mat3.ts:61-67`) plus 1 `Bound` par appel, sur un chemin appelé par frame et par calque.

**Accroche :** ajouter `Mat3.transformBound(bound: Bound, out: Bound): Bound` à `@atlasjs/math`, en version déroulée sans allocation sur le modèle de `SpriteNode.getWorldBound`, puis faire de `worldBoundToLocalBound` un appel direct. `SpriteNode` travaille sur un `Mat4` (`Transformable.worldMatrix`) et ne migre donc pas automatiquement — le laisser tel quel. Attention : c'est un changement d'API publique de `@atlasjs/math`, donc `pnpm --filter @atlasjs/math build` obligatoire avant que les consommateurs le voient.
