import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

const RELATIVE_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKILINK = /\[\[([^\]]+)\]\]/g;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#)/i;

const FENCE = /^ {0,3}(`{3,})(.*)$/;

function blank(text) {
  return " ".repeat(text.length);
}

function maskInlineCode(line) {
  let out = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      out += line[index];
      index += 1;
      continue;
    }
    let open = index;
    while (open < line.length && line[open] === "`") open += 1;
    const width = open - index;
    let close = open;
    let found = -1;
    while (close < line.length) {
      if (line[close] !== "`") {
        close += 1;
        continue;
      }
      let end = close;
      while (end < line.length && line[end] === "`") end += 1;
      if (end - close === width) {
        found = end;
        break;
      }
      close = end;
    }
    if (found === -1) {
      out += line.slice(index, open);
      index = open;
      continue;
    }
    out += blank(line.slice(index, found));
    index = found;
  }
  return out;
}

export function maskCode(text) {
  const lines = text.split("\n");
  let fence = null;
  return lines
    .map((line) => {
      const match = FENCE.exec(line);
      if (fence === null) {
        if (match) {
          fence = match[1].length;
          return blank(line);
        }
        return maskInlineCode(line);
      }
      if (match && match[1].length >= fence && match[2].trim() === "") {
        fence = null;
      }
      return blank(line);
    })
    .join("\n");
}

export function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function wikilinkTarget(raw) {
  return raw.split("|")[0].split("#")[0].trim();
}

export function checkLinks(vaultDir) {
  const files = listFiles(vaultDir);
  const known = new Set();
  for (const file of files) {
    const name = basename(file);
    known.add(name);
    if (name.endsWith(".md")) known.add(name.slice(0, -3));
  }

  const dead = [];
  for (const file of files.filter((name) => name.endsWith(".md"))) {
    const text = maskCode(readFileSync(file, "utf8"));

    for (const [, target] of text.matchAll(RELATIVE_LINK)) {
      if (EXTERNAL.test(target)) continue;
      const path = decodeURI(target.split("#")[0]);
      if (!path) continue;
      if (!existsSync(resolve(dirname(file), path))) {
        dead.push({ file, target, kind: "relative" });
      }
    }

    for (const [, raw] of text.matchAll(WIKILINK)) {
      const target = wikilinkTarget(raw);
      if (!target) continue;
      if (!known.has(target)) dead.push({ file, target, kind: "wikilink" });
    }
  }
  return dead;
}

function main() {
  const vaultDir = process.argv[2] ?? "memory/atlas";
  const dead = checkLinks(vaultDir);
  for (const entry of dead) {
    console.log(`${entry.file} — ${entry.kind} mort : ${entry.target}`);
  }
  console.log(
    `check-vault-links — ${dead.length} lien(s) mort(s) dans ${vaultDir}`,
  );
  process.exitCode = dead.length > 0 ? 1 : 0;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
