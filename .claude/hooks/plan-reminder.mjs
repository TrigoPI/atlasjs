import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(repoRoot, "docs", "plans");
if (!existsSync(dir)) process.exit(0);

const plans = readdirSync(dir).filter((name) => name.endsWith(".md"));
if (plans.length === 0) process.exit(0);

console.log(
  `Plan(s) in progress under docs/plans/: ${plans.join(", ")}. ` +
    `If the corresponding work is finished, run /atlas-done to close it out ` +
    `(delete the plan, update the backlog and the design doc status).`,
);
