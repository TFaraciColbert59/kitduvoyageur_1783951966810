import type { Carte3DTrail, Carte3DWaypoint } from '../types';
import { buildElevationProfile } from '../lib/elevationEngine';

/**
 * Sentiers mythiques préchargés pour la Carte 3D vivante LKDV.
 * Données GPS et altimétriques précises, drapées fidèlement sur le relief 3D.
 */

/* ------------------------------------------------------------------ */
/* 1. TOUR DU MONT-BLANC (TMB) - Boucle Mythique des Alpes              */
/* ------------------------------------------------------------------ */
const TMB_RAW_COORDS: [number, number, number][] = [
  // Chamonix -> Les Houches -> Col de Voza -> Les Contamines
  [6.8694, 45.9237, 1035],
  [6.8321, 45.9082, 1010],
  [6.7984, 45.8901, 1007],
  [6.7725, 45.8741, 1320],
  [6.7612, 45.8643, 1657], // Col de Voza
  [6.7451, 45.8509, 1380],
  [6.7262, 45.8214, 1167], // Les Contamines
  [6.7198, 45.8032, 1210], // Notre Dame de la Gorge
  [6.7154, 45.7865, 1459], // Refuge Nant Borrant
  [6.7102, 45.7681, 1706], // Refuge de la Balme
  [6.7121, 45.7482, 2329], // Col du Bonhomme
  [6.7189, 45.7381, 2433], // Refuge Croix du Bonhomme
  [6.7385, 45.7254, 1870], // Les Chapieux
  [6.7582, 45.7412, 1800], // Ville des Glaciers
  [6.7794, 45.7512, 1868], // Refuge des Mottets
  [6.8045, 45.7538, 2516], // Col de la Seigne (Frontière FR/IT)
  [6.8321, 45.7672, 2195], // Rifugio Elisabetta
  [6.8645, 45.7781, 1965], // Lac Combal
  [6.9124, 45.7954, 1970], // Arp Vieille
  [6.9532, 45.7972, 1224], // Courmayeur
  [6.9745, 45.8112, 1989], // Rifugio Bertone
  [7.0084, 45.8451, 2025], // Rifugio Bonatti
  [7.0421, 45.8712, 1766], // Arnuva (Val Ferret)
  [7.0512, 45.8821, 2060], // Refuge Elena
  [7.0754, 45.8892, 2537], // Grand Col Ferret (Frontière IT/CH)
  [7.0912, 45.8984, 2071], // La Peule
  [7.1145, 45.9056, 1705], // Ferret
  [7.1321, 45.9324, 1593], // La Fouly
  [7.1512, 45.9612, 1055], // Praz-de-Fort
  [7.1702, 45.9921, 1145], // Issert
  [7.1895, 46.0312, 1466], // Champex-Lac
  [7.1421, 46.0543, 1987], // Alpage de Bovine
  [7.0895, 46.0612, 1527], // Col de la Forclaz
  [7.0451, 46.0587, 1300], // Trient
  [6.9854, 46.0275, 2191], // Col de Balme (Frontière CH/FR)
  [6.9582, 46.0112, 2201], // Aiguillette des Posettes
  [6.9245, 45.9954, 1417], // Tré-le-Champ
  [6.8894, 45.9812, 2352], // Lac Blanc
  [6.8812, 45.9612, 1877], // La Flégère
  [6.8745, 45.9412, 1550], // Planpraz
  [6.8694, 45.9237, 1035], // Retour Chamonix
];

