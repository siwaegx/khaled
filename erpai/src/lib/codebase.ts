import fs from "fs";
import path from "path";

// erpai/ is at the repo root, so parent dir = repo root
const REPO_ROOT = path.resolve(process.cwd(), "..");

export function getRepoRoot(): string {
  return REPO_ROOT;
}

// Patterns that must never be read regardless of path
const BLOCKED_PATTERNS = [/\.env($|\.)/, /\.env\b/, /secret/i, /private_key/i];

export function readFile(filePath: string): string | null {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(REPO_ROOT, filePath);

    // Enforce sandbox: resolved path must be inside REPO_ROOT
    const repoRoot = path.resolve(REPO_ROOT);
    if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) {
      return `Error: access denied — path is outside the project directory`;
    }

    // Block sensitive file names
    const basename = path.basename(fullPath);
    if (BLOCKED_PATTERNS.some((re) => re.test(basename))) {
      return `Error: access denied — sensitive file`;
    }

    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return null;
  }
}

export function listDirectory(dirPath: string): string[] {
  try {
    const fullPath = path.isAbsolute(dirPath)
      ? path.resolve(dirPath)
      : path.resolve(REPO_ROOT, dirPath);

    const repoRoot = path.resolve(REPO_ROOT);
    if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) {
      return [];
    }

    return fs.readdirSync(fullPath, { withFileTypes: true }).map(
      (e) => (e.isDirectory() ? `[DIR] ${e.name}` : e.name)
    );
  } catch {
    return [];
  }
}

export function grepCode(
  pattern: string,
  directory: string = "",
  extensions: string[] = [".ts", ".tsx", ".js"]
): string[] {
  const results: string[] = [];
  const searchDir = directory
    ? path.join(REPO_ROOT, directory)
    : REPO_ROOT;

  function walk(dir: string, depth: number) {
    if (depth > 6 || results.length >= 60) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git" ||
        entry.name === "generated"
      )
        continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          // Compile regex once outside the loop; catch invalid/ReDoS-prone patterns
          let re: RegExp;
          try {
            re = new RegExp(pattern, "gi");
          } catch {
            return; // invalid pattern — skip silently
          }
          lines.forEach((line, i) => {
            re.lastIndex = 0; // reset for global flag reuse
            if (re.test(line)) {
              const rel = path.relative(REPO_ROOT, fullPath).replace(/\\/g, "/");
              results.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          });
        } catch {}
      }
    }
  }

  walk(searchDir, 0);
  return results;
}

// Builds the large stable context string for caching in the system prompt
let _cachedContext: string | null = null;

export function getProjectContext(): string {
  if (_cachedContext) return _cachedContext;

  const parts: string[] = [];

  // EXPLAIN.txt — first 18 KB gives full architecture picture
  const explain = readFile("EXPLAIN.txt");
  if (explain) {
    parts.push("## BUSINESS360 PROJECT DOCUMENTATION\n\n" + explain.slice(0, 18000));
  }

  // MODULE_RULES.txt
  const rules = readFile("MODULE_RULES.txt");
  if (rules) {
    parts.push("## MODULE RULES\n\n" + rules.slice(0, 3000));
  }

  // Active modules list
  try {
    const mods = fs.readdirSync(path.join(REPO_ROOT, "modules"));
    parts.push("## ACTIVE MODULES\n\n" + mods.join(", "));
  } catch {}

  // API route files
  const apiRoutes = listDirectory("apps/api/src/routes").filter(
    (f) => !f.startsWith("[DIR]")
  );
  if (apiRoutes.length) {
    parts.push("## API ROUTE FILES\n\n" + apiRoutes.join(", "));
  }

  // Web app pages
  const webPages = listDirectory("apps/web/src/app");
  if (webPages.length) {
    parts.push("## WEB APP PAGES\n\n" + webPages.join(", "));
  }

  _cachedContext = parts.join("\n\n---\n\n");
  return _cachedContext;
}
