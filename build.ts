import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(ROOT, "src/main.ts")],
  outdir: DIST,
  target: "browser",
  minify: true,
  naming: "app.js",
});

if (!result.success) {
  console.error(...result.logs);
  process.exit(1);
}

await Bun.write(join(DIST, "index.html"), Bun.file(join(ROOT, "index.html")));
await cp(join(ROOT, "css"), join(DIST, "css"), { recursive: true });
await cp(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
await cp(join(ROOT, "favicon.svg"), join(DIST, "favicon.svg"));

console.log(`Built ${result.outputs.length} file(s) → dist/`);