const TMB_WAYPOINTS: Carte3DWaypoint[] = [
  {
    id: 'tmb-wb-chamonix',
    name: 'Chamonix-Mont-Blanc',
    category: 'viewpoint',
    lat: 45.9237,
    lng: 6.8694,
    altitudeM: 1035,
    distanceKm: 0,
    details: 'Départ historique du Tour du Mont-Blanc dans la vallée alpine.',
    photoUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    weatherSnapshot: { tempC: 18, windKmh: 8, condition: 'Ensoleillé', icon: 'sun' },
  },
  {
    id: 'tmb-wpt-col-voza',
    name: 'Col de Voza',
    category: 'pass',
    lat: 45.8643,
    lng: 6.7612,
    altitudeM: 1657,
    distanceKm: 14.5,
    details: 'Passage entre la vallée de Chamonix et le Val Montjoie avec vue sur le glacier de Bionnassay.',
  },
  {
    id: 'tmb-wpt-nant-borrant',
    name: 'Refuge Nant Borrant',
    category: 'refuge',
    lat: 45.7865,
    lng: 6.7154,
    altitudeM: 1459,
    distanceKm: 27.2,
    details: 'Refuge typique savoyard au pied de la voie romaine.',
    capacity: 35,
  },
  {
    id: 'tmb-wpt-bonhomme',
    name: 'Col du Bonhomme',
    category: 'pass',
    lat: 45.7482,
    lng: 6.7121,
    altitudeM: 2329,
    distanceKm: 34.0,
    details: 'Point de bascule mythique vers le Beaufortain et l’Italie.',
    weatherSnapshot: { tempC: 9, windKmh: 35, condition: 'Vent fort', icon: 'wind' },
  },
  {
    id: 'tmb-wpt-croix-bonhomme',
    name: 'Refuge de la Croix du Bonhomme',
    category: 'refuge',
    lat: 45.7381,
    lng: 6.7189,
    altitudeM: 2433,
    distanceKm: 36.8,
    details: 'L’un des plus hauts refuges du TMB, au carrefour du Beaufortain et de la Haute Tarentaise.',
    capacity: 105,
  },
  {
    id: 'tmb-wpt-seigne',
    name: 'Col de la Seigne',
    category: 'pass',
    lat: 45.7538,
    lng: 6.8045,
    altitudeM: 2516,
    distanceKm: 52.4,
    details: 'Frontière franco-italienne. Vue spectaculaire sur les arêtes sud du Mont Blanc et le Val Veny.',
    weatherSnapshot: { tempC: 7, windKmh: 28, condition: 'Frais & Dégagé', icon: 'cloud-sun' },
  },
  {
    id: 'tmb-wpt-rif-elisabetta',
    name: 'Rifugio Elisabetta Soldini',
    category: 'refuge',
    lat: 45.7672,
    lng: 6.8321,
    altitudeM: 2195,
    distanceKm: 56.1,
    details: 'Refuge italien surplombant le glacier de la Lex Blanche.',
    capacity: 70,
  },
  {
    id: 'tmb-wpt-eau-combal',
    name: 'Source du Lac Combal',
    category: 'water',
    lat: 45.7781,
    lng: 6.8645,
    altitudeM: 1965,
    distanceKm: 60.5,
    details: 'Point d’eau potable rafraîchissant au bord de la plaine alluviale du Combal.',
    isPotable: true,
  },
  {
    id: 'tmb-wpt-courmayeur',
    name: 'Courmayeur (Italie)',
    category: 'viewpoint',
    lat: 45.7972,
    lng: 6.9532,
    altitudeM: 1224,
    distanceKm: 76.8,
    details: 'Cité alpine du versant italien, idéale pour le ravitaillement et les produits valdôtains.',
    weatherSnapshot: { tempC: 21, windKmh: 10, condition: 'Grand soleil', icon: 'sun' },
  },
  {
    id: 'tmb-wpt-rif-bonatti',
    name: 'Rifugio Walter Bonatti',
    category: 'refuge',
    lat: 45.8451,
    lng: 7.0084,
    altitudeM: 2025,
    distanceKm: 89.2,
    details: 'Balcon d’exception face aux Grandes Jorasses, dédié au grand alpiniste.',
    capacity: 75,
    photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  },
  {
    id: 'tmb-wpt-grand-col-ferret',
    name: 'Grand Col Ferret',
    category: 'pass',
    lat: 45.8892,
    lng: 7.0754,
    altitudeM: 2537,
    distanceKm: 99.4,
    details: 'Point culminant de l’itinéraire pédestre, passage de l’Italie vers la Suisse valaisanne.',
    weatherSnapshot: { tempC: 6, windKmh: 30, condition: 'Vent d’altitude', icon: 'wind' },
  },
  {
    id: 'tmb-wpt-champex',
    name: 'Champex-Lac (Suisse)',
    category: 'water',
    lat: 46.0312,
    lng: 7.1895,
    altitudeM: 1466,
    distanceKm: 124.0,
    details: 'Le "Petit Canada" suisse avec son lac paisible et ses chalets en bois.',
    isPotable: true,
  },
  {
    id: 'tmb-wpt-col-balme',
    name: 'Col de Balme',
    category: 'pass',
    lat: 46.0275,
    lng: 6.9854,
    altitudeM: 2191,
    distanceKm: 146.5,
    details: 'Retour en France avec vue plongeante sur toute la longueur de la vallée de Chamonix.',
    weatherSnapshot: { tempC: 11, windKmh: 18, condition: 'Léger brouillard', icon: 'cloud' },
  },
  {
    id: 'tmb-wpt-lac-blanc',
    name: 'Refuge du Lac Blanc',
    category: 'refuge',
    lat: 45.9812,
    lng: 6.8894,
    altitudeM: 2352,
    distanceKm: 158.2,
    details: 'Miroir d’eau glaciaire reflétant l’aiguille Verte, les Drus et le massif du Mont-Blanc.',
    capacity: 45,
    photoUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
    weatherSnapshot: { tempC: 10, windKmh: 12, condition: 'Ciel bleu limpide', icon: 'sun' },
  },
  // Sommets emblématiques environnants (affichés en 3D sur le relief)
  {
    id: 'tmb-summit-mont-blanc',
    name: 'Mont Blanc',
    category: 'summit',
    lat: 45.8326,
    lng: 6.8652,
    altitudeM: 4809,
    distanceKm: 70.0,
    details: 'Toit de l’Europe occidentale (4 809 m), dôme de glace éternel.',
  },
  {
    id: 'tmb-summit-aiguille-midi',
    name: 'Aiguille du Midi',
    category: 'summit',
    lat: 45.8794,
    lng: 6.8875,
    altitudeM: 3842,
    distanceKm: 160.0,
    details: 'Aiguille rocheuse spectaculaire accessible par téléphérique.',
  },
  {
    id: 'tmb-summit-grandes-jorasses',
    name: 'Grandes Jorasses',
    category: 'summit',
    lat: 45.8672,
    lng: 6.9875,
    altitudeM: 4208,
    distanceKm: 88.0,
    details: 'Face nord mythique de l’alpinisme mondial.',
  },
];

