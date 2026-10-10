'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function layoutAt(width, height) {
  const source = fs.readFileSync(path.join(__dirname, 'GuidedTour.tsx'), 'utf8');
  const tree = ts.createSourceFile('GuidedTour.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['pickSide', 'cardPosition']);
  const functions = tree.statements
    .filter((statement) => ts.isFunctionDeclaration(statement) && names.has(statement.name?.text))
    .map((statement) => statement.getText(tree));
  const constants = source.match(/const CARD_W[^;]*;/)?.[0];
  assert.equal(functions.length, 2);
  assert.ok(constants);

  const code = ts.transpileModule(
    `${constants}\n${functions.join('\n')}\nglobalThis.layout = { pickSide, cardPosition };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const context = { window: { innerWidth: width, innerHeight: height } };
  vm.runInNewContext(code, context, { timeout: 1000 });
  return context.layout;
}

test('keeps the tour card and highlighted target visible at 320px', () => {
  const { pickSide, cardPosition } = layoutAt(320, 640);
  const hole = { top: 92, left: 12, width: 76, height: 56 };
  const side = pickSide(hole);
  const position = cardPosition(hole, side);
  const responsiveCardWidth = Math.min(330, 320 - 24);

  assert.equal(side, 'below');
  assert.equal(position.left, 12);
  assert.equal(position.left + responsiveCardWidth, 308);
  assert.ok(position.top >= hole.top + hole.height + 16);
});

test('keeps the preferred right-side placement when it fits', () => {
  const { pickSide, cardPosition } = layoutAt(1024, 768);
  const hole = { top: 92, left: 12, width: 76, height: 56 };
  const side = pickSide(hole);
  const position = cardPosition(hole, side);

  assert.equal(side, 'right');
  assert.equal(position.left, hole.left + hole.width + 16);
});
