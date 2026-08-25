---
name: vite-type-only-imports
description: "In AtlasJS, Vite-consumed files must import type-only symbols with `import type` — tsc passes but the runtime breaks"
type: project
---

In the AtlasJS monorepo, a **type-only symbol** (an `interface`/`type` with no runtime export, e.g. `GameEntity`) imported as a **value import** in a Vite-consumed file (anything under `apps/*`, and script files bundled by the app) **compiles under `tsc --noEmit` (the import is erased) but crashes at runtime** under Vite/esbuild with `SyntaxError: The requested module '.../dist/index.mjs' does not provide an export named 'X'`. In a React app this kills the whole mount → **black screen**, and it may surface with **no browser console error** (engine logs can route to a WebSocket transport, not console).

**Why tsc misses it:** esbuild/oxc transpile per-file with no cross-file type info, so they can't know `X` is type-only unless you write `import type`. The gameplay package omits `verbatimModuleSyntax`, but `apps/sandbox`/`apps/webgpu` set `verbatimModuleSyntax: true` — yet even there the bare import did not reliably trigger TS1484 in practice.

**How to apply:** in any app/script file, import interfaces/types with `import type { X }` (or inline `type` qualifier: `import { type X, realValue }`). Keep genuine runtime values (factory functions, tokens like `createGameEntity`, `isScriptComponentToken`, `ScriptMetadata`, `Transform`/`RigidBody` tokens) as value imports. **This is why Task 6 of the GameEntity feature needed `import type { GameEntity }` in `TestScript.ts`** — caught only by driving the sandbox in the browser, never by `tsc`. Always run the browser verification for previewable sandbox changes; don't trust a clean typecheck. Related: [[verify-against-committed-head]].