/* ------------------------------------------------------------------ */
/* 2. GR20 CORSE - L’Épine Dorsale de l’Île de Beauté                 */
/* ------------------------------------------------------------------ */
const GR20_RAW_COORDS: [number, number, number][] = [
  [8.8521, 42.5084, 275],  // Calenzana
  [8.8924, 42.4789, 1570], // Refuge d'Ortu di u Piobbu
  [8.9145, 42.4512, 1270], // Refuge de Carrozzu
  [8.9321, 42.4214, 1422], // Asco Stagnu
  [8.9284, 42.3951, 1683], // Refuge de Tighettu
  [8.8895, 42.3612, 1991], // Refuge de Ciottulu di i Mori
  [8.9451, 42.3241, 1743], // Lac de Nino
  [8.9874, 42.2981, 1601], // Refuge de Manganu
  [9.0145, 42.2612, 1900], // Refuge de Petra Piana
  [9.0512, 42.2214, 1430], // Refuge de l'Onda
  [9.1145, 42.1245, 920],  // Vizzavona
  [9.1784, 42.0645, 1289], // Capanelle
  [9.2012, 42.0124, 1820], // Refuge de Prati
  [9.2451, 41.9541, 1750], // Refuge d'Usciolu
  [9.2214, 41.8745, 1536], // Refuge d'Asinao
  [9.2341, 41.7951, 1218], // Bavella
  [9.2512, 41.7612, 1050], // Refuge d'I Paliri
  [9.2845, 41.7351, 252],  // Conca
];

