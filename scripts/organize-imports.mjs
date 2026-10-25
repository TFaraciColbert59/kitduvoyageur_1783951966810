import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const files = process.argv.slice(2).map((f) => path.resolve(f));
const cfgPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, '.');
const host = {
  getScriptFileNames: () => files,
  getScriptVersion: () => '1',
  getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined),
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => cfg.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
};
const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
for (const f of files) {
  const changes = ls.organizeImports({ type: 'file', fileName: f }, { newLineCharacter: '\n' }, {});
  let text = fs.readFileSync(f, 'utf8');
  for (const c of changes) for (const t of [...c.textChanges].sort((a, b) => b.span.start - a.span.start)) text = text.slice(0, t.span.start) + t.newText + text.slice(t.span.start + t.span.length);
  fs.writeFileSync(f, text);
  console.log('ok', path.basename(f));
}
