// Flat scalars only ("key: value"). A YAML list ("tags:" followed by "- a" lines) is not
// parsed and is silently dropped from `data` — do not use list fields in backlog notes.
export function parseFrontmatter(text) {
  const input = text.replace(/^\uFEFF/, "");
  if (!input.startsWith("---")) return { data: {}, body: input };

  const end = input.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: input };

  const block = input.slice(4, end);
  const body = input.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};

  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key) continue;
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["'](.*)["']$/, "$1");
    data[key] = value;
  }

  return { data, body };
}
