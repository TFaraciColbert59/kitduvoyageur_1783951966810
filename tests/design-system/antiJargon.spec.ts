import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function findFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions));
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// Strip block comments and line comments so we only inspect JSX and code strings
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

describe('Anti-Jargon Validation (D9 & Règle R0)', () => {
  const dirsToScan = [
    path.resolve(process.cwd(), 'src/features/trips'),
    path.resolve(process.cwd(), 'src/features/hub'),
    path.resolve(process.cwd(), 'src/app/hub'),
  ];

  const allFiles = dirsToScan.flatMap(dir => findFiles(dir, ['.tsx']));

  it('should not contain user-facing "Chantier [0-9]" or "Chantier N" in UI components', () => {
    const jargonRegex = /\b(Chantier\s*(\d+|N))\b/i;
    const violations: { file: string; match: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const cleanContent = stripComments(content);
      const lines = cleanContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (jargonRegex.test(line)) {
          violations.push({
            file: `${path.relative(process.cwd(), file)}:${i + 1}`,
            match: line.trim(),
          });
        }
      }
    }

    expect(
      violations,
      `Found user-facing "Chantier" jargon:\n${violations
        .map(v => `  - ${v.file}: "${v.match}"`)
        .join('\n')}`
    ).toEqual([]);
  });

  it('should not contain user-facing roadmap jargon like "(C2)", "Master Plan" in UI components', () => {
    const roadmapRegex = /\b(Master\s*Plan|\(C[1-8]\))\b/i;
    const violations: { file: string; match: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const cleanContent = stripComments(content);
      const lines = cleanContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (roadmapRegex.test(line)) {
          violations.push({
            file: `${path.relative(process.cwd(), file)}:${i + 1}`,
            match: line.trim(),
          });
        }
      }
    }

    expect(
      violations,
      `Found user-facing roadmap jargon:\n${violations
        .map(v => `  - ${v.file}: "${v.match}"`)
        .join('\n')}`
    ).toEqual([]);
  });

  it('should not use TripPlaceholderTab component anywhere in production UI', () => {
    const placeholderRegex = /<TripPlaceholderTab\b/;
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (placeholderRegex.test(content)) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    expect(
      violations,
      `Found usage of deprecated TripPlaceholderTab in: ${violations.join(', ')}`
    ).toEqual([]);
  });
});
