import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcApp = path.join(root, 'src', 'app');
const srcComponents = path.join(root, 'src', 'components');
const srcFeatures = path.join(root, 'src', 'features');

// 1. Scanner toutes les routes de src/app
function scanRoutes(dir, base = '') {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      routes = routes.concat(scanRoutes(full, rel));
    } else if (entry.name === 'page.tsx') {
      routes.push({
        routePath: base ? `/${base.replace(/\\/g, '/')}` : '/',
        relFile: path.relative(root, full).replace(/\\/g, '/'),
        dir: base,
      });
    }
  }
  return routes;
}

const allRoutes = scanRoutes(srcApp);

// 2. Scanner les composants
function scanComponents(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(scanComponents(full));
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      list.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  return list;
}

const componentFiles = scanComponents(srcComponents).concat(scanComponents(srcFeatures));

// 3. Scanner les valeurs en dur dans src (hors tokens.css / tokens.ts)
const rawValues = [];
const hexPattern = /#(?:[0-9a-fA-F]{3,8})\b/g;
const roundedPattern = /rounded-(?:sm|md|lg|xl|2xl|3xl|\[\d+px\])/g;
const accentClassPattern = /\b(?:bg|text|border|ring)-(?:emerald|green|teal|primary|action|secondary)(?:-\d+)?\b/g;
const forbiddenPalette = ['#e4501c', '#a3c4a3', '#0b1f17', '#2d6b4a', '#1c2620'];

function scanFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Vérifier les hex
    const hexMatches = line.match(hexPattern);
    if (hexMatches) {
      hexMatches.forEach((h) => {
        const lower = h.toLowerCase();
        if (lower !== '#fff' && lower !== '#ffffff' && lower !== '#000' && lower !== '#000000') {
          const isForbidden = forbiddenPalette.includes(lower);
          rawValues.push({
            file: path.relative(root, filePath).replace(/\\/g, '/'),
            line: idx + 1,
            type: 'Hexadécimal',
            val: h,
            accentToDelete: isForbidden ? 'OUI (Palette Interdite)' : 'OUI (Monochrome requis)',
          });
        }
      });
    }

    // Vérifier les classes accent Tailwind
    const accentMatches = line.match(accentClassPattern);
    if (accentMatches) {
      accentMatches.forEach((ac) => {
        rawValues.push({
          file: path.relative(root, filePath).replace(/\\/g, '/'),
          line: idx + 1,
          type: 'Classe Accent',
          val: ac,
          accentToDelete: 'OUI (Supprimer accent couleur)',
        });
      });
    }

    // Vérifier les arrondis non-tokens
    const roundedMatches = line.match(roundedPattern);
    if (roundedMatches) {
      roundedMatches.forEach((r) => {
        rawValues.push({
          file: path.relative(root, filePath).replace(/\\/g, '/'),
          line: idx + 1,
          type: 'Rayon Tailwind',
          val: r,
          accentToDelete: 'NON (À harmoniser concentricité/capsule)',
        });
      });
    }
  });
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      walkDir(full);
    } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
      if (entry.name === 'tokens.css' || entry.name === 'tokens.ts') continue;
      scanFileContent(full);
    }
  }
}

walkDir(path.join(root, 'src'));

// Écriture du rapport inventaire
let md = `# Audit & Inventaire Exhaustif — LKDV Full Liquid Glass iOS 27\n\n`;
md += `Généré automatiquement par Cartographe le ${new Date().toISOString()}.\n\n`;

md += `## 1. Routes de l'application (${allRoutes.length} routes répertoriées)\n\n`;
md += `| N° | Route | Fichier Source | Typologie | Auth requise | Identifiant démo / Fixture |\n`;
md += `|:---|:------|:---------------|:----------|:-------------|:---------------------------|\n`;

allRoutes.forEach((r, idx) => {
  let sample = 'N/A';
  if (r.routePath.includes('[slug]')) {
    if (r.routePath.includes('pays')) sample = 'fr, is, jp';
    else if (r.routePath.includes('kits')) sample = 'islande-trek, gr20-corse';
    else if (r.routePath.includes('guides')) sample = 'checklist-sac-a-dos-trek-nepal';
    else if (r.routePath.includes('produit')) sample = 'sac-a-dos-de-randonnee-categorie-bigbuy';
    else if (r.routePath.includes('lieux')) sample = 'refuge-du-gouter-mont-blanc';
    else if (r.routePath.includes('voyages')) sample = 'y-long-group, y-day-solo';
    else sample = 'demo-slug';
  } else if (r.routePath.includes('[id]')) {
    if (r.routePath.includes('carnets')) sample = 'f21439a3-4daf-42ed-a778-1fa3fffa8f61';
    else if (r.routePath.includes('clubs')) sample = 'b2000012-0000-0000-0000-000000000005';
    else if (r.routePath.includes('profil')) sample = '622c9c69-2b19-425c-be5f-d47d470461d8';
    else sample = 'sample-id-1';
  } else if (r.routePath.includes('[token]')) {
    sample = 'demo-token';
  } else if (r.routePath.includes('[userId]')) {
    sample = '622c9c69-2b19-425c-be5f-d47d470461d8';
  }

  const isAuth = r.routePath.startsWith('/compte') || r.routePath.startsWith('/admin') || r.routePath.startsWith('/messagerie');
  md += `| ${idx + 1} | \`${r.routePath}\` | \`${r.relFile}\` | ${r.routePath.includes('[') ? 'Dynamique' : 'Statique'} | ${isAuth ? 'Oui' : 'Non'} | ${sample} |\n`;
});

md += `\n## 2. Composants & Primitives Détectés (${componentFiles.length} fichiers)\n\n`;
md += `Principaux conteneurs et shells recensés :\n`;
md += `- \`src/components/mobile-nav/MobilePageShell.tsx\` (Shell mobile standard)\n`;
md += `- \`src/components/mobile-nav/BottomTabBar.tsx\` (Tab bar mobile principale)\n`;
md += `- \`src/components/Header.tsx\` & \`src/components/shell/AppShell.tsx\`\n`;
md += `- \`src/components/glass/MarbleZone.tsx\` (Zone Liquid Glass)\n`;
md += `- \`src/components/ui/*\` (Button, Card, Badge, Modal, Input, etc.)\n\n`;

md += `## 3. Relevé des Valeurs en Dur & Accents de Couleur à Supprimer (${rawValues.length} occurrences détectées)\n\n`;
md += `Synthèse par typologie :\n`;
const byType = {};
rawValues.forEach((v) => {
  byType[v.type] = (byType[v.type] || 0) + 1;
});
Object.entries(byType).forEach(([t, count]) => {
  md += `- **${t}** : ${count} occurrences\n`;
});

md += `\n### Échantillon représentatif des anomalies à convertir en Full Glass :\n\n`;
md += `| Fichier | Ligne | Type | Valeur trouvée | Couleur d'accent à supprimer |\n`;
md += `|:--------|:------|:-----|:---------------|:----------------------------|\n`;
rawValues.slice(0, 100).forEach((v) => {
  md += `| \`${v.file}\` | ${v.line} | ${v.type} | \`${v.val}\` | ${v.accentToDelete} |\n`;
});

if (rawValues.length > 100) {
  md += `| ... | ... | ... | *(+ ${rawValues.length - 100} autres occurrences inventoriées dans le script)* | ... |\n`;
}

fs.writeFileSync(path.join(root, 'audit', '00-inventaire.md'), md, 'utf8');
console.log(`✓ audit/00-inventaire.md généré avec succès (${allRoutes.length} routes, ${rawValues.length} anomalies inventoriées).`);