const GR20_WAYPOINTS: Carte3DWaypoint[] = [
  {
    id: 'gr20-wpt-calenzana',
    name: 'Calenzana',
    category: 'viewpoint',
    lat: 42.5084,
    lng: 8.8521,
    altitudeM: 275,
    distanceKm: 0,
    details: 'Départ nord du GR20 au cœur du maquis corse.',
  },
  {
    id: 'gr20-summit-cinto',
    name: 'Monte Cinto',
    category: 'summit',
    lat: 42.3828,
    lng: 8.9458,
    altitudeM: 2706,
    distanceKm: 32.0,
    details: 'Toit de la Corse (2 706 m), sommet minéral aride et grandiose.',
  },
  {
    id: 'gr20-wpt-tighettu',
    name: 'Refuge de Tighettu',
    category: 'refuge',
    lat: 42.3951,
    lng: 8.9284,
    altitudeM: 1683,
    distanceKm: 34.5,
    details: 'Refuge perché au débouché de l’ancien Cirque de la Solitude.',
    capacity: 32,
  },
  {
    id: 'gr20-wpt-lac-nino',
    name: 'Lac de Nino & Pozzines',
    category: 'water',
    lat: 42.3241,
    lng: 8.9451,
    altitudeM: 1743,
    distanceKm: 48.0,
    details: 'Pelouses tourbeuses uniques ("pozzines") et chevaux sauvages en liberté.',
    photoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  },
  {
    id: 'gr20-wpt-vizzavona',
    name: 'Col de Vizzavona',
    category: 'viewpoint',
    lat: 42.1245,
    lng: 9.1145,
    altitudeM: 920,
    distanceKm: 92.0,
    details: 'Séparation physique entre le GR20 Nord technique et le GR20 Sud plus roulant.',
  },
  {
    id: 'gr20-wpt-bavella',
    name: 'Aiguilles de Bavella',
    category: 'viewpoint',
    lat: 41.7951,
    lng: 9.2341,
    altitudeM: 1218,
    distanceKm: 154.0,
    details: 'Remparts de porphyre rouge dressés vers le ciel méditerranéen.',
  },
  {
    id: 'gr20-wpt-conca',
    name: 'Conca',
    category: 'viewpoint',
    lat: 41.7351,
    lng: 9.2845,
    altitudeM: 252,
    distanceKm: 178.0,
    details: 'Arrivée finale du GR20 et fin de l’aventure.',
  },
];

/* ------------------------------------------------------------------ */
/* 3. CIRQUE DE GAVARNIE & BRÈCHE DE ROLAND - Pyrénées Majestueuses   */
/* ------------------------------------------------------------------ */
const GAVARNIE_RAW_COORDS: [number, number, number][] = [
  [-0.0112, 42.7324, 1370], // Village de Gavarnie
  [-0.0078, 42.7154, 1480], // Plateau de la Prade
  [-0.0045, 42.7021, 1570], // Hôtel du Cirque
  [-0.0032, 42.6951, 1680], // Pied de la Grande Cascade
  [-0.0184, 42.6982, 2150], // Sentier des Espugues
  [-0.0345, 42.6941, 2587], // Refuge des Sarradets
  [-0.0358, 42.6908, 2807], // Brèche de Roland (Frontière FR/ES)
  [-0.0512, 42.6924, 3144], // Sommet du Taillon
  [-0.0358, 42.6908, 2807], // Retour Brèche
  [-0.0345, 42.6941, 2587], // Refuge des Sarradets
  [-0.0112, 42.7324, 1370], // Retour Village
];

const GAVARNIE_WAYPOINTS: Carte3DWaypoint[] = [
  {
    id: 'gav-wpt-village',
    name: 'Village de Gavarnie',
    category: 'viewpoint',
    lat: 42.7324,
    lng: -0.0112,
    altitudeM: 1370,
    distanceKm: 0,
    details: 'Porte d’entrée du Parc National des Pyrénées.',
  },
  {
    id: 'gav-wpt-cascade',
    name: 'Grande Cascade de Gavarnie',
    category: 'water',
    lat: 42.6951,
    lng: -0.0032,
    altitudeM: 1680,
    distanceKm: 5.2,
    details: 'Plus haute chute d’eau de France (422 m de saut vertical).',
    photoUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80',
  },
  {
    id: 'gav-wpt-sarradets',
    name: 'Refuge des Sarradets (Brèche de Roland)',
    category: 'refuge',
    lat: 42.6941,
    lng: -0.0345,
    altitudeM: 2587,
    distanceKm: 9.8,
    details: 'Refuge d’altitude mythique au pied de la muraille calcaire.',
    capacity: 57,
  },
  {
    id: 'gav-summit-breche',
    name: 'Brèche de Roland',
    category: 'pass',
    lat: 42.6908,
    lng: -0.0358,
    altitudeM: 2807,
    distanceKm: 11.2,
    details: 'Entaille gigantesque de 40m de large par 100m de haut ouverte dans la crête frontière.',
  },
  {
    id: 'gav-summit-taillon',
    name: 'Le Taillon',
    category: 'summit',
    lat: 42.6924,
    lng: -0.0512,
    altitudeM: 3144,
    distanceKm: 13.5,
    details: 'L’un des 3 000 les plus faciles et panoramiques des Pyrénées, dominant le canyon d’Ordesa.',
  },
];

