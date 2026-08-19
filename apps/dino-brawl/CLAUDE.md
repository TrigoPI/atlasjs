# AGENTS.md — apps/dino-brawl

## Type-check

A bare `tsc --noEmit` **is a no-op in this app**: it doesn't pick up the right configuration and checks nothing. Always:

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json
```

## Render loop

The loop runs on RAF, so it's throttled when the browser panel isn't in the foreground: black canvas, 0 fps, no error. See the `atlas-verify-webgpu` skill before concluding a render is broken.
