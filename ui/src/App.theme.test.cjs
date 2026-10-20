"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const file = path.join(__dirname, "App.tsx");
const source = fs.readFileSync(file, "utf8");
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let themeDeclaration;
let themeToggle;

function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "[theme, setTheme]") {
    themeDeclaration = node.getText(tree);
  }
  if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onClick"
    && node.initializer && ts.isJsxExpression(node.initializer)
    && node.initializer.expression?.getText(tree).includes("setTheme(theme ===")) {
    themeToggle = node.initializer.expression.getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);

function initialThemeAndFirstToggle(stored) {
  assert.ok(themeDeclaration, "theme state initializer must be present");
  assert.ok(themeToggle, "theme toggle handler must be present");
  const javascript = ts.transpileModule(`
    const ${themeDeclaration};
    const clickTheme = ${themeToggle};
    globalThis.initialTheme = theme;
    clickTheme();
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const context = {
    localStorage: { getItem: () => stored },
    useState: (initialize) => [initialize(), (next) => { context.nextTheme = next; }],
  };
  vm.runInNewContext(javascript, context, { timeout: 1000 });
  return { initial: context.initialTheme, afterFirstToggle: context.nextTheme };
}

test("invalid persisted theme falls back to dark and first toggle changes to light", () => {
  assert.deepEqual(initialThemeAndFirstToggle("blue"), { initial: "dark", afterFirstToggle: "light" });
});

test("valid light theme remains light and toggles to dark", () => {
  assert.deepEqual(initialThemeAndFirstToggle("light"), { initial: "light", afterFirstToggle: "dark" });
});

test("valid dark theme remains dark and toggles to light", () => {
  assert.deepEqual(initialThemeAndFirstToggle("dark"), { initial: "dark", afterFirstToggle: "light" });
});

test("missing persisted theme defaults to dark and toggles to light", () => {
  assert.deepEqual(initialThemeAndFirstToggle(null), { initial: "dark", afterFirstToggle: "light" });
});
