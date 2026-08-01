# Graph Report - .  (2026-08-01)

## Corpus Check
- Large corpus: 647 files · ~241,442 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3545 nodes · 6803 edges · 218 communities (161 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.82)
- Token cost: 468,129 input · 0 output

## Community Hubs (Navigation)
- Gameplay Script Facades
- Render Queue & Batchers
- Shader Types & Vertex Layouts
- Scene Graph Shape Nodes
- Sprite Sheet Animation
- Nebula Renderer Facade
- Material & Binding Resources
- Sprite Assets & Animator
- WebGPU Binding Groups
- Nexus World & Commands
- Scheduler Lanes & Stages
- Asset Manager
- Gameplay Physics Components
- Dino Brawl App TS Config
- ECS Queries & Transform Propagation
- WebGPU Buffers & Binder
- Engine Plugins & Services
- Scene Management
- Tilemap & TileSet Assets
- WebGPU Instanced Batches
- Entity Storage (Sparse Set)
- Root Workspace Scripts
- ECS Hierarchy Relations
- Gameplay Package Manifest
- Shader Type Guards
- WebGPU Demo Manifest
- Fake Rigid Body Test Double
- Input Action Bindings
- 2D Vector & Transform Math
- WebGPU Pipeline Cache
- Rapier Rigid Body
- Gameplay Camera
- Tilemap Render & Grid Geometry
- Sorting Layers & Sprite Render
- Inertia Rigid Body Contract
- WebGPU Samplers & Shader List
- Dino Brawl Arena Scene
- WebGPU Demo TS Config
- Rapier Package Manifest
- Tiled Bridge Design
- Script Runtime Manager
- WebGPU Renderer Core
- Script Component Aliases
- Dino Brawl Node TS Config
- Tilemap & Sprite Design Docs
- Input API Script Service
- Component Registry & Query Filters
- Editor Package Manifest
- Keyboard Backend
- Keyboard Input Actions
- Nebula WebGPU Manifest
- Dino Brawl Atlas Dependencies
- Dino Brawl Dev Dependencies
- Scheduling & Asset Design Docs
- Fake Collider Test Double
- Inertia Physics Contracts
- Nebula Package Manifest
- Sprite Node Renderer
- Nexus Plugin & ECS Tests
- Component Store Iteration
- Dino Brawl Gameplay Scripts
- Tiled Map Math
- Gameplay Redesign Principles
- Engine Package Conventions
- Debug Package Manifest
- Editor Gizmo Tools
- Script Lifecycle & GameEntity
- Inertia Collider Contract
- DOM Input Backend
- Tiled GID Decoding
- Inertia Package Manifest
- Input Package Manifest
- WebGPU Material Layout
- Nexus Package Manifest
- ECS Query Contract
- Rapier Collider
- ECS & Hierarchy Design Docs
- Shader & Material Authoring Design
- Engine Boot & Plugins
- Input Action Map Runtime
- Observable Transform Math
- WGSL Reflection
- Script Variable Exposure Design
- Render Submission Design
- Shapes & Canvas Resize Design
- Assets Package Manifest
- Editor Picking & Drag Events
- Fake Physics World
- Observable Vec2
- Rapier Units & Queries
- Logging Transports
- Input & Camera Design Docs
- Script Token Model Design
- Editor Picking System
- Script Context & Tokens
- Mat4 Matrix Math
- Math Like-Interfaces
- Base TS Compiler Config
- Stateless Script Proxies Design
- Core Package Manifest
- Typed Event Bus
- Debug TS Config
- Math Package Manifest
- Vec3 Math
- WebGPU Textures
- Color Utility
- Turborepo Task Pipeline
- Tiled Map Builder
- Tiled Document Traversal
- Tilemap & Collider Design Notes
- Character Controller
- Inertia Physics Plugin
- Math Constants & Utils
- Nebula Camera2D
- Rapier Physics World
- AtlasJS Project Overview
- Pointer Backend
- Vec4 Math
- WebGPU Surface & Resize
- Rapier Collider Mappers
- Dino Brawl React Shell
- Editor Scale Tool & Box2
- Script Service Access
- Runtime Script Context
- Script Metadata Registry
- Math Package Exports
- Mat3 Matrix Math
- Material Shader Builder
- Rapier Init & Constants
- Utils Observable & Callbacks
- Dino Brawl Package Scripts
- Sword Script
- Asset Loader Design
- Unified Backlog
- Input Service & Render Seams
- Utils Package Manifest
- Logger Factory & Levels
- Transform Propagation Design
- Editor Gizmo
- Material Serialization Design
- Frame Clock & RAF Loop
- Clock Utility
- Tiled Asset Resolver
- Collision Filtering Findings
- Script Attach & Props Injection
- GameEntity Handle
- Gameplay Test TS Config
- Collision Layers
- Pointer Facade
- Instance Buffer Pool
- Nebula WebGPU TS Config
- Rapier TS Config
- Gizmo Handle Types
- Physics Raycast & Overlap
- Transformable Node Base
- Query Each Tests
- WebSocket Log Client
- Debug Log Server
- Selection Overlay Tool
- WebGPU Uniform Buffer
- Rapier Rigid Body Mapper
- WebSocket Transport Impl
- App HTML Entry Points
- Assets TS Config
- Core TS Config
- Editor TS Config
- Player Input Tests
- Gameplay TS Config
- Inertia TS Config
- Input TS Config
- Math TS Config
- Nebula TS Config
- Nexus TS Config
- Utils TS Config
- Determinism Test Provider
- Gameplay Test Harness
- Box2 Bounds
- Dino Brawl TS Root Config
- Fixed Lane Invariants
- WASD Vector Builder
- Gameplay Dependency Edge
- Nexus Dependency Edge
- React Dependency
- ESLint Dependency
- React Hooks ESLint Dep
- wgsl_reflect ESM Gotchas
- Nebula Plugin Options
- Rapier Unit-Aware Queries
- Event Bus Note

