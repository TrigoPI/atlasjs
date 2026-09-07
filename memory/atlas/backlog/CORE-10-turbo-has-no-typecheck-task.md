---
id: CORE-10
status: todo
domain: core
effort: S
verified: 2026-09-06
---

# `turbo.json` ne déclare ni `typecheck` ni `lint`

Les tâches déclarées sont `build`, `dev`, `test` et `clean`. Or presque tous les packages et
toutes les apps ont un script `typecheck` et un script `lint` : `npx turbo run typecheck` répond
`Could not find task 'typecheck' in project`, et il faut passer par `pnpm --filter <pkg> typecheck`
un paquet à la fois. Aucun type-check à l'échelle du dépôt n'est donc lançable en une commande.

**Accroche :** la tâche `test` montre le gabarit exact, `dependsOn: ["^build"]` compris — ce qui
compte ici puisque les packages se résolvent vers leur `dist`, pas vers `src`.
