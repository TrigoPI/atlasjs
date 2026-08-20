import { execFileSync } from "node:child_process";

const raw = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
});

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? "";
if (!/\.tsx?$/.test(filePath)) process.exit(0);

try {
  execFileSync("pnpm", ["exec", "prettier", "--write", filePath], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 15000,
  });
  console.log(`[prettier] ${filePath}`);
  process.exit(0);
} catch (error) {
  console.error(
    `[prettier] failed on ${filePath}\n${error.stderr ?? error.message ?? ""}`,
  );
  process.exit(2);
}
