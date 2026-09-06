import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findFilesWithExtensions(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findFilesWithExtensions(fullPath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Sous-phase 2.2 — Anti-Hexadécimal JSX & Design Tokens Strictness (TDD)', () => {
  const targetDirs = [
    path.resolve(process.cwd(), 'src/features/trips'),
    path.resolve(process.cwd(), 'src/components/groupes'),
    path.resolve(process.cwd(), 'src/app/voyages'),
  ];

  it('TEST-DESIGN-01: zero occurrence of rogue green #5C6B5E in JSX files', () => {
    const violations: { file: string; line: number; content: string }[] = [];

    for (const dir of targetDirs) {
      const files = findFilesWithExtensions(dir, ['.tsx']);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('#5C6B5E') || line.includes('#5c6b5e')) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }

    expect(
      violations,
      `Rogue green #5C6B5E found in ${violations.length} places. Use semantic tokens instead.`
    ).toEqual([]);
  });

  it('TEST-DESIGN-02: zero occurrence of hardcoded arbitrary hex [#17402C] or [#5B7F55] in JSX classNames', () => {
    const violations: { file: string; line: number; content: string }[] = [];

    for (const dir of targetDirs) {
      const files = findFilesWithExtensions(dir, ['.tsx']);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          // Check for arbitrary tailwind syntax like text-[#17402C] or bg-[#5B7F55]
          if (
            line.includes('[#17402C]') ||
            line.includes('[#17402c]') ||
            line.includes('[#5B7F55]') ||
            line.includes('[#5b7f55]')
          ) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }

    expect(
      violations,
      `Hardcoded hex classes found in ${violations.length} places. Use lkv-primary, lkv-secondary or tokens.`
    ).toEqual([]);
  });
});
