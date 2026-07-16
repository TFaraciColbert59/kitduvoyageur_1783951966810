import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Rich fallback data (always visible even if DB is empty) ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FALLBACK_TRAILS: any[] = [
  { id: 'f-t1', name: 'Tour du Mont-Blanc', trail_type: 'trek', country: 'France/Italie/Suisse', region: 'Alpes', distance_km: 170, duration_hours: 110, difficulty: 'hard', elevation_gain: 10000, altitude_max: 2665, start_lat: 45.9237, start_lng: 6.8694, end_lat: 45.9237, end_lng: 6.8694, is_loop: true, source: 'osm', geojson: null, description: 'Le tour mythique du massif du Mont Blanc traversant 3 pays', surface: null, metadata: null },
  { id: 'f-t2', name: 'GR20 – Corse', trail_type: 'trek', country: 'France', region: 'Corse', distance_km: 180, duration_hours: 130, difficulty: 'expert', elevation_gain: 13000, altitude_max: 2706, start_lat: 42.4472, start_lng: 8.9000, end_lat: 41.5500, end_lng: 9.0500, is_loop: false, source: 'osm', geojson: null, description: 'La plus belle randonnée d\'Europe selon les experts', surface: null },
  { id: 'f-t3', name: 'Chemin de Saint-Jacques (GR65)', trail_type: 'hiking', country: 'France/Espagne', region: 'Pyrénées', distance_km: 780, duration_hours: 300, difficulty: 'moderate', elevation_gain: 15000, altitude_max: 1450, start_lat: 43.1631, start_lng: -1.2358, end_lat: 42.8805, end_lng: -8.5459, is_loop: false, source: 'osm', geojson: null, description: 'Le chemin de Compostelle, pèlerinage mondial', surface: null },
  { id: 'f-t4', name: 'Tour des Écrins', trail_type: 'trek', country: 'France', region: 'Hautes-Alpes', distance_km: 160, duration_hours: 100, difficulty: 'hard', elevation_gain: 11000, altitude_max: 3000, start_lat: 44.9300, start_lng: 6.3500, end_lat: 44.9300, end_lng: 6.3500, is_loop: true, source: 'osm', geojson: null, description: 'Grande traversée du Parc National des Écrins', surface: null },
  { id: 'f-t5', name: 'Tour des Pyrénées (HRP)', trail_type: 'trek', country: 'France/Espagne', region: 'Pyrénées', distance_km: 800, duration_hours: 400, difficulty: 'expert', elevation_gain: 48000, altitude_max: 3404, start_lat: 43.3700, start_lng: -1.7800, end_lat: 42.4300, end_lng: 3.1600, is_loop: false, source: 'osm', geojson: null, description: 'La Haute Route des Pyrénées, traversée intégrale', surface: null },
  { id: 'f-t6', name: 'Annapurna Circuit', trail_type: 'trek', country: 'Népal', region: 'Himalaya', distance_km: 230, duration_hours: 200, difficulty: 'hard', elevation_gain: 16000, altitude_max: 5416, start_lat: 28.3500, start_lng: 84.1000, end_lat: 28.2000, end_lng: 83.9800, is_loop: false, source: 'osm', geojson: null, description: 'Tour classique autour du massif Annapurna', surface: null },
  { id: 'f-t7', name: 'Inca Trail – Machu Picchu', trail_type: 'trek', country: 'Pérou', region: 'Andes', distance_km: 43, duration_hours: 32, difficulty: 'hard', elevation_gain: 2400, altitude_max: 4215, start_lat: -13.5183, start_lng: -71.9784, end_lat: -13.1631, end_lng: -72.5450, is_loop: false, source: 'osm', geojson: null, description: 'Sentier inca vers le Machu Picchu', surface: null },
  { id: 'f-t8', name: 'Kilimanjaro – Route Machame', trail_type: 'trek', country: 'Tanzanie', region: 'Afrique de l\'Est', distance_km: 62, duration_hours: 48, difficulty: 'expert', elevation_gain: 4900, altitude_max: 5895, start_lat: -3.0674, start_lng: 37.3556, end_lat: -3.0674, end_lng: 37.3556, is_loop: true, source: 'osm', geojson: null, description: 'Ascension du toit de l\'Afrique par la route Machame', surface: null },
  { id: 'f-t9', name: 'Tour du Vercors', trail_type: 'hiking', country: 'France', region: 'Vercors', distance_km: 120, duration_hours: 60, difficulty: 'moderate', elevation_gain: 5500, altitude_max: 2341, start_lat: 45.0500, start_lng: 5.4500, end_lat: 45.0500, end_lng: 5.4500, is_loop: true, source: 'osm', geojson: null, description: 'Tour du plateau du Vercors', surface: null },
  { id: 'f-t10', name: 'GR10 – Pyrénées versant français', trail_type: 'trek', country: 'France', region: 'Pyrénées', distance_km: 866, duration_hours: 450, difficulty: 'hard', elevation_gain: 48000, altitude_max: 2734, start_lat: 43.3800, start_lng: -1.7800, end_lat: 42.5000, end_lng: 3.1600, is_loop: false, source: 'osm', geojson: null, description: 'Traversée des Pyrénées côté français', surface: null },
  { id: 'f-t11', name: 'Sentier des Douaniers – Bretagne', trail_type: 'hiking', country: 'France', region: 'Bretagne', distance_km: 2000, duration_hours: 600, difficulty: 'easy', elevation_gain: 8000, altitude_max: 330, start_lat: 48.6500, start_lng: -4.5000, end_lat: 47.3000, end_lng: -2.2000, is_loop: false, source: 'osm', geojson: null, description: 'Le GR34, sentier côtier de Bretagne', surface: null },
  { id: 'f-t12', name: 'Haute Route Chamonix-Zermatt', trail_type: 'trek', country: 'France/Suisse', region: 'Alpes', distance_km: 180, duration_hours: 120, difficulty: 'expert', elevation_gain: 12000, altitude_max: 3664, start_lat: 45.9237, start_lng: 6.8694, end_lat: 46.0207, end_lng: 7.7491, is_loop: false, source: 'osm', geojson: null, description: 'La haute route alpine entre Chamonix et Zermatt', surface: null },
  { id: 'f-t13', name: 'Everest Base Camp Trek', trail_type: 'trek', country: 'Népal', region: 'Himalaya', distance_km: 130, duration_hours: 130, difficulty: 'hard', elevation_gain: 8000, altitude_max: 5364, start_lat: 27.6878, start_lng: 86.7314, end_lat: 27.9881, end_lng: 86.9250, is_loop: false, source: 'osm', geojson: null, description: 'Trek vers le camp de base de l\'Everest', surface: null },
  { id: 'f-t14', name: 'Tour du Beaufortain', trail_type: 'hiking', country: 'France', region: 'Savoie', distance_km: 110, duration_hours: 55, difficulty: 'moderate', elevation_gain: 6500, altitude_max: 2800, start_lat: 45.7200, start_lng: 6.6800, end_lat: 45.7200, end_lng: 6.6800, is_loop: true, source: 'osm', geojson: null, description: 'Tour du massif du Beaufortain en Savoie', surface: null },
  { id: 'f-t15', name: 'W Trek – Torres del Paine', trail_type: 'trek', country: 'Chili', region: 'Patagonie', distance_km: 100, duration_hours: 80, difficulty: 'hard', elevation_gain: 4000, altitude_max: 1200, start_lat: -50.9423, start_lng: -73.4068, end_lat: -51.1000, end_lng: -73.0000, is_loop: false, source: 'osm', geojson: null, description: 'Le W Trek dans le Parc Torres del Paine', surface: null },
  { id: 'f-t16', name: 'Sentier des Crêtes – Vosges', trail_type: 'hiking', country: 'France', region: 'Alsace', distance_km: 170, duration_hours: 70, difficulty: 'easy', elevation_gain: 5000, altitude_max: 1424, start_lat: 47.9000, start_lng: 7.0500, end_lat: 47.3500, end_lng: 7.0000, is_loop: false, source: 'osm', geojson: null, description: 'Randonnée sur les crêtes des Vosges', surface: null },
  { id: 'f-t17', name: 'Tour de la Vanoise', trail_type: 'trek', country: 'France', region: 'Savoie', distance_km: 130, duration_hours: 80, difficulty: 'hard', elevation_gain: 8500, altitude_max: 3000, start_lat: 45.4200, start_lng: 6.6500, end_lat: 45.4200, end_lng: 6.6500, is_loop: true, source: 'osm', geojson: null, description: 'Tour du Parc National de la Vanoise', surface: null },
  { id: 'f-t18', name: 'Appalachian Trail (section NH)', trail_type: 'hiking', country: 'États-Unis', region: 'New Hampshire', distance_km: 450, duration_hours: 250, difficulty: 'hard', elevation_gain: 30000, altitude_max: 1917, start_lat: 44.2700, start_lng: -71.3000, end_lat: 45.3000, end_lng: -71.0000, is_loop: false, source: 'osm', geojson: null, description: 'Section New Hampshire de l\'Appalachian Trail', surface: null },
  { id: 'f-t19', name: 'Camino Portugués', trail_type: 'hiking', country: 'Portugal/Espagne', region: 'Galice', distance_km: 610, duration_hours: 200, difficulty: 'easy', elevation_gain: 8000, altitude_max: 700, start_lat: 38.7169, start_lng: -9.1399, end_lat: 42.8805, end_lng: -8.5459, is_loop: false, source: 'osm', geojson: null, description: 'Le Camino Portugués vers Saint-Jacques-de-Compostelle', surface: null },
  { id: 'f-t20', name: 'Tour du Mercantour', trail_type: 'trek', country: 'France', region: 'Alpes-Maritimes', distance_km: 200, duration_hours: 120, difficulty: 'hard', elevation_gain: 12000, altitude_max: 3143, start_lat: 44.1000, start_lng: 7.1000, end_lat: 44.1000, end_lng: 7.1000, is_loop: true, source: 'osm', geojson: null, description: 'Tour du Parc National du Mercantour', surface: null },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FALLBACK_POINTS: any[] = [
  { id: 'f-p1', category: 'summit', name: 'Mont Blanc', description: 'Plus haut sommet d\'Europe occidentale', lat: 45.8326, lng: 6.8652, altitude: 4808, country: 'France/Italie', region: 'Alpes', metadata: { massif: 'Mont-Blanc', prominence: 4695 } },
  { id: 'f-p2', category: 'summit', name: 'Barre des Écrins', description: 'Point culminant du Parc national des Écrins', lat: 44.9217, lng: 6.3567, altitude: 4102, country: 'France', region: 'Hautes-Alpes', metadata: { massif: 'Écrins', prominence: 2068 } },
  { id: 'f-p3', category: 'summit', name: 'Vignemale', description: 'Plus haut sommet français des Pyrénées', lat: 42.7733, lng: -0.1467, altitude: 3298, country: 'France/Espagne', region: 'Pyrénées', metadata: { massif: 'Pyrénées', prominence: 1468 } },
  { id: 'f-p4', category: 'summit', name: 'Mont Ventoux', description: 'Le Géant de Provence', lat: 44.1742, lng: 5.2786, altitude: 1912, country: 'France', region: 'Provence', metadata: { massif: 'Ventoux', prominence: 1622 } },
  { id: 'f-p5', category: 'summit', name: 'Pic du Midi de Bigorre', description: 'Observatoire astronomique d\'altitude', lat: 42.9369, lng: 0.1417, altitude: 2877, country: 'France', region: 'Pyrénées', metadata: { massif: 'Pyrénées', prominence: 1477 } },
  { id: 'f-p6', category: 'summit', name: 'Grand Ballon', description: 'Point culminant des Vosges', lat: 47.9022, lng: 7.0994, altitude: 1424, country: 'France', region: 'Alsace', metadata: { massif: 'Vosges', prominence: 1024 } },
  { id: 'f-p7', category: 'summit', name: 'Puy de Dôme', description: 'Volcan emblématique d\'Auvergne', lat: 45.7722, lng: 2.9650, altitude: 1465, country: 'France', region: 'Auvergne', metadata: { massif: 'Massif Central', prominence: 1165 } },
  { id: 'f-p8', category: 'summit', name: 'Kilimanjaro', description: 'Toit de l\'Afrique', lat: -3.0674, lng: 37.3556, altitude: 5895, country: 'Tanzanie', region: 'Afrique de l\'Est', metadata: { massif: 'Kilimanjaro', prominence: 5885 } },
  { id: 'f-p9', category: 'summit', name: 'Mont Cervin (Matterhorn)', description: 'Sommet emblématique des Alpes', lat: 45.9766, lng: 7.6586, altitude: 4478, country: 'Suisse/Italie', region: 'Alpes', metadata: { massif: 'Pennines', prominence: 1042 } },
  { id: 'f-p10', category: 'summit', name: 'Aiguille du Midi', description: 'Téléphérique le plus haut d\'Europe', lat: 45.8792, lng: 6.8872, altitude: 3842, country: 'France', region: 'Alpes', metadata: { massif: 'Mont-Blanc', prominence: 342 } },
  { id: 'f-p11', category: 'refuge', name: 'Refuge du Goûter', description: 'Refuge d\'altitude sur la voie normale du Mont Blanc', lat: 45.8444, lng: 6.8283, altitude: 3835, country: 'France', region: 'Alpes', metadata: { capacity: 120, is_staffed: true, price_per_night: 65, has_meals: true } },
  { id: 'f-p12', category: 'refuge', name: 'Refuge de la Charpoua', description: 'Refuge gardé dans le massif du Mont Blanc', lat: 45.9200, lng: 6.9700, altitude: 2841, country: 'France', region: 'Alpes', metadata: { capacity: 40, is_staffed: true, price_per_night: 55, has_meals: true } },
  { id: 'f-p13', category: 'refuge', name: 'Refuge des Oulettes de Gaube', description: 'Refuge au pied du Vignemale', lat: 42.8000, lng: -0.1200, altitude: 2151, country: 'France', region: 'Pyrénées', metadata: { capacity: 70, is_staffed: true, price_per_night: 50, has_meals: true } },
  { id: 'f-p14', category: 'refuge', name: 'Refuge du Promontoire', description: 'Refuge d\'altitude dans les Écrins', lat: 44.9300, lng: 6.3600, altitude: 3092, country: 'France', region: 'Hautes-Alpes', metadata: { capacity: 60, is_staffed: true, price_per_night: 58, has_meals: true } },
  { id: 'f-p15', category: 'refuge', name: 'Refuge de Vallonpierre', description: 'Refuge dans le Parc des Écrins', lat: 44.8700, lng: 6.2800, altitude: 2271, country: 'France', region: 'Hautes-Alpes', metadata: { capacity: 50, is_staffed: true, price_per_night: 52, has_meals: true } },
  { id: 'f-p16', category: 'refuge', name: 'Refuge de Bonne Pierre', description: 'Refuge dans le Vercors', lat: 44.9800, lng: 5.5200, altitude: 1657, country: 'France', region: 'Vercors', metadata: { capacity: 35, is_staffed: false, price_per_night: 20, has_meals: false } },
  { id: 'f-p17', category: 'refuge', name: 'Refuge de Pietra Piana', description: 'Refuge sur le GR20 en Corse', lat: 42.2800, lng: 9.1500, altitude: 1842, country: 'France', region: 'Corse', metadata: { capacity: 55, is_staffed: true, price_per_night: 48, has_meals: true } },
  { id: 'f-p18', category: 'water', name: 'Source de la Siagne', description: 'Source naturelle dans les Alpes-Maritimes', lat: 43.7200, lng: 6.8500, altitude: 1200, country: 'France', region: 'Alpes-Maritimes', metadata: { water_type: 'spring', is_potable: true, is_seasonal: false } },
  { id: 'f-p19', category: 'water', name: 'Fontaine du Col de la Croix de Fer', description: 'Point d\'eau au col', lat: 45.2300, lng: 6.2000, altitude: 2067, country: 'France', region: 'Savoie', metadata: { water_type: 'fountain', is_potable: true, is_seasonal: true } },
  { id: 'f-p20', category: 'water', name: 'Source du Gave de Pau', description: 'Source glaciaire dans les Pyrénées', lat: 42.8500, lng: -0.0500, altitude: 2800, country: 'France', region: 'Pyrénées', metadata: { water_type: 'spring', is_potable: true, is_seasonal: true } },
  { id: 'f-p21', category: 'water', name: 'Fontaine de Vaucluse', description: 'Résurgence la plus puissante de France', lat: 43.9200, lng: 5.1300, altitude: 85, country: 'France', region: 'Provence', metadata: { water_type: 'spring', is_potable: false, is_seasonal: false } },
  { id: 'f-p22', category: 'waterfall', name: 'Cascade du Cirque de Gavarnie', description: 'Plus haute cascade de France (423m)', lat: 42.7300, lng: -0.0100, altitude: 1700, country: 'France', region: 'Pyrénées', metadata: { height_m: 423 } },
  { id: 'f-p23', category: 'waterfall', name: 'Cascade de la Pissevache', description: 'Cascade spectaculaire en Valais', lat: 46.1000, lng: 7.0500, altitude: 800, country: 'Suisse', region: 'Valais', metadata: { height_m: 114 } },
  { id: 'f-p24', category: 'waterfall', name: 'Cascade du Saut du Doubs', description: 'Chute d\'eau entre France et Suisse', lat: 47.0500, lng: 6.8700, altitude: 500, country: 'France/Suisse', region: 'Franche-Comté', metadata: { height_m: 27 } },
  { id: 'f-p25', category: 'waterfall', name: 'Cascade de Skógafoss', description: 'Cascade islandaise emblématique', lat: 63.5320, lng: -19.5118, altitude: 60, country: 'Islande', region: 'Sud', metadata: { height_m: 60 } },
  { id: 'f-p26', category: 'col', name: 'Col du Galibier', description: 'Col mythique du Tour de France', lat: 45.0644, lng: 6.4078, altitude: 2642, country: 'France', region: 'Savoie/Hautes-Alpes', metadata: {} },
  { id: 'f-p27', category: 'col', name: 'Col de l\'Iseran', description: 'Plus haut col routier des Alpes', lat: 45.4167, lng: 7.0333, altitude: 2770, country: 'France', region: 'Savoie', metadata: {} },
  { id: 'f-p28', category: 'col', name: 'Col du Tourmalet', description: 'Col pyrénéen légendaire', lat: 42.9000, lng: 0.1500, altitude: 2115, country: 'France', region: 'Pyrénées', metadata: {} },
  { id: 'f-p29', category: 'col', name: 'Col de la Bonette', description: 'Route la plus haute d\'Europe', lat: 44.3200, lng: 6.8100, altitude: 2802, country: 'France', region: 'Alpes-Maritimes', metadata: {} },
  { id: 'f-p30', category: 'col', name: 'Thorong La Pass', description: 'Col de l\'Annapurna Circuit', lat: 28.7900, lng: 83.9300, altitude: 5416, country: 'Népal', region: 'Himalaya', metadata: {} },
  { id: 'f-p31', category: 'lake', name: 'Lac d\'Annecy', description: 'Lac le plus pur d\'Europe', lat: 45.8667, lng: 6.1667, altitude: 447, country: 'France', region: 'Haute-Savoie', metadata: {} },
  { id: 'f-p32', category: 'lake', name: 'Lac du Bourget', description: 'Plus grand lac naturel de France', lat: 45.7333, lng: 5.8667, altitude: 231, country: 'France', region: 'Savoie', metadata: {} },
  { id: 'f-p33', category: 'lake', name: 'Lac de Gaube', description: 'Lac glaciaire au pied du Vignemale', lat: 42.8200, lng: -0.1300, altitude: 1725, country: 'France', region: 'Pyrénées', metadata: {} },
  { id: 'f-p34', category: 'lake', name: 'Lac Blanc – Chamonix', description: 'Lac d\'altitude avec vue sur le Mont Blanc', lat: 45.9500, lng: 6.9300, altitude: 2352, country: 'France', region: 'Alpes', metadata: {} },
  { id: 'f-p35', category: 'lake', name: 'Lac de Sainte-Croix', description: 'Lac artificiel des Gorges du Verdon', lat: 43.7700, lng: 6.1500, altitude: 482, country: 'France', region: 'Provence', metadata: {} },
  { id: 'f-p36', category: 'viewpoint', name: 'Aiguille du Midi – Panorama', description: 'Vue à 360° sur les Alpes depuis 3842m', lat: 45.8792, lng: 6.8872, altitude: 3842, country: 'France', region: 'Alpes', metadata: {} },
  { id: 'f-p37', category: 'viewpoint', name: 'Belvédère du Cirque de Gavarnie', description: 'Vue sur le plus grand cirque glaciaire d\'Europe', lat: 42.7400, lng: -0.0200, altitude: 1650, country: 'France', region: 'Pyrénées', metadata: {} },
  { id: 'f-p38', category: 'viewpoint', name: 'Panorama du Puy de Dôme', description: 'Vue sur la chaîne des Puys', lat: 45.7722, lng: 2.9650, altitude: 1465, country: 'France', region: 'Auvergne', metadata: {} },
  { id: 'f-p39', category: 'viewpoint', name: 'Belvédère des Gorges du Verdon', description: 'Vue plongeante sur les gorges', lat: 43.7500, lng: 6.3500, altitude: 1200, country: 'France', region: 'Provence', metadata: {} },
  { id: 'f-p40', category: 'viewpoint', name: 'Pointe Helbronner – Mont Blanc', description: 'Vue sur le massif du Mont Blanc côté italien', lat: 45.8700, lng: 6.9900, altitude: 3462, country: 'Italie', region: 'Val d\'Aoste', metadata: {} },
  { id: 'f-p41', category: 'camping', name: 'Bivouac Col de la Vanoise', description: 'Zone de bivouac autorisée dans le parc', lat: 45.3800, lng: 6.7200, altitude: 2517, country: 'France', region: 'Savoie', metadata: {} },
  { id: 'f-p42', category: 'camping', name: 'Camping sauvage Lac de l\'Eychauda', description: 'Bivouac au bord du lac d\'altitude', lat: 44.9000, lng: 6.4500, altitude: 2514, country: 'France', region: 'Hautes-Alpes', metadata: {} },
  { id: 'f-p43', category: 'camping', name: 'Zone bivouac GR20 – Refuge de Ciottulu', description: 'Bivouac sur le GR20 en Corse', lat: 42.4200, lng: 8.9800, altitude: 1991, country: 'France', region: 'Corse', metadata: {} },
  { id: 'f-p44', category: 'spring', name: 'Source de l\'Ardèche', description: 'Naissance de la rivière Ardèche', lat: 44.8500, lng: 4.2000, altitude: 1467, country: 'France', region: 'Ardèche', metadata: { water_type: 'spring', is_potable: true } },
  { id: 'f-p45', category: 'spring', name: 'Source du Rhône – Glacier', description: 'Source du Rhône dans les Alpes suisses', lat: 46.5700, lng: 8.3500, altitude: 1760, country: 'Suisse', region: 'Valais', metadata: { water_type: 'glacier', is_potable: true } },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const minLat = parseFloat(searchParams.get('min_lat') || '0');
    const minLng = parseFloat(searchParams.get('min_lng') || '0');
    const maxLat = parseFloat(searchParams.get('max_lat') || '90');
    const maxLng = parseFloat(searchParams.get('max_lng') || '180');

    const difficulty = searchParams.get('difficulty');
    const trailType = searchParams.get('type');
    const country = searchParams.get('country');
    const region = searchParams.get('region');
    const search = searchParams.get('q');
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const limit = Math.min(parseInt(searchParams.get('limit') || '300'), 500);

    // Advanced filters
    const minDistance = parseFloat(searchParams.get('min_distance') || '0');
    const maxDistance = parseFloat(searchParams.get('max_distance') || '99999');
    const minDuration = parseFloat(searchParams.get('min_duration') || '0');
    const maxDuration = parseFloat(searchParams.get('max_duration') || '99999');
    const minElevation = parseInt(searchParams.get('min_elevation') || '0');
    const maxElevation = parseInt(searchParams.get('max_elevation') || '99999');

    const hasBbox = minLat !== 0 || minLng !== 0 || maxLat !== 90 || maxLng !== 180;

    // ── Try DB first ──────────────────────────────────────────
    let trailsQuery = supabase
      .from('trails')
      .select('id, name, trail_type, country, region, distance_km, duration_hours, difficulty, elevation_gain, altitude_max, start_lat, start_lng, end_lat, end_lng, is_loop, source, geojson, description, surface, metadata, gps_points_count')
      .limit(limit);

    if (hasBbox) {
      trailsQuery = trailsQuery.gte('start_lat', minLat).lte('start_lat', maxLat).gte('start_lng', minLng).lte('start_lng', maxLng);
    }
    if (difficulty) trailsQuery = trailsQuery.eq('difficulty', difficulty);
    if (trailType) trailsQuery = trailsQuery.eq('trail_type', trailType);
    if (country) trailsQuery = trailsQuery.ilike('country', `%${country}%`);
    if (region) trailsQuery = trailsQuery.ilike('region', `%${region}%`);
    if (search) trailsQuery = trailsQuery.ilike('name', `%${search}%`);
    if (minDistance > 0) trailsQuery = trailsQuery.gte('distance_km', minDistance);
    if (maxDistance < 99999) trailsQuery = trailsQuery.lte('distance_km', maxDistance);
    if (minElevation > 0) trailsQuery = trailsQuery.gte('elevation_gain', minElevation);
    if (maxElevation < 99999) trailsQuery = trailsQuery.lte('elevation_gain', maxElevation);

    let poisQuery = supabase
      .from('outdoor_points')
      .select('id, category, name, description, lat, lng, altitude, country, region, metadata')
      .limit(limit);

    if (hasBbox) {
      poisQuery = poisQuery.gte('lat', minLat).lte('lat', maxLat).gte('lng', minLng).lte('lng', maxLng);
    }
    if (categories.length > 0) poisQuery = poisQuery.in('category', categories);
    if (country) poisQuery = poisQuery.ilike('country', `%${country}%`);
    if (region) poisQuery = poisQuery.ilike('region', `%${region}%`);
    if (search) poisQuery = poisQuery.ilike('name', `%${search}%`);

    const [trailsRes, poisRes] = await Promise.all([trailsQuery, poisQuery]);

    const dbTrails = trailsRes.data || [];
    const dbPoints = poisRes.data || [];

    // Use fallback when DB is empty or has very few records
    let finalTrails = dbTrails;
    let finalPoints = dbPoints;

    if (dbTrails.length < 5) {
      let fb = FALLBACK_TRAILS;
      if (difficulty) fb = fb.filter(t => t.difficulty === difficulty);
      if (trailType) fb = fb.filter(t => t.trail_type === trailType);
      if (search) fb = fb.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
      if (region) fb = fb.filter(t => t.region.toLowerCase().includes(region.toLowerCase()));
      if (minDistance > 0) fb = fb.filter(t => t.distance_km >= minDistance);
      if (maxDistance < 99999) fb = fb.filter(t => t.distance_km <= maxDistance);
      if (minElevation > 0) fb = fb.filter(t => t.elevation_gain >= minElevation);
      if (maxElevation < 99999) fb = fb.filter(t => t.elevation_gain <= maxElevation);
      finalTrails = [...dbTrails, ...fb].slice(0, limit);
    } else {
      finalTrails = dbTrails.filter((t: Record<string, unknown>) => {
        const meta = t.metadata as Record<string, unknown> | null;
        return !meta?.is_private;
      });
    }

    if (dbPoints.length < 5) {
      let fb = FALLBACK_POINTS;
      if (categories.length > 0) fb = fb.filter(p => categories.includes(p.category));
      if (search) fb = fb.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
      if (region) fb = fb.filter(p => p.region.toLowerCase().includes(region.toLowerCase()));
      finalPoints = [...dbPoints, ...fb].slice(0, limit);
    }

    const difficultyLabels: Record<string, string> = {
      easy: 'Facile',
      moderate: 'Modéré',
      hard: 'Difficile',
      expert: 'Expert',
    };

    return NextResponse.json({
      trails: finalTrails,
      outdoor_points: finalPoints,
      meta: {
        trails_count: finalTrails.length,
        pois_count: finalPoints.length,
        source: dbTrails.length >= 5 ? 'database' : 'fallback+database',
        methodology: 'alltrails-osm-derivation',
        gps_valid_trails: finalTrails.filter((t: Record<string, unknown>) =>
          (t.gps_points_count as number) >= 10 || ((t.geojson as { coordinates?: unknown[] } | null)?.coordinates?.length ?? 0) >= 10
        ).length,
        difficulty_labels: difficultyLabels,
      },
    });

  } catch (_err) {
    return NextResponse.json({
      trails: FALLBACK_TRAILS,
      outdoor_points: FALLBACK_POINTS,
      meta: { trails_count: FALLBACK_TRAILS.length, pois_count: FALLBACK_POINTS.length, source: 'fallback' },
    });
  }
}
