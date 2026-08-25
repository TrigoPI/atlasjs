import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderMemory } from "./claude-memory.mjs";

test("renvoie null quand le vault n'a pas de memoire", () => {
  assert.equal(renderMemory(mkdtempSync(join(tmpdir(), "repo-"))), null);
});

test("renvoie le contenu de l'index quand il existe", () => {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  mkdirSync(join(root, "memory/atlas/claude"), { recursive: true });
  writeFileSync(
    join(root, "memory/atlas/claude/index.md"),
    "# Mémoire\n\n- [[une-note]] — accroche\n",
  );
  const out = renderMemory(root);
  assert.match(out, /\[\[une-note\]\]/);
  assert.match(out, /memory\/atlas\/claude\//);
});

test("n'inclut jamais le corps des notes voisines", () => {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  mkdirSync(join(root, "memory/atlas/claude"), { recursive: true });
  writeFileSync(join(root, "memory/atlas/claude/index.md"), "- [[une-note]]\n");
  writeFileSync(
    join(root, "memory/atlas/claude/une-note.md"),
    "CORPS_QUI_NE_DOIT_PAS_SORTIR",
  );
  assert.doesNotMatch(renderMemory(root), /CORPS_QUI_NE_DOIT_PAS_SORTIR/);
});
