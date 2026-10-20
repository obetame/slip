// Builds the slip browser client.
//
// Two stages, because neither tool alone can do the whole job:
//
//   1. tsc (TypeScript 5.9) type-checks the sources and DOWNLEVELS them to ES5.
//      esbuild cannot lower const/let/class to ES5 ("Transforming const to the
//      configured target environment es5 is not supported yet"), so tsc has to
//      produce ES5 first. TypeScript 5.9 is pinned in package.json because the
//      ES5 target was removed in TypeScript 7.
//   2. esbuild bundles each entry into an IIFE. Its input is already ES5, so it
//      never has to downlevel language syntax.
//
// The four bundles are separate <script> tags that share state through the
// global `window.Slip`. They must not import each other at module level, which
// is why each entry is bundled on its own (bundle is only used to concatenate
// the entry with any TypeScript helpers that tsc inlined into it).
//
// Run with `npm run build` from tooling/, which type-checks first.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const srcDir = join(repoRoot, "internal", "web", "src");
const outDir = join(repoRoot, "internal", "web", "static");
const tmpDir = join(repoRoot, ".webuild");

// The temp dir lives inside the repo (the sandbox forbids writing outside it)
// and must never be committed. It is also ignored in the root .gitignore.
const tsc = join(here, "node_modules", "typescript", "bin", "tsc");

// Every entry is bundled independently. `out` names the destination inside
// internal/web/static, and `entry` is the TypeScript file in internal/web/src.
const ENTRIES = [
  { entry: "core.ts", out: "core.js" },
  { entry: "app.ts", out: "app.js" },
  { entry: "legacy.ts", out: "legacy.js" },
  { entry: "boot.ts", out: "boot.js" },
];

// Tokens that must never reach the emitted artifacts: the legacy page targets
// iOS 12 Safari and the Go test internal/web/syntax_test.go greps for exactly
// these. Backticks, `?.`, `??`, arrow functions, and const/let/class words.
const FORBIDDEN = [
  { name: "arrow function", re: /=>/ },
  { name: "optional chaining", re: /\?\./ },
  { name: "nullish coalescing", re: /\?\?/ },
  { name: "template literal", re: /`/ },
  { name: "const", re: /\bconst\b/ },
  { name: "let", re: /\blet\b/ },
  { name: "class", re: /\bclass\b/ },
];

function fail(message) {
  console.error("build failed: " + message);
  process.exit(1);
}

function stripCommentsAndStrings(code) {
  // Good enough for a guard rail, not a parser: removes block comments, line
  // comments, and string literals so that words appearing inside them (for
  // example the string "class") do not trip the check. Regex literals are left
  // alone on purpose, since a stray one is worth failing over.
  let out = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end === -1 ? code.length : end + 2;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      i = end === -1 ? code.length : end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c) {
        if (code[j] === "\\") j++;
        j++;
      }
      out += c + c;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function lineOf(code, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (code[i] === "\n") line++;
  return line;
}

// A backtick inside a regular expression is plain ES5; only a real template
// literal leaves one in the emitted code. Regular expressions have to be
// cleared first, because the string scanner otherwise treats the pair of
// backticks in /^```/ as opening and closing quotes and mangles the rest of
// the file. A regex can follow an operator, an opening bracket, or a keyword
// such as return, and esbuild drops the parentheses around those, so the
// check looks at the last token rather than a single character.
const REGEX_AFTER_KEYWORD = /(?:^|[^A-Za-z0-9_$])(return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)\s*$/;

function stripRegexLiterals(code) {
  let out = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "/" && code[i + 1] !== "/" && code[i + 1] !== "*") {
      const before = out.replace(/\s+$/, "");
      const last = before.charAt(before.length - 1);
      const mayStart = last === "" || "=([,:[!&|?{};+-*%~^<>".indexOf(last) !== -1 || REGEX_AFTER_KEYWORD.test(before);
      if (mayStart) {
        let j = i + 1;
        let inClass = false;
        while (j < code.length) {
          const d = code[j];
          if (d === "\\") {
            j += 2;
            continue;
          }
          if (d === "\n") break;
          if (d === "[") inClass = true;
          else if (d === "]") inClass = false;
          else if (d === "/" && !inClass) break;
          j++;
        }
        if (code[j] === "/") {
          out += "//";
          i = j + 1;
          continue;
        }
      }
    }
    out += c;
    i++;
  }
  return out;
}

