# AGENTS.md — apps/dino-brawl

## Type-check

A bare `tsc --noEmit` **is a no-op in this app**: it doesn't pick up the right configuration and checks nothing. Always:

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json
```

## Lint — paramètre non utilisé

`@typescript-eslint/no-unused-vars` est en `error` avec `args: "after-used"`, et **l'underscore n'exempte de rien** dans cette configuration : un dernier paramètre non utilisé est signalé même préfixé. Vérifié empiriquement, `public advance(_t: number): void {}` échoue.

Un paramètre volontairement ignoré (implémentation no-op d'un contrat de classe de base) se déclare donc ainsi :

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
public advance(_t: number): void {}
```

Un `_t` en position non finale passe, lui, sans directive — `after-used` ne signale qu'à partir du dernier paramètre utilisé. Contrôle : `pnpm --filter dino-brawl lint`.

## Render loop

The loop runs on RAF, so it's throttled when the browser panel isn't in the foreground: black canvas, 0 fps, no error. See the `atlas-verify-webgpu` skill before concluding a render is broken.
