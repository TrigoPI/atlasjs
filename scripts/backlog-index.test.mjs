import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderBacklogIndex, describeDoc } from "./backlog-index.mjs";

function writeTempDoc(content) {
  const dir = mkdtempSync(join(tmpdir(), "backlog-index-test-"));
  const fullPath = join(dir, "doc.md");
  writeFileSync(fullPath, content);
  return fullPath;
}

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

test("un statut contenant un | est échappé pour ne pas casser la ligne de tableau", () => {
  const fullPath = writeTempDoc("# Doc\n\n> Statut : implémenté (a | b).\n");
  try {
    const doc = describeDoc(fullPath, "doc.md");
    assert.doesNotMatch(doc.status, /(?<!\\)\|/);
    assert.match(doc.status, /a \\\| b/);
  } finally {
    rmSync(fullPath);
  }
});

test("une troncature qui tomberait au milieu d'un lien markdown recule avant le lien plutôt que de le couper", () => {
  const long =
    "x".repeat(70) + " voir [sorting-layers.md](sorting-layers.md) pour le détail complet ici.";
  const fullPath = writeTempDoc(`# Doc\n\n> Statut : ${long}\n`);
  try {
    const doc = describeDoc(fullPath, "doc.md");
    assert.ok(doc.status.length <= 90, `attendu <= 90 caractères, reçu ${doc.status.length}`);
    assert.ok(!doc.status.includes("["), "le lien markdown ne doit pas apparaître partiellement coupé");
    assert.ok(!doc.status.endsWith(" "), "la troncature doit tomber sur une frontière de mot, sans espace final");
  } finally {
    rmSync(fullPath);
  }
});
