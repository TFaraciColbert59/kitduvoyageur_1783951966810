import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateSideBySide() {
  const dir = path.resolve('audit/screens/hub');
  const imgBeforePath = path.join(dir, '390x844-dark-intensity-0.png');
  const imgAfterPath = path.join(dir, '390x844-dark-default.png');

  if (!fs.existsSync(imgBeforePath) || !fs.existsSync(imgAfterPath)) {
    console.error('Images non trouvées pour le comparatif');
    return;
  }

  const meta1 = await sharp(imgBeforePath).metadata();
  const meta2 = await sharp(imgAfterPath).metadata();

  const width = meta1.width + meta2.width + 40;
  const height = Math.max(meta1.height, meta2.height) + 80;

  // Créer un fond sombre avec étiquettes SVG
  const svgHeader = `
  <svg width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#0A0E0C" />
    <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#CBD8D0">AVANT : Fond brut / Verre éteint (Ratio &lt; 3:1)</text>
    <text x="${meta1.width + 50}" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#7FC49A">APRÈS : Liquid Glass Calibré (Conformité 97.4%)</text>
  </svg>
  `;

  const outPath = path.resolve('audit/screens/hub/comparatif-avant-apres.png');

  await sharp(Buffer.from(svgHeader))
    .composite([
      { input: imgBeforePath, left: 20, top: 60 },
      { input: imgAfterPath, left: meta1.width + 40, top: 60 }
    ])
    .png()
    .toFile(outPath);

  console.log(`✓ Comparatif généré : ${outPath}`);
}

generateSideBySide().catch(console.error);