function assertEs5(code, where) {
  const bare = stripCommentsAndStrings(stripRegexLiterals(code));
  for (const rule of FORBIDDEN) {
    const m = rule.re.exec(bare);
    if (m) {
      fail(
        where +
          " is not ES5: found " +
          rule.name +
          " at line " +
          lineOf(bare, m.index) +
          ". tsc must downlevel this before esbuild sees it.",
      );
    }
  }
}

function bytes(n) {
  return n + " B";
}

async function main() {
  // Stage 1: emit ES5 JavaScript from the TypeScript sources.
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  try {
    execFileSync(
      process.execPath,
      [
        tsc,
        "-p",
        join(here, "tsconfig.json"),
        "--noEmit",
        "false",
        "--outDir",
        tmpDir,
      ],
      { cwd: here, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
  } catch (err) {
    // tsc prints its diagnostics on stdout; surface them verbatim.
    if (err.stdout) process.stderr.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    fail("tsc did not emit (see diagnostics above)");
  }

  // Stage 1b: refuse to hand anything but ES5 to esbuild.
  //
  // tsc preserves the tree layout relative to the common source root. Sources
  // live in exactly one directory (internal/web/src), so normally the emit
  // lands flat in tmpDir. Check the nested path first anyway and fall back to
  // the flat one, so this keeps working if a second source directory appears.
  const emitRoots = [join(tmpDir, "internal", "web", "src"), tmpDir];
  function locate(entry) {
    // ENTRIES name the .ts sources; tsc writes the matching .js next to them.
    const emittedName = entry.replace(/\.ts$/, ".js");
    for (const root of emitRoots) {
      const file = join(root, emittedName);
      try {
        readFileSync(file);
        return file;
      } catch {
        // try the next candidate
      }
    }
    return null;
  }

  const emittedFiles = new Map();
  for (const { entry } of ENTRIES) {
    const emitted = locate(entry);
    if (!emitted) {
      fail(
        "tsc did not emit " +
          entry +
          ". Is internal/web/src/" +
          entry +
          " missing or excluded from tsconfig?",
      );
    }
    emittedFiles.set(entry, emitted);
    assertEs5(readFileSync(emitted, "utf8"), "tsc output for " + entry);
  }

  // Stage 2: bundle each entry separately. Resolve esbuild from tooling/ so the
  // lookup does not depend on which directory the script was started from.
  const esbuild = createRequire(join(here, "package.json"))("esbuild");
  const results = [];
  for (const { entry, out } of ENTRIES) {
    const inFile = emittedFiles.get(entry);
    const outFile = join(outDir, out);
    try {
      const result = await esbuild.build({
        entryPoints: [inFile],
        // Write to a scratch outdir, not straight to static/, so the artifacts
        // can be checked for ES5 syntax before they land in the repo.
        outdir: join(tmpDir, "bundle"),
        bundle: true,
        format: "iife",
        target: "es5",
        platform: "browser",
        charset: "utf8",
        legalComments: "none",
        minify: false,
        write: false,
        logLevel: "silent",
      });
      // esbuild may report non-fatal errors through build().errors too.
      if (result.errors.length > 0) {
        for (const e of result.errors) console.error(e.text);
        fail("esbuild reported errors for " + entry);
      }
      const file = result.outputFiles[0];
      const text = file.text;
      assertEs5(text, out);
      // write:false keeps the artifact deterministic: we control the bytes and
      // never rely on esbuild's own file writing or source maps.
      writeFileSync(outFile, text, "utf8");
      results.push({ out, size: Buffer.byteLength(text, "utf8") });
    } catch (err) {
      if (err && err.errors) {
        for (const e of err.errors) {
          console.error(e.text || JSON.stringify(e));
        }
        fail(
          "esbuild could not bundle " +
            entry +
            ". If this mentions const/let/class and the ES5 target, the tsc step produced non-ES5 output.",
        );
      }
      throw err;
    }
  }

  // Stage 3: clean up and report.
  rmSync(tmpDir, { recursive: true, force: true });

  let total = 0;
  for (const r of results) total += r.size;
  for (const r of results) {
    console.log("  internal/web/static/" + r.out.padEnd(11) + bytes(r.size));
  }
  console.log("  " + results.length + " files, " + bytes(total) + " total");
}

main().catch((err) => {
  console.error("build failed: " + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
