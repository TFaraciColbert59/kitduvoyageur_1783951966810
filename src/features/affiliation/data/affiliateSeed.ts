import type { AffiliateCategory } from '../types/affiliate.types';

export interface AffiliateSeedLink {
  slug: string;
  partner_slug: 'booking' | 'aviasales' | 'getyourguide' | 'airalo' | 'chapka';
  category: AffiliateCategory;
  country_code: string;
  title: string;
  destination_name: string;
  target_url: string;
  tracking_params: Record<string, string>;
}

export const REAL_AFFILIATE_LINKS_SEED: AffiliateSeedLink[] = [
  // ==========================================
  // FRANCE (FR)
  // ==========================================
  {
    slug: 'booking-chamonix-alpes-hebergements',
    partner_slug: 'booking',
    category: 'hotel',
    country_code: 'FR',
    title: 'Hôtels, Chalets & Lodges à Chamonix-Mont-Blanc',
    destination_name: 'Chamonix-Mont-Blanc',
    target_url: 'https://www.booking.com/searchresults.fr.html?ss=Chamonix-Mont-Blanc',
    tracking_params: { aid: '800100', label: 'lkdv_trip_fr_chamonix' },
  },
  {
    slug: 'aviasales-vols-alpes-geneve-lyon',
    partner_slug: 'aviasales',
    category: 'flight',
    country_code: 'FR',
    title: 'Comparateur de Vols vers Genève / Lyon (Accès Alpes)',
    destination_name: 'Genève / Lyon',
    target_url: 'https://www.aviasales.com/search/PARGVA',
    tracking_params: { marker: '584920' },
  },
  {
    slug: 'getyourguide-activites-chamonix-mont-blanc',
    partner_slug: 'getyourguide',
    category: 'activity',
    country_code: 'FR',
    title: 'Sorties Alpinisme, Via Ferrata & Aiguille du Midi',
    destination_name: 'Chamonix-Mont-Blanc',
    target_url: 'https://www.getyourguide.com/chamonix-mont-blanc-l804/',
    tracking_params: { partner_id: 'LKDV2026' },
  },
  {
    slug: 'chapka-assurance-trek-alpes-france',
    partner_slug: 'chapka',
    category: 'insurance',
    country_code: 'FR',
    title: 'Assurance Secours en Montagne & Évacuation Hélicoptère (Cap Aventure)',
    destination_name: 'Alpes & Pyrénées',
    target_url: 'https://www.chapkassurances.com/contrat/cap-aventure/',
    tracking_params: { promo: 'LKDV' },
  },

  // ==========================================
  // NÉPAL (NP)
  // ==========================================
  {
    slug: 'booking-nepal-pokhara-kathmandu-lodges',
    partner_slug: 'booking',
    category: 'hotel',
    country_code: 'NP',
    title: 'Hôtels & Guest Houses à Katmandou et Pokhara',
    destination_name: 'Katmandou & Pokhara',
    target_url: 'https://www.booking.com/searchresults.fr.html?ss=Kathmandu',
    tracking_params: { aid: '800100', label: 'lkdv_trip_np_kathmandu' },
  },
  {
    slug: 'aviasales-vols-paris-kathmandu-nepal',
    partner_slug: 'aviasales',
    category: 'flight',
    country_code: 'NP',
    title: 'Vols Paris — Katmandou (Tribhuvan KTM)',
    destination_name: 'Katmandou (KTM)',
    target_url: 'https://www.aviasales.com/search/PARKTM',
    tracking_params: { marker: '584920' },
  },
  {
    slug: 'getyourguide-treks-annapurnas-everest-nepal',
    partner_slug: 'getyourguide',
    category: 'activity',
    country_code: 'NP',
    title: 'Permis, Guides Sherpas & Expéditions Annapurna / Everest',
    destination_name: 'Khumbu & Annapurna',
    target_url: 'https://www.getyourguide.com/kathmandu-l109/',
    tracking_params: { partner_id: 'LKDV2026' },
  },
  {
    slug: 'airalo-esim-nepal-data-himalaya',
    partner_slug: 'airalo',
    category: 'esim',
    country_code: 'NP',
    title: 'Forfait eSIM Népal Data Illimitée / Ncell',
    destination_name: 'Népal National',
    target_url: 'https://www.airalo.com/nepal-esim',
    tracking_params: { ref: 'LKDV' },
  },
  {
    slug: 'chapka-assurance-trek-haute-altitude-nepal',
    partner_slug: 'chapka',
    category: 'insurance',
    country_code: 'NP',
    title: 'Assurance Trek Haute Altitude > 5000 m (Évacuation Everest / Thorong La)',
    destination_name: 'Himalaya Népal',
    target_url: 'https://www.chapkassurances.com/contrat/cap-assistance-24-24/',
    tracking_params: { promo: 'LKDV' },
  },

  // ==========================================
  // PÉROU (PE)
  // ==========================================
  {
    slug: 'booking-cusco-vallee-sacree-perou',
    partner_slug: 'booking',
    category: 'hotel',
    country_code: 'PE',
    title: 'Lodges Andins & Hôtels Typiques à Cusco & Vallée Sacrée',
    destination_name: 'Cusco',
    target_url: 'https://www.booking.com/searchresults.fr.html?ss=Cusco',
    tracking_params: { aid: '800100', label: 'lkdv_trip_pe_cusco' },
  },
  {
    slug: 'aviasales-vols-paris-lima-perou',
    partner_slug: 'aviasales',
    category: 'flight',
    country_code: 'PE',
    title: 'Vols Aller-Retour Paris — Lima (Pérou)',
    destination_name: 'Lima (LIM)',
    target_url: 'https://www.aviasales.com/search/PARLIM',
    tracking_params: { marker: '584920' },
  },
  {
    slug: 'getyourguide-machu-picchu-train-vistadome',
    partner_slug: 'getyourguide',
    category: 'activity',
    country_code: 'PE',
    title: 'Billet Officiel Machu Picchu & Train Panoramique Vistadome',
    destination_name: 'Aguas Calientes',
    target_url: 'https://www.getyourguide.com/machu-picchu-l4215/',
    tracking_params: { partner_id: 'LKDV2026' },
  },
  {
    slug: 'airalo-esim-perou-claro-movistar',
    partner_slug: 'airalo',
    category: 'esim',
    country_code: 'PE',
    title: 'Forfait eSIM Pérou Data 4G (Réseau Claro / Movistar)',
    destination_name: 'Pérou',
    target_url: 'https://www.airalo.com/peru-esim',
    tracking_params: { ref: 'LKDV' },
  },

  // ==========================================
  // ISLANDE (IS)
  // ==========================================
  {
    slug: 'booking-islande-sud-vik-hella-chalets',
    partner_slug: 'booking',
    category: 'hotel',
    country_code: 'IS',
    title: 'Chalets & Gîtes Ruraux Sud Islande (Hella, Vík, Kirkjubæjarklaustur)',
    destination_name: 'Suðurland',
    target_url: 'https://www.booking.com/searchresults.fr.html?ss=Vik+Iceland',
    tracking_params: { aid: '800100', label: 'lkdv_trip_is_south' },
  },
  {
    slug: 'aviasales-vols-paris-reykjavik-keflavik',
    partner_slug: 'aviasales',
    category: 'flight',
    country_code: 'IS',
    title: 'Vols Directs Paris — Reykjavik (Keflavík KEF)',
    destination_name: 'Reykjavik (KEF)',
    target_url: 'https://www.aviasales.com/search/PARKEF',
    tracking_params: { marker: '584920' },
  },
  {
    slug: 'getyourguide-excursion-glacier-vatnajokull-islande',
    partner_slug: 'getyourguide',
    category: 'activity',
    country_code: 'IS',
    title: 'Randonnée Glaciaire Vatnajökull & Grotte de Glace Bleue',
    destination_name: 'Vatnajökull',
    target_url: 'https://www.getyourguide.com/reykjavik-l30/',
    tracking_params: { partner_id: 'LKDV2026' },
  },
  {
    slug: 'airalo-esim-islande-4g-siminn',
    partner_slug: 'airalo',
    category: 'esim',
    country_code: 'IS',
    title: 'eSIM Islande Data Haut Débit (Réseau Síminn)',
    destination_name: 'Islande',
    target_url: 'https://www.airalo.com/iceland-esim',
    tracking_params: { ref: 'LKDV' },
  },

  // ==========================================
  // MAROC (MA)
  // ==========================================
  {
    slug: 'booking-maroc-marrakech-imlil-riads',
    partner_slug: 'booking',
    category: 'hotel',
    country_code: 'MA',
    title: 'Riads Traditionnels à Marrakech & Gîtes Berbères à Imlil',
    destination_name: 'Marrakech & Imlil',
    target_url: 'https://www.booking.com/searchresults.fr.html?ss=Imlil',
    tracking_params: { aid: '800100', label: 'lkdv_trip_ma_imlil' },
  },
  {
    slug: 'aviasales-vols-paris-marrakech-menara',
    partner_slug: 'aviasales',
    category: 'flight',
    country_code: 'MA',
    title: 'Vols Paris — Marrakech Ménara (RAK)',
    destination_name: 'Marrakech (RAK)',
    target_url: 'https://www.aviasales.com/search/PARRAK',
    tracking_params: { marker: '584920' },
  },
  {
    slug: 'getyourguide-ascension-toubkal-guide-muletiers',
    partner_slug: 'getyourguide',
    category: 'activity',
    country_code: 'MA',
    title: 'Pack Ascension Jbel Toubkal 2 Jours avec Guide Certifié & Muletier',
    destination_name: 'Parc National du Toubkal',
    target_url: 'https://www.getyourguide.com/marrakech-l260/',
    tracking_params: { partner_id: 'LKDV2026' },
  },
  {
    slug: 'airalo-esim-maroc-inwi-maroc-telecom',
    partner_slug: 'airalo',
    category: 'esim',
    country_code: 'MA',
    title: 'Forfait eSIM Maroc Data 4G (Inwi / Maroc Telecom)',
    destination_name: 'Maroc',
    target_url: 'https://www.airalo.com/morocco-esim',
    tracking_params: { ref: 'LKDV' },
  },
];
