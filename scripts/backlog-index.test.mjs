import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBacklogIndex } from "./backlog-index.mjs";

test("un item sans domain apparaît comme ligne de tableau, pas seulement comme en-tête de section", () => {
  const out = renderBacklogIndex([
    { file: "no-domain.md", id: "MISC-01", status: "todo" },
  ]);
  assert.match(out, /## \?/);
  assert.match(out, /\| MISC-01 \|/);
  assert.match(out, /\[no-domain\]\(no-domain\.md\)/);
});

test("un statut inconnu trie après todo, partial et vision", () => {
  const out = renderBacklogIndex([
    { file: "z-weird.md", id: "A-03", domain: "core", status: "weird" },
    { file: "a-todo.md", id: "A-01", domain: "core", status: "todo" },
    { file: "b-partial.md", id: "A-02", domain: "core", status: "partial" },
    { file: "c-vision.md", id: "A-04", domain: "core", status: "vision" },
  ]);
  const order = ["A-01", "A-02", "A-04", "A-03"];
  const positions = order.map((id) => out.indexOf(`| ${id} |`));
  for (const position of positions) assert.notEqual(position, -1);
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1], `${order[i]} devrait apparaître après ${order[i - 1]}`);
  }
});

test("aucune cellule générée ne contient jamais la chaîne undefined", () => {
  const out = renderBacklogIndex([
    { file: "sparse.md" },
    { file: "partial-fields.md", id: "PART-01", status: "todo" },
  ]);
  assert.doesNotMatch(out, /undefined/);
});

test("une valeur vide (id: sans valeur) rend le marqueur de valeur manquante, pas une cellule blanche", () => {
  const out = renderBacklogIndex([{ file: "empty-id.md", id: "", domain: "core", status: "todo" }]);
  assert.match(out, /\| \? \|/);
  assert.doesNotMatch(out, /\|  \|/);
});

test("le total compte tous les items, y compris ceux sans domain", () => {
  const out = renderBacklogIndex([
    { file: "a.md", id: "A-01", domain: "core", status: "todo" },
    { file: "b.md", id: "B-01", status: "todo" },
  ]);
  assert.match(out, /Total : \*\*2\*\* items\./);
});
