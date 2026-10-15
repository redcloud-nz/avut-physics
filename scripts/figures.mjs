// Articles' figures are worked out ahead of time, since the solvers are too slow to run as the site builds. Each
// `src/articles/<name>.compute.ts` works out its article's figures, and `npm run figures` saves them in
// `<name>.figures.json`, with a hash of the compute module and every local file it imports, followed through
// their imports. When that hash no longer matches, the figures are stale: the article, its inputs or a solver
// they come from has changed since.
//
// `node scripts/figures.mjs --check` lists stale figures, and fails if there are any. It runs before every build
// and commit, and only hashes, so it takes a moment.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
export const ARTICLES = join(SRC, "articles");

/** Each `import … from "x"`, `export … from "x"` and `import "x"`. */
const IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

/** The file an import names, or null for a package's. */
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  throw new Error(`Can't find ${spec}, imported in ${relative(ROOT, from)}`);
}

/** `entry` and every local file it imports, followed through their imports. */
function dependencies(entry) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith(".json")) return;
    for (const [, spec] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const dep = resolveImport(file, spec);
      if (dep) visit(dep);
    }
  };
  visit(entry);
  return [...seen].sort();
}

/** The hash of a compute module and everything it imports. */
export function hashFor(compute) {
  const hash = createHash("sha256");
  for (const file of dependencies(compute)) {
    hash.update(relative(ROOT, file)).update("\0").update(readFileSync(file)).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

/** Every article's compute module, with its figures file and whether that's stale. */
export function articles() {
  return readdirSync(ARTICLES)
    .filter((f) => f.endsWith(".compute.ts"))
    .sort()
    .map((f) => {
      const compute = join(ARTICLES, f);
      const figures = compute.replace(/\.compute\.ts$/, ".figures.json");
      const hash = hashFor(compute);
      const saved = existsSync(figures) ? JSON.parse(readFileSync(figures, "utf8")).hash : null;
      return {
        name: f.replace(/\.compute\.ts$/, ""),
        compute,
        figures,
        hash,
        stale: saved !== hash,
      };
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--check")) {
  const stale = articles().filter((a) => a.stale);
  if (stale.length) {
    console.error(
      `These articles' figures are out of date: ${stale.map((a) => a.name).join(", ")}.\n` +
        "Run `npm run figures` to work them out again, and commit the result.",
    );
    process.exit(1);
  }
}
