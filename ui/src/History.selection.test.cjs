'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function selectedCondition() {
  const source = fs.readFileSync(path.join(__dirname, 'History.tsx'), 'utf8');
  const tree = ts.createSourceFile('History.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helper = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'sameCell');
  let condition;
  function visit(node) {
    if (ts.isConditionalExpression(node)
      && node.whenTrue.getText(tree) === "'selected'"
      && node.whenFalse.getText(tree) === "''") {
      condition = node.condition.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(condition, 'History must render a selected-cell condition');
  const code = ts.transpileModule(
    `${helper?.getText(tree) ?? ''}\nglobalThis.isSelected = (selected, c) => ${condition};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const context = {};
  vm.runInNewContext(code, context, { timeout: 1000 });
  return context.isSelected;
}

const entry = {
  ts: 1000, trigger: 'heartbeat', ok: true, verdict: true,
  txId: 'tx-1', attestedAt: '2026-10-16T00:00:00Z', validUntil: null,
  assetsCommitment: 'assets-1', liabilitiesRoot: 'root-1',
  durationSec: 1.5, error: null,
};

test('keeps an attestation selected after the cells are rebuilt', () => {
  const isSelected = selectedCondition();
  assert.equal(isSelected({ kind: 'attest', entry }, { kind: 'attest', entry: { ...entry } }), true);
  assert.equal(isSelected({ kind: 'attest', entry }, { kind: 'attest', entry: { ...entry, txId: 'tx-2' } }), false);
});

test('keeps a gap selected without selecting a different gap or attestation', () => {
  const isSelected = selectedCondition();
  const selected = { kind: 'gap', from: 1000, to: 2000 };
  assert.equal(isSelected(selected, { kind: 'gap', from: 1000, to: 2000 }), true);
  assert.equal(isSelected(selected, { kind: 'gap', from: 2000, to: 3000 }), false);
  assert.equal(isSelected(selected, { kind: 'attest', entry }), false);
});
