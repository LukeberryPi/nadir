const ROOT = import.meta.dir;
const PORT = Number(process.env.PORT) || 4173;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function contentType(pathname: string) {
  const dot = pathname.lastIndexOf(".");
  return MIME[pathname.slice(dot)] ?? "application/octet-stream";
}

async function bundleApp() {
  const result = await Bun.build({
    entrypoints: [`${ROOT}/src/main.ts`],
    target: "browser",
    sourcemap: "inline",
    naming: "app.js",
  });
  if (!result.success) {
    const detail = result.logs.map((log) => String(log)).join("\n");
    return new Response(detail, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(await result.outputs[0].text(), {
    headers: { "content-type": "text/javascript; charset=utf-8" },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/app.js") return bundleApp();
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`${ROOT}${pathname}`);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file, {
      headers: { "content-type": contentType(pathname) },
    });
  },
});

console.log(`Nadir at http://localhost:${server.port}`);
