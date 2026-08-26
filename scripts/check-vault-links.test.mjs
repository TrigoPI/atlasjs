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

test("ignore un lien mort dans un bloc de code", () => {
  const root = makeVault({
    "a/one.md": ["texte", "```", "[deux](../b/two.md)", "```", ""].join("\n"),
  });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore un lien mort dans un bloc de code avec langage", () => {
  const root = makeVault({
    "a/one.md": ["```yaml", "cible: [deux](../b/two.md)", "```", ""].join("\n"),
  });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore un lien mort dans un bloc de code a plus de trois backticks", () => {
  const root = makeVault({
    "a/one.md": ["````md", "```", "[deux](../b/two.md)", "```", "````"].join(
      "\n",
    ),
  });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore un wikilink mort dans un span de code inline", () => {
  const root = makeVault({ "a/one.md": "on ecrit `[[trois]]` pour lier" });
  assert.deepEqual(checkLinks(root), []);
});

test("ignore un lien relatif mort dans un span de code inline", () => {
  const root = makeVault({ "a/one.md": "voir `[deux](../b/two.md)` ici" });
  assert.deepEqual(checkLinks(root), []);
});

test("detecte encore un lien mort situe apres un bloc de code", () => {
  const root = makeVault({
    "a/one.md": [
      "```js",
      "const x = 1;",
      "```",
      "",
      "voir [deux](../b/two.md) et [[trois]]",
    ].join("\n"),
  });
  const dead = checkLinks(root);
  assert.equal(dead.length, 2);
  assert.deepEqual(dead.map((entry) => entry.target).sort(), [
    "../b/two.md",
    "trois",
  ]);
});

test("detecte encore un lien mort entre deux blocs de code", () => {
  const root = makeVault({
    "a/one.md": [
      "```",
      "[ignore](./nulle-part-1.md)",
      "```",
      "voir [deux](../b/two.md)",
      "```",
      "[ignore](./nulle-part-2.md)",
      "```",
    ].join("\n"),
  });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].target, "../b/two.md");
});

test("un bloc de code non ferme neutralise le reste du fichier", () => {
  const root = makeVault({
    "a/one.md": [
      "texte [zero](../b/zero.md)",
      "```",
      "[deux](../b/two.md)",
    ].join("\n"),
  });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].target, "../b/zero.md");
});

test("un backtick isole ne neutralise pas le reste de la ligne", () => {
  const root = makeVault({
    "a/one.md": "un ` seul backtick puis [deux](../b/two.md)",
  });
  const dead = checkLinks(root);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].target, "../b/two.md");
});
