import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { bank } from '../../src/design/bank.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

console.log('=== ADVERSARIAL STRESS TEST SUITE FOR DESIGN BANK GENERATOR ===\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

function runCmd(cmd) {
  try {
    const stdout = execSync(cmd, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

// -----------------------------------------------------------------------------
// 1. Initial State & Sync Check
// -----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Initial Sync & Check Mode ---');
const initialCheck = runCmd('node scripts/generate-design-bank.mjs --check');
assert(initialCheck.status === 0, 'Initial check exits with code 0');
assert(initialCheck.stdout.includes('All design bank generated artifacts are in sync'), 'Initial check outputs success message');

// -----------------------------------------------------------------------------
// 2. Drift Detection on Every Generated Target
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Drift Detection on Targets ---');
const targets = [
  'src/styles/tokens.generated.css',
  'src/design/tokens.generated.ts',
  'tailwind.preset.generated.js',
  'tailwind.preset.generated.cjs',
  'ios/App/App/DesignTokens.generated.swift',
  'android/app/src/main/res/values/design_tokens.generated.xml',
  'android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt',
];

for (const targetRel of targets) {
  const targetPath = resolve(root, targetRel);
  const originalContent = readFileSync(targetPath, 'utf8');
  
  // Drift by appending a comment or altering content
  const driftContent = originalContent + '\n/* DRIFT_TEST_INTENTIONAL_PAYLOAD */\n';
  writeFileSync(targetPath, driftContent, 'utf8');

  // Verify --check catches the drift
  const driftCheck = runCmd('node scripts/generate-design-bank.mjs --check');
  assert(driftCheck.status === 1, `--check exits with code 1 on drift in ${targetRel}`);
  assert(driftCheck.stderr.includes(`Content mismatch in: ${targetPath}`) || driftCheck.stdout.includes(`Content mismatch in: ${targetPath}`),
    `--check correctly reports mismatch in ${targetRel}`);

  // Re-run generator to restore sync
  const genResult = runCmd('node scripts/generate-design-bank.mjs');
  assert(genResult.status === 0, `generator exits with code 0 restoring ${targetRel}`);

  // Verify content restored
  const restoredContent = readFileSync(targetPath, 'utf8');
  assert(restoredContent === originalContent, `Restored content matches original exactly for ${targetRel}`);

  // Verify --check passes again
  const postCheck = runCmd('node scripts/generate-design-bank.mjs --check');
  assert(postCheck.status === 0, `--check exits with code 0 after restoring ${targetRel}`);
}

// -----------------------------------------------------------------------------
// 3. Missing File Drift Detection
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Missing Target File Detection ---');
const swiftPath = resolve(root, 'ios/App/App/DesignTokens.generated.swift');
const swiftBak = swiftPath + '.bak';
renameSync(swiftPath, swiftBak);

try {
  const missingCheck = runCmd('node scripts/generate-design-bank.mjs --check');
  assert(missingCheck.status === 1, '--check exits with code 1 when target file is missing');
  assert(missingCheck.stderr.includes('Missing file:') || missingCheck.stdout.includes('Missing file:'),
    '--check reports "Missing file:" for missing target');

  // Generator recovers missing file
  const genResult = runCmd('node scripts/generate-design-bank.mjs');
  assert(genResult.status === 0, 'generator recreates missing file and exits 0');
  assert(existsSync(swiftPath), 'Missing file successfully recreated');

  const postCheck = runCmd('node scripts/generate-design-bank.mjs --check');
  assert(postCheck.status === 0, '--check passes after recreating missing file');
} finally {
  if (existsSync(swiftBak)) {
    unlinkSync(swiftBak);
  }
}

// -----------------------------------------------------------------------------
// 4. Swift Syntax & Type Safety
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Swift Syntax & Type Safety ---');
const swiftTypecheck = runCmd('xcrun -sdk iphonesimulator swiftc -target arm64-apple-ios17.0-simulator -typecheck ios/App/App/DesignTokens.generated.swift');
assert(swiftTypecheck.status === 0, 'Swift file typechecks cleanly with arm64-apple-ios17.0-simulator SDK');
if (swiftTypecheck.status !== 0) {
  console.error('Swift error output:', swiftTypecheck.stderr || swiftTypecheck.stdout);
}

const swiftContent = readFileSync(swiftPath, 'utf8');
assert(swiftContent.includes('public enum DesignTokens'), 'Swift file defines public enum DesignTokens');
assert(swiftContent.includes('public enum Colors'), 'Swift file defines public enum Colors');
assert(swiftContent.includes('public enum Radii'), 'Swift file defines public enum Radii');
assert(swiftContent.includes('public enum ZIndex'), 'Swift file defines public enum ZIndex');
assert(swiftContent.includes('public enum Touch'), 'Swift file defines public enum Touch');

// Verify token value parity with bank.ts
assert(swiftContent.includes(`"${bank.brand.primary}"`), `Swift brandPrimary matches bank.ts (${bank.brand.primary})`);
assert(swiftContent.includes(`"${bank.brand.action}"`), `Swift brandAction matches bank.ts (${bank.brand.action})`);
assert(swiftContent.includes(`"${bank.surfaces.canvas}"`), `Swift surfaceCanvas matches bank.ts (${bank.surfaces.canvas})`);
assert(swiftContent.includes(`"${bank.inks.labelPrimary}"`), `Swift labelPrimary matches bank.ts (${bank.inks.labelPrimary})`);
assert(swiftContent.includes(`xs: CGFloat = ${bank.radii.xs}`), `Swift radii.xs matches bank.ts (${bank.radii.xs})`);
assert(swiftContent.includes(`card: CGFloat = ${bank.radii.card}`), `Swift radii.card matches bank.ts (${bank.radii.card})`);
assert(swiftContent.includes(`modal: Int = ${bank.zIndex.modal}`), `Swift zIndex.modal matches bank.ts (${bank.zIndex.modal})`);
assert(swiftContent.includes(`minTouchTarget: CGFloat = ${bank.spacing.touchMinApple}`), `Swift touchMin matches bank.ts (${bank.spacing.touchMinApple})`);

// -----------------------------------------------------------------------------
// 5. Android XML Syntax & Well-Formedness
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 5: Android XML Well-Formedness ---');
const xmlPath = resolve(root, 'android/app/src/main/res/values/design_tokens.generated.xml');
const xmlValidation = runCmd(`xmllint --noout "${xmlPath}"`);
assert(xmlValidation.status === 0, 'Android XML passes xmllint validation with 0 errors');
if (xmlValidation.status !== 0) {
  console.error('xmllint error:', xmlValidation.stderr || xmlValidation.stdout);
}

const xmlContent = readFileSync(xmlPath, 'utf8');
assert(xmlContent.startsWith('<?xml version="1.0" encoding="utf-8"?>'), 'Android XML has valid XML header declaration');
assert(xmlContent.includes('<resources>') && xmlContent.includes('</resources>'), 'Android XML has <resources> root tags');

// Verify tag balancing
const openColorTags = (xmlContent.match(/<color\b/g) || []).length;
const closeColorTags = (xmlContent.match(/<\/color>/g) || []).length;
assert(openColorTags > 0 && openColorTags === closeColorTags, `Android XML <color> tags are balanced (${openColorTags} opened, ${closeColorTags} closed)`);

const openDimenTags = (xmlContent.match(/<dimen\b/g) || []).length;
const closeDimenTags = (xmlContent.match(/<\/dimen>/g) || []).length;
assert(openDimenTags > 0 && openDimenTags === closeDimenTags, `Android XML <dimen> tags are balanced (${openDimenTags} opened, ${closeDimenTags} closed)`);

// Verify XML values match bank.ts
assert(xmlContent.includes(`<color name="lkdv_brand_primary">${bank.brand.primary}</color>`), 'XML lkdv_brand_primary matches bank.ts');
assert(xmlContent.includes(`<color name="lkdv_brand_action">${bank.brand.action}</color>`), 'XML lkdv_brand_action matches bank.ts');
assert(xmlContent.includes(`<color name="lkdv_surface_canvas">${bank.surfaces.canvas}</color>`), 'XML lkdv_surface_canvas matches bank.ts');
assert(xmlContent.includes(`<color name="lkdv_label_primary">${bank.inks.labelPrimary}</color>`), 'XML lkdv_label_primary matches bank.ts');
assert(xmlContent.includes(`<dimen name="lkdv_radius_card">${bank.radii.card}dp</dimen>`), 'XML lkdv_radius_card matches bank.ts');
assert(xmlContent.includes(`<dimen name="lkdv_touch_target_min">${bank.spacing.touchMinAndroid}dp</dimen>`), 'XML lkdv_touch_target_min matches bank.ts');

// -----------------------------------------------------------------------------
// 6. Zero Black Rule (#000, #101010, #121815) Across Bank & Generated Files
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Zero Forbidden Black Colors ---');
const filesToCheck = [
  'src/design/bank.ts',
  ...targets
];

const forbiddenHex = ['#000000', '#000', '#101010', '#121815'];
const forbiddenRegex = /#(?:000000|000|101010|121815)\b/gi;

for (const fileRel of filesToCheck) {
  const filePath = resolve(root, fileRel);
  const content = readFileSync(filePath, 'utf8');
  
  // Strip comments (including multi-line JSDoc/CSS comments) before checking code values
  const codeOnly = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const matches = codeOnly.match(forbiddenRegex) || [];
  assert(matches.length === 0, `Zero forbidden black colors in code of ${fileRel}`);
  if (matches.length > 0) {
    console.error(`  Violations in ${fileRel}:`, matches);
  }
}

// -----------------------------------------------------------------------------
// 7. tokens.generated.css Contains 0 !important
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 7: Zero !important in tokens.generated.css ---');
const cssPath = resolve(root, 'src/styles/tokens.generated.css');
const cssContent = readFileSync(cssPath, 'utf8');
const importantMatches = (cssContent.match(/!important/g) || []).length;
assert(importantMatches === 0, `tokens.generated.css contains 0 !important (actual: ${importantMatches})`);

// -----------------------------------------------------------------------------
// 8. Idempotency & Determinism
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 8: Idempotency & Determinism ---');
const gitDiffBefore = runCmd('git diff ' + targets.join(' '));
assert(gitDiffBefore.stdout.trim() === '', 'Workspace targets are clean in git diff before idempotency test');

const run1 = runCmd('node scripts/generate-design-bank.mjs');
assert(run1.status === 0, 'First regeneration succeeds');
const run2 = runCmd('node scripts/generate-design-bank.mjs');
assert(run2.status === 0, 'Second regeneration succeeds');

const gitDiffAfter = runCmd('git diff ' + targets.join(' '));
assert(gitDiffAfter.stdout.trim() === '', 'Regeneration is 100% idempotent; git diff is completely empty');

// -----------------------------------------------------------------------------
// 9. Edge Cases: npm scripts integration
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 9: npm Scripts Wiring ---');
const pkgJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
assert(pkgJson.scripts['design:generate'] === 'node scripts/generate-design-bank.mjs', 'package.json defines "design:generate"');
assert(pkgJson.scripts['design:check'] === 'node scripts/generate-design-bank.mjs --check', 'package.json defines "design:check"');
assert(pkgJson.scripts['prebuild'].includes('node scripts/generate-design-bank.mjs'), 'package.json prebuild runs design generator');
assert(pkgJson.scripts['predev'].includes('node scripts/generate-design-bank.mjs'), 'package.json predev runs design generator');

const npmCheckRun = runCmd('npm run design:check');
assert(npmCheckRun.status === 0, '"npm run design:check" executes cleanly with exit code 0');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log(`\n===============================================================`);
console.log(`TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`===============================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