/* ------------------------------------------------------------------ */
/* 4. DOLOMITES - ALTA VIA 1                                          */
/* ------------------------------------------------------------------ */
const DOLOMITES_RAW_COORDS: [number, number, number][] = [
  [12.0851, 46.6945, 1496], // Lago di Braies
  [12.0812, 46.6612, 2327], // Rifugio Biella
  [12.0214, 46.6341, 2060], // Rifugio Fanes
  [12.0112, 46.5275, 2752], // Rifugio Lagazuoi
  [12.0541, 46.5184, 2255], // Cinque Torri
  [12.0582, 46.4951, 2575], // Rifugio Nuvolau
  [12.1124, 46.4251, 1766], // Passo Staulanza
  [12.1345, 46.3812, 2132], // Rifugio Coldai (Civetta)
  [12.1241, 46.3451, 1714], // Rifugio Vazzoler
  [12.1845, 46.2112, 650],  // Belluno
];

const DOLOMITES_WAYPOINTS: Carte3DWaypoint[] = [
  {
    id: 'dol-wpt-braies',
    name: 'Lago di Braies',
    category: 'water',
    lat: 46.6945,
    lng: 12.0851,
    altitudeM: 1496,
    distanceKm: 0,
    details: 'Lac émeraude entouré par les parois verticales de la Croda del Becco.',
    photoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  },
  {
    id: 'dol-wpt-lagazuoi',
    name: 'Rifugio Lagazuoi',
    category: 'refuge',
    lat: 46.5275,
    lng: 12.0112,
    altitudeM: 2752,
    distanceKm: 34.0,
    details: 'Nid d’aigle spectaculaire avec sauna d’altitude et vestiges de galeries de la Grande Guerre.',
    capacity: 74,
  },
  {
    id: 'dol-summit-tofana',
    name: 'Tofana di Rozes',
    category: 'summit',
    lat: 46.5358,
    lng: 12.0512,
    altitudeM: 3225,
    distanceKm: 38.0,
    details: 'Colosse calcaire dominant Cortina d’Ampezzo.',
  },
  {
    id: 'dol-summit-civetta',
    name: 'Monte Civetta',
    category: 'summit',
    lat: 46.3781,
    lng: 12.0545,
    altitudeM: 3220,
    distanceKm: 85.0,
    details: 'Paroi des parois du nord-ouest dolomitique (1 000 m de vide).',
  },
];

/* ------------------------------------------------------------------ */
/* 5. HAUTE ROUTE CHAMONIX - ZERMATT                                  */
/* ------------------------------------------------------------------ */
const HAUTE_ROUTE_RAW_COORDS: [number, number, number][] = [
  [6.8694, 45.9237, 1035], // Chamonix
  [6.9284, 45.9812, 1250], // Argentière
  [7.0245, 45.9984, 3321], // Col du Chardonnet
  [7.0541, 46.0312, 1466], // Champex
  [7.2284, 46.0984, 1500], // Verbier
  [7.3112, 46.0541, 2213], // Cabane de Louvie
  [7.3951, 46.0845, 2657], // Cabane de Prafleuri
  [7.4895, 45.9981, 3790], // Pigne d'Arolla
  [7.4984, 45.9812, 3158], // Cabane des Vignettes
  [7.5841, 45.9612, 3382], // Col de l'Évêque
  [7.7491, 45.9765, 4478], // Pied du Cervin / Matterhorn
  [7.7491, 46.0207, 1620], // Zermatt
];

