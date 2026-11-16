/* Supplementary in-memory TS runner for audit-wave3-library-import.ts.
 * Same pattern as ~/workspace/vela-work/run-ts-test.mjs (rolldown JS API →
 * data: URL import, no bundle file written), plus ONE stub: pdf.ts imports
 * 'pdfjs-dist/.../pdf.worker.min.mjs?url', a Vite asset URL the plain
 * runner cannot resolve. The stub replaces only that asset string; every
 * function the probe exercises (formatOf, sniffFormat, contentHash,
 * finishBook) is the real app code, and none of them touch pdf.ts. */
import { createRequire } from "node:module";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const require = createRequire(new URL("../../vela-work/repo/package.json", import.meta.url));
const { rolldown } = require("rolldown");

const input = process.argv[2];
if (!input) { console.error("usage: node audit-wave3-run-import.mjs <test.ts>"); process.exit(2); }
try {
  const bundle = await rolldown({
    input,
    logLevel: "silent",
    plugins: [{
      name: "audit-url-stub",
      resolveId(id) { if (id.endsWith("?url")) return "\0url-stub"; return null },
      load(id) { if (id === "\0url-stub") return "export default 'stub-url'"; return null },
    }],
  });
  const { output } = await bundle.generate({ format: "esm", codeSplitting: false });
  const code = output.find((o) => o.type === "chunk").code;
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  setTimeout(() => process.exit(process.exitCode ?? 0), 300);
} catch (e) {
  console.error("RUNNER ERROR:", e instanceof Error ? e.message : String(e));
  if (e instanceof Error && e.stack) console.error(e.stack.split("\n").slice(0, 8).join("\n"));
  process.exit(1);
}
