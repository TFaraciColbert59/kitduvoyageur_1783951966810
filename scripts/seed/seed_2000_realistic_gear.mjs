import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const envPath = path.join(ROOT, '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STORAGE = 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images';

const IMG = {
  sac: `${STORAGE}/sac-a-dos-de-randonnee-categorie-bigbuy/01.jpg`,
  tente: `${STORAGE}/tente-de-camping-2-personnes-categorie-bigbuy/01.jpg`,
  abri: `${STORAGE}/tente-abri-bache-de-survie-categorie-bigbuy/01.jpg`,
  duvet: `${STORAGE}/sac-de-couchage-enfant-tineo-summer-tifruits-6-mois-coton/01.jpg`,
  matelas: `${STORAGE}/lit-gonflable-intex-beam-deluxe-ultra-plush-152x46x236-cm/01.jpg`,
  thermos: `${STORAGE}/tasse-thermos-avec-couvercle-fc-barcelona-acier-inoxydable/01.jpg`,
  vaisselle: `${STORAGE}/vaisselle-exterieure-pique-nique-categorie-bigbuy/01.jpg`,
  couteau: `${STORAGE}/genouillereprotection-couteau-workpro-outdoor/01.jpg`,
  chauffe: `${STORAGE}/chauffe-mains-chauffe-pieds-categorie-bigbuy/01.jpg`,
  chaise: `${STORAGE}/mobilier-de-camping-chaise-pliante-categorie-bigbuy/01.jpg`,
  semelles: `${STORAGE}/semelles-confort-orthopediques-categorie-bigbuy/01.jpg`,
  hygiene: `${STORAGE}/gel-hydroalcoolique-desinfectant-categorie-bigbuy/01.jpg`,
  creme: `${STORAGE}/creme-hydratante-soin-peau-apres-soleil-categorie-bigbuy/01.jpg`,
};

// Catalogue ultra-réaliste classé par archétype de pratique
const GEAR_BY_PERSONA = {
  alpinisme: [
    { name: 'Sac à dos Osprey Mutant 38', brand: 'Osprey', category: 'Sacs & Portage', weight_g: 1240, price_cents: 19500, volume_ml: 38000, dims_mm: '680x300x260', tags: ['alpinisme', 'glacier', 'porte-piolet'], photo: IMG.sac },
    { name: 'Piolet Petzl Summit Evo 59 cm', brand: 'Petzl', category: 'Progression', weight_g: 420, price_cents: 16500, dims_mm: '590x230x30', tags: ['alpinisme', 'neige', 'glacier'], photo: IMG.couteau },
    { name: 'Crampons Petzl Vasak Leverlock Universel', brand: 'Petzl', category: 'Progression', weight_g: 840, price_cents: 16000, dims_mm: '280x120x90', tags: ['alpinisme', 'crampons', '12-pointes'], photo: IMG.couteau },
    { name: 'Casque Petzl Sirocco M/L', brand: 'Petzl', category: 'Sécurité', weight_g: 170, price_cents: 11500, dims_mm: '260x210x160', tags: ['alpinisme', 'escalade', 'ultralight'], photo: IMG.abri },
    { name: 'Baudrier Petzl Altitude', brand: 'Petzl', category: 'Sécurité', weight_g: 150, price_cents: 8500, dims_mm: '200x140x40', tags: ['alpinisme', 'ski-rando', 'glacier'], photo: IMG.sac },
    { name: 'Corde à double Beal Opera 8.5 mm 50 m', brand: 'Beal', category: 'Sécurité', weight_g: 2400, price_cents: 21000, tags: ['corde', 'alpinisme', 'golden-dry'], photo: IMG.sac },
    { name: 'Veste Arc’teryx Alpha SV Gore-Tex Pro', brand: 'Arc’teryx', category: 'Vêtements & Vestes', weight_g: 485, price_cents: 75000, tags: ['hardshell', 'gore-tex', 'haute-montagne'], photo: IMG.abri },
    { name: 'Doudoune Millet Trilogy Diamond Down', brand: 'Millet', category: 'Protection froid', weight_g: 430, price_cents: 38000, tags: ['duvet-850', 'alpinisme', 'froid'], photo: IMG.duvet },
    { name: 'Chaussures La Sportiva Nepal Cube GTX', brand: 'La Sportiva', category: 'Confort des pieds', weight_g: 1780, price_cents: 49000, tags: ['cramponnable', 'haute-montagne', 'gore-tex'], photo: IMG.semelles },
    { name: 'DVA Mammut Barryvox S', brand: 'Mammut', category: 'Sécurité / Urgence', weight_g: 210, price_cents: 39000, dims_mm: '115x67x27', tags: ['avalanche', 'hiver', 'secours'], photo: IMG.chauffe },
    { name: 'Frontale Petzl Swift RL 1100 lm', brand: 'Petzl', category: 'Lampes & Éclairage', weight_g: 100, price_cents: 11500, tags: ['frontale', 'reactive-lighting', 'usb-c'], photo: IMG.chauffe },
    { name: 'Réchaud MSR Reactor 1.7L', brand: 'MSR', category: 'Cuisine & Réchauds', weight_g: 496, price_cents: 23000, volume_ml: 1700, tags: ['neige', 'vent', 'haute-altitude'], photo: IMG.vaisselle },
  ],
  ultra_trail: [
    { name: 'Gilet Salomon Adv Skin 12 Set', brand: 'Salomon', category: 'Sacs & Portage', weight_g: 293, price_cents: 16000, volume_ml: 12000, tags: ['ultra-trail', 'utmb', 'hydratation'], photo: IMG.sac },
    { name: 'Chaussures Hoka Mafate Speed 4', brand: 'Hoka', category: 'Confort des pieds', weight_g: 590, price_cents: 18000, tags: ['trail', 'vibram', 'longue-distance'], photo: IMG.semelles },
    { name: 'Bâtons Leki Ultratrail FX.One Superlite', brand: 'Leki', category: 'Progression', weight_g: 274, price_cents: 19500, dims_mm: '1200x20x20', tags: ['carbone', 'pliable', 'trail'], photo: IMG.couteau },
    { name: 'Veste Salomon S/Lab MotionFit 360', brand: 'Salomon', category: 'Vêtements & Protection', weight_g: 168, price_cents: 29000, tags: ['20000mm', 'utmb', 'impermeable'], photo: IMG.abri },
    { name: 'Montre Coros Apex 2 Pro', brand: 'Coros', category: 'Navigation & GPS', weight_g: 66, price_cents: 44900, tags: ['gps', 'carto', 'autonomie-75h'], photo: IMG.chauffe },
    { name: 'Flasques souples Hydrapak UltraFlask 500 ml (paire)', brand: 'Hydrapak', category: 'Hydratation', weight_g: 74, price_cents: 3800, volume_ml: 1000, tags: ['softflask', 'trail', 'sans-bpa'], photo: IMG.thermos },
    { name: 'Frontale Ledlenser NEO9R 1200 lm', brand: 'Ledlenser', category: 'Lampes & Éclairage', weight_g: 199, price_cents: 11900, tags: ['nuit', 'trail', 'batterie'], photo: IMG.chauffe },
    { name: 'Sacs de couchage Sea to Summit Spark SpI', brand: 'Sea to Summit', category: 'Bivouac / Sommeil', weight_g: 350, price_cents: 34000, tags: ['ultralight', 'duvet-850', 'fastpacking'], photo: IMG.duvet },
    { name: 'Matelas Therm-a-Rest NeoAir UberLite Regular', brand: 'Therm-a-Rest', category: 'Bivouac / Sommeil', weight_g: 250, price_cents: 22500, dims_mm: '1830x510x64', tags: ['ultralight', 'r-value-2.3', 'fastpacking'], photo: IMG.matelas },
    { name: 'Tente Big Agnes Tiger Wall UL2 Carbon', brand: 'Big Agnes', category: 'Couchage & Tentes', weight_g: 765, price_cents: 69000, dims_mm: '2180x1320x990', tags: ['dyneema', 'ultralight', '2-places'], photo: IMG.tente },
  ],
  bikepacking: [
    { name: 'Sacoche de selle Apidura Expedition 14L', brand: 'Apidura', category: 'Sacs & Portage', weight_g: 350, price_cents: 16400, volume_ml: 14000, tags: ['bikepacking', 'etanche', 'gravel'], photo: IMG.sac },
    { name: 'Sacoche de cadre Ortlieb Frame-Pack RC 6L', brand: 'Ortlieb', category: 'Sacs & Portage', weight_g: 250, price_cents: 12500, volume_ml: 6000, tags: ['ip64', 'gravel', 'cyclotourisme'], photo: IMG.sac },
    { name: 'Sacoche de guidon Tailfin Bar Bag 9L', brand: 'Tailfin', category: 'Sacs & Portage', weight_g: 410, price_cents: 19000, volume_ml: 9000, tags: ['bikepacking', 'stable', 'etanche'], photo: IMG.sac },
    { name: 'Compteur GPS Garmin Edge 840 Solar', brand: 'Garmin', category: 'Navigation & GPS', weight_g: 89, price_cents: 54900, tags: ['solaire', 'gpx', 'gravel'], photo: IMG.chauffe },
    { name: 'Multi-outil Topeak Mini 20 Pro', brand: 'Topeak', category: 'Outils', weight_g: 151, price_cents: 3600, tags: ['derive-chaine', 'reparation', 'velo'], photo: IMG.couteau },
    { name: 'Pompe Lezyne Micro Floor Drive HV', brand: 'Lezyne', category: 'Réparation', weight_g: 150, price_cents: 5800, tags: ['manometre', 'gravel', 'pneu'], photo: IMG.couteau },
    { name: 'Tente MSR Hubba Hubba Bikepack 2', brand: 'MSR', category: 'Bivouac / Sommeil', weight_g: 1400, price_cents: 56000, dims_mm: '2130x1270x1070', tags: ['arceaux-courts', 'guidon', '2-places'], photo: IMG.tente },
    { name: 'Éclairage Lupine SL Nano AF', brand: 'Lupine', category: 'Éclairage', weight_g: 52, price_cents: 26000, tags: ['stvzo', 'nuit', 'velo'], photo: IMG.chauffe },
  ],
  nautique: [
    { name: 'Sac étanche Ortlieb Duffle RG 60L', brand: 'Ortlieb', category: 'Transport', weight_g: 1450, price_cents: 29500, volume_ml: 60000, tags: ['ip67', 'nautique', 'kayak'], photo: IMG.sac },
    { name: 'Vareuse Musto MPX Gore-Tex Pro Offshore', brand: 'Musto', category: 'Vêtements & Vestes', weight_g: 980, price_cents: 65000, tags: ['voile', 'gore-tex', 'embruns'], photo: IMG.abri },
    { name: 'Gilet d’aide à la flottabilité Palm Peyto', brand: 'Palm', category: 'Sécurité', weight_g: 790, price_cents: 15500, tags: ['kayak-mer', '50n', 'poches'], photo: IMG.sac },
    { name: 'Sac étanche Sea to Summit Big River 20L', brand: 'Sea to Summit', category: 'Organisation du sac', weight_g: 185, price_cents: 4200, volume_ml: 20000, tags: ['tpu', 'etanche', 'cotier'], photo: IMG.sac },
    { name: 'VHF portable Icom IC-M37E flottante', brand: 'Icom', category: 'Énergie / Électronique', weight_g: 293, price_cents: 23500, tags: ['vhf', 'mer', 'ip57'], photo: IMG.chauffe },
    { name: 'Bâche tarp Hilleberg Tarp 10 UL', brand: 'Hilleberg', category: 'Bivouac / Sommeil', weight_g: 750, price_cents: 24500, dims_mm: '3000x3500', tags: ['vent-fort', 'bivouac-cotier', 'kerlon'], photo: IMG.abri },
    { name: 'Couteau Wichard Offshore lame crantée', brand: 'Wichard', category: 'Outils', weight_g: 85, price_cents: 5900, tags: ['inox-316l', 'demanilleur', 'mer'], photo: IMG.couteau },
  ],
  photo_drone: [
    { name: 'Boîtier Sony Alpha 7C II + 20-70mm f/4', brand: 'Sony', category: 'Photo', weight_g: 998, price_cents: 289000, tags: ['plein-format', 'paysage', 'bivouac'], photo: IMG.chauffe },
    { name: 'Drone DJI Mini 4 Pro Fly More', brand: 'DJI', category: 'Photo', weight_g: 249, price_cents: 99900, tags: ['4k-60fps', 'compact', 'montagne'], photo: IMG.chauffe },
    { name: 'Trépied Peak Design Travel Tripod Carbone', brand: 'Peak Design', category: 'Photo', weight_g: 1270, price_cents: 64900, dims_mm: '391x79x79', tags: ['carbone', 'astro', 'compact'], photo: IMG.couteau },
    { name: 'Insert photo Shimoda Core Unit Medium DSLR V2', brand: 'Shimoda', category: 'Organisation du sac', weight_g: 480, price_cents: 9500, tags: ['protection', 'boitier', 'randonnee'], photo: IMG.sac },
    { name: 'Batterie externe Anker Prime 27650 mAh 250W', brand: 'Anker', category: 'Énergie / Électronique', weight_g: 667, price_cents: 17900, dims_mm: '162x57x50', tags: ['usb-c', 'drone', 'pd-140w'], photo: IMG.chauffe },
    { name: 'Panneau solaire BigBlue 28W pliable', brand: 'BigBlue', category: 'Énergie / Électronique', weight_g: 580, price_cents: 7900, tags: ['solaire', 'autonomie', 'usb'], photo: IMG.abri },
    { name: 'Jumelles Swarovski CL Pocket 8x25', brand: 'Swarovski', category: 'Observation', weight_g: 345, price_cents: 84000, tags: ['faune', 'ornitho', 'optique'], photo: IMG.chauffe },
  ],
  famille: [
    { name: 'Porte-bébé Deuter Kid Comfort Pro', brand: 'Deuter', category: 'Randonnée Famille', weight_g: 3550, price_cents: 36000, volume_ml: 12000, tags: ['famille', 'pare-soleil', 'confort'], photo: IMG.sac },
    { name: 'Tente MSR Elixir 3 personnes', brand: 'MSR', category: 'Bivouac / Sommeil', weight_g: 3190, price_cents: 38000, dims_mm: '2130x1720x1040', tags: ['famille', '3-places', 'double-entree'], photo: IMG.tente },
    { name: 'Sac à dos enfant Osprey Jet 18', brand: 'Osprey', category: 'Randonnée Famille', weight_g: 560, price_cents: 6500, volume_ml: 18000, tags: ['enfant', 'leger', 'dos-ventile'], photo: IMG.sac },
    { name: 'Trousse de secours Care Plus Family Pro', brand: 'Care Plus', category: 'Sécurité & Soins', weight_g: 490, price_cents: 4500, tags: ['premiers-secours', 'ampoules', 'famille'], photo: IMG.hygiene },
    { name: 'Popote Sea to Summit Alpha Set 2.2', brand: 'Sea to Summit', category: 'Alimentation / Cuisine', weight_g: 765, price_cents: 11000, tags: ['anodise', 'famille', 'compact'], photo: IMG.vaisselle },
    { name: 'Chaise pliante Helinox Chair Zero Highback', brand: 'Helinox', category: 'Confort', weight_g: 690, price_cents: 15500, tags: ['bivouac', 'confort', 'ultralight'], photo: IMG.chaise },
  ],
  trek_general: [
    { name: 'Sac à dos Osprey Atmos AG 65', brand: 'Osprey', category: 'Sacs & Portage', weight_g: 2090, price_cents: 31000, volume_ml: 65000, tags: ['gr20', 'tmb', 'dos-filet'], photo: IMG.sac },
    { name: 'Sac à dos Deuter Aircontact Core 50+10', brand: 'Deuter', category: 'Sacs & Portage', weight_g: 2150, price_cents: 26500, volume_ml: 60000, tags: ['trekking', 'robuste', 'confort'], photo: IMG.sac },
    { name: 'Tente MSR Hubba Hubba NX 2', brand: 'MSR', category: 'Bivouac / Sommeil', weight_g: 1720, price_cents: 52000, dims_mm: '2130x1270x1000', tags: ['autoportante', '2-places', '3-saisons'], photo: IMG.tente },
    { name: 'Tente Decathlon MT900 2 places Forclaz', brand: 'Forclaz', category: 'Bivouac / Sommeil', weight_g: 1950, price_cents: 22000, dims_mm: '2100x1200x1050', tags: ['trekking', 'autoportante', 'bon-rapport'], photo: IMG.tente },
    { name: 'Sac de couchage Cumulus Panyam 600', brand: 'Cumulus', category: 'Bivouac / Sommeil', weight_g: 970, price_cents: 38900, tags: ['duvet-850', '-6C', 'bivouac'], photo: IMG.duvet },
    { name: 'Matelas Therm-a-Rest NeoAir XLite NXT', brand: 'Therm-a-Rest', category: 'Bivouac / Sommeil', weight_g: 370, price_cents: 23500, dims_mm: '1830x510x76', tags: ['r-value-4.5', 'silencieux', '4-saisons'], photo: IMG.matelas },
    { name: 'Réchaud Jetboil Flash', brand: 'Jetboil', category: 'Cuisine & Réchauds', weight_g: 371, price_cents: 13500, volume_ml: 1000, tags: ['rapide', 'gaz', '100s'], photo: IMG.vaisselle },
    { name: 'Réchaud MSR PocketRocket Deluxe', brand: 'MSR', category: 'Cuisine & Réchauds', weight_g: 83, price_cents: 8500, tags: ['regulateur', 'piezo', 'ultralight'], photo: IMG.vaisselle },
    { name: 'Filtre à eau Katadyn BeFree 1.0L', brand: 'Katadyn', category: 'Eau & Filtres', weight_g: 63, price_cents: 4900, volume_ml: 1000, tags: ['filtration', '0.1-micron', 'leger'], photo: IMG.thermos },
    { name: 'Filtre à eau Sawyer Squeeze', brand: 'Sawyer', category: 'Eau & Filtres', weight_g: 85, price_cents: 4800, tags: ['potabilisation', 'trek', 'durable'], photo: IMG.thermos },
    { name: 'Gourde Nalgene Wide Mouth 1L Tritan', brand: 'Nalgene', category: 'Hydratation', weight_g: 177, price_cents: 1600, volume_ml: 1000, tags: ['indestructible', 'sans-bpa', 'graduation'], photo: IMG.thermos },
    { name: 'Bouteille isotherme Hydro Flask 621 ml', brand: 'Hydro Flask', category: 'Hydratation', weight_g: 340, price_cents: 3900, volume_ml: 621, tags: ['inox', 'isotherme', '24h'], photo: IMG.thermos },
    { name: 'Bâtons Black Diamond Trail Pro Shock', brand: 'Black Diamond', category: 'Progression', weight_g: 590, price_cents: 14900, tags: ['amortisseur', 'aluminium', 'flicklock'], photo: IMG.couteau },
    { name: 'Couteau Opinel N°8 Outdoor', brand: 'Opinel', category: 'Outils', weight_g: 63, price_cents: 2900, tags: ['sifflet', 'inox', 'manilleur'], photo: IMG.couteau },
    { name: 'Pinces Leatherman Signal', brand: 'Leatherman', category: 'Outils', weight_g: 212, price_cents: 16900, tags: ['allume-feu', 'sifflet', 'multitool'], photo: IMG.couteau },
    { name: 'Balise Garmin inReach Mini 2', brand: 'Garmin', category: 'Sécurité / Urgence', weight_g: 100, price_cents: 39900, dims_mm: '99x52x26', tags: ['sos-satellite', 'iridium', 'tracking'], photo: IMG.chauffe },
    { name: 'Boussole Silva Expedition S', brand: 'Silva', category: 'Navigation / Orientation', weight_g: 86, price_cents: 6500, tags: ['miroir', 'clinometre', 'carte'], photo: IMG.chauffe },
    { name: 'Doudoune Patagonia Down Sweater Hoody', brand: 'Patagonia', category: 'Protection froid', weight_g: 420, price_cents: 32000, tags: ['duvet-800', 'compressible', 'recycle'], photo: IMG.duvet },
    { name: 'Veste Patagonia Torrentshell 3L', brand: 'Patagonia', category: 'Vêtements & Vestes', weight_g: 400, price_cents: 20000, tags: ['h2no', '3-couches', 'pluie'], photo: IMG.abri },
    { name: 'Crème solaire minérale EQ Love SPF50+', brand: 'EQ', category: 'Protection / Hygiène', weight_g: 110, price_cents: 1900, tags: ['montagne', 'reef-safe', 'stick'], photo: IMG.creme },
    { name: 'Serviette microfibre Sea to Summit Pocket L', brand: 'Sea to Summit', category: 'Hygiène', weight_g: 110, price_cents: 2400, tags: ['sechage-rapide', 'compact'], photo: IMG.hygiene },
  ],
};

function detectPersona(user) {
  const txt = `${user.bio || ''} ${user.location || ''}`.toLowerCase();
  if (/alpin|haute montagne|glacier|escalade|via ferrata|refuge|loue du matériel|ski de randonnée|écrins/.test(txt)) {
    return 'alpinisme';
  }
  if (/ultra-trail|utmb|traileuse|au gramme|diagonale/.test(txt)) {
    return 'ultra_trail';
  }
  if (/bikepack|gravel|cyclotour|vélos|ultra-cycliste|motard/.test(txt)) {
    return 'bikepacking';
  }
  if (/skipper|kayak|plongée|navigue|mer/.test(txt)) {
    return 'nautique';
  }
  if (/photographe|drone|astrophysic|faune|flore/.test(txt)) {
    return 'photo_drone';
  }
  if (/enfant|maman|papa|jeune maman|fauteuil/.test(txt)) {
    return 'famille';
  }
  return 'trek_general';
}

function buildDescription(item, user, mode, condition) {
  const city = (user.location || 'France').split(',')[0].trim();
  const condNote =
    condition === 'neuf'
      ? 'État neuf, jamais servi sur le terrain, étiquette et housse d’origine.'
      : condition === 'bon'
        ? 'Très bon état, entretenu et nettoyé après chaque sortie.'
        : 'Usure visible liée aux sorties, mais 100 % fonctionnel.';
  const modeNote =
    mode === 'location'
      ? `Disponible à la location au départ de ${city} pour vos week-ends ou treks.`
      : mode === 'pret'
        ? `Je le prête volontiers aux membres LKDV autour de ${city} sur simple demande.`
        : mode === 'vente'
          ? `À vendre d’occasion suite à un renouvellement de matériel (${city}).`
          : `Fait partie de mon équipement personnel régulier au départ de ${city}.`;
  return `${item.brand} ${item.name} (${item.weight_g} g). ${condNote} ${modeNote}`;
}

function pickRandom(arr, i) {
  return arr[i % arr.length];
}

async function main() {
  const { data: users, error: uErr } = await sb
    .from('user_profiles')
    .select('id, full_name, location, bio, is_demo')
    .eq('is_demo', true)
    .order('full_name');
  if (uErr || !users?.length) throw new Error(`Demo users fetch failed: ${uErr?.message}`);

  const { data: shopProducts, error: sErr } = await sb
    .from('shop_products')
    .select('id, name, brand, category, weight_g, price_eur, image')
    .limit(100);
  if (sErr) throw new Error(`shop_products fetch failed: ${sErr.message}`);

  const validShop = (shopProducts || []).filter((p) => p.image && p.image.startsWith('http'));
  console.log(`Loaded ${users.length} demo users and ${validShop.length} shop_products with photos.`);

  const TARGET_COUNT = 2000;
  const ownershipRows = [];
  const listingCandidates = [];

  for (let i = 0; i < TARGET_COUNT; i++) {
    const user = users[i % users.length];
    const persona = detectPersona(user);
    const personaPool = GEAR_BY_PERSONA[persona];
    const generalPool = GEAR_BY_PERSONA.trek_general;

    // 45% persona-specific gear, 30% trek_general gear, 25% real shop_products (so marketplace matches kit items!)
    const roll = (i * 37 + user.full_name.length) % 20;
    let base;
    let productId = null;

    if (roll < 9) {
      base = pickRandom(personaPool, i + Math.floor(i / users.length));
    } else if (roll < 15) {
      base = pickRandom(generalPool, i + Math.floor(i / users.length));
    } else {
      const sp = pickRandom(validShop, i);
      productId = sp.id;
      base = {
        name: sp.name,
        brand: sp.brand || 'LKDV Outdoor',
        category: sp.category || 'Divers',
        weight_g: sp.weight_g || 250,
        price_cents: Math.max(500, Math.round((sp.price_eur || 29) * 100)),
        volume_ml: null,
        dims_mm: null,
        tags: ['catalogue-lkdv', persona],
        photo: sp.image,
      };
    }

    // Olivier Tissot (loueur à Chamonix) et quelques autres ont davantage de location/prêt
    const isLoueurPro = /loue du matériel/i.test(user.bio || '');
    const modeRoll = (i * 13 + persona.length) % 10;
    let listingMode = 'personnel';
    let status = 'en_stock';
    if (isLoueurPro) {
      listingMode = modeRoll < 6 ? 'location' : modeRoll < 8 ? 'vente' : 'pret';
    } else if (modeRoll === 0 || modeRoll === 1) {
      listingMode = 'vente';
    } else if (modeRoll === 2) {
      listingMode = 'location';
    } else if (modeRoll === 3) {
      listingMode = 'pret';
    }

    if (listingMode === 'location') status = 'a_louer';
    else if (listingMode === 'pret') status = 'a_preter';

    const conditionRoll = (i * 7) % 10;
    const condition =
      conditionRoll < 2 ? 'neuf' : conditionRoll < 8 ? 'bon' : 'use';

    // Slight realistic weight/price variation per personal item
    const priceFactor = listingMode === 'vente' ? (condition === 'neuf' ? 0.85 : 0.62) : 1;
    const priceCents = Math.max(500, Math.round(base.price_cents * priceFactor));
    const rentalPriceCents =
      listingMode === 'location'
        ? Math.max(300, Math.round((base.price_cents * 0.05) / 100) * 100)
        : null;
    const depositCents =
      listingMode === 'location' || listingMode === 'pret'
        ? Math.max(1000, Math.round(base.price_cents * 0.4))
        : null;

    const city = (user.location || 'France').split(',')[0].trim();
    const year = 2022 + (i % 5);
    const month = String(1 + (i % 12)).padStart(2, '0');
    const day = String(1 + (i % 28)).padStart(2, '0');

    const row = {
      user_id: user.id,
      name: base.name,
      brand: base.brand,
      category: base.category,
      weight_g: base.weight_g,
      price_cents: priceCents,
      purchase_date: `${year}-${month}-${day}`,
      condition,
      photo_url: base.photo,
      quantity: 1,
      product_id: productId,
      description: buildDescription(base, user, listingMode, condition),
      location: city,
      listing_mode: listingMode,
      status,
      rental_price_cents: rentalPriceCents,
      deposit_cents: depositCents,
      volume_ml: base.volume_ml ?? null,
      dims_mm: (() => {
        if (!base.dims_mm) return null;
        const arr = base.dims_mm.split('x').map(Number);
        return arr.length === 3 && arr.every((n) => Number.isFinite(n) && n > 0) ? arr : null;
      })(),
      tags: base.tags ?? [persona],
      is_lent: false,
    };

    ownershipRows.push(row);

    // Publier en marketplace_listings si vente/location/pret & condition neuf|bon
    if (
      ['vente', 'location', 'pret'].includes(listingMode) &&
      ['neuf', 'bon'].includes(condition)
    ) {
      listingCandidates.push({
        idx: i,
        mode: listingMode,
        price_cents:
          listingMode === 'pret'
            ? 0
            : listingMode === 'location'
              ? rentalPriceCents || 800
              : priceCents,
        deposit_cents: depositCents ?? 0,
      });
    }
  }

  console.log(`Inserting ${ownershipRows.length} product_ownership rows in batches of 200...`);
  const insertedOwnership = [];
  for (let start = 0; start < ownershipRows.length; start += 200) {
    const batch = ownershipRows.slice(start, start + 200);
    const { data, error } = await sb
      .from('product_ownership')
      .insert(batch)
      .select('id, user_id, name, brand, category, condition, photo_url, listing_mode, description, location');
    if (error) {
      throw new Error(`Insert product_ownership batch ${start} failed: ${error.message}`);
    }
    insertedOwnership.push(...data);
    process.stdout.write(`  inserted ${insertedOwnership.length}/${ownershipRows.length}\r`);
  }
  console.log(`\nInserted ${insertedOwnership.length} product_ownership rows.`);

  // Map back candidates to inserted IDs (take up to 500 marketplace listings so explorer & drawers stay snappy)
  const candidateMap = new Map(listingCandidates.map((c) => [c.idx, c]));
  const listingsToInsert = [];
  for (let i = 0; i < insertedOwnership.length; i++) {
    const cand = candidateMap.get(i);
    if (!cand) continue;
    const ow = insertedOwnership[i];
    listingsToInsert.push({
      item_id: ow.id,
      owner_id: ow.user_id,
      name: ow.name,
      brand: ow.brand,
      category: ow.category,
      condition: ow.condition,
      photo_url: ow.photo_url,
      mode: cand.mode,
      description: ow.description,
      public_location: ow.location || 'France',
      price_cents: cand.price_cents,
      deposit_cents: cand.deposit_cents,
      status: 'published',
    });
    if (listingsToInsert.length >= 500) break;
  }

  console.log(`Inserting ${listingsToInsert.length} marketplace_listings in batches of 100...`);
  let insertedListings = 0;
  for (let start = 0; start < listingsToInsert.length; start += 100) {
    const batch = listingsToInsert.slice(start, start + 100);
    const { error } = await sb.from('marketplace_listings').insert(batch);
    if (error) {
      throw new Error(`Insert marketplace_listings batch ${start} failed: ${error.message}`);
    }
    insertedListings += batch.length;
  }
  console.log(`Done! Total inserted: ${insertedOwnership.length} product_ownership + ${insertedListings} marketplace_listings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