const HAUTE_ROUTE_WAYPOINTS: Carte3DWaypoint[] = [
  {
    id: 'hr-wpt-chamonix',
    name: 'Chamonix-Mont-Blanc',
    category: 'viewpoint',
    lat: 45.9237,
    lng: 6.8694,
    altitudeM: 1035,
    distanceKm: 0,
    details: 'Berceau de l’alpinisme mondial.',
  },
  {
    id: 'hr-summit-pigne',
    name: 'Pigne d’Arolla',
    category: 'summit',
    lat: 45.9981,
    lng: 7.4895,
    altitudeM: 3790,
    distanceKm: 98.0,
    details: 'Point culminant glaciaire de la Haute Route pédestre et à ski.',
  },
  {
    id: 'hr-wpt-vignettes',
    name: 'Cabane des Vignettes',
    category: 'refuge',
    lat: 45.9812,
    lng: 7.4984,
    altitudeM: 3158,
    distanceKm: 104.0,
    details: 'Refuge suisse suspendu au-dessus du glacier de Pièce.',
    capacity: 120,
  },
  {
    id: 'hr-summit-matterhorn',
    name: 'Cervin / Matterhorn',
    category: 'summit',
    lat: 45.9765,
    lng: 7.7491,
    altitudeM: 4478,
    distanceKm: 145.0,
    details: 'La pyramide la plus emblématique du monde, dominant la vallée de Zermatt.',
  },
  {
    id: 'hr-wpt-zermatt',
    name: 'Zermatt (Suisse)',
    category: 'viewpoint',
    lat: 46.0207,
    lng: 7.7491,
    altitudeM: 1620,
    distanceKm: 162.0,
    details: 'Terminus grandiose au pied du Cervin.',
  },
];

function buildPresetTrail(
  id: string,
  name: string,
  massif: string,
  country: string,
  region: string,
  coords: [number, number, number][],
  waypoints: Carte3DWaypoint[],
  description: string,
  difficulty: 'facile' | 'moyen' | 'difficile' | 'expert'
): Carte3DTrail {
  const result = buildElevationProfile(coords);

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const c of coords) {
    if (c[0] < minLng) minLng = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[0] > maxLng) maxLng = c[0];
    if (c[1] > maxLat) maxLat = c[1];
  }

  const padLng = (maxLng - minLng) * 0.08;
  const padLat = (maxLat - minLat) * 0.08;

  return {
    id,
    name,
    massif,
    country,
    region,
    distanceKm: result.distanceKm,
    elevationGainM: result.elevationGainM,
    elevationLossM: result.elevationLossM,
    minElevationM: result.minElevationM,
    maxElevationM: result.maxElevationM,
    estimatedDurationHours: result.estimatedDurationHours,
    bounds: [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat],
    coordinates: coords,
    elevationProfile: result.elevationProfile,
    waypoints,
    description,
    difficulty,
  };
}

export const PRESET_TRAILS: Carte3DTrail[] = [
  buildPresetTrail(
    'tmb-mont-blanc',
    'Tour du Mont-Blanc (TMB)',
    'Massif du Mont-Blanc',
    'France / Italie / Suisse',
    'Haute-Savoie / Val d’Aoste / Valais',
    TMB_RAW_COORDS,
    TMB_WAYPOINTS,
    'La boucle reine d’Europe : 170 km autour du toit des Alpes à travers trois pays et six cols d’altitude.',
    'difficile'
  ),
  buildPresetTrail(
    'gr20-corse',
    'GR20 Corse — La Diagonale',
    'Montagnes Corses',
    'France',
    'Haute-Corse / Corse-du-Sud',
    GR20_RAW_COORDS,
    GR20_WAYPOINTS,
    'Le sentier le plus exigeant et minéral d’Europe, traversant la crête granitique de Calenzana à Conca.',
    'expert'
  ),
  buildPresetTrail(
    'gavarnie-breche',
    'Cirque de Gavarnie & Brèche de Roland',
    'Pyrénées — Mont Perdu',
    'France / Espagne',
    'Hautes-Pyrénées',
    GAVARNIE_RAW_COORDS,
    GAVARNIE_WAYPOINTS,
    'Spectacle géologique classé à l’UNESCO avec la plus haute cascade de France et la brèche taillée dans la muraille.',
    'moyen'
  ),
  buildPresetTrail(
    'dolomites-av1',
    'Dolomites — Alta Via 1',
    'Dolomites',
    'Italie',
    'Vénétie / Trentin-Haut-Adige',
    DOLOMITES_RAW_COORDS,
    DOLOMITES_WAYPOINTS,
    'Traversée féerique du nord au sud des Dolomites, des eaux turquoises de Braies aux parois mythiques de la Civetta.',
    'difficile'
  ),
  buildPresetTrail(
    'haute-route-zermatt',
    'Haute Route Chamonix-Zermatt',
    'Alpes Pennines / Valais',
    'France / Suisse',
    'Chamonix / Zermatt',
    HAUTE_ROUTE_RAW_COORDS,
    HAUTE_ROUTE_WAYPOINTS,
    'L’itinéraire glaciaire et alpin reliant les deux capitales mondiales de la haute montagne face au Cervin.',
    'expert'
  ),
];
