import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const INDEX = join("memory", "atlas", "claude", "index.md");

export function renderMemory(repoRoot) {
  const path = join(repoRoot, INDEX);
  if (!existsSync(path)) return null;
  return (
    `Mémoire de Claude sur ce projet (${INDEX}). Une ligne par note ; ` +
    `lire memory/atlas/claude/<nom>.md pour le détail avant d'agir dessus.\n\n` +
    readFileSync(path, "utf8").trim()
  );
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const output = renderMemory(repoRoot);
if (output) console.log(output);
