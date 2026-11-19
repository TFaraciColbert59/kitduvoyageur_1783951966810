import type { CockpitData, Coordinate } from './model';

const route: Coordinate[] = [
  [6.781, 44.759], [6.784, 44.761], [6.789, 44.76], [6.792, 44.763], [6.798, 44.764],
  [6.805, 44.767], [6.809, 44.772], [6.808, 44.779], [6.815, 44.784], [6.825, 44.785],
  [6.829, 44.792], [6.835, 44.791], [6.839, 44.784], [6.848, 44.784], [6.856, 44.779],
];

export const cockpitFixture: CockpitData = {
  key: 'recette-queyras',
  title: 'Tour du Queyras',
  location: 'Hautes-Alpes, France',
  today: 3,
  dayCount: 7,
  weather: {
    temperature: 13, condition: 'Partiellement nuageux', place: 'Saint-Véran', rain: '0,4 mm',
    days: [
      { date: '2026-09-20', day: 'Dim', low: 5, high: 16, condition: 'Partiellement nuageux' },
      { date: '2026-09-21', day: 'Lun', low: 4, high: 14, condition: 'Averses' },
      { date: '2026-09-22', day: 'Mar', low: 3, high: 17, condition: 'Dégagé' },
    ],
  },
  budget: {
    spent: [{ currency: 'EUR', amount: 184.5 }],
    planned: { currency: 'EUR', amount: 420 },
    expenses: [
      { id: 'd1', title: 'Nuit et dîner au refuge', amount: 72, currency: 'EUR' },
      { id: 'd2', title: 'Navette et ravitaillement', amount: 34.5, currency: 'EUR' },
      { id: 'd3', title: 'Hébergement du départ', amount: 78, currency: 'EUR' },
    ],
  },
  route: [route],
  distance: 14.6,
  elevation: 740,
  steps: [
    { id: 'e1', day: 3, title: 'Saint-Véran', time: '08:15', place: 'Départ du village', distance: null, elevation: null, coordinate: route[0], description: 'Faire le point sur le matériel et rejoindre le départ à pied.' },
    { id: 'e2', day: 3, title: 'Chapelle de Clausis', time: '10:40', place: 'Pause prévue', distance: 6.1, elevation: 350, coordinate: route[8], description: 'Pause et point d’étape avant le dernier tronçon.' },
    { id: 'e3', day: 3, title: 'Refuge de la Blanche', time: '14:10', place: 'Arrivée prévue', distance: 8.5, elevation: 390, coordinate: route[14], description: 'Terminer le parcours au refuge.' },
    { id: 'e4', day: 4, title: 'Col de Chamoussière', time: '09:00', place: 'Départ du lendemain', distance: null, elevation: null, coordinate: null, description: null },
  ],
  notes: [{ id: 'n1', title: 'Au départ de Saint-Véran', content: 'Premier café en équipe et sacs prêts pour le troisième jour.', day: 3 }],
  kit: [
    { id: 'k1', title: 'Veste imperméable', amount: 1, packed: true },
    { id: 'k2', title: 'Gourdes', amount: 2, packed: true },
    { id: 'k3', title: 'Trousse de secours', amount: 1, packed: true },
    { id: 'k4', title: 'Lampe frontale', amount: 1, packed: false },
  ],
  documents: [
    { id: 'o1', title: 'Réservation du refuge', category: 'booking', expiration: null },
    { id: 'o2', title: 'Billet de navette retour', category: 'ticket', expiration: null },
  ],
  people: [
    { id: 'p1', name: 'Camille', role: 'Responsable' },
    { id: 'p2', name: 'Alex', role: 'Participant' },
    { id: 'p3', name: 'Léna', role: 'Participant' },
    { id: 'p4', name: 'Malo', role: 'Participant' },
  ],
  peopleCount: 4,
  pending: 0,
  trip: true,
  collective: false,
};
