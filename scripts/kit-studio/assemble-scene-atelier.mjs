// Assemble only captured WebGL pixels; text and framing are added with SVG.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const dir = path.join(process.cwd(), 'docs/kit-studio/preuves/scene-atelier');
const paper = '#EEEAE4', ink = '#141916';
const svg = (w,h,text) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial,sans-serif;fill:${ink}}</style>${text}</svg>`);
const layers = [];
const addText = (text, left, top, width=1860, size=25) => layers.push({input:svg(width,80,`<text x="0" y="32" font-size="${size}">${text}</text>`),left,top});
addText('KIT STUDIO · SCÈNE ATELIER · AVANT / APRÈS',30,20,1860,34);
addText('Scène de production · Chromium WebGL / SwiftShader · caméra et matières du sac identiques',30,70,1860,23);
const cases = [['45-seul','45 L seul'],['45-modules','45 L · M04 monté + M01 sur l’établi'],['15-seul','15 L seul']];
for(let col=0;col<3;col++) {
 const [file,label]=cases[col]; const left=30+col*630;
 for(const [row,tag] of ['avant','apres'].entries()) {
  const top=125+row*780;
  addText(`${tag==='avant'?'AVANT':'APRÈS'} · ${label}`,left,top,610,22);
  layers.push({input:await sharp(path.join(dir,`${tag}-${file}.png`)).resize(600,712).toBuffer(),left,top:top+45});
 }
}
addText('MATIÈRE · VRAI GROS PLAN WEBGL · TRAME ET SHEEN INCHANGÉS',30,1700,1860,29);
for(const [col,tag] of ['avant','apres'].entries()) {
 const left=30+col*600;
 addText(tag==='avant'?'AVANT · clé haute':'APRÈS · clé 30° / azimut 10°',left,1750,580,23);
 layers.push({input:await sharp(path.join(dir,`${tag}-tissu.png`)).resize(560,665).toBuffer(),left,top:1800});
}
const stats=JSON.parse(fs.readFileSync(path.join(dir,'apres-webgl.json')));
const c=stats.tissu.contrast;
addText('Pas de la trame : 4,69 mm',1230,1810,640,27);
addText('Sheen : 0,35 · PMREM intérieur conservé',1230,1870,640,25);
addText('Clé : 0,8π · remplissage opposé doux',1230,1930,640,25);
addText('Texture de tissu : même fichier avant/après',1230,1990,640,25);
addText(`Contraste local avec / sans trame : ×${c.ratio.toFixed(2)}`,1230,2070,660,24);
addText('Mesure sur une plage textile du gros plan',1230,2120,640,23);
addText('Ancres du 45 L : une façade auditée',1230,2220,640,25);
addText('M01 posé sur le plan, M04 fixé au sac',1230,2270,640,25);
await sharp({create:{width:1920,height:2490,channels:3,background:paper}}).composite(layers).png().toFile(path.join(dir,'scene-atelier-avant-apres.png'));
const matrix=[];
for(const [row,el] of [25,30,35].entries()) for(const [col,az] of [10,35].entries()) {
 const left=col*500,top=70+row*650;
 matrix.push({input:svg(500,65,`<text x="15" y="40" font-size="24">Élévation ${el}° · azimut ${az}° · 0,8π</text>`),left,top});
 matrix.push({input:await sharp(path.join(dir,`lumiere-${el}-${az}.png`)).resize(480,570).toBuffer(),left:left+10,top:top+60});
}
matrix.push({input:svg(1000,65,'<text x="15" y="40" font-size="28">Matrice de lumière · même tissu, même caméra, même PMREM</text>'),left:0,top:0});
await sharp({create:{width:1000,height:2025,channels:3,background:paper}}).composite(matrix).png().toFile(path.join(dir,'scene-atelier-matrice-lumiere.png'));
console.log('Assembled scene-atelier-avant-apres.png and scene-atelier-matrice-lumiere.png');
