const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = '/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference';
const tiersDir = path.join(root, 'tests/e2e/tiers');
const files = fs.readdirSync(tiersDir).filter(f => f.endsWith('.spec.ts'));

const domainAssertions = new Set([
  'assertAppleGrabber',
  'assertContinuousSquircle',
  'assertMinTouchTarget',
  'assertNoPureBlack',
  'assertWcagContrast',
  'assertZeroCollision',
  'calculateContrastRatio',
  'calculateRelativeLuminance',
  'calculateIntersectionArea',
]);

const results = [];

for (const file of files) {
  const filePath = path.join(tiersDir, file);
  const code = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'it' || expr.text === 'test')) {
        const testNameArg = node.arguments[0];
        const testFuncArg = node.arguments[1];

        let testName = 'unknown';
        if (testNameArg && ts.isStringLiteral(testNameArg)) {
          testName = testNameArg.text;
        }

        let expectCalls = 0;
        let domainAssertionCalls = 0;
        let suspiciousTrivial = 0;

        function walkTestBody(child) {
          if (ts.isCallExpression(child)) {
            const childExpr = child.expression;
            // check for expect(...)
            if (ts.isIdentifier(childExpr) && childExpr.text === 'expect') {
              expectCalls++;
              // Check what it is expecting
              const arg = child.arguments[0];
              // check if parent is .toBe(...) or similar
              if (ts.isPropertyAccessExpression(child.parent) && ts.isCallExpression(child.parent.parent)) {
                const method = child.parent.name.text;
                const expectedArg = child.parent.parent.arguments[0];
                if (arg && expectedArg) {
                  // check if both are literals and equal
                  if (arg.kind === expectedArg.kind && arg.getText(sourceFile) === expectedArg.getText(sourceFile)) {
                    // Check if it's true === true or false === false or 1 === 1
                    suspiciousTrivial++;
                  }
                }
              }
            }
            // check for domain assertions
            if (ts.isIdentifier(childExpr) && domainAssertions.has(childExpr.text)) {
              domainAssertionCalls++;
            }
          }
          ts.forEachChild(child, walkTestBody);
        }

        if (testFuncArg) {
          walkTestBody(testFuncArg);
        }

        results.push({
          file,
          testName,
          expectCalls,
          domainAssertionCalls,
          suspiciousTrivial,
          totalAssertions: expectCalls + domainAssertionCalls,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log('Total tests parsed via TS AST:', results.length);
const withoutAssertions = results.filter(r => r.totalAssertions === 0);
console.log('Tests with zero assertions:', withoutAssertions.length);
if (withoutAssertions.length > 0) {
  console.log(JSON.stringify(withoutAssertions, null, 2));
}

const suspicious = results.filter(r => r.suspiciousTrivial > 0);
console.log('Tests with suspicious trivial assertions:', suspicious.length);
if (suspicious.length > 0) {
  console.log(JSON.stringify(suspicious, null, 2));
}

const byFile = {};
for (const r of results) {
  byFile[r.file] = (byFile[r.file] || 0) + 1;
}
console.log('Tests per file:', JSON.stringify(byFile, null, 2));
