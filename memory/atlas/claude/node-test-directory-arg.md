---
name: node-test-directory-arg
description: "`node --test <dir>` does not discover tests under Node 26.3 — it loads the directory as a module and fails with a bare 'test failed' that says nothing about the code."
type: reference
modified: 2026-08-25
---

Node 26.3 (the version installed here, `node --version` → `v26.3.0`) does not treat a bare directory as a test-discovery root. `node --test scripts/` resolves `scripts` as a module entry point and dies before any test runs:

```
Error: Cannot find module '/Users/…/atlas/scripts'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1519:15)
    …
✖ scripts (65.8ms)
ℹ pass 0
ℹ fail 1
✖ failing tests:
test at scripts:1:1
✖ scripts (65.8ms)
  'test failed'
```

The tail is the trap. `fail 1` and `'test failed'` read exactly like a broken assertion, so the reflex is to go hunt a regression in code that is in fact entirely green. The `MODULE_NOT_FOUND` that explains it sits at the *top* of the output, above the reporter's own lines, and scrolls away.

Both of these work:

```bash
node --test scripts/check-vault-links.test.mjs .claude/hooks/claude-memory.test.mjs
node --test 'scripts/*.test.mjs'
```

The glob must be quoted so Node expands it rather than the shell.

**Why:** it cost two steps of the vault-reorganisation plan (2026-08-25), which had been written with `node --test scripts/`. The run went red twice and the red carried no information.

**How to apply:** never pass a directory to `node --test` in this repo — enumerate the files or quote a glob. And when a `node --test` run reports `'test failed'` with no assertion text attached, read the head of the output before believing the code is broken.
