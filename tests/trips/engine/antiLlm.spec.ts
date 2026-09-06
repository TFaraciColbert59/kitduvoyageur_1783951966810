import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function scanFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanFilesRecursively(fullPath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Anti-LLM Compliance Check (Règle Structurante Chantier 2)', () => {
  it('TEST-ANTI-LLM: getChatCompletion est ABSOLUMENT ABSENT de tout src/features/trips/**', () => {
    const tripsDir = path.resolve(process.cwd(), 'src/features/trips');
    const allFiles = scanFilesRecursively(tripsDir);

    expect(allFiles.length).toBeGreaterThan(0);

    const violatingFiles: string[] = [];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('getChatCompletion')) {
        violatingFiles.push(filePath);
      }
    }

    expect(
      violatingFiles,
      `Violation de la règle structurante : getChatCompletion détecté dans : ${violatingFiles.join(', ')}`
    ).toEqual([]);
  });
});