## God Nodes (most connected - your core abstractions)
1. `Entity` - 106 edges
2. `AtlasScript` - 60 edges
3. `NexusWorld` - 50 edges
4. `Node` - 46 edges
5. `Renderer` - 43 edges
6. `Component` - 43 edges
7. `WebGPURenderer` - 42 edges
8. `RigidBody` - 39 edges
9. `WebGPUBindingGroup` - 35 edges
10. `Vec2` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Dependency direction rapier→inertia, gameplay→inertia` --semantically_similar_to--> `Core stays standalone (only @atlasjs/utils)`  [INFERRED] [semantically similar]
  docs/physics/collision-layer.md → packages/core/CLAUDE.md
- `defineActions (serializable ActionMapDescriptor)` --semantically_similar_to--> `Code-first-first principle`  [INFERRED] [semantically similar]
  packages/input/CLAUDE.md → docs/rendering/material-graph.md
- `wgsl_reflect module-field ESM gotcha` --semantically_similar_to--> `wgsl_reflect ESM/CJS resolution gotcha`  [INFERRED] [semantically similar]
  packages/nebula-webgpu/CLAUDE.md → docs/rendering/shaders-materials.md
- `GameEntity (stateless cross-entity handle)` --conceptually_related_to--> `Stateless proxies invariant`  [INFERRED]
  packages/gameplay/CLAUDE.md → docs/gameplay/scripting-components.md
- `pnpm dependency catalog (babel decorators plugins)` --conceptually_related_to--> `Magic getters + registry (superseded)`  [AMBIGUOUS]
  pnpm-workspace.yaml → docs/gameplay/scripting-components.md

## Import Cycles
- 3-file cycle: `packages/nebula/src/core/core-types.ts -> packages/nebula/src/core/material/index.ts -> packages/nebula/src/core/material/Material.ts -> packages/nebula/src/core/core-types.ts`
- 3-file cycle: `packages/nebula/src/core/core-types.ts -> packages/nebula/src/core/geometry/index.ts -> packages/nebula/src/core/geometry/Quad.ts -> packages/nebula/src/core/core-types.ts`
- 3-file cycle: `packages/nebula/src/core/core-types.ts -> packages/nebula/src/core/geometry/index.ts -> packages/nebula/src/core/geometry/Primitive.ts -> packages/nebula/src/core/core-types.ts`
- 3-file cycle: `packages/gameplay/src/scripting/core/AtlasScript.ts -> packages/gameplay/src/scripting/core/GameEntity.ts -> packages/gameplay/src/scripting/core/core-types.ts -> packages/gameplay/src/scripting/core/AtlasScript.ts`
- 4-file cycle: `packages/nexus/src/command/CommandBuffer.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/command/index.ts -> packages/nexus/src/command/CommandBuffer.ts`
- 4-file cycle: `packages/nexus/src/component/ComponentRegistry.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/component/index.ts -> packages/nexus/src/component/ComponentRegistry.ts`
- 4-file cycle: `packages/nexus/src/component/ComponentStore.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/component/index.ts -> packages/nexus/src/component/ComponentStore.ts`
- 4-file cycle: `packages/nexus/src/component/SparseSet.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/component/index.ts -> packages/nexus/src/component/SparseSet.ts`
- 4-file cycle: `packages/nexus/src/component/define-component.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/component/index.ts -> packages/nexus/src/component/define-component.ts`
- 4-file cycle: `packages/nexus/src/entity/EntityManager.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/entity/index.ts -> packages/nexus/src/entity/EntityManager.ts`
- 4-file cycle: `packages/nexus/src/entity/entity.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/entity/index.ts -> packages/nexus/src/entity/entity.ts`
- 4-file cycle: `packages/nexus/src/hierarchy/Children.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/hierarchy/index.ts -> packages/nexus/src/hierarchy/Children.ts`
- 4-file cycle: `packages/nexus/src/hierarchy/Parent.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/hierarchy/index.ts -> packages/nexus/src/hierarchy/Parent.ts`
- 4-file cycle: `packages/nexus/src/query/EmptyQuery.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/query/index.ts -> packages/nexus/src/query/EmptyQuery.ts`
- 4-file cycle: `packages/nexus/src/query/NexusQuery.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/query/index.ts -> packages/nexus/src/query/NexusQuery.ts`
- 4-file cycle: `packages/nexus/src/query/Query.ts -> packages/nexus/src/types.ts -> packages/nexus/src/world/NexusWorld.ts -> packages/nexus/src/query/index.ts -> packages/nexus/src/query/Query.ts`
- 4-file cycle: `packages/nebula/src/animations/AnimationPlayer.ts -> packages/nebula/src/graphics/index.ts -> packages/nebula/src/graphics/SpriteNode.ts -> packages/nebula/src/animations/index.ts -> packages/nebula/src/animations/AnimationPlayer.ts`
- 4-file cycle: `packages/nebula/src/animations/SpriteAnimation.ts -> packages/nebula/src/graphics/index.ts -> packages/nebula/src/graphics/SpriteNode.ts -> packages/nebula/src/animations/index.ts -> packages/nebula/src/animations/SpriteAnimation.ts`
- 4-file cycle: `packages/nebula/src/core/buffers/IndexBuffer.ts -> packages/nebula/src/core/utils/index.ts -> packages/nebula/src/core/utils/IDGenerator.ts -> packages/nebula/src/core/buffers/index.ts -> packages/nebula/src/core/buffers/IndexBuffer.ts`
- 4-file cycle: `packages/nebula/src/core/buffers/UniformBuffer.ts -> packages/nebula/src/core/utils/index.ts -> packages/nebula/src/core/utils/IDGenerator.ts -> packages/nebula/src/core/buffers/index.ts -> packages/nebula/src/core/buffers/UniformBuffer.ts`

## Hyperedges (group relationships)
- **Asset descriptor → resource load pipeline** — docs_assets_asset_system_asset, docs_assets_asset_system_resource, docs_assets_asset_system_assetmanager, docs_assets_asset_system_assetloader, docs_assets_asset_system_loadcontext, docs_assets_asset_system_textureloader, docs_assets_asset_system_spriteloader [EXTRACTED 1.00]
- **Physics bridge with authority declared by body type** — docs_gameplay_gameplay_redesign_physicspushsystem, docs_gameplay_gameplay_redesign_physicspullsystem, docs_gameplay_gameplay_redesign_physicsbodyref, docs_gameplay_gameplay_redesign_authority_by_body_type, docs_gameplay_entity_hierarchy_transformpropagationsystem, docs_gameplay_entity_hierarchy_worldtransform2d [EXTRACTED 1.00]
- **Single ordering authority: lanes → stages → constraints** — docs_core_scheduling_lane, docs_core_scheduling_stage_vocabulary, docs_core_scheduling_stepspec, docs_core_scheduling_stephandle, docs_core_scheduling_stepset, docs_core_nexus_ecs_hybrid_flush, docs_core_scheduling_registersystem [EXTRACTED 1.00]
- **Y-sorting / sorting-layer pipeline** — docs_rendering_sorting_layers_sortinglayers_registry, docs_rendering_sorting_layers_ysort_mode, docs_rendering_sorting_layers_node_sort_fields, docs_rendering_sorting_layers_multi_criteria_comparator, docs_rendering_sorting_layers_pivot_sort_point, docs_rendering_sorting_layers_frame_pivot [EXTRACTED 1.00]
- **Collider → filtered contact → script callback chain** — docs_physics_collision_layer_definecollisionlayers, docs_physics_collision_layer_packcollisiongroups, docs_physics_collision_layer_mapcolliderdesc, docs_physics_collision_layer_collider2d, docs_physics_collision_layer_physicspushsystem_collider_pass, docs_physics_collision_layer_rapierphysicsworld_eventqueue, docs_physics_collision_layer_physicscollisionsystem, docs_physics_collision_layer_userdata_entity_mapping [EXTRACTED 1.00]
- **Unified instanced-batch draw path** — docs_rendering_shapes_instancedbatch, docs_rendering_shapes_drawinstancedbatch, docs_rendering_shapes_webgpuinstancedbatch, docs_rendering_renderer_architecture_spritebatch_instancing, docs_gameplay_tilemap_tilemapbatcher, docs_rendering_renderer_architecture_instance_buffer_pool [INFERRED 0.95]

## Communities (218 total, 57 thin omitted)

### Community 0 - "Gameplay Script Facades"
Cohesion: 0.05
Nodes (37): RigidBody2D, Transform2D, GameplayPlugin, Transform, AtlasScript, registerScriptMetadata(), ScriptMetadata, SCRIPT_MANAGER (+29 more)

### Community 1 - "Render Queue & Batchers"
Cohesion: 0.07
Nodes (22): SpriteBatch, Sampler, TileMapNode, ShapeBatcher, SpriteBatcher, TileMapBatcher, DrawCommand, SpriteDrawCommand (+14 more)

### Community 2 - "Shader Types & Vertex Layouts"
Cohesion: 0.04
Nodes (48): IndexBuffer, VertexBuffer, VertexBufferLayout, BOOL, DEFAULT_RENDER_STATE, FLOAT, INT, MAT3 (+40 more)

### Community 3 - "Scene Graph Shape Nodes"
Cohesion: 0.05
Nodes (13): BlendMode, CircleNode, TraverseCallback, LineNode, Node, RectNode, ShapeNode, TileInstance (+5 more)

### Community 4 - "Sprite Sheet Animation"
Cohesion: 0.05
Nodes (9): Bound, FromAutoGridOptions, FromGridOptions, SpriteAnimationOptions, AnimationPlayer, Frame, SpriteAnimation, SpriteSheet (+1 more)

### Community 5 - "Nebula Renderer Facade"
Cohesion: 0.06
Nodes (17): TextureAsset, TextureAssetOptions, TextureLoader, SamplerDescriptor, Texture2DDescriptor, TextureFormat, Renderer, PassDescriptor (+9 more)

### Community 6 - "Material & Binding Resources"
Cohesion: 0.08
Nodes (14): BindingGroup, BindingGroupDefinition, UniformBuffer, BindingGroupProperty, RenderState, ShaderDescriptor, Material, Shader (+6 more)

### Community 7 - "Sprite Assets & Animator"
Cohesion: 0.08
Nodes (16): Sprite, SpriteOptions, getPivotKey(), getRectKey(), SpriteAsset, SpriteAssetOptions, SpriteLoader, Animator (+8 more)

### Community 8 - "WebGPU Binding Groups"
Cohesion: 0.07
Nodes (8): WebGPUBindingGroup, WebGPUBindingGroupDefinition, WebGPUFrameGlobals, WebGPUMaterial, WebGPUReflectedGroup, WebGPUReflectedStorage, WebGPUGuard, WebGPUShaderTypeGuard

### Community 9 - "Nexus World & Commands"
Cohesion: 0.08
Nodes (5): CommandBuffer, CommandTarget, NexusCommandBuffer, SparseSetStore, Entity

### Community 10 - "Scheduler Lanes & Stages"
Cohesion: 0.10
Nodes (17): asArray(), Entry, LaneSchedulerImpl, SchedulerCycleError, StepSetImpl, FIXED_STAGES, RENDER_STAGES, STAGES_BY_LANE (+9 more)

### Community 11 - "Asset Manager"
Cohesion: 0.13
Nodes (11): Asset, AssetLoader, AssetManager, AssetPlugin, LoadContext, Resource, ASSET_MANAGER, CompositeLoader (+3 more)

### Community 12 - "Gameplay Physics Components"
Cohesion: 0.08
Nodes (11): Camera, Collider2D, PhysicsBodyRef, PhysicsColliderRef, PlayerInput, registerSystem(), PhysicsPullSystem, PhysicsPushSystem (+3 more)

### Community 13 - "Dino Brawl App TS Config"
Cohesion: 0.05
Nodes (37): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+29 more)

### Community 14 - "ECS Queries & Transform Propagation"
Cohesion: 0.15
Nodes (6): controllingBody(), worldMatrix(), Component, ComponentListener, Unsubscribe, NexusWorld

### Community 15 - "WebGPU Buffers & Binder"
Cohesion: 0.12
Nodes (8): WebGPUBinder, WebGPUIndexBuffer, WebGPUVertexBuffer, WebGPUGeometry, WebGPURenderContext, WebGPURenderState, WebGPURenderContextOptions, Recorded

### Community 16 - "Engine Plugins & Services"
Cohesion: 0.11
Nodes (11): Deferred, PluginDependencies, BootTimeoutError, DependencyCycleError, DuplicateProviderError, MissingDependencyError, ServiceRegistry, EngineOptions (+3 more)

### Community 17 - "Scene Management"
Cohesion: 0.11
Nodes (8): Scheduler, EngineEvents, StepSet, Scene, SceneContext, SceneManager, ManualLoop, ProbeScene

### Community 18 - "Tilemap & TileSet Assets"
Cohesion: 0.10
Nodes (7): Tile, TileSet, TileSetOptions, TileSetAsset, TileSetAssetOptions, TileSetLoader, TileMap

### Community 19 - "WebGPU Instanced Batches"
Cohesion: 0.08
Nodes (5): WebGPUInstancedBatch, WebGPUShapeBatch, WebGPUSpriteBatch, WebGPUShaderCache, WebGPUShader

### Community 20 - "Entity Storage (Sparse Set)"
Cohesion: 0.08
Nodes (9): SparseSet, ENTITY_INDEX_BITS, ENTITY_INDEX_CAPACITY, ENTITY_MAX_GENERATION, entityGeneration(), entityIndex(), makeEntity(), EntityManager (+1 more)

### Community 21 - "Root Workspace Scripts"
Cohesion: 0.06
Nodes (30): @babel/plugin-proposal-decorators, devDependencies, @babel/plugin-proposal-decorators, prettier, rimraf, @rolldown/plugin-babel, tsdown, turbo (+22 more)

### Community 22 - "ECS Hierarchy Relations"
Cohesion: 0.13
Nodes (9): defaultComponentRegistry, Children, Parent, StoreResolver, ComponentID, ComponentList, NexusSystemContext, NexusSystem (+1 more)

### Community 23 - "Gameplay Package Manifest"
Cohesion: 0.07
Nodes (29): dependencies, @atlasjs/assets, @atlasjs/core, @atlasjs/inertia, @atlasjs/input, @atlasjs/math, @atlasjs/nebula, @atlasjs/nexus (+21 more)

### Community 24 - "Shader Type Guards"
Cohesion: 0.17
Nodes (7): BindingGroupLayout, BindingValue, ResourcePropertyLayout, ShaderValueType, UniformPropertyLayout, BindingGroupLayoutHelper, ShaderTypeGuard

### Community 25 - "WebGPU Demo Manifest"
Cohesion: 0.07
Nodes (28): dependencies, @atlasjs/gameplay, @atlasjs/math, @atlasjs/nebula, @atlasjs/nebula-webgpu, @atlasjs/nexus, @atlasjs/utils, devDependencies (+20 more)

### Community 27 - "Input Action Bindings"
Cohesion: 0.17
Nodes (12): ActionKind, AnyActionSpec, ValueActionSpec, ValueSource, Vector2ActionSpec, Vector2Composite, ActionKinds, ActionKindsOf (+4 more)

### Community 29 - "WebGPU Pipeline Cache"
Cohesion: 0.13
Nodes (7): WebGPUBindingGroupCache, WebGPUPipeline, WebGPUPipelineFactory, WebGPUBlend, PipelineKeySpec, WebGPUPipelineDescriptor, indexed

### Community 31 - "Gameplay Camera"
Cohesion: 0.11
Nodes (8): CameraManager, CAMERA_MANAGER, CameraApi, CameraSyncSystem, fakeNebula(), setup(), fakeNebula(), setup()

### Community 32 - "Tilemap Render & Grid Geometry"
Cohesion: 0.15
Nodes (8): Grid, TileMapRenderer, WorldTransform2D, TileMapRenderSystem, cellOrigin, CellRange, visibleCellRange(), worldBoundToLocalBound()

### Community 33 - "Sorting Layers & Sprite Render"
Cohesion: 0.11
Nodes (8): applySortFields(), SortTarget, LayerEntry, SortingLayers, SortMode, SORTING_LAYERS, MountedSprite, SpriteRenderSystem

### Community 35 - "WebGPU Samplers & Shader List"
Cohesion: 0.16
Nodes (9): WebGPUShaderParams, WebGPUSampler, WebGPUBuiltinShaders, WebGPUShaders, BINDING_GROUP_GLOBAL, BINDING_GROUP_MATERIAL, BINDING_GROUP_OBJECT, BLACK (+1 more)

### Community 36 - "Dino Brawl Arena Scene"
Cohesion: 0.18
Nodes (12): ArenaScene, CollisionLayers, MAP_SCALE, SortingLayer, SortingOrder, ResourcesPath, spawnCamera(), spawnPlayer() (+4 more)

### Community 37 - "WebGPU Demo TS Config"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+17 more)

### Community 38 - "Rapier Package Manifest"
Cohesion: 0.08
Nodes (25): @dimforge/rapier2d-compat, dependencies, @atlasjs/core, @atlasjs/inertia, @atlasjs/math, @atlasjs/utils, @dimforge/rapier2d-compat, devDependencies (+17 more)

### Community 39 - "Tiled Bridge Design"
Cohesion: 0.12
Nodes (26): TextureLoader, Named sorting layers + order-in-layer, ArenaScene (ex EcsScene), Dino Brawl cleanup workstream, game/config.ts (SortingLayer, CollisionLayers, SortingOrder, MAP_SCALE), Browser verification protocol, Dino Brawl cleanup implementation plan, import type constraint under Vite (+18 more)

### Community 40 - "Script Runtime Manager"
Cohesion: 0.13
Nodes (8): ScriptID, ScriptInstanceRecord, IncrementalScriptIdGenerator, AttachProps, PropsOf, PropsOfArgs, ScriptManager, PhysicsCollisionSystem

### Community 42 - "Script Component Aliases"
Cohesion: 0.09
Nodes (14): Collider, RigidBody, SpriteRenderer, ENTITY, TransformHandle, defineScriptComponent(), AliasProbe, sprite (+6 more)

### Community 43 - "Dino Brawl Node TS Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+14 more)

### Community 44 - "Tilemap & Sprite Design Docs"
Cohesion: 0.10
Nodes (23): AnimatorSystem, Frame (texture + rect), Map<Frame, Sprite> system-level cache, Reuse the SpriteRender sprite-swap path, SpriteSheet (nebula), Tile (thin extension seam), TileMapNode (nebula instance bag), TileMapRenderer (layer render params) (+15 more)

### Community 45 - "Input API Script Service"
Cohesion: 0.10
Nodes (8): ScriptService, InputApi, FakeInput, FakeFacade, BrokenFacade, FAKE, FakeFacade, FakeService

### Community 46 - "Component Registry & Query Filters"
Cohesion: 0.09
Nodes (7): ComponentRegistry, Position, Position, Position, Frozen, Position, Velocity

### Community 47 - "Editor Package Manifest"
Cohesion: 0.09
Nodes (21): dependencies, @atlasjs/core, @atlasjs/input, @atlasjs/math, @atlasjs/nebula, @atlasjs/utils, exports, @atlasjs/core (+13 more)

### Community 48 - "Keyboard Backend"
Cohesion: 0.13
Nodes (3): BackendKeyboard, Keyboard, CTX

### Community 49 - "Keyboard Input Actions"
Cohesion: 0.12
Nodes (6): ButtonActionSpec, ButtonBuilder, ValueBuilder, ButtonAction, Input, Key

### Community 50 - "Nebula WebGPU Manifest"
Cohesion: 0.09
Nodes (21): dependencies, @atlasjs/math, @atlasjs/nebula, @atlasjs/utils, devDependencies, @webgpu/types, exports, @atlasjs/math (+13 more)

### Community 51 - "Dino Brawl Atlas Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @atlasjs/assets, @atlasjs/core, @atlasjs/inertia, @atlasjs/input, @atlasjs/math, @atlasjs/nebula, @atlasjs/nebula-webgpu (+13 more)

### Community 52 - "Dino Brawl Dev Dependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @eslint/js, eslint-plugin-react-refresh, globals, @types/node, @types/react, @types/react-dom, typescript (+13 more)

### Community 53 - "Scheduling & Asset Design Docs"
Cohesion: 0.15
Nodes (21): ASSET_MANAGER service token, AssetPlugin, NebulaPlugin → AssetPlugin coupling, Scheduling Phase 3 — Physics dt, Auto-flush at lane Sync, Engine.advanceFixed seam, Engine loop: fixed×N → update → render+alpha, Fixed-step determinism (rollback-ready, not deterministic) (+13 more)

### Community 55 - "Inertia Physics Contracts"
Cohesion: 0.17
Nodes (11): BoxColliderShapeDesc, CapsuleColliderShapeDesc, CircleColliderShapeDesc, ColliderShapeDesc, CollisionHandler, PhysicsWorldOptions, PolygonColliderShapeDesc, RigidBodyDesc (+3 more)

### Community 56 - "Nebula Package Manifest"
Cohesion: 0.10
Nodes (20): dependencies, @atlasjs/assets, @atlasjs/core, @atlasjs/math, @atlasjs/utils, exports, @atlasjs/assets, @atlasjs/core (+12 more)

### Community 58 - "Nexus Plugin & ECS Tests"
Cohesion: 0.12
Nodes (8): NexusPlugin, NEXUS, Frozen, Position, Tag, Frozen, Position, Velocity

### Community 60 - "Dino Brawl Gameplay Scripts"
Cohesion: 0.12
Nodes (5): DinoControls, CameraFollowScript, CameraZoomScript, PlayerAnimationScript, PlayerMovementScript

### Community 61 - "Tiled Map Math"
Cohesion: 0.27
Nodes (15): colliderFromRect(), groupCellsByTileset(), MapCollider, tileObjectPlacement(), TilePlacement, worldPointFromObject(), ObjectBase, PointObject (+7 more)

### Community 62 - "Gameplay Redesign Principles"
Cohesion: 0.12
Nodes (20): Performance Principle, B3 — Transform as pure data, Changed<T> tick-based change detection, world.onAdd / world.onRemove, PhysicsPull restricted to dynamic bodies, worldPositionStays reparent semantics, Authority declared by body type, Dynamic teleport before body creation (+12 more)

### Community 63 - "Engine Package Conventions"
Cohesion: 0.11
Nodes (20): nebula texture-level vs gameplay tile-level boundary, Dependency direction rapier→inertia, gameplay→inertia, NebulaRenderer.resize passthrough, "Default" layer pre-seeded at index 0 (retro-compat), nebula mechanical / gameplay semantic split, SortingLayers registry (named, ordered, code-first), Core stays standalone (only @atlasjs/utils), Lanes (fixed / update / render) (+12 more)

### Community 64 - "Debug Package Manifest"
Cohesion: 0.10
Nodes (19): dependencies, @atlasjs/utils, ws, devDependencies, @types/node, @types/ws, @atlasjs/utils, @types/node (+11 more)

### Community 65 - "Editor Gizmo Tools"
Cohesion: 0.18
Nodes (3): GizmoTool, GizmoContext, DragTool

### Community 68 - "DOM Input Backend"
Cohesion: 0.17
Nodes (5): BackendInput, DomInputBackend, InputPlugin, INPUT, InputPluginOptions

### Community 69 - "Tiled GID Decoding"
Cohesion: 0.16
Nodes (14): FLIP_D, FLIP_H, FLIP_V, GID_MASK, ResolvedGid, resolveGid(), TiledGroupLayer, TiledLayer (+6 more)

### Community 70 - "Inertia Package Manifest"
Cohesion: 0.11
Nodes (18): dependencies, @atlasjs/core, @atlasjs/math, @atlasjs/utils, exports, @atlasjs/core, @atlasjs/math, @atlasjs/utils (+10 more)

### Community 71 - "Input Package Manifest"
Cohesion: 0.11
Nodes (18): dependencies, @atlasjs/core, @atlasjs/math, @atlasjs/utils, exports, @atlasjs/core, @atlasjs/math, @atlasjs/utils (+10 more)

### Community 73 - "Nexus Package Manifest"
Cohesion: 0.11
Nodes (18): dependencies, @atlasjs/core, @atlasjs/math, @atlasjs/utils, exports, @atlasjs/core, @atlasjs/math, @atlasjs/utils (+10 more)

### Community 76 - "ECS & Hierarchy Design Docs"
Cohesion: 0.18
Nodes (18): Hybrid command buffer, ComponentRegistry, Generational entities, Fail-fast structural-change guard, IComponentStore seam, Multi-world isolation, Nexus ECS (@atlasjs/nexus), Perf target 1k–3k entities @ 60fps (+10 more)

### Community 77 - "Shader & Material Authoring Design"
Cohesion: 0.13
Nodes (18): Topological walker → WGSL compilation, @atlasjs/material-graph optional package, MaterialGraph (serializable DAG + code-first builder), ObservableTransform2D dirty-flag propagation, Missing render/submission layer, Three-layer architecture (scene / render / RHI), Binding-group versioning fix (no reference short-circuit), defineMaterial easy path (material { } block) (+10 more)

### Community 78 - "Engine Boot & Plugins"
Cohesion: 0.20
Nodes (5): Engine, Plugin, TestPlugin, runFixed(), runFixedMany()

### Community 79 - "Input Action Map Runtime"
Cohesion: 0.14
Nodes (8): button(), value(), vector2(), ActionMapDescriptor, defineActions(), createAction(), InputActionMap, FakeInput

### Community 81 - "WGSL Reflection"
Cohesion: 0.16
Nodes (7): wgsl_reflect, ArrayTypeLike, MemberLike, VariableLike, WebGPUReflectedShader, WebGPUReflection, wgsl_reflect

### Community 82 - "Script Variable Exposure Design"
Cohesion: 0.12
Nodes (17): Dependency reference by value, Custom TypeScript compiler, Technical debt — dino-brawl tsc -b red, Dead code removal, A script is per-frame behaviour; composition lives in the spawn function, AtlasScript<TProps> phantom typing, AttachProps mapped type, Babel / decorator toolchain removal (+9 more)

### Community 83 - "Render Submission Design"
Cohesion: 0.15
Nodes (17): TileMapBatcher (reuses SpriteBatch backend), TileMapNodeRenderer (kind "tilemap"), batchKey = texture|sampler|blend; per-instance tint, DrawCommand, WebGPUInstanceBufferPool (one buffer per run per frame), InstanceData (model + uvRect + tint, stride 96), NodeRenderer seam (E3), Packed radix sort key (zNorm*65536 + batchId) (+9 more)

### Community 84 - "Shapes & Canvas Resize Design"
Cohesion: 0.12
Nodes (17): applyResize (shared private core), Expand view policy (1 world unit = 1 logical px), Logical (CSS) vs physical (DPR) size split, Renderer.resize(w, h) logical-pixel contract, ResizeObserver auto-observe (autoResize opt-out), Camera interface (viewProjection: Mat4), Built-in shader library (getBuiltinShader), nebula / nebula-webgpu package split (+9 more)

### Community 85 - "Assets Package Manifest"
Cohesion: 0.12
Nodes (16): dependencies, @atlasjs/core, @atlasjs/utils, exports, @atlasjs/core, @atlasjs/utils, name, private (+8 more)

### Community 86 - "Editor Picking & Drag Events"
Cohesion: 0.21
Nodes (4): DragEvents, PickingEventPayload, PickingEvents, PICKING

### Community 89 - "Rapier Units & Queries"
Cohesion: 0.23
Nodes (5): scaleDesc(), PhysicsUnitConverter, ColliderResolver, RigidBodyResolver, RapierPhysicsQuery

### Community 90 - "Logging Transports"
Cohesion: 0.12
Nodes (3): ConsoleTransport, Logger, LogTransport

### Community 91 - "Input & Camera Design Docs"
Cohesion: 0.15
Nodes (15): game/controls.ts (dinoControls + DinoControls), Camera component (LEVEL 1), CameraApi script service façade, CameraManager (CAMERA_MANAGER), Single active camera, ButtonAction, defineActions + button()/value()/vector2() builders, isDown / isPressed / isReleased vocabulary (+7 more)

### Community 92 - "Script Token Model Design"
Cohesion: 0.13
Nodes (16): Authority routing (dynamic body teleport), B3 — Transform as pure data via Changed<T>, ScriptComponent<TEngine> class façade (superseded), ENTITY symbol threading between proxies, Façade ⇔ real engine behavior rule, Magic getters + registry (superseded), Phase A export aliases (superseded), Transform (sole behavioral token) (+8 more)

### Community 93 - "Editor Picking System"
Cohesion: 0.19
Nodes (3): DragSystem, EditorPlugin, Picker

### Community 97 - "Base TS Compiler Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+7 more)

### Community 98 - "Stateless Script Proxies Design"
Cohesion: 0.15
Nodes (15): Load-bearing any[] component signature, B2 — custom TS compiler over the token surface, defineScriptComponent (token primitive), isScriptComponentToken (brand dispatch), RuntimeScriptContext single-point dispatch, ScriptComponentToken (branded token), Staleness asymmetry (raw vs proxy), Stateless proxies invariant (+7 more)

### Community 99 - "Core Package Manifest"
Cohesion: 0.13
Nodes (14): dependencies, @atlasjs/utils, exports, @atlasjs/utils, name, private, scripts, build (+6 more)

### Community 100 - "Typed Event Bus"
Cohesion: 0.27
Nodes (6): EventBus, EventCallback, EventMap, EventName, EventPayload, Unsubscribe

### Community 101 - "Debug TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, skipLibCheck (+6 more)

### Community 102 - "Math Package Manifest"
Cohesion: 0.13
Nodes (14): dependencies, @atlasjs/utils, exports, @atlasjs/utils, name, private, scripts, build (+6 more)

### Community 104 - "WebGPU Textures"
Cohesion: 0.16
Nodes (7): WebGPUTexture2D, GetUniformPropertiesResult, GlobalBindingDefinition, UniformGroup, UniformKey, WebGPUShaderBindingGroups, WebGPUTexture2DOptions

### Community 106 - "Turborepo Task Pipeline"
Cohesion: 0.15
Nodes (14): ^build, dist/**, dependsOn, outputs, cache, cache, persistent, $schema (+6 more)

### Community 107 - "Tiled Map Builder"
Cohesion: 0.21
Nodes (8): MapBuilder, MapBuilderOptions, GroupNameSortingOptions, groupNameSortingResolver(), SortingLayerInput, TiledAssetResolver, makeCamera(), mount()

### Community 108 - "Tiled Document Traversal"
Cohesion: 0.31
Nodes (3): ResolvedObject, ResolvedTileset, TiledDocument

### Community 109 - "Tilemap & Collider Design Notes"
Cohesion: 0.14
Nodes (14): Identity passthrough case, AnimationPlayer (named clips, reused), Animator (LEVEL-1 component), dt-driven SpriteAnimation (elapsedMs accumulator), Grid (root cell-coordinate system), cellSize must equal native tile size, Sparse packed-key cell Map + revision, TileMap (one layer of cells) (+6 more)

### Community 110 - "Character Controller"
Cohesion: 0.20
Nodes (5): CharacterController, clamp(), moveTowards(), CharacterControllerOptions, CharacterControllerState

### Community 111 - "Inertia Physics Plugin"
Cohesion: 0.19
Nodes (3): ColliderDesc, InertialPlugin, PhysicsWorld

### Community 112 - "Math Constants & Utils"
Cohesion: 0.16
Nodes (9): atan2, cos, PI, PI_2, PI_4, RAD_TO_DEG, sin, tan (+1 more)

### Community 115 - "AtlasJS Project Overview"
Cohesion: 0.18
Nodes (13): 2D-first, 3D-ready Architectural Direction, AI Agent Guidelines, apps/ — Executable Applications, AtlasJS Engine, Extensibility Principle, Graphify Knowledge Graph Workflow, Modularity Principle, packages/ — Reusable Engine Modules (+5 more)

### Community 119 - "Rapier Collider Mappers"
Cohesion: 0.27
Nodes (8): packCollisionGroups(), ball(), capsule(), cuboid(), mapColliderDesc(), polygon(), segment(), vec2ToBuffer()

### Community 120 - "Dino Brawl React Shell"
Cohesion: 0.24
Nodes (4): App(), DebugOverlay(), GameCanvas(), throttle()

### Community 123 - "Runtime Script Context"
Cohesion: 0.23
Nodes (3): createGameEntity(), ScriptResolver, RuntimeScriptContext

### Community 124 - "Script Metadata Registry"
Cohesion: 0.27
Nodes (10): ExposeFieldMetadata, getExposedFields(), getScriptMetadata(), REGISTRY, Base, Child, GrandChild, NoMeta (+2 more)

### Community 127 - "Material Shader Builder"
Cohesion: 0.27
Nodes (9): buildMaterialShaderSource(), defineMaterial(), extractMaterialBlock(), generateMaterialGroup(), MaterialBlock, MaterialMember, parseMaterialBlock(), parseMember() (+1 more)

### Community 128 - "Rapier Init & Constants"
Cohesion: 0.38
Nodes (4): ensureRapierInit(), EARTH_GRAVITY, RapierColliderOption, RapierRigidBodyOption

### Community 129 - "Utils Observable & Callbacks"
Cohesion: 0.26
Nodes (3): Observable, Callback, TCallback

### Community 130 - "Dino Brawl Package Scripts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, preview, test (+2 more)

### Community 131 - "Sword Script"
Cohesion: 0.29
Nodes (3): MinMax, SwordScript, SwordState

### Community 132 - "Asset Loader Design"
Cohesion: 0.27
Nodes (11): Asset (serializable descriptor), AssetLoader<A, R>, AssetManager, Load deduplication by asset id, LoadContext, Resource (runtime handle), Sprite (gameplay resource handle), SpriteAsset (+3 more)

### Community 133 - "Unified Backlog"
Cohesion: 0.24
Nodes (11): A2 — Text rendering, A3 — Post-processing stack, Archetype / SoA storage backend, B2 — Editor ↔ nebula reconciliation, AtlasJS Unified Backlog, C7 — Pixel-perfect smooth scroll, Camera2D.pixelSnap, Tilemap colliders (+3 more)

### Community 134 - "Input Service & Render Seams"
Cohesion: 0.20
Nodes (11): Code-first-first principle, Editor seam (editor is a pure consumer), Node-type registry (single source for code + editor), RenderPass / RenderTarget seam, InputApi ScriptService façade, ButtonAction / ValueAction / Vector2Action, defineActions (serializable ActionMapDescriptor), dt threaded through sample/update as a future seam (+3 more)

### Community 135 - "Utils Package Manifest"
Cohesion: 0.18
Nodes (10): exports, name, private, scripts, build, clean, dev, type (+2 more)

### Community 137 - "Transform Propagation Design"
Cohesion: 0.24
Nodes (10): B4 — 3D depth test, CameraSyncSystem, Centering baked into the view matrix, Follow via parenting, Mat3 completion (multiply / invert / decompose), One-frame physics latency, Lossy TRS decomposition at the render edge, TransformPropagationSystem (+2 more)

### Community 139 - "Material Serialization Design"
Cohesion: 0.22
Nodes (9): Versioned format + migration pipeline, MaterialData (serializable POJO), materialize / dematerialize with injected resolvers, ShaderResolver, TextureResolver, Two-tier architecture (material instance vs graph template), WebGPUPipelineFactory unification (E2), Hidden pipeline + PipelineCache (+1 more)

### Community 140 - "Frame Clock & RAF Loop"
Cohesion: 0.31
Nodes (3): FrameClock, startRafLoop(), clamp()

### Community 142 - "Tiled Asset Resolver"
Cohesion: 0.39
Nodes (6): commonTailLength(), createGlobTilesetResolver(), logger, matchAssetByTail(), segments(), modules

### Community 143 - "Collision Filtering Findings"
Cohesion: 0.25
Nodes (8): ActiveCollisionTypes.ALL finding (kinematic↔fixed events off by default), CollisionHandler + drainCollisions contract, FakePhysicsWorld / FakeCollider test infra, mapColliderDesc (groups + active events), packCollisionGroups (membership<<16 | filter), RapierCollider filtering fix (collisionGroups not solverGroups), RapierPhysicsWorld EventQueue + drainCollisions, WASM behavior untested by design (browser-verify covers it)

### Community 146 - "Gameplay Test TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, extends, include, src, test, ./tsconfig.json

### Community 147 - "Collision Layers"
Cohesion: 0.29
Nodes (6): ALL_LAYERS, CollisionLayer, CollisionLayers, CollisionMask, defineCollisionLayers(), NO_LAYERS

### Community 150 - "Nebula WebGPU TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, src, ../../tsconfig.base.json, @webgpu/types

### Community 151 - "Rapier TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, src, ../../tsconfig.base.json, @webgpu/types

### Community 152 - "Gizmo Handle Types"
Cohesion: 0.33
Nodes (4): GizmoHandle, GizmoHandleKind, GizmoMode, ToolUpdateEnv

### Community 153 - "Physics Raycast & Overlap"
Cohesion: 0.29
Nodes (3): AABB, RaycastHit, PhysicsQuery

### Community 155 - "Query Each Tests"
Cohesion: 0.29
Nodes (4): Position, seed(), Tag, Velocity

### Community 157 - "Debug Log Server"
Cohesion: 0.47
Nodes (4): colors, wss, LogLevel, LogPayload

### Community 160 - "Rapier Rigid Body Mapper"
Cohesion: 0.47
Nodes (3): createRapierRigidBodyDesc(), mapRigidBodyDesc(), scaleDesc()

### Community 162 - "App HTML Entry Points"
Cohesion: 0.50
Nodes (5): Dino Brawl HTML Entry Point, React + TypeScript + Vite Template, WebGPU Demo HTML Entry Point, *Node scene-graph naming convention, app/ shell split (App / GameCanvas / DebugOverlay)

### Community 163 - "Assets TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 164 - "Core TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 165 - "Editor TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 167 - "Gameplay TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 168 - "Inertia TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 169 - "Input TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 170 - "Math TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 171 - "Nebula TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 172 - "Nexus TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 173 - "Utils TS Config"
Cohesion: 0.40
Nodes (4): extends, include, src, ../../tsconfig.base.json

### Community 181 - "Fixed Lane Invariants"
Cohesion: 0.67
Nodes (3): advanceFixed(n) rollback seam, Fixed lane must stay wall-clock-free, RafLoop + FrameClock (injectable loop driver)

## Ambiguous Edges - Review These
- `B4 — 3D depth test` → `Mat3 completion (multiply / invert / decompose)`  [AMBIGUOUS]
  docs/gameplay/entity-hierarchy.md · relation: conceptually_related_to
- `Magic getters + registry (superseded)` → `pnpm dependency catalog (babel decorators plugins)`  [AMBIGUOUS]
  pnpm-workspace.yaml · relation: conceptually_related_to

## Knowledge Gaps
- **560 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+555 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `B4 — 3D depth test` and `Mat3 completion (multiply / invert / decompose)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Magic getters + registry (superseded)` and `pnpm dependency catalog (babel decorators plugins)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `TileMapNode` connect `Render Queue & Batchers` to `Tilemap Render & Grid Geometry`, `Sorting Layers & Sprite Render`, `Scene Graph Shape Nodes`, `Nebula Renderer Facade`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `Node` connect `Scene Graph Shape Nodes` to `Sprite Node Renderer`, `Transformable Node Base`, `Nebula Renderer Facade`, `Render Queue & Batchers`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `Texture2D` connect `Nebula Renderer Facade` to `Render Queue & Batchers`, `Shader Types & Vertex Layouts`, `Scene Graph Shape Nodes`, `Sprite Sheet Animation`, `Material & Binding Resources`, `Sprite Node Renderer`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _560 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gameplay Script Facades` be split into smaller, more focused modules?**
  _Cohesion score 0.05030643513789581 - nodes in this community are weakly interconnected._