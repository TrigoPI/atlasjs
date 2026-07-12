# AGENTS.md

# AtlasJS

## Overview

AtlasJS is a modern game engine written in TypeScript.

It is designed as a modular, plugin-based engine where every major system can evolve independently while remaining part of a cohesive ecosystem.

The engine is **2D-first**, while its architecture should remain flexible enough to support future 3D capabilities without requiring a fundamental redesign.

This repository is a **Turborepo monorepo** managed with **pnpm**.

---

## Project Philosophy

AtlasJS is built around four core principles.

### Performance

Performance should be considered from the beginning of the design process.

Avoid unnecessary allocations, excessive abstraction overhead, and APIs that make efficient implementations difficult.

Abstractions should improve the architecture without hiding important runtime costs.

### Modularity

Every major system should have a clear and focused responsibility.

Shared engine capabilities should be isolated into independent packages with minimal coupling between them.

AtlasJS should behave as an ecosystem of composable modules rather than as a single monolithic engine.

### Plugin-based Architecture

The engine core should remain lightweight and independent from optional systems.

Rendering, physics, ECS, gameplay features, tooling, and future systems should integrate through well-defined extension points.

New capabilities should be introducible through plugins without requiring modifications to the engine core.

### Extensibility

AtlasJS should make it possible to add new systems, replace existing implementations, and experiment with alternative technologies.

Architectural decisions should favor long-term flexibility and clear extension points over short-term convenience.

---

## Repository Structure

The repository is divided into two main areas.

### `packages/`

The `packages` directory contains reusable libraries and engine modules.

This includes shared systems such as:

- Engine foundations
- Mathematics
- Plugin APIs
- Rendering
- Physics
- ECS
- Gameplay utilities
- Shared tooling

Packages should remain focused, reusable, and as independent as possible.

A package should not depend on an application from the `apps` directory.

### `apps/`

The `apps` directory contains executable applications built using AtlasJS packages.

This may include:

- Sandboxes
- Examples
- Development tools
- Editors
- Demo games
- Test applications

Applications may compose multiple packages together, but application-specific logic should not leak into reusable engine packages.

### `docs/`

The `docs` directory contains cross-cutting design documents and architecture decisions that span multiple packages or describe planned refactors.

Consult it before undertaking a significant change: a design may already be validated and awaiting implementation.

Current documents:

- `docs/shaders-materials-redesign.md` — validated redesign of the Nebula shader/material authoring API (WGSL as single source of truth via reflection, layered easy/advanced paths, package split).

---

## Architectural Direction

AtlasJS is intended for a broad audience, from hobby developers to more advanced users and tooling authors.

The public API should remain approachable while preserving enough flexibility for advanced use cases.

The engine core must remain independent from specific implementations whenever possible.

Packages should communicate through stable abstractions, public contracts, and extension points rather than relying directly on internal implementation details.

AtlasJS is currently focused on 2D development, but new architecture should avoid assumptions that would unnecessarily prevent future 3D support.

This does not mean every system must support 3D today. It means new decisions should avoid making future evolution impossible without a strong reason.

---

## AI Agent Guidelines

Before modifying the project:

- Check `docs/` for an existing design document covering the change.
- Identify whether the change belongs in `packages` or `apps`.
- Understand the responsibility of the affected package or application.
- Follow the existing architecture before introducing a new pattern.
- Keep packages loosely coupled.
- Avoid circular dependencies between packages.
- Preserve clear and stable public APIs.
- Avoid leaking implementation details across package boundaries.
- Keep application-specific code out of reusable packages.
- Prefer extending existing systems over creating parallel implementations.
- Keep the engine core independent from optional systems whenever possible.
- Consider runtime performance when introducing new abstractions.
- Preserve the plugin-based philosophy of the engine.
- Avoid introducing unnecessary 2D-only assumptions into foundational APIs.

Architecture consistency is generally more important than implementing the quickest possible solution.

If a more specific `AGENTS.md` exists inside a package or application, its instructions take precedence over this root document.
