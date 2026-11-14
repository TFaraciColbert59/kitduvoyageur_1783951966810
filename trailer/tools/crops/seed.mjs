#!/usr/bin/env node
// Graine de film/crops.json (cadres 9:16 provisoires, tirés du cadre décrit dans chaque prompt de PROMPTS-CHATGPT.md).
// Une fois écrit, crops.json est la source : on l'ajuste à la main à la réception des images.
//   node tools/crops/seed.mjs [--force]
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTrame } from './trame.mjs';
import { RATIO_9x16 } from './validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../film/crops.json');
const r2 = (v) => Math.round(v * 100) / 100;

// Cadre 9:16 de hauteur h (% de la hauteur source), centré en (cx, cy) %, ramené dans l'image.
export function band(cx = 50, h = 100, cy = 50) {
  const w = h * RATIO_9x16;
  const x = Math.min(100 - w, Math.max(0, cx - w / 2));
  const y = Math.min(100 - h, Math.max(0, cy - h / 2));
  return { x: r2(x), y: r2(y), w: r2(w), h: r2(h) };
}

// [id, type, début [cx,h,cy], fin [cx,h,cy] | null, point d'intérêt [x,y], note]
const S = [
  ['p01', 'espace', [68, 100], [62, 100], [74, 30], 'Limbe et lever du soleil (tiers droit) ; glissé vers la gauche avec la poussée.'],
  ['p02', 'espace', [50, 100], [50, 82, 52], [50, 55], 'Dolomites au centre exact ; la poussée devient un resserrement.'],
  ['p03', 'espace', [50, 100], [50, 86], [50, 60], 'Point de fuite du flou radial au centre.'],
  ['p04', 'espace', [50, 100], [50, 78], [50, 50], 'Trouée au centre : le resserrement prolonge la traversée.'],
  ['p05', 'espace', [50, 100], [50, 70], [50, 50], 'Fenêtre éclairée au centre exact : on fonce dessus.'],
  ['p06', 'personnage', [46, 100], [54, 100], [50, 34], 'Léa au tiers central, tête aux genoux ; le travelling latéral devient un glissé.'],
  ['p07', 'telephone', [50, 78], [50, 68], [50, 50], 'Téléphone au centre (40 % de la hauteur) : cadre serré, écran entier.'],
  ['p08', 'personnage', [50, 100], [50, 86], [50, 48], 'Œil au centre ; reflet dans la pupille.'],
  ['p09', 'telephone', [50, 72], [50, 42, 46], [50, 46], 'Poussée violente dans l\'écran : le cadre finit sur l\'écran seul.'],
  ['p10', 'paysage', [50, 100], [50, 90, 52], [50, 40], 'Pic en aiguille au centre exact, eau au premier plan.'],
  ['p11', 'personnage', [48, 100], [56, 100], [50, 35], 'Léa au centre, part vers la droite : le cadre la suit.'],
  ['p12', 'telephone', [47, 100], [53, 100], [50, 55], 'Téléphone au centre (35 %), visage flou au-dessus : les deux dans la bande ; glissé latéral.'],
  ['p13', 'telephone', [50, 82, 52], [50, 74, 52], [50, 52], 'Par-dessus l\'épaule : téléphone au centre, épaule floue en bord.'],
  ['p14', 'special', null, null, [50, 30], 'Trois bandes verticales (img11) : voir « bandes ».'],
  ['p15', 'telephone', [50, 80, 52], [50, 64, 52], [50, 52], 'Poussée sur l\'itinéraire 3D.'],
  ['p16', 'telephone', [50, 100], [50, 90, 54], [50, 60], 'Plongée : Léa au tiers central, téléphone à plat devant elle (position à vérifier).'],
  ['p17', 'telephone', [50, 100], [50, 88, 58], [50, 70], 'Écran dans la moitié basse, pouce au centre.'],
  ['p18', 'objet', [50, 100], [50, 92, 54], [50, 55], 'Sac au centre exact, Léa derrière et au-dessus.'],
  ['p19', 'objet', [50, 100], [50, 86, 55], [50, 55], 'Flat lay : sac au centre, mains par le bas.'],
  ['p20', 'objet', [50, 90], [50, 74], [50, 50], 'Boucle au centre.'],
  ['p21', 'personnage', [50, 100], [50, 92], [50, 50], 'Spirale centrée, Léa au tiers central (la rotation du 16:9 se garde).'],
  ['p22', 'personnage', [54, 100], [46, 100], [50, 45], 'Reflet de Léa au tiers central ; le paysage défile, le cadre glisse avec lui.'],
  ['p23', 'groupe', [48, 100], [50, 100], [46, 50], 'Quatre personnages en pied : la bande ne tient que Léa et Sami (le prêt) ; risque de couper Inès et Tom.'],
  ['p24', 'objet', [50, 100], [50, 90, 56], [50, 62], 'Chaussures au tiers central, ras du sol.'],
  ['p25', 'telephone', [50, 90], [50, 80], [50, 50], 'Téléphone sur la bretelle, presque de face.'],
  ['p26', 'star', [56, 100], [46, 100], [50, 50], '★ Seceda : la crête en diagonale ; le glissé passe des aiguilles aux quatre points (tiers central).'],
  ['p27', 'star', [44, 100], [50, 92, 54], [50, 55], '★ Tre Cime : tours au fond, groupe au tiers central ; le cadre descend vers eux.'],
  ['p28', 'personnage', [50, 100], [50, 92], [50, 50], 'Mains jointes au centre, contre-plongée.'],
  ['p29', 'telephone', [50, 100], [50, 90], [50, 50], 'Téléphone net au tiers central, Tre Cime floues derrière.'],
  ['p30', 'star', [50, 100], [50, 96, 52], [50, 58], '★ Sorapis : pic en aiguille en haut au centre, Léa sur le rocher au tiers central.'],
  ['p31', 'telephone', [50, 100], [50, 88, 48], [50, 45], 'Téléphone à hauteur des yeux devant le lac : même composition que P10.'],
  ['p32', 'personnage', [44, 100], [40, 100], [42, 55], 'Malik flou au premier plan, à gauche du centre ; le cadre part avec lui (sens à vérifier).'],
  ['p33', 'personnage', [50, 100], [50, 96], [50, 50], 'Malik au tiers central, filé.'],
  ['p34', 'objet', [50, 100], [50, 84, 56], [50, 60], 'Impact de la chaussure au centre.'],
  ['p35', 'personnage', [50, 100], [50, 92, 54], [50, 62], 'Malik au tiers central bas, lacets en contrebas.'],
  ['p36', 'telephone', [50, 86], [50, 76], [50, 50], 'Brassard et téléphone au centre.'],
  ['p37', 'personnage', [50, 100], [50, 94], [50, 45], 'Malik à l\'apex, au centre.'],
  ['p38', 'star', [50, 88, 60], [50, 100], [50, 70], '★ Tofana : la paroi occupe les trois quarts ; Malik au tiers central bas ; le recul découvre la paroi.'],
  ['p39', 'groupe', [47, 100], [55, 100], [50, 55], 'Malik et Clara au tiers central ; le cadre suit Clara qui le dépasse (sens à vérifier).'],
  ['p40', 'star', [46, 100], [54, 100], [50, 55], '★ Clara au tiers central sur la piste, sommets au fond ; glissé latéral.'],
  ['p41', 'objet', [50, 100], [50, 90], [50, 55], 'Roue au centre.'],
  ['p42', 'star', [50, 100], [50, 94], [50, 50], '★ Épingle en S, Clara au centre exact (plongée verticale) ; la rotation du 16:9 se garde.'],
  ['p43', 'star', [50, 90, 56], [50, 100], [50, 58], '★ Passo Giau : Clara dans un lacet au tiers central, Ra Gusela au-dessus ; l\'élévation ouvre le cadre.'],
  ['p44', 'personnage', [50, 100], [50, 94, 48], [50, 40], 'Clara au centre, bras levés, soleil derrière la tête.'],
  ['p45', 'groupe', [42, 100], [52, 100], [52, 55], 'Clara passe de gauche à droite au premier plan ; le cadre reste avec le groupe.'],
  ['p46', 'special', [50, 100], [50, 96, 52], [50, 70], 'Timelapse img35a -> img35b : même cadre pour les deux images (tentes au tiers central bas, ciel au-dessus).'],
  ['p47', 'groupe', [50, 100], [50, 94], [50, 45], 'Quatre visages au tiers central : risque de couper les deux du bord.'],
  ['p48', 'telephone', [50, 100], [50, 90], [50, 50], 'Téléphone au centre, Léa de trois-quarts.'],
  ['p49', 'telephone', [50, 56, 52], [50, 50, 52], [50, 52], 'Très gros plan (recadrage de img37) : l\'écran seul.'],
  ['p50', 'star', [50, 92, 58], [50, 100], [50, 72], '★ Bivouac au tiers central bas, Tre Cime et Voie lactée au-dessus ; recul et élévation.'],
  ['p51', 'telephone', [50, 100], [50, 92], [50, 50], 'Téléphone et visage de Noah au tiers central.'],
  ['p52', 'espace', [50, 100], [50, 100], [50, 50], 'Remontée img05 -> img04 -> img03 : centres de fuite au centre ; même cadre pour les trois.'],
  ['p53', 'code', [50, 100], [50, 100], [50, 45], 'Terre de nuit + tracés : les tracés se recalculent en 1080×1920 (cosmos-vfx), la Terre se recadre.'],
  ['p54', 'code', [50, 100], [50, 100], [50, 50], 'Logo codé : composé nativement en 1080×1920, ce cadre ne sert que de repère.'],
];

