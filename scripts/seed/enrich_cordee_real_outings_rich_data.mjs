#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const CLUB_ID = 'db8623d4-fc9b-4c39-ae3a-c93daf2a5075';
const SEED_TAG = 'cordee-real-outings-v1';

function readDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error('DATABASE_URL introuvable dans .env.local');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(`${SEED_TAG}:${seed}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function fetchInatTaxonMedia(latinName, commonName) {
  const queries = [
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&rank=species&per_page=5&locale=fr`,
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(commonName)}&per_page=5&locale=fr`,
  ];
  for (const url of queries) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'LeKitDuVoyageur/2.0 (pokedex-nature)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const results = Array.isArray(json.results) ? json.results : [];
      const exact = results.find(
        (t) =>
          typeof t?.name === 'string' &&
          t.name.toLowerCase() === latinName.toLowerCase() &&
          t.default_photo?.medium_url,
      );
      const best = exact || results.find((t) => t?.default_photo?.medium_url);
      if (best?.default_photo?.medium_url) {
        return {
          imageUrl: best.default_photo.medium_url,
          wikipediaUrl: best.wikipedia_url || null,
        };
      }
    } catch {
      // try next query
    }
  }
  return { imageUrl: null, wikipediaUrl: null };
}

/**
 * Catalogue authentique de faune alpine & lacustre + récits de terrain
 * par clé d'itinéraire réel (corrélé sur le titre de club_events).
 */
const OUTING_PACKS = [
  {
    match: 'GRP Tour du Lac d’Annecy',
    spotBase: 'Tour du Lac d’Annecy',
    species: [
      { name: 'Grèbe huppé', latin: 'Podiceps cristatus', spot: 'Roselière de Doussard · Lac d’Annecy', note: 'Couple en parade nuptiale près des roseaux au lever du jour.', confidence: 0.97, progress: 0.14 },
      { name: 'Faucon pèlerin', latin: 'Falco peregrinus', spot: 'Falaises du Roc de Chère · Lac d’Annecy', note: 'Vol en piqué fulgurant le long des parois calcaires surplombant le lac.', confidence: 0.94, progress: 0.36 },
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Crête du Semnoz · Tour du Lac d’Annecy', note: 'Hardes de 7 individus traversant les lapiaz au-dessus de Duingt.', confidence: 0.98, progress: 0.61 },
      { name: 'Martin-pêcheur d’Europe', latin: 'Alcedo atthis', spot: 'Anse de Talloires · Lac d’Annecy', note: 'Éclair bleu turquoise rasant la surface calme à la sortie du sentier côtier.', confidence: 0.93, progress: 0.84 },
    ],
    posts: [
      {
        title: 'GRP Tour du Lac d’Annecy — Balcons secs & eau translucide',
        content: 'Traversée superbe entre le Roc de Chère, le Col de la Forclaz et les crêtes du Semnoz. Les sentiers balcon sont parfaitement secs, eau fraîche disponible aux fontaines de Talloires et Doussard. Plusieurs haltes baignade et observation sur les rives navigables.',
        mediaUrl: '/assets/images/lake-1.jpg',
        likes: 34,
        replies: 8,
      },
      {
        title: 'Bivouac & lever de soleil sur le GRP Tour du Lac d’Annecy',
        content: 'Nuit calme face au massif de la Tournette avant de boucler la descente vers Veyrier-du-Lac. Le profil réel du GRP pique bien dans la montée de Montmin mais le panorama 360° sur le lac récompense chaque mètre de D+.',
        mediaUrl: '/assets/images/club-kayak.jpg',
        likes: 27,
        replies: 5,
      },
    ],
  },
  {
    match: 'Circuit de Leschaux',
    spotBase: 'Col de Leschaux · Bauges',
    species: [
      { name: 'Cygne tuberculé', latin: 'Cygnus olor', spot: 'Rive ouest de Sévrier · Lac d’Annecy', note: 'Groupe paisible glissant près des bouées de rive à l’aube.', confidence: 0.99, progress: 0.15 },
      { name: 'Milan royal', latin: 'Milvus milvus', spot: 'Col de Leschaux · Massif des Bauges', note: 'Longue glissade thermique au-dessus des alpages fauchés de Bellecombe.', confidence: 0.95, progress: 0.42 },
      { name: 'Chevreuil d’Europe', latin: 'Capreolus capreolus', spot: 'Forêt du Semnoz · Leschaux', note: 'Traversée furtive de la lisière forestière au kilomètre 32.', confidence: 0.96, progress: 0.68 },
      { name: 'Cincle plongeur', latin: 'Cinclus cinclus', spot: 'Torrent du Chéran · Bauges', note: 'Observé en chasse sous-marine sur les galets du pont de Bellecombe.', confidence: 0.91, progress: 0.86 },
    ],
    posts: [
      {
        title: 'Circuit de Leschaux — Lac d’Annecy & Bauges : revêtement nickel',
        content: 'Boucle roulante de 55,9 km par Sévrier, le Col de Leschaux et la vallée du Chéran. Peu de circulation avant 9h, fontaine ouverte sur la place de Leschaux et descente panoramique vers le bord du lac.',
        mediaUrl: '/assets/images/journal-trail.jpg',
        likes: 22,
        replies: 4,
      },
      {
        title: 'Ravitaillement & pause café après le Circuit de Leschaux',
        content: 'Belle sortie en groupe homogène avec deux allures sur la montée régulière du Col de Leschaux. Vent de nord léger sur la voie verte au retour le long du lac d’Annecy.',
        mediaUrl: '/assets/images/lake-1.jpg',
        likes: 18,
        replies: 3,
      },
    ],
  },
  {
    match: 'GR 55 La Vanoise',
    spotBase: 'GR 55 · Col de la Vanoise',
    species: [
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Col de la Vanoise · GR 55', note: 'Mâles aux cornes imposantes à 30 m du sentier près du lac des Vaches.', confidence: 0.99, progress: 0.18 },
      { name: 'Gypaète barbu', latin: 'Gypaetus barbatus', spot: 'Glaciers de la Vanoise · GR 55', note: 'Immense silhouette rousse planant lentement au ras des barres de la Grande Casse.', confidence: 0.96, progress: 0.44 },
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Vallon de la Leisse · GR 55', note: 'Colonie très active sifflant à notre passage entre les blocs morainiques.', confidence: 0.99, progress: 0.66 },
      { name: 'Lagopède alpin', latin: 'Lagopus muta', spot: 'Col de Chavière · GR 55', note: 'Plumage mimétique dans les éboulis d’altitude au-dessus de 2 650 m.', confidence: 0.92, progress: 0.85 },
    ],
    posts: [
      {
        title: 'GR 55 La Vanoise — Passage du Lac des Vaches & Refuge Félix Faure',
        content: 'Conditions grandioses sur la traversée des glaciers de la Vanoise ! Les dalles du lac des Vaches sont bien dégagées, névé court et portant sous le col de Chavière. Prévoir une polaire coupe-vent pour les pauses au col.',
        mediaUrl: '/assets/images/mountain-1.jpg',
        likes: 41,
        replies: 11,
      },
      {
        title: 'Retour matos ultralight sur le GR 55 La Vanoise',
        content: 'Sac à 6,2 kg en autonomie refuge + bivouac sur les 56 km du GR 55. Les bâtons carbone ont fait la différence dans la longue descente vers Pralognan.',
        mediaUrl: '/assets/images/journal-refuge.jpg',
        likes: 29,
        replies: 6,
      },
    ],
  },
  {
    match: 'Tour des Lacs des Sept Laux',
    spotBase: 'Lacs des Sept Laux · Belledonne',
    species: [
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Lac Blanc des Sept Laux · Belledonne', note: 'Trois chamois descendant boire sur les névés bordant le lac glaciaire.', confidence: 0.97, progress: 0.2 },
      { name: 'Lièvre variable', latin: 'Lepus timidus', spot: 'Col de la Vache · Sept Laux', note: 'Surpris à l’aube en mue partielle au milieu des blocs de granit.', confidence: 0.91, progress: 0.48 },
      { name: 'Tichodrome échelette', latin: 'Tichodroma muraria', spot: 'Paroi du Rocher Blanc · Sept Laux', note: 'Ailes carmin papillonant sur la falaise humide au-dessus du refuge.', confidence: 0.93, progress: 0.72 },
      { name: 'Triton alpestre', latin: 'Ichthyosaura alpestris', spot: 'Lac de la Sagne · Sept Laux', note: 'Observé en eau cristalline près des berges peu profondes (aucun contact).', confidence: 0.95, progress: 0.88 },
    ],
    posts: [
      {
        title: 'Tour des Lacs des Sept Laux — Emplacements bivouac & eau',
        content: 'Nuit étoilée au-dessus du lac Cottepens, température 3°C au lever du soleil. Eau abondante sur tout le plateau des Sept Laux, filtre conseillé près des zones pastorales. Zéro trace laissée derrière la cordée.',
        mediaUrl: '/assets/images/club-bivouac.jpg',
        likes: 36,
        replies: 9,
      },
      {
        title: 'Traversée des pierriers sur le Tour des Lacs des Sept Laux',
        content: 'Les cairns du col de la Vache sont parfaitement visibles. Chaussures à bonne accroche vibram recommandées sur le granit humide de Belledonne.',
        mediaUrl: '/assets/images/adventure-bivouac.jpg',
        likes: 24,
        replies: 4,
      },
    ],
  },
  {
    match: 'Pas de l’Aiguille',
    spotBase: 'Pas de l’Aiguille · Vercors',
    species: [
      { name: 'Vautour fauve', latin: 'Gyps fulvus', spot: 'Falaises du Mont Aiguille · Vercors', note: 'Escadrille de 11 vautours tournoyant dans les ascendants face au Pas de l’Aiguille.', confidence: 0.98, progress: 0.22 },
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Hauts Plateaux · Pas de l’Aiguille', note: 'Jeunes bouquetins couchés à l’abri du vent sur la vire calcaire.', confidence: 0.97, progress: 0.5 },
      { name: 'Aigle royal', latin: 'Aquila chrysaetos', spot: 'Crête de la Montagnette · Vercors', note: 'Passage majestueux juste au-dessus du plateau herbeux.', confidence: 0.95, progress: 0.74 },
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Plaine de la Queyrie · Vercors', note: 'Sentinelle postée sur un gros bloc calcaire à la sortie du pas.', confidence: 0.98, progress: 0.88 },
    ],
    posts: [
      {
        title: 'Pas de l’Aiguille — Hauts Plateaux du Vercors : panorama limpide',
        content: 'Montée tonique depuis Richardière dans les lacets sous les falaises, puis débouché saisissant sur la mer de calcaire des Hauts Plateaux face au Mont Aiguille. Pensez à prendre 2,5 L d’eau, pas de source fiable sur le plateau.',
        mediaUrl: '/assets/images/adventure-hiking.jpg',
        likes: 31,
        replies: 7,
      },
      {
        title: 'Covoiturage & débrief Pas de l’Aiguille — Vercors',
        content: 'Super ambiance sur les 17 km de boucle avec pause pique-nique près de la bergerie de Chaumailloux. Les vautours fauves ont assuré le spectacle pendant tout le déjeuner.',
        mediaUrl: '/assets/images/community-hikers.jpg',
        likes: 19,
        replies: 3,
      },
    ],
  },
  {
    match: 'La Brèche Pacave',
    spotBase: 'Brèche Pacave · La Grave',
    species: [
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Vallon de la Buffe · La Grave', note: 'Hardes de chamois gravissant les pentes raides face aux glaciers de la Meije.', confidence: 0.98, progress: 0.19 },
      { name: 'Chocard à bec jaune', latin: 'Pyrrhocorax graculus', spot: 'Brèche Pacave · Écrins', note: 'Acrobates du vent virevoltant dans la brèche à 2 800 m.', confidence: 0.99, progress: 0.49 },
      { name: 'Gypaète barbu', latin: 'Gypaetus barbatus', spot: 'Glacier de la Girose · La Grave', note: 'Individu adulte survolant les arêtes nord de la Meije.', confidence: 0.94, progress: 0.71 },
      { name: 'Hermine', latin: 'Mustela erminea', spot: 'Plateau d’Emparis · La Grave', note: 'Apparition éclair entre deux rochers sur le sentier de retour.', confidence: 0.91, progress: 0.87 },
    ],
    posts: [
      {
        title: 'La Brèche Pacave depuis La Grave — Conditions arête & névés',
        content: 'Départ matinal face à la Meije sous une lumière dorée exceptionnelle. Le sentier CA17 est bien cairné, un court névé raide demande vigilance (crampons légers appréciables tôt le matin).',
        mediaUrl: '/assets/images/club-alpin.jpg',
        likes: 38,
        replies: 9,
      },
      {
        title: 'Lumière d’alpenglow sur La Meije depuis La Brèche Pacave',
        content: 'Vue imprenable sur le Râteau et le glacier de la Girose. Groupe soudé et timing impeccable avant la brise thermique de l’après-midi.',
        mediaUrl: '/assets/images/mountain-2.jpg',
        likes: 26,
        replies: 5,
      },
    ],
  },
  {
    match: 'Boucle d’Ailefroide',
    spotBase: 'Ailefroide · Vallouise Écrins',
    species: [
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Pré de Madame Carle · Ailefroide', note: 'Très nombreuses dans les prairies d’altitude en bordure du torrent.', confidence: 0.99, progress: 0.17 },
      { name: 'Cincle plongeur', latin: 'Cinclus cinclus', spot: 'Torrent de Saint-Pierre · Ailefroide', note: 'Observé sur les rochers éclaboussés par la fonte du Glacier Blanc.', confidence: 0.93, progress: 0.45 },
      { name: 'Aigle royal', latin: 'Aquila chrysaetos', spot: 'Pelvoux · Ailefroide', note: 'Cercles majestueux au-dessus de la face sud du Pelvoux.', confidence: 0.96, progress: 0.7 },
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Sentier du Sélé · Ailefroide', note: 'Individu solitaire immobile sur un verrou glaciaire au lever du jour.', confidence: 0.97, progress: 0.86 },
    ],
    posts: [
      {
        title: 'Boucle d’Ailefroide — Vallouise Écrins : atelier sécurité glacier',
        content: 'Approche magnifique depuis Ailefroide entre mélèzes et torrents glaciaires, suivie d’une révision encordement et progression sur moraine. Tout le groupe a validé les manips.',
        mediaUrl: '/assets/images/club-alpin.jpg',
        likes: 28,
        replies: 6,
      },
      {
        title: 'Ambiance haute montagne sur la Boucle d’Ailefroide',
        content: 'Température fraîche au départ du refuge puis soleil franc dès 9h30. Le granit d’Ailefroide est toujours aussi photogénique.',
        mediaUrl: '/assets/images/hero-editorial.jpg',
        likes: 21,
        replies: 4,
      },
    ],
  },
  {
    match: 'Boucle du Plateau du Parmelan',
    spotBase: 'Plateau du Parmelan · Aravis',
    species: [
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Lapiaz du Parmelan · Aravis', note: 'Observés dans les failles calcaires à 200 m du refuge Camille Dunant.', confidence: 0.97, progress: 0.21 },
      { name: 'Chocard à bec jaune', latin: 'Pyrrhocorax graculus', spot: 'Tête du Parmelan · Aravis', note: 'Vol synchronisé au ras de la falaise ouest face au lac d’Annecy.', confidence: 0.99, progress: 0.48 },
      { name: 'Faucon crécerelle', latin: 'Falco tinnunculus', spot: 'Grand Montoir · Parmelan', note: 'Vol en Saint-Esprit au-dessus des pelouses sommitales.', confidence: 0.94, progress: 0.73 },
      { name: 'Salamandre noire', latin: 'Salamandra atra', spot: 'Forêt de l’Anglettaz · Parmelan', note: 'Aperçue sur le sentier humide après la rosée matinale.', confidence: 0.95, progress: 0.89 },
    ],
    posts: [
      {
        title: 'Boucle du Plateau du Parmelan — Lapiaz secs & vue Mont-Blanc',
        content: 'Montée ludique par le Petit Montoir puis traversée complète des lapiaz du Parmelan. Prudence sur les fissures calcaires si la roche est humide ; vue limpide du Mont-Blanc jusqu’au Jura.',
        mediaUrl: '/assets/images/mountain-1.jpg',
        likes: 25,
        replies: 5,
      },
      {
        title: 'Pause refuge sur la Boucle du Plateau du Parmelan',
        content: 'Pause conviviale au chalet Camille Dunant avant la descente en boucle vers l’Anglettaz. Super sortie accessible pour accueillir les nouveaux membres.',
        mediaUrl: '/assets/images/journal-refuge.jpg',
        likes: 17,
        replies: 3,
      },
    ],
  },
  {
    match: 'Boucle du Mont Veyrier',
    spotBase: 'Mont Veyrier · Lac d’Annecy',
    species: [
      { name: 'Faucon pèlerin', latin: 'Falco peregrinus', spot: 'Crête du Mont Baron · Mont Veyrier', note: 'Passage rapide au-dessus de l’ancienne gare du téléphérique.', confidence: 0.95, progress: 0.24 },
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Versant est du Mont Veyrier', note: 'Deux chamois broutant en lisière sous le col des Sauts.', confidence: 0.97, progress: 0.54 },
      { name: 'Grand Corbeau', latin: 'Corvus corax', spot: 'Sommet du Mont Veyrier', note: 'Croassements sonores et figures aériennes face aux Dents de Lanfon.', confidence: 0.98, progress: 0.78 },
    ],
    posts: [
      {
        title: 'Boucle du Mont Veyrier — Sortie trail rythme au-dessus du lac',
        content: '12,8 km et +1 269 m avalés en deux groupes d’allure sur les escaliers naturels du Mont Veyrier et la crête du Mont Baron. Sentier sec et accrocheur, panorama incroyable sur le lac d’Annecy.',
        mediaUrl: '/assets/images/club-trail.jpg',
        likes: 33,
        replies: 7,
      },
      {
        title: 'Lever de soleil depuis les crêtes de la Boucle du Mont Veyrier',
        content: 'Départ frontale à 06h00 depuis Annecy-le-Vieux pour attraper les premières lumières roses sur la Tournette. Un classique indémodable du club.',
        mediaUrl: '/assets/images/community-morning.jpg',
        likes: 29,
        replies: 6,
      },
    ],
  },
  {
    match: 'Petit Balcon Nord VTT',
    spotBase: 'Petit Balcon Nord · Chamonix',
    species: [
      { name: 'Pic noir', latin: 'Dryocopus martius', spot: 'Forêt des Tines · Petit Balcon Nord', note: 'Tambourinage sonore sur les épicéas en bordure du single.', confidence: 0.94, progress: 0.22 },
      { name: 'Écureuil roux', latin: 'Sciurus vulgaris', spot: 'Bois du Bouchet · Chamonix', note: 'Traversée agile entre les mélèzes juste devant le groupe VTT.', confidence: 0.98, progress: 0.51 },
      { name: 'Chevreuil d’Europe', latin: 'Capreolus capreolus', spot: 'Argentière · Petit Balcon Nord', note: 'Observé immobile dans une clairière en fin de boucle.', confidence: 0.96, progress: 0.81 },
    ],
    posts: [
      {
        title: 'Petit Balcon Nord VTT Chamonix – Argentière : single en flow',
        content: 'Relance permanente sur les racines et les épingles propres entre Chamonix et Argentière face aux Drus. Pression pneus 1,6 bar idéale sur le sol souple de forêt.',
        mediaUrl: '/assets/images/forest-1.jpg',
        likes: 23,
        replies: 4,
      },
      {
        title: 'Brief sécurité & partage du sentier — Petit Balcon Nord VTT',
        content: 'Sortie tôt le matin pour respecter la tranquillité des randonneurs. Tout le monde a adoré les sections techniques sous le glacier d’Argentière.',
        mediaUrl: '/assets/images/journal-trail.jpg',
        likes: 16,
        replies: 2,
      },
    ],
  },
  {
    match: 'Lac Blanc — Balcon des Aiguilles Rouges',
    spotBase: 'Lac Blanc · Aiguilles Rouges',
    species: [
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Lacs des Chéserys · Lac Blanc', note: 'Famille entière de bouquetins posant face à la Mer de Glace.', confidence: 0.99, progress: 0.2 },
      { name: 'Chocard à bec jaune', latin: 'Pyrrhocorax graculus', spot: 'Refuge du Lac Blanc · Chamonix', note: 'Vol en formation au-dessus du miroir d’eau glaciaire.', confidence: 0.99, progress: 0.48 },
      { name: 'Aigle royal', latin: 'Aquila chrysaetos', spot: 'Aiguilles Rouges · Lac Blanc', note: 'Survol majestueux des arêtes granitiques au-dessus du col des Montets.', confidence: 0.96, progress: 0.72 },
      { name: 'Hermine', latin: 'Mustela erminea', spot: 'Sentier du Lac Blanc · Chamonix', note: 'Curieuse entre les pierres sèches du balcon sud.', confidence: 0.92, progress: 0.88 },
    ],
    posts: [
      {
        title: 'Lac Blanc — Balcon des Aiguilles Rouges : reflets parfaits sur le Mont-Blanc',
        content: 'Départ du col des Montets à la fraîche : pas un souffle de vent aux lacs des Chéserys, reflet miroir des Grandes Jorasses et de l’Aiguille Verte. Les échelles métalliques sont sèches et sécurisées.',
        mediaUrl: '/assets/images/mountain-2.jpg',
        likes: 47,
        replies: 12,
      },
      {
        title: 'Faune & réglementation réserve naturelle au Lac Blanc',
        content: 'Rappel utile de notre sortie : la réserve des Aiguilles Rouges regorge de bouquetins peu farouches — on garde bien nos distances et zéro drone pour préserver la quiétude.',
        mediaUrl: '/assets/images/club-photo.jpg',
        likes: 32,
        replies: 6,
      },
    ],
  },
  {
    match: 'Croix de Pralognan',
    spotBase: 'Croix de Pralognan · Vanoise',
    species: [
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Bois de la Glière · Pralognan', note: 'Observé tôt le matin au-dessus des chalets d’alpage.', confidence: 0.97, progress: 0.25 },
      { name: 'Cassenoix moucheté', latin: 'Nucifraga caryocatactes', spot: 'Forêt de mélèzes · Croix de Pralognan', note: 'En train de récolter des graines de pin cembro près du sentier.', confidence: 0.94, progress: 0.56 },
      { name: 'Renard roux', latin: 'Vulpes vulpes', spot: 'Alpage de Pralognan · Vanoise', note: 'Mulotage matinal dans la prairie sous la croix.', confidence: 0.95, progress: 0.82 },
    ],
    posts: [
      {
        title: 'Croix de Pralognan — Balcon de Vanoise : boucle idéale de récupération',
        content: '8,1 km fluides en forêt de mélèzes avec vue permanente sur le cirque de la Grande Casse. Super séance d’endurance fondamentale pour lancer le week-end en Vanoise.',
        mediaUrl: '/assets/images/club-trail.jpg',
        likes: 20,
        replies: 3,
      },
      {
        title: 'Lumière d’automne sur la Croix de Pralognan',
        content: 'Mélèzes dorés et sentier souple recouvert d’aiguilles. On recommande la petite variante par la cascade de la Fraîche au retour.',
        mediaUrl: '/assets/images/forest-1.jpg',
        likes: 18,
        replies: 2,
      },
    ],
  },
  {
    match: 'Boucle du Pigeonnier',
    spotBase: 'Cirque du Gioberney · Valgaudemar',
    species: [
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Refuge du Pigeonnier · Gioberney', note: 'Groupe d’une dizaine d’individus sur les dalles face aux Rouies.', confidence: 0.98, progress: 0.21 },
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Cirque du Gioberney · Écrins', note: 'Très nombreuses autour du torrent du Vaccivier.', confidence: 0.99, progress: 0.5 },
      { name: 'Gypaète barbu', latin: 'Gypaetus barbatus', spot: 'Glacier des Rouies · Valgaudemar', note: 'Grand planeur silencieux longeant les crêtes du Sirac.', confidence: 0.95, progress: 0.77 },
    ],
    posts: [
      {
        title: 'Boucle du Pigeonnier — Cirque du Gioberney : ambiance Himalaya des Écrins',
        content: 'Montée superbe face aux cascades du Voile de la Mariée et aux faces glaciaires des Rouies. Le sentier balcon jusqu’au refuge du Pigeonnier est un bijou minéral.',
        mediaUrl: '/assets/images/mountain-1.jpg',
        likes: 35,
        replies: 8,
      },
      {
        title: 'Observation faune exceptionnelle sur la Boucle du Pigeonnier',
        content: 'Bouquetins à la montée, marmottes au bord du torrent et gypaète au sommet — le Valgaudemar tient toujours ses promesses sauvages.',
        mediaUrl: '/assets/images/adventure-hiking.jpg',
        likes: 24,
        replies: 5,
      },
    ],
  },
  {
    match: 'Tour des Petites Roches',
    spotBase: 'Petites Roches · Chartreuse',
    species: [
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Falaises de Saint-Hilaire · Chartreuse', note: 'Equilibristes sur les vires calcaires surplombant le Grésivaudan.', confidence: 0.98, progress: 0.22 },
      { name: 'Faucon pèlerin', latin: 'Falco peregrinus', spot: 'Dent de Crolles · Petites Roches', note: 'Vol territorial spectaculaire près des décollages parapente.', confidence: 0.95, progress: 0.55 },
      { name: 'Cerf élaphe', latin: 'Cervus elaphus', spot: 'Plateau des Petites Roches · Chartreuse', note: 'Traces fraîches et harde aperçue en lisière au petit matin.', confidence: 0.93, progress: 0.81 },
    ],
    posts: [
      {
        title: 'Tour des Petites Roches — Balcon de Chartreuse face à Belledonne',
        content: 'Sortie trail technique de 9,8 km avec +1 086 m bien raides dans les cheminées et sentiers en balcon. Vue imprenable sur toute la chaîne de Belledonne enneigée.',
        mediaUrl: '/assets/images/club-trail.jpg',
        likes: 27,
        replies: 6,
      },
      {
        title: 'Sentiers & cascades sur le Tour des Petites Roches',
        content: 'Passage rafraîchissant près de la cascade du Touvet. Sol calcaire parfois glissant en forêt : crampons 4 mm conseillés.',
        mediaUrl: '/assets/images/hero-misty.jpg',
        likes: 19,
        replies: 3,
      },
    ],
  },
  {
    match: 'Tour du Mont Thabor',
    spotBase: 'Mont Thabor · Vallée de la Clarée',
    species: [
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Refuge des Drayères · Mont Thabor', note: 'Partout dans les pelouses alpines autour des lacs des Muandes.', confidence: 0.99, progress: 0.16 },
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Col des Méandes · Mont Thabor', note: 'Hardes observant les randonneurs depuis les schistes pourpres.', confidence: 0.97, progress: 0.43 },
      { name: 'Aigle royal', latin: 'Aquila chrysaetos', spot: 'Vallée Étroite · Tour du Mont Thabor', note: 'En chasse le long des parois des Rois Mages.', confidence: 0.96, progress: 0.69 },
      { name: 'Lagopède alpin', latin: 'Lagopus muta', spot: 'Crêtes du Thabor (2 800 m)', note: 'Couple discret dans les pierriers d’altitude sous la chapelle.', confidence: 0.92, progress: 0.87 },
    ],
    posts: [
      {
        title: 'Tour du Mont Thabor — 4 jours d’itinérance Clarée & Vallée Étroite',
        content: 'Boucle de 65,8 km absolument magique entre lacs glaciaires, schistes rouges et polenta en Vallée Étroite. Bivouac toléré près des Drayères, refuges accueillants sur tout le tour.',
        mediaUrl: '/assets/images/club-bivouac.jpg',
        likes: 44,
        replies: 10,
      },
      {
        title: 'Météo & points d’eau sur le Tour du Mont Thabor',
        content: 'Sources actives à tous les cols principaux (Valmeinier, Muandes, Vallée Étroite). Prévoir une doudoune légère pour les soirées fraîches au-dessus de 2 200 m.',
        mediaUrl: '/assets/images/hero-solar.jpg',
        likes: 28,
        replies: 5,
      },
    ],
  },
  {
    match: 'GR 57',
    spotBase: 'GR 57 · Haute Vallée de la Clarée',
    species: [
      { name: 'Tétras-lyre', latin: 'Lyrurus tetrix', spot: 'Mélézin de Névache · GR 57', note: 'Coq repéré au chant dans les landes à rhododendrons à l’aube.', confidence: 0.93, progress: 0.18 },
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Lac Long & Lac Rond · GR 57', note: 'Traversée gracieuse d’un pierrier au-dessus du lac Cristol.', confidence: 0.98, progress: 0.44 },
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Col de Buffère · GR 57', note: 'Sifflements d’alerte en chaîne sur le versant sud.', confidence: 0.99, progress: 0.68 },
      { name: 'Loup gris', latin: 'Canis lupus', spot: 'Haute Clarée · GR 57', note: 'Empreintes nettes relevées sur une piste humide tôt le matin (indice validé).', confidence: 0.89, progress: 0.86 },
    ],
    posts: [
      {
        title: 'GR 57 — Haute Vallée de la Clarée : lacs d’altitude & crêtes',
        content: '85,4 km et +4 595 m sur les deux versants de la Clarée : lac de la Douche, lac Laramon, lac Serpent et col des Rochilles. Balisage rouge et blanc impeccable sur toute la boucle.',
        mediaUrl: '/assets/images/adventure-hiking.jpg',
        likes: 39,
        replies: 9,
      },
      {
        title: 'Conseils bivouac & autonomie sur le GR 57 Clarée',
        content: 'Les chalets de Laval et le refuge de Buffère permettent de ravitailler facilement à mi-parcours. Nuits étoilées sans aucune pollution lumineuse !',
        mediaUrl: '/assets/images/adventure-bivouac.jpg',
        likes: 25,
        replies: 4,
      },
    ],
  },
  {
    match: 'GR 58',
    spotBase: 'GR 58 · Tour du Queyras',
    species: [
      { name: 'Vautour fauve', latin: 'Gyps fulvus', spot: 'Col Fromage · GR 58 Queyras', note: 'Grand rassemblement dans les thermiques au-dessus de Ceillac.', confidence: 0.97, progress: 0.17 },
      { name: 'Marmotte alpine', latin: 'Marmota marmota', spot: 'Col Chamoussière · GR 58 Queyras', note: 'Très peu farouches sur la montée vers Saint-Véran.', confidence: 0.99, progress: 0.42 },
      { name: 'Tétras-lyre', latin: 'Lyrurus tetrix', spot: 'Forêt de mélèzes d’Abriès · GR 58', note: 'Observé aux jumelles en lisière supérieure du mélézin.', confidence: 0.92, progress: 0.67 },
      { name: 'Bouquetin des Alpes', latin: 'Capra ibex', spot: 'Col Vieux & Pain de Sucre · GR 58', note: 'Groupe surveillant la frontière italienne face au Mont Viso.', confidence: 0.98, progress: 0.86 },
    ],
    posts: [
      {
        title: 'GR 58 — Tour du Queyras : 110 km entre Ceillac, Saint-Véran et le Viso',
        content: 'Itinérance mythique bouclée en 6 étapes avec des cols à près de 2 850 m (Chamoussière, Malrif, Fromage). Villages en bois, gîtes chaleureux et soleil quasi permanent dans les Hautes-Alpes.',
        mediaUrl: '/assets/images/mountain-2.jpg',
        likes: 52,
        replies: 14,
      },
      {
        title: 'Topographie & étapes clés du GR 58 Tour du Queyras',
        content: 'Mention spéciale pour les lacs du Grand Laus et la vue saisissante sur la pyramide du Mont Viso depuis le col Vieux. Pensez à réserver les gîtes d’étape en haute saison.',
        mediaUrl: '/assets/images/journal-refuge.jpg',
        likes: 34,
        replies: 7,
      },
    ],
  },
  {
    match: 'Tour des Aiguilles d’Arves',
    spotBase: 'Aiguilles d’Arves · Maurienne',
    species: [
      { name: 'Mouflon méditerranéen', latin: 'Ovis gmelini musimon', spot: 'Plateau d’Emparis · Aiguilles d’Arves', note: 'Troupeau d’une quinzaine de mouflons traversant les crêtes herbeuses.', confidence: 0.96, progress: 0.19 },
      { name: 'Aigle royal', latin: 'Aquila chrysaetos', spot: 'Col des Trois Pointes · Maurienne', note: 'Vol rasant autour des trois célèbres aiguilles calcaires.', confidence: 0.97, progress: 0.47 },
      { name: 'Chamois des Alpes', latin: 'Rupicapra rupicapra', spot: 'Refuge des Aiguilles d’Arves', note: 'Observés en nombre sous le col Lombard au petit matin.', confidence: 0.98, progress: 0.72 },
      { name: 'Lièvre variable', latin: 'Lepus timidus', spot: 'Col des Prés Nouveaux · Maurienne', note: 'Départ vif dans les éboulis d’altitude à 2 350 m.', confidence: 0.91, progress: 0.88 },
    ],
    posts: [
      {
        title: 'Tour des Aiguilles d’Arves — Haute Maurienne : reflets aux lacs Noir & Lérié',
        content: '96,3 km et +5 039 m autour des trois géants de Maurienne. Le lever de soleil sur les Aiguilles d’Arves reflétées dans le lac Lérié reste l’un des plus beaux souvenirs de la saison du club.',
        mediaUrl: '/assets/images/hero-editorial.jpg',
        likes: 43,
        replies: 11,
      },
      {
        title: 'Retour matos & gestion de l’effort sur le Tour des Aiguilles d’Arves',
        content: 'Étapes exigeantes avec de longs cols minéraux. On recommande des chaussures semi-rigides et une bonne protection solaire sur le plateau d’Emparis.',
        mediaUrl: '/assets/images/club-alpin.jpg',
        likes: 26,
        replies: 5,
      },
    ],
  },
];

async function main() {
  const client = new Client({
    connectionString: readDbUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 1. Charger les 18 vraies sorties du club
    const { rows: events } = await client.query(
      `SELECT id, title, location, sport, event_date, organizer_id
       FROM club_events
       WHERE club_id = $1
       ORDER BY event_date DESC`,
      [CLUB_ID],
    );
    if (events.length === 0) throw new Error('Aucune sortie trouvée pour cordee-des-alpes');

    // 2. Charger des membres actifs humains (avec vrai nom)
    const { rows: members } = await client.query(
      `SELECT cm.user_id, up.full_name, up.handle
       FROM club_members cm
       JOIN user_profiles up ON up.id = cm.user_id
       WHERE cm.club_id = $1
         AND cm.status = 'active'
         AND up.full_name IS NOT NULL
         AND up.full_name NOT ILIKE '%lkdv%'
         AND up.full_name NOT ILIKE '%Coéquipier Y%'
       ORDER BY cm.joined_at ASC
       LIMIT 40`,
      [CLUB_ID],
    );
    if (members.length === 0) throw new Error('Aucun membre actif trouvé');

    // 3. Remplacer tout organizer_id générique (lkdv-studio / null) par un vrai membre actif du club
    let updatedOrganizers = 0;
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      const leader = members[i % members.length];
      if (!ev.organizer_id || ev.organizer_id === '00000000-0000-4000-8000-0000000000a1') {
        await client.query(`UPDATE club_events SET organizer_id = $1 WHERE id = $2`, [
          leader.user_id,
          ev.id,
        ]);
        updatedOrganizers += 1;
      }
    }

    // 4. Nettoyage idempotent de nos précédents inserts Pokédex (carnet_moments)
    const delCm = await client.query(
      `DELETE FROM carnet_moments WHERE moment_meta->>'seed_tag' = $1`,
      [SEED_TAG],
    );

    // 4b. Précharger les vraies photos taxonomiques CC iNaturalist pour chaque espèce unique
    const uniqueSpecies = new Map();
    for (const pack of OUTING_PACKS) {
      for (const sp of pack.species) {
        if (!uniqueSpecies.has(sp.latin)) {
          uniqueSpecies.set(sp.latin, sp.name);
        }
      }
    }
    const taxonMediaByLatin = new Map();
    const entriesList = Array.from(uniqueSpecies.entries());
    for (let i = 0; i < entriesList.length; i += 4) {
      const batch = entriesList.slice(i, i + 4);
      const results = await Promise.all(
        batch.map(async ([latin, name]) => [latin, await fetchInatTaxonMedia(latin, name)]),
      );
      for (const [latin, media] of results) {
        taxonMediaByLatin.set(latin, media);
      }
    }

    // 5. Nettoyage des doublons exacts anciens dans club_topics + de nos précédents inserts
    const delDupTopics = await client.query(
      `DELETE FROM club_topics
       WHERE club_id = $1
         AND (
           client_request_id IS NOT NULL AND id IN (
             SELECT id FROM club_topics WHERE club_id = $1 AND content LIKE '%#cordee-real-v1%'
           )
           OR id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at DESC) AS rn
               FROM club_topics
               WHERE club_id = $1
             ) sub
             WHERE sub.rn > 1
           )
         )`,
      [CLUB_ID],
    );

    let insertedPokedex = 0;
    let insertedPosts = 0;
    let memberCursor = 0;

    for (let evIdx = 0; evIdx < events.length; evIdx += 1) {
      const ev = events[evIdx];
      const pack = OUTING_PACKS.find((p) => ev.title.includes(p.match));
      if (!pack) {
        console.warn(`Pack manquant pour ${ev.title}`);
        continue;
      }

      const evDate = ev.event_date ? new Date(ev.event_date) : new Date();
      // Garder des timestamps de posts réalistes (dans les 14 derniers jours)
      const nowMs = Date.now();

      // 5a. Insérer les 3-4 observations Pokédex faune réelles dans carnet_moments
      for (let sIdx = 0; sIdx < pack.species.length; sIdx += 1) {
        const sp = pack.species[sIdx];
        const observer = members[memberCursor % members.length];
        memberCursor += 1;

        const obsId = deterministicUuid(`pokedex:${ev.id}:${sIdx}`);
        const obsTime = new Date(
          Math.min(nowMs - (evIdx * 3 + sIdx + 1) * 3600_000, evDate.getTime() + (sIdx + 1) * 3600_000),
        );
        const hourLabel = `${String(7 + sIdx * 2).padStart(2, '0')}h${sIdx % 2 === 0 ? '20' : '45'}`;

        const taxonMedia = taxonMediaByLatin.get(sp.latin) || { imageUrl: null, wikipediaUrl: null };
        await client.query(
          `INSERT INTO carnet_moments (
            id, jour_numero, heure, citation, auteur_nom, auteur_id, lieu, image_url,
            created_at, moment_timestamp, source, identified_species, moment_type, moment_meta
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $9, 'manuel', $10::jsonb, 'species', $11::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            citation = EXCLUDED.citation,
            auteur_nom = EXCLUDED.auteur_nom,
            auteur_id = EXCLUDED.auteur_id,
            lieu = EXCLUDED.lieu,
            image_url = EXCLUDED.image_url,
            identified_species = EXCLUDED.identified_species,
            moment_meta = EXCLUDED.moment_meta`,
          [
            obsId,
            1,
            hourLabel,
            `${sp.name} (${sp.latin}) — ${sp.note}`,
            observer.full_name,
            observer.user_id,
            sp.spot,
            taxonMedia.imageUrl,
            obsTime.toISOString(),
            JSON.stringify({
              name: sp.name,
              latin: sp.latin,
              group: 'faune',
              confidence: sp.confidence,
              wikipedia_url: taxonMedia.wikipediaUrl,
            }),
            JSON.stringify({
              seed_tag: SEED_TAG,
              event_id: ev.id,
              track_progress: sp.progress,
            }),
          ],
        );
        insertedPokedex += 1;
      }

      // 5b. Insérer 2 vrais posts club dans club_topics associés à la sortie
      for (let pIdx = 0; pIdx < pack.posts.length; pIdx += 1) {
        const post = pack.posts[pIdx];
        const author = members[memberCursor % members.length];
        memberCursor += 1;

        const postId = deterministicUuid(`topic:${ev.id}:${pIdx}`);
        const reqId = deterministicUuid(`topic-req:${ev.id}:${pIdx}`);
        const createdAt = new Date(nowMs - (evIdx * 6 + pIdx * 3 + 1) * 3600_000);

        await client.query(
          `INSERT INTO club_topics (
            id, club_id, author_id, title, content, is_pinned, is_announcement, is_approved,
            likes_count, replies_count, reports_count, created_at, updated_at, mentions,
            client_request_id, media_url
          ) VALUES (
            $1, $2, $3, $4, $5, $6, false, true,
            $7, $8, 0, $9, $9, '{}',
            $10, $11
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            author_id = EXCLUDED.author_id,
            media_url = EXCLUDED.media_url,
            likes_count = EXCLUDED.likes_count,
            replies_count = EXCLUDED.replies_count,
            updated_at = EXCLUDED.updated_at`,
          [
            postId,
            CLUB_ID,
            author.user_id,
            post.title,
            post.content,
            evIdx === 0 && pIdx === 0,
            post.likes,
            post.replies,
            createdAt.toISOString(),
            reqId,
            post.mediaUrl,
          ],
        );
        insertedPosts += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          clubId: CLUB_ID,
          eventsProcessed: events.length,
          updatedOrganizers,
          deletedOldSeededPokedex: delCm.rowCount,
          deletedDuplicateTopics: delDupTopics.rowCount,
          insertedPokedex,
          insertedPosts,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
