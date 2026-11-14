const fs = require('fs');
const path = require('path');

const root = '/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference';
const tiersDir = path.join(root, 'tests/e2e/tiers');
const files = fs.readdirSync(tiersDir).filter(f => f.endsWith('.spec.ts'));

let totalTests = 0;
let suspiciousAssertions = [];
let allExpectCalls = 0;
let testsWithoutExpectOrAssertion = [];

const domainAssertionNames = [
  'assertAppleGrabber',
  'assertContinuousSquircle',
  'assertMinTouchTarget',
  'assertNoPureBlack',
  'assertWcagContrast',
  'assertZeroCollision',
  'calculateContrastRatio',
  'calculateRelativeLuminance',
  'calculateIntersectionArea',
];

for (const file of files) {
  const filePath = path.join(tiersDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Count "it(" or "test("
  const itRegex = /it\s*\(\s*(['"`].*?['"`])\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\);/g;
  let match;
  let countInFile = 0;

  while ((match = itRegex.exec(content)) !== null) {
    countInFile++;
    totalTests++;
    const testName = match[1];
    const testBody = match[2];

    const hasExpect = /expect\s*\(/.test(testBody);
    const hasDomainAssertion = domainAssertionNames.some(name => testBody.includes(name));

    if (!hasExpect && !hasDomainAssertion) {
      testsWithoutExpectOrAssertion.push({ file, testName });
    }

    // Check trivial expects like expect(true).toBe(true)
    const trivialPatterns = [
      /expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/,
      /expect\s*\(\s*false\s*\)\s*\.toBe\s*\(\s*false\s*\)/,
      /expect\s*\(\s*1\s*\)\s*\.toBe\s*\(\s*1\s*\)/,
      /expect\s*\(\s*0\s*\)\s*\.toBe\s*\(\s*0\s*\)/,
      /expect\s*\(\s*(['"][^'"]*['"])\s*\)\s*\.toBe\s*\(\s*\1\s*\)/,
    ];

    for (const pat of trivialPatterns) {
      if (pat.test(testBody)) {
        suspiciousAssertions.push({ file, testName, pattern: pat.toString() });
      }
    }
  }

  const expects = content.match(/expect\s*\(/g) || [];
  allExpectCalls += expects.length;

  console.log(`${file}: found ${countInFile} tests via regex, ${expects.length} expect calls`);
}

console.log('--- Summary ---');
console.log('Total tests parsed:', totalTests);
console.log('Total expect calls:', allExpectCalls);
console.log('Tests with zero expect or domain assertions:', testsWithoutExpectOrAssertion.length);
if (testsWithoutExpectOrAssertion.length > 0) {
  console.log(JSON.stringify(testsWithoutExpectOrAssertion, null, 2));
}
console.log('Suspicious trivial assertions found:', suspiciousAssertions.length);
if (suspiciousAssertions.length > 0) {
  console.log(JSON.stringify(suspiciousAssertions, null, 2));
}
