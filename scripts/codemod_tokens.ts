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
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const targetDirs = [
  path.resolve(process.cwd(), 'src/features/trips'),
  path.resolve(process.cwd(), 'src/components/groupes'),
  path.resolve(process.cwd(), 'src/app/voyages'),
];

let totalModified = 0;

for (const dir of targetDirs) {
  const files = findFilesWithExtensions(dir, ['.tsx', '.ts']);
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;

    // 1. Purge rogue green #5C6B5E -> #5B7F55 or semantic classes
    content = content.replace(/text-\[#5C6B5E\]/gi, 'text-lkv-text-muted');
    content = content.replace(/bg-\[#5C6B5E\]/gi, 'bg-lkv-secondary');
    content = content.replace(/border-\[#5C6B5E\]/gi, 'border-lkv-border');
    content = content.replace(/ring-\[#5C6B5E\]/gi, 'ring-lkv-secondary');
    content = content.replace(/#5C6B5E/gi, '#5B7F55');

    // 2. Systematic Tailwind Arbitrary Hex Replacement for #17402C
    // Handles opacities like /10, /20, /5 etc.
    content = content.replace(/text-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `text-lkv-primary${opacity}` : 'text-lkv-primary';
    });
    content = content.replace(/bg-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `bg-lkv-primary${opacity}` : 'bg-lkv-primary';
    });
    content = content.replace(/border-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `border-lkv-primary${opacity}` : 'border-lkv-primary';
    });
    content = content.replace(/ring-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `ring-lkv-primary${opacity}` : 'ring-lkv-primary';
    });
    content = content.replace(/hover:bg-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:bg-lkv-primary${opacity}` : 'hover:bg-lkv-primary';
    });
    content = content.replace(/hover:text-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:text-lkv-primary${opacity}` : 'hover:text-lkv-primary';
    });
    content = content.replace(/hover:border-\[#17402[Cc]\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:border-lkv-primary${opacity}` : 'hover:border-lkv-primary';
    });

    // 3. Systematic Tailwind Arbitrary Hex Replacement for #5B7F55
    content = content.replace(/text-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `text-lkv-secondary${opacity}` : 'text-lkv-secondary';
    });
    content = content.replace(/bg-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `bg-lkv-secondary${opacity}` : 'bg-lkv-secondary';
    });
    content = content.replace(/border-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `border-lkv-secondary${opacity}` : 'border-lkv-secondary';
    });
    content = content.replace(/ring-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `ring-lkv-secondary${opacity}` : 'ring-lkv-secondary';
    });
    content = content.replace(/hover:bg-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:bg-lkv-secondary${opacity}` : 'hover:bg-lkv-secondary';
    });
    content = content.replace(/hover:text-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:text-lkv-secondary${opacity}` : 'hover:text-lkv-secondary';
    });
    content = content.replace(/hover:border-\[#5[Bb]7[Ff]55\](\/[0-9]+)?/g, (_match, opacity) => {
      return opacity ? `hover:border-lkv-secondary${opacity}` : 'hover:border-lkv-secondary';
    });

    // Generic any remaining `[#17402C]` or `[#5B7F55]`
    content = content.replace(/\[#17402[Cc]\]/g, 'var(--lkv-primary)');
    content = content.replace(/\[#5[Bb]7[Ff]55\]/g, 'var(--lkv-secondary)');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`Updated tokens in: ${path.relative(process.cwd(), file)}`);
      totalModified++;
    }
  }
}

console.log(`Codemod complete! ${totalModified} files updated.`);
