# AGENTS.md — apps/dino-brawl

## Type-check

A bare `tsc --noEmit` **is a no-op in this app**: it doesn't pick up the right configuration and checks nothing. Always:

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json
```

**Cette commande ne couvre pas `test/`.** `tsconfig.app.json` déclare `include: ["src"]`, et vitest efface les types sans les vérifier : **aucune configuration ne type-check les specs** (dette suivie par `docs/backlog/APP-04-dino-brawl-specs-not-typechecked.md`). Une spec peut donc être rouge au compilateur tout en passant `pnpm --filter dino-brawl test`. Pour vérifier un fichier de test, créer une configuration temporaire, la lancer, puis **la supprimer** :

```bash
cd apps/dino-brawl && printf '{"extends":"./tsconfig.app.json","include":["test"]}' > tsconfig.tmp.json && npx tsc --noEmit -p tsconfig.tmp.json; rm tsconfig.tmp.json
```

Deux erreurs `TS2415` préexistantes sortent aujourd'hui (`meleeHitResolver.test.ts`, `swordScript.test.ts`) : elles sont connues, hors périmètre, et ne signalent rien sur le fichier qu'on vient d'écrire.

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
