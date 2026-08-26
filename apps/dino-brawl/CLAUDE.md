# AGENTS.md — apps/dino-brawl

## Type-check

A bare `tsc --noEmit` **is a no-op in this app**: it doesn't pick up the right configuration and checks nothing. Use the solution-wide build, which walks every project referenced by `tsconfig.json` — `src` (`tsconfig.app.json`), the config files (`tsconfig.node.json`) and `test` (`tsconfig.test.json`) :

```bash
pnpm --filter dino-brawl typecheck   # = tsc -b, same as the first half of `build`
```

`tsc -b` writes its `.tsbuildinfo` files under `node_modules/.tmp/` only, so it leaves no artefact in the tree.

Pour ne vérifier qu'une cible, passer le projet explicitement — un `-p` sans projet ne couvre rien :

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json    # src uniquement
pnpm exec tsc --noEmit -p tsconfig.test.json   # test/ uniquement
```

`test/` **est** type-checké depuis que `tsconfig.test.json` est référencé : un renommage dans `src/` casse désormais `tsc -b` si une spec le suit encore.

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
