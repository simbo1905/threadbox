#!/usr/bin/env bun
// Tiny typecheck helper: runs TS diagnostics on provided files.
import * as ts from "typescript";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: bun run src/agent-dsl/check.ts <file.ts> [more.ts...]");
  process.exit(1);
}

const program = ts.createProgram({
  rootNames: files,
  options: {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.ES2020,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    baseUrl: ".",
    noEmit: true,
    allowImportingTsExtensions: true,
    paths: {
      "agent-dsl": ["src/agent-dsl/index.ts"],
    },
  },
});

const diagnostics = ts.getPreEmitDiagnostics(program);
const hasErrors = diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error);
if (hasErrors) {
  const msg = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
  console.error(msg);
  process.exit(2);
}

console.log("OK");
