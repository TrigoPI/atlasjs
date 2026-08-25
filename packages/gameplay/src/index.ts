export { Key } from "@atlasjs/input";
export { Color } from "@atlasjs/nebula";

export { defineCollisionLayers, ALL_LAYERS, NO_LAYERS } from "@atlasjs/inertia";

export * from "./tokens";
export * from "./components";
export * from "./camera";
export * from "./rendering";
export * from "./scripting";
export * from "./prefab";
export * from "./registerSystem";
export * from "./GameplayPlugin";

export { OccluderStrip } from "./components/OccluderStrip";
export { OccluderRenderSystem } from "./systems/OccluderRenderSystem";
export { bakeOccluderStrips } from "./systems/utils/bake-occluder-strips";
export type {
  OccluderRegion,
  OccluderStripData,
} from "./systems/utils/bake-occluder-strips";

export type {
  CollisionLayer,
  CollisionMask,
  CollisionLayers,
  ColliderShapeDesc,
  BoxColliderShapeDesc,
  CircleColliderShapeDesc,
  CapsuleColliderShapeDesc,
} from "@atlasjs/inertia";

export {
  defineActions,
  button,
  value,
  vector2,
  ButtonAction,
  ValueAction,
  Vector2Action,
} from "@atlasjs/input";

export type {
  ActionKind,
  ActionMapDescriptor,
  ActionFor,
  ButtonActionSpec,
  ValueActionSpec,
  Vector2ActionSpec,
} from "@atlasjs/input";

export {
  SpriteSheet,
  SpriteAnimation,
  AnimationPlayer,
  Frame,
  Sprite,
  SpriteAsset,
  SpriteLoader,
  Tile,
  TileSet,
  TileSetAsset,
  TileSetLoader,
} from "@atlasjs/nebula";

export type {
  SpriteAnimationOptions,
  FromGridOptions,
  FromAutoGridOptions,
  SpriteOptions,
  SpriteAssetOptions,
  TileSetOptions,
  TileSetAssetOptions,
} from "@atlasjs/nebula";
