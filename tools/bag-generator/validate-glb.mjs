import { readGLBHeader } from './glb-writer.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2] || './out';
let bad = 0;
for (const f of readdirSync(dir).filter(x => x.endsWith('.glb'))) {
  const buf = readFileSync(join(dir, f));
  try {
    const { version, json, binLen } = readGLBHeader(buf);
    const meshNames = json.meshes.map(m => m.name);
    const anchors = json.nodes.filter(n => n.name?.startsWith('anchor:')).map(n => n.name);
    const hinges = json.nodes.filter(n => n.extras?.hinge).length;
    console.log(`${f}`);
    console.log(`  glTF v${version} · ${json.meshes.length} maillages · ${json.materials.length} matériaux · ${json.accessors.length} accesseurs · BIN ${binLen} o`);
    console.log(`  pièces : ${meshNames.join(', ')}`);
    console.log(`  ancres : ${anchors.length} (${anchors.slice(0,4).join(', ')}${anchors.length>4?', …':''})`);
    console.log(`  charnières : ${hinges}`);
    // contrôles durs
    if (!json.meshes.length) { console.log('  ÉCHEC aucun maillage'); bad++; }
    if (json.meshes.some(m => !m.name)) { console.log('  ÉCHEC maillage sans nom'); bad++; }
    if (!anchors.length) { console.log('  ÉCHEC aucune ancre'); bad++; }
    for (const a of json.accessors) if (a.type==='VEC3' && a.min && a.min.some(v=>!isFinite(v))) { console.log('  ÉCHEC bornes non finies'); bad++; }
  } catch (e) { console.log(`${f}  ÉCHEC ${e.message}`); bad++; }
  console.log();
}
console.log(bad ? `${bad} problème(s)` : 'Tous les GLB sont bien formés.');
process.exit(bad?1:0);
