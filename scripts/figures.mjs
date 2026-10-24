// Articles' figures are worked out ahead of time, since the solvers are too slow to run as the site builds. Each
// `src/articles/<name>.compute.ts` works out its article's figures, and `npm run figures` saves them in
// `<name>.figures.json`, with a hash of the compute module and every local file it imports, followed through
// their imports, and the installed versions of the packages they import. When that hash no longer matches, the figures are stale: the article, its inputs or a solver
// they come from has changed since.
//
// `node scripts/figures.mjs --check` lists stale figures, and fails if there are any. It runs before every build
// and commit, and only hashes, so it takes a moment. With `--staged` (as the commit hook runs it) it reads what's
// staged rather than what's on disk, so a commit can't hold a solver change without the figures that go with it.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
export const ARTICLES = join(SRC, "articles");

/** Reading files from disk. */
const DISK = {
  isFile: (file) => existsSync(file) && statSync(file).isFile(),
  read: (file) => readFileSync(file),
  list: (dir) => readdirSync(dir),
};

/** Reading files as staged in git's index. */
function staged() {
  const git = (...args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 1 << 26 });
  const files = new Set(
    git("ls-files", "-z")
      .toString()
      .split("\0")
      .filter(Boolean)
      .map((f) => join(ROOT, f)),
  );
  return {
    isFile: (file) => files.has(file),
    read: (file) => git("show", `:${relative(ROOT, file)}`),
    list: (dir) => [...files].filter((f) => dirname(f) === dir).map((f) => relative(dir, f)),
  };
}

/** Each `import … from "x"`, `export … from "x"` and `import "x"`. */
const IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

/**
 * Ways of loading code or files that the hash can't follow. Figures that depend on them could go stale unnoticed, so
 * a compute module and what it imports must stick to static imports.
 */
const UNFOLLOWED = [
  [/\bimport\s*\(/, "import()"],
  [/\brequire\s*\(/, "require()"],
  [/["'](?:node:)?fs(?:\/promises)?["']/, "fs"],
];

/** The file an import names, or null for a package's. */
function resolveImport(from, spec, files) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (files.isFile(file)) return file;
  }
  throw new Error(`Can't find ${spec}, imported in ${relative(ROOT, from)}`);
}

/** A package import's package: `react` for `react-dom/server`'s `react-dom`, `@scope/name` for `@scope/name/x`. */
const packageOf = (spec) =>
  spec
    .replace(/^node:.*/, "")
    .split("/")
    .slice(0, spec.startsWith("@") ? 2 : 1)
    .join("/");

/** `entry` and every local file it imports, followed through their imports, and the packages they import. */
function walk(entry, files) {
  const seen = new Set();
  const packages = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith(".json")) return;
    const source = files.read(file).toString("utf8");
    for (const [pattern, name] of UNFOLLOWED)
      if (pattern.test(source))
        throw new Error(
          `${relative(ROOT, file)} uses ${name}, which the figures hash can't follow: use static imports.`,
        );
    for (const [, spec] of source.matchAll(IMPORT)) {
      const dep = resolveImport(file, spec, files);
      if (dep) visit(dep);
      else if (packageOf(spec)) packages.add(packageOf(spec));
    }
  };
  visit(entry);
  return { files: [...seen].sort(), packages: [...packages].sort() };
}

/** `entry` and every local file it imports, followed through their imports. */
export const dependencies = (entry, files = DISK) => walk(entry, files).files;

/** The installed version of a package. */
function versionOf(name) {
  const manifest = join(ROOT, "node_modules", name, "package.json");
  return JSON.parse(readFileSync(manifest, "utf8")).version;
}

/** The hash of a compute module, everything it imports, and the versions of the packages they import. */
export function hashFor(compute, files = DISK) {
  const hash = createHash("sha256");
  const { files: sources, packages } = walk(compute, files);
  for (const file of sources) {
    hash.update(relative(ROOT, file)).update("\0").update(files.read(file)).update("\0");
  }
  for (const name of packages) hash.update(`${name}@${versionOf(name)}`).update("\0");
  return hash.digest("hex").slice(0, 16);
}

/** Every article's compute module, with its figures file and whether that's stale. */
export function articles(files = DISK) {
  return files
    .list(ARTICLES)
    .filter((f) => f.endsWith(".compute.ts"))
    .sort()
    .map((f) => {
      const compute = join(ARTICLES, f);
      const figures = compute.replace(/\.compute\.ts$/, ".figures.json");
      const hash = hashFor(compute, files);
      const saved = files.isFile(figures)
        ? JSON.parse(files.read(figures).toString("utf8")).hash
        : null;
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
  const fromIndex = process.argv.includes("--staged");
  const stale = articles(fromIndex ? staged() : DISK).filter((a) => a.stale);
  if (stale.length) {
    console.error(
      `These articles' figures are out of date${fromIndex ? " as staged" : ""}: ${stale.map((a) => a.name).join(", ")}.\n` +
        `Run \`npm run figures\` to work them out again, and ${fromIndex ? "stage" : "commit"} the result.`,
    );
    process.exit(1);
  }
}
