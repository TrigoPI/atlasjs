import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const BACKLOG_DIR = "docs/backlog";
const DOCS_DIR = "docs";
const STATUS_ORDER = ["todo", "partial", "vision"];
const STATUS_LABEL = { todo: "📋 à faire", partial: "🔶 partiel", vision: "💭 vision" };

// Treats both "no value" and "" (an empty frontmatter value) as missing — a bare `??`
// fallback only catches the former, and an empty string then renders as a blank cell
// instead of the placeholder.
function orDefault(value, fallback) {
  return value === undefined || value === "" ? fallback : value;
}

function statusRank(status) {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}

export function readBacklog() {
  if (!existsSync(BACKLOG_DIR)) return [];
  return readdirSync(BACKLOG_DIR)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => {
      const { data } = parseFrontmatter(readFileSync(join(BACKLOG_DIR, name), "utf8"));
      if (!data.id) {
        console.warn(`docs:index — ${name}: no "id" in frontmatter (malformed or missing block), check the file`);
      }
      return { file: name, ...data };
    });
}

export function renderBacklogIndex(items) {
  // Normalize the domain once per item so the section header and the group filter
  // agree on the same value — computing the header from a fallback but filtering on
  // the raw field let domain-less items fall into an empty section while still being
  // counted in the total.
  const withDomain = items.map((item) => ({ ...item, domain: orDefault(item.domain, "?") }));
  const domains = [...new Set(withDomain.map((item) => item.domain))].sort();
  const lines = [
    "# Backlog — index",
    "",
    "> Fichier **généré** par `pnpm docs:index`. Ne pas éditer à la main.",
    "",
    `Total : **${withDomain.length}** items.`,
    "",
  ];

  for (const domain of domains) {
    const group = withDomain
      .filter((item) => item.domain === domain)
      .sort(
        (a, b) =>
          statusRank(a.status) - statusRank(b.status) ||
          String(orDefault(a.id, "?")).localeCompare(String(orDefault(b.id, "?"))),
      );
    lines.push(`## ${domain}`, "");
    lines.push("| ID | Item | Statut | Effort | Vérifié |", "| --- | --- | --- | --- | --- |");
    for (const item of group) {
      const title = item.file.replace(/\.md$/, "");
      const statusLabel = STATUS_LABEL[item.status] ?? orDefault(item.status, "?");
      lines.push(
        `| ${orDefault(item.id, "?")} | [${title}](${item.file}) | ${statusLabel} | ${orDefault(item.effort, "?")} | ${orDefault(item.verified, "—")} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function describeDoc(fullPath, name) {
  const head = readFileSync(fullPath, "utf8").split("\n").slice(0, 8);
  const statusLine = head.find((line) => /statut|status/i.test(line)) ?? "";
  const status = statusLine.replace(/[>*`]/g, "").replace(/^\s*statut\s*:\s*/i, "").trim();
  return { name, status: status.slice(0, 90) || "—" };
}

export function readDesignDocs() {
  const entries = readdirSync(DOCS_DIR, { withFileTypes: true });
  const sections = [];

  const rootDocs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort()
    .map((name) => describeDoc(join(DOCS_DIR, name), name));
  if (rootDocs.length > 0) sections.push({ folder: "racine", prefix: "", docs: rootDocs });

  const folders = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !["backlog", "plans"].includes(entry.name),
    )
    .map((entry) => entry.name)
    .sort();

  for (const folder of folders) {
    sections.push({
      folder,
      prefix: `${folder}/`,
      docs: readdirSync(join(DOCS_DIR, folder))
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => describeDoc(join(DOCS_DIR, folder, name), name)),
    });
  }

  return sections;
}

export function renderReadme(sections, itemCount) {
  const lines = [
    "# Documentation AtlasJS",
    "",
    "> Fichier **généré** par `pnpm docs:index`. Ne pas éditer à la main.",
    "",
    "Le backlog vit dans [`backlog/`](backlog/) — **" +
      itemCount +
      "** items ouverts, index dans [`backlog/_index.md`](backlog/_index.md).",
    "",
    "Les plans d'implémentation en cours vivent dans [`plans/`](plans/) et sont **transitoires** : ils sont supprimés à la clôture de la feature (`/atlas-done`).",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.folder}`, "");
    lines.push("| Document | Statut |", "| --- | --- |");
    for (const doc of section.docs) {
      lines.push(`| [${doc.name}](${section.prefix}${doc.name}) | ${doc.status} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const items = readBacklog();
  writeFileSync(join(BACKLOG_DIR, "_index.md"), renderBacklogIndex(items) + "\n");
  writeFileSync(join(DOCS_DIR, "README.md"), renderReadme(readDesignDocs(), items.length) + "\n");
  console.log(`docs:index — ${items.length} items de backlog, README régénéré.`);
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
