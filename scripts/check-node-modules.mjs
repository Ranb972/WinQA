// Batch H1: checks that every installed package still ships the entry files it
// declares. On 2026-10-06 two @aws-sdk packages lost their dist-cjs folders while
// package.json and the lockfile said nothing was wrong; `npm ls` reads only the
// package.json files, so it cannot see that. This walk takes about 0.1 s.
//
//   node scripts/check-node-modules.mjs [projectDir]   (npm run check:deps)
//
// Rules learned from false positives:
// - when `exports` exists, `main` is ignored (@humanfs/* declare a main they do
//   not ship);
// - only the ".", "import", "require", "node" and "default" conditions are
//   followed (custom conditions such as "standard-schema-spec" point at source).
// Node built-ins only. Nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONDITIONS = new Set(['import', 'require', 'node', 'default']);
const CANDIDATE_SUFFIXES = ['', '.js', '.json', '.cjs', '.mjs'];

function entryExists(base, rel) {
  const p = path.join(base, rel);
  for (const suffix of CANDIDATE_SUFFIXES) {
    try {
      if (fs.statSync(p + suffix).isFile()) return true;
    } catch {
      // keep looking
    }
  }
  try {
    return fs.statSync(path.join(p, 'index.js')).isFile();
  } catch {
    return false;
  }
}

function exportTargets(exp, out) {
  if (typeof exp === 'string') {
    if (!exp.includes('*')) out.push(exp);
    return;
  }
  if (Array.isArray(exp)) {
    for (const item of exp) exportTargets(item, out);
    return;
  }
  if (exp && typeof exp === 'object') {
    for (const [key, value] of Object.entries(exp)) {
      if (key === '.' || CONDITIONS.has(key)) exportTargets(value, out);
    }
  }
}

/** The entry files a package.json declares for its root import. */
export function declaredEntries(pkg) {
  const targets = [];
  if (pkg.exports !== undefined && pkg.exports !== null) {
    const isMap =
      typeof pkg.exports === 'object' &&
      !Array.isArray(pkg.exports) &&
      Object.keys(pkg.exports).some((k) => k.startsWith('.'));
    exportTargets(isMap ? pkg.exports['.'] : pkg.exports, targets);
  } else if (typeof pkg.main === 'string' && pkg.main.length > 0) {
    targets.push(pkg.main);
  }
  return targets;
}

/**
 * Walks `<projectDir>/node_modules` (scoped and nested trees included) and
 * returns the package count and every missing entry as "<package path>: <entry>".
 */
export function checkNodeModules(projectDir) {
  const root = path.resolve(projectDir, 'node_modules');
  const problems = [];
  let packages = 0;

  function checkPackage(dir) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      return;
    }
    if (!pkg.name || !pkg.version) return;
    packages += 1;
    for (const rel of declaredEntries(pkg)) {
      if (!entryExists(dir, rel)) problems.push(`${path.relative(root, dir).split(path.sep).join('/')}: ${rel}`);
    }
  }

  function walk(nodeModules) {
    let entries;
    try {
      entries = fs.readdirSync(nodeModules, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      // Symlinked or junctioned packages (npm link) are skipped on purpose: they
      // are not part of the installed tree and following them could loop.
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const dir = path.join(nodeModules, entry.name);
      if (entry.name.startsWith('@')) {
        let scoped;
        try {
          scoped = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const sub of scoped) {
          if (!sub.isDirectory()) continue;
          const pkgDir = path.join(dir, sub.name);
          checkPackage(pkgDir);
          walk(path.join(pkgDir, 'node_modules'));
        }
      } else {
        checkPackage(dir);
        walk(path.join(dir, 'node_modules'));
      }
    }
  }

  walk(root);
  return { packages, problems };
}

function realpathOrSelf(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

// Compared through realpath on both sides, so running the script through a
// junction or symlink still counts as a direct run and prints the summary.
const invokedDirectly =
  process.argv[1] !== undefined && realpathOrSelf(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const started = Date.now();
  const { packages, problems } = checkNodeModules(process.argv[2] || '.');
  console.log(`packages=${packages} problems=${problems.length} ms=${Date.now() - started}`);
  for (const problem of problems.slice(0, 40)) console.log(`  ${problem}`);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
  process.exit(problems.length === 0 ? 0 : 1);
}
