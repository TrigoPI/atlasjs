import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLinks } from "./check-vault-links.mjs";

function makeVault(files) {
  const root = mkdtempSync(join(tmpdir(), "vault-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("signale un lien relatif mort", () => {
  const root = makeVault({ "a/one.md": "voir [deux](../b/two.md)" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "relative");
  assert.equal(dead[0].target, "../b/two.md");
});

test("accepte un lien relatif valide, ancre comprise", () => {
  const root = makeVault({
    "a/one.md": "voir [deux](../b/two.md#section)",
    "b/two.md": "# Deux",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("accepte un lien relatif vers un dossier", () => {
  const root = makeVault({ "a/one.md": "voir [b](../b/)", "b/two.md": "x" });
  assert.deepEqual(checkLinks(root), []);
});

test("signale un wikilink mort", () => {
  const root = makeVault({ "a/one.md": "voir [[trois]]" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "wikilink");
  assert.equal(dead[0].target, "trois");
});

test("resout un wikilink par nom de base, avec alias et ancre", () => {
  const root = makeVault({
    "a/one.md": "[[two|Deux]] et [[two#Section]] et [[two.md]]",
    "b/two.md": "# Deux",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("resout un wikilink vers un fichier non-markdown du vault", () => {
  const root = makeVault({
    "a/one.md": "[[backlog.base]]",
    "backlog.base": "views: []",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore les URL externes et les ancres pures", () => {
  const root = makeVault({
    "a/one.md":
      "[web](https://example.com) [mail](mailto:x@y.z) [anchor](#section)",
  });
  assert.deepEqual(checkLinks(root), []);
});

test("suit une cible qui sort du vault", () => {
  const root = makeVault({ "a/one.md": "[code](../../nulle-part.ts)" });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].kind, "relative");
});
