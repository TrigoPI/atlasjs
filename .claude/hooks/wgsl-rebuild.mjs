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
if (!filePath.endsWith(".wgsl") || !filePath.includes("packages/nebula-webgpu/"))
  process.exit(0);

try {
  execFileSync("pnpm", ["--filter", "@atlasjs/nebula-webgpu", "build"], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 180000,
  });
  console.log(`[wgsl] rebuild @atlasjs/nebula-webgpu OK (${filePath})`);
  process.exit(0);
} catch (error) {
  console.error(
    `[wgsl] REBUILD FAILED after editing ${filePath}. ` +
      `dist still serves the old shader.\n${error.stdout ?? ""}${error.stderr ?? error.message ?? ""}`,
  );
  process.exit(2);
}