// P14 : trois bandes horizontales empilées en 9:16 (1080×640 chacune), taillées dans les trois bandes verticales.
// Une bande verticale fait 1/3 de la largeur ; une tranche 1080×640 y découpe 35,16 % de la hauteur.
const STRIPE_H = r2(((100 / 3) * 640) / 1080 / (9 / 16)); // en % de la hauteur source
const stripe = (i, cy) => ({ x: r2((i * 100) / 3), y: r2(cy - STRIPE_H / 2), w: r2(100 / 3), h: STRIPE_H });

export function seed() {
  const trame = readTrame();
  const shots = trame.map((t) => {
    const s = S.find((e) => e[0] === t.id);
    const [id, type, a, b, poi, note] = s;
    const entry = {
      id, frames: [t.startFrame, t.endFrame], sources: t.sources, type,
      start: a ? band(...a) : null, end: b ? band(...b) : null,
      poi: { x: poi[0], y: poi[1] }, note, status: 'provisoire, à ajuster à la réception de l\'image',
    };
    if (type === 'star') entry.fallback = 'pleine-largeur';
    if (id === 'p14') {
      entry.layout = 'trois-bandes-empilees';
      entry.bands = [
        { who: 'Sami', start: stripe(0, 32), end: stripe(0, 30) },
        { who: 'Inès', start: stripe(1, 32), end: stripe(1, 30) },
        { who: 'Tom', start: stripe(2, 32), end: stripe(2, 30) },
      ];
    }
    if (id === 'p46') entry.layout = 'timelapse-meme-cadre';
    if (id === 'p54') entry.layout = 'natif-vertical';
    return entry;
  });
  return {
    $comment: 'Cadres 9:16 du trailer (déclinaison 1080×1920). Rectangles en % de l\'image source posée en 16:9 (cover 1920×1080, comme dans le film 16:9) : x, y = coin haut gauche, w, h = taille. Rapport w/h = 81/256 (9:16 dans du 16:9). start = cadre à la première image du plan, end = cadre à la dernière (null = fixe). poi = point d\'intérêt (sujet, téléphone, personnage minuscule). Tous provisoires : à ajuster à la réception des images (tools/crops/preview.mjs).',
    version: 1,
    sourceAspect: '16:9',
    targetAspect: '9:16',
    target: { width: 1080, height: 1920 },
    starFallback: 'pleine-largeur = image entière calée en largeur (1080×608) au tiers haut, sur un fond prolongé de la même image (agrandie, floutée par media-treatment) ; réservé au cas où sommet et personnage ne tiennent pas dans la bande',
    shots,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (existsSync(OUT) && !process.argv.includes('--force')) { console.error(`${OUT} existe : --force pour l'écraser`); process.exit(1); }
  writeFileSync(OUT, JSON.stringify(seed(), null, 2) + '\n');
  console.log(`écrit ${OUT}`);
}
