import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "./frontmatter.mjs";

test("extrait les paires cle/valeur et le corps", () => {
  const input = `---
id: RENDER-02
status: todo
---

# Titre

Corps.`;
  const { data, body } = parseFrontmatter(input);
  assert.equal(data.id, "RENDER-02");
  assert.equal(data.status, "todo");
  assert.match(body, /# Titre/);
});

test("retire les guillemets des valeurs", () => {
  const { data } = parseFrontmatter('---\nsource: "[[renderer-architecture]]"\n---\n');
  assert.equal(data.source, "[[renderer-architecture]]");
});

test("renvoie un objet vide sans frontmatter", () => {
  const { data, body } = parseFrontmatter("# Pas de frontmatter\n");
  assert.deepEqual(data, {});
  assert.match(body, /Pas de frontmatter/);
});

test("ignore un deux-points dans la valeur", () => {
  const { data } = parseFrontmatter("---\nnote: voir a: cet endroit\n---\n");
  assert.equal(data.note, "voir a: cet endroit");
});

test("frontmatter non terminé (pas de --- final) : traité comme absence de frontmatter", () => {
  const input = "---\nid: RENDER-01\nstatus: todo\n\n# Titre\nCorps.";
  const { data, body } = parseFrontmatter(input);
  assert.deepEqual(data, {});
  assert.equal(body, input);
});

test("bloc de frontmatter vide : data vide, body préservé", () => {
  const { data, body } = parseFrontmatter("---\n---\n\nBody");
  assert.deepEqual(data, {});
  assert.equal(body, "\nBody");
});

test("fins de ligne CRLF : parse les paires et retire le \\r des valeurs", () => {
  const input = "---\r\nid: RENDER-02\r\nstatus: todo\r\n---\r\n\r\n# Titre\r\n";
  const { data, body } = parseFrontmatter(input);
  assert.equal(data.id, "RENDER-02");
  assert.equal(data.status, "todo");
  assert.equal(body, "\r\n# Titre\r\n");
});

test("clé dupliquée : la dernière occurrence gagne (comportement retenu, pas une erreur)", () => {
  const { data } = parseFrontmatter("---\nid: FIRST\nid: SECOND\n---\nBody");
  assert.equal(data.id, "SECOND");
});

test("BOM en tête de fichier : retiré avant le parsing", () => {
  const { data, body } = parseFrontmatter("﻿---\nid: RENDER-03\n---\nBody");
  assert.equal(data.id, "RENDER-03");
  assert.equal(body, "Body");
});

test("frontière exacte du corps : un seul saut de ligne en tête est retiré, pas plus", () => {
  // Régression ciblée : si `.replace(/^\r?\n/, "")` disparaît du parser, le corps
  // redevient "\n\nBody line" (les deux sauts de ligne bruts après le "---" fermant)
  // au lieu de "\nBody line" — cette égalité stricte doit échouer dans ce cas.
  const { body } = parseFrontmatter("---\nid: RENDER-04\n---\n\nBody line");
  assert.equal(body, "\nBody line");
});
