import { Country, ALL_COUNTRIES } from './countries';
import type { CountryGeo } from './supabase/types';

export interface CountryDetail {
  code: string;
  iso_a3?: string;
  nom: string;
  nom_en?: string;
  slogan: string;
  subtitle: string;
  subtitle_is_custom?: boolean;
  hero_image_url?: string;
  region: string;
  subregion?: string;
  saison_recommandee: string;
  latitude: string;
  longitude: string;
  fuseau: string;
  timezone?: string;
  continent: string;
  superficie_court: string;
  superficie_detail: string;
  population_court?: string;
  population_detail?: string;
  capitale: string;
  capitale_pop?: string;
  langue: string;
  langue_sub: string;
  languages?: string[];
  monnaie_code: string;
  monnaie_nom: string;
  monnaie?: string;
  taux_change: string;
  sources?: string;
  sources_list?: { url: string; label: string }[];
  presentation_titre: string;
  presentation_paragraphes: string[];
  citation_texte: string;
  citation_auteur: string;
  points_interet_carte: { nom: string; isCapital?: boolean; top: string; left: string }[];
  carte_echelle: string;
  carte_repere: string;
  highlights: { icon: string; titre: string; sous_titre: string; description: string }[];
  destinations: {
    isBig?: boolean;
    image_url: string;
    categorie: string;
    titre: string;
    titre_em: string;
    meta_1: string;
    meta_2: string;
    meta_3: string;
    slug?: string;
  }[];
  activites: {
    categorie: 'nature' | 'aqua' | 'rand' | 'cult';
    difficulte: 'Facile' | 'Modérée' | 'Difficile';
    difficulte_type: 'easy' | 'med' | 'hard';
    saison: string;
    image_url: string;
    tag: string;
    titre: string;
    titre_em: string;
    description: string;
    duree: string;
    prix: string;
  }[];
  culture: {
    citation: string;
    citation_em: string;
    citation_auteur: string;
    faits: { cle: string; valeur: string; valeur_em: string; description: string }[];
    fetes: { mois: string; nom?: string; isWarm?: boolean }[];
  };
  gastronomie: {
    numero: number;
    categorie: string;
    nom: string;
    nom_em: string;
    description: string;
    image_url: string;
  }[];
  pratique: {
    formalites: { cle: string; val: string; isMono?: boolean }[];
    transport: { cle: string; val: string; isMono?: boolean }[];
    budget: { cle: string; val: string; isMono?: boolean }[];
    sante: { cle: string; val: string; isMono?: boolean }[];
  };
  meteo?: {
    ville: string;
    temperature_actuelle: number;
    conditions: string;
    details: string;
    mois_temperatures: number[]; // 12 numbers for heights or temps
  };
  securite?: {
    niveau_label: string;
    niveau_score: number; // 1 to 5
    conseils: { titre: string; description: string }[];
  };
}

// ─── BASE DE DONNÉES ÉDITORIALE SUR-MESURE POUR LES PAYS PHARES ───────────

export const COUNTRY_DETAILS: Record<string, Partial<CountryDetail>> = {
  IS: {
    code: 'IS',
    nom: 'Islande',
    slogan: 'feu & glace',
    subtitle: 'Une île volcanique posée au bord de l’Arctique où la lumière glisse sans jamais s’éteindre. Glaciers millénaires, aurores et sources chaudes composent le plus improbable des terrains de jeu du Nord.',
    region: 'Cercle polaire · Europe du Nord',
    saison_recommandee: 'juin → août',
    latitude: '64°08′ N',
    longitude: '21°56′ O',
    fuseau: 'UTC ±00:00',
    continent: 'Europe',
    superficie_court: '103',
    superficie_detail: '103 000 km²',
    population_court: '376k',
    population_detail: '≈ 3,7 hab/km²',
    capitale: 'Reykjavík',
    capitale_pop: '≈ 140 000 hab',
    langue: 'Islandais',
    langue_sub: 'Anglais très répandu',
    monnaie_code: 'ISK',
    monnaie_nom: 'couronne',
    taux_change: '1 € ≈ 148 ISK',
    presentation_titre: 'Une île où la terre respire, encore.',
    presentation_paragraphes: [
      'Posée à la jonction des plaques nord-américaine et eurasienne, l’Islande est une géologie en mouvement — un archipel volcanique de 103 000 km² où trente systèmes actifs sculptent en direct des paysages qui ailleurs prendraient des millénaires. Les glaciers couvrent encore 11 % du territoire ; la vapeur des sources chaudes, elle, s’échappe partout.',
      'C’est un pays de contrastes exécutés à l’échelle : plages de sable noir léchées par l’Atlantique, champs de lave figés en champs verts par la mousse, lagons turquoise perdus entre les fjords. Ici, la Ring Road — 1 332 km d’asphalte parfait — enlace l’île comme une invitation à ne rien manquer.',
      'Trois heures de vol depuis Paris, deux fuseaux avec Montréal : l’Islande est le nord le plus accessible d’Europe. On y vient pour les aurores en hiver, la nuit blanche en été, et cette impression tenace, quel que soit le mois, d’habiter provisoirement une planète qui n’a pas fini de se former.',
    ],
    citation_texte: '« Il n’y a pas de forêts en Islande, mais chaque pierre est un arbre. »',
    citation_auteur: 'Halldór Laxness — Prix Nobel de littérature',
    points_interet_carte: [
      { nom: 'Reykjavík', isCapital: true, top: '71%', left: '32%' },
      { nom: 'Akureyri', top: '37%', left: '56%' },
      { nom: 'Vík', top: '80%', left: '47%' },
      { nom: 'Höfn', top: '73%', left: '72%' },
      { nom: 'Ísafjörður', top: '36%', left: '22%' },
    ],
    carte_echelle: '1 : 4 200 000',
    carte_repere: 'Carte administrative',
    highlights: [
      {
        icon: 'calendar',
        titre: 'Meilleure',
        sous_titre: 'saison',
        description: 'Juin → août pour la nuit blanche et les hauts plateaux accessibles. Novembre → février pour les aurores boréales et les glaciers illuminés.',
      },
      {
        icon: 'plane',
        titre: 'Vol',
        sous_titre: 'direct',
        description: 'Paris → Keflavík · 3 h 30. Vols quotidiens Icelandair, réguliers Play. Location de 4x4 recommandée dès qu’on quitte la Ring Road.',
      },
      {
        icon: 'compass',
        titre: 'Densité',
        sous_titre: 'de rêve',
        description: '3,7 habitants/km². Deux tiers de la population vivent dans la région de Reykjavík : l’essentiel de l’île est un désert habité par la géologie.',
      },
    ],
    destinations: [
      {
        isBig: true,
        image_url: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
        categorie: 'Site majeur · Sud',
        titre: 'Jökulsárlón',
        titre_em: 'glaciaire',
        meta_1: '64°04′ N',
        meta_2: '≈ 4 h de Reykjavík',
        meta_3: 'Été · Hiver',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?q=80&w=800&auto=format&fit=crop',
        categorie: 'Ville · Capitale',
        titre: 'Reykjavík',
        titre_em: '',
        meta_1: 'Point d’entrée',
        meta_2: 'Toute l’année',
        meta_3: 'Culture',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop',
        categorie: 'Nature · Nord',
        titre: 'Þingvellir',
        titre_em: '',
        meta_1: 'UNESCO',
        meta_2: 'Faille tectonique',
        meta_3: 'Histoire',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
        categorie: 'Fjords · Ouest',
        titre: 'Westfjords',
        titre_em: '',
        meta_1: 'Sauvage',
        meta_2: 'Été uniquement',
        meta_3: 'Falaises',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop',
        categorie: 'Bain · Péninsule',
        titre: 'Blue',
        titre_em: 'Lagoon',
        meta_1: 'Thermal',
        meta_2: 'Toute l’année',
        meta_3: 'Détente',
      },
    ],
    activites: [
      {
        categorie: 'nature',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Nov → Fév',
        image_url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=800&auto=format&fit=crop',
        tag: 'Nature — Nuit',
        titre: 'Chasse aux',
        titre_em: 'aurores',
        description: 'Guide météo + prévision KP en direct. Départ Reykjavík à la tombée du jour, retour vers 2 h du matin.',
        duree: '4-6 h',
        prix: '€89',
      },
      {
        categorie: 'rand',
        difficulte: 'Modérée',
        difficulte_type: 'med',
        saison: 'Mai → Sep',
        image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop',
        tag: 'Randonnée — Sud',
        titre: 'Trek du',
        titre_em: 'Laugavegur',
        description: '55 km de vallées volcaniques, sources chaudes et déserts noirs. Refuges FI, portage léger, 4 jours.',
        duree: '4 jours',
        prix: '€620',
      },
      {
        categorie: 'aqua',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: "Toute l'année",
        image_url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=800&auto=format&fit=crop',
        tag: 'Bain — Bienêtre',
        titre: 'Sources',
        titre_em: 'chaudes',
        description: 'Circuit privé en 4x4 vers trois hverir naturels loin des foules. Guide local, boissons chaudes fournies.',
        duree: '1 jour',
        prix: '€145',
      },
      {
        categorie: 'nature',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Sep → Avr',
        image_url: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?q=80&w=800&auto=format&fit=crop',
        tag: 'Glace — Vatnajökull',
        titre: 'Randonnée sur',
        titre_em: 'glacier',
        description: 'Encordé, crampons, piolet. Traversée d’une langue glaciaire et descente dans une grotte de glace.',
        duree: '6 h',
        prix: '€199',
      },
      {
        categorie: 'aqua',
        difficulte: 'Modérée',
        difficulte_type: 'med',
        saison: 'Mai → Sep',
        image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop',
        tag: 'Mer — Húsavík',
        titre: 'Observation',
        titre_em: 'des baleines',
        description: 'La capitale mondiale du whale-watching. Petits groupes, bateau silencieux, biologiste à bord.',
        duree: '3 h',
        prix: '€75',
      },
      {
        categorie: 'cult',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: "Toute l'année",
        image_url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?q=80&w=800&auto=format&fit=crop',
        tag: 'Culture — Reykjavík',
        titre: 'Sagas &',
        titre_em: 'street-art',
        description: 'Deux siècles de récits nordiques racontés dans les ruelles peintes de la capitale. Guide bilingue.',
        duree: '2 h',
        prix: '€35',
      },
    ],
    culture: {
      citation: 'Le mot Þjóð — le peuple — se dit ici en une syllabe qui contient à la fois le paysage, la langue, et l’idée qu’on partage un même destin volcanique.',
      citation_em: 'Þjóð',
      citation_auteur: 'Auður Ava Ólafsdóttir · Écrivaine',
      faits: [
        { cle: 'Langue', valeur: 'Islandais', valeur_em: '· á · ð · þ', description: 'Peu changé depuis l’époque des Vikings — un Islandais lit les sagas du XIIᵉ siècle dans le texte.' },
        { cle: 'Croyance', valeur: '54%', valeur_em: 'croient', description: 'Aux Huldufólk, le peuple caché des elfes. Les routes contournent parfois leurs rochers.' },
        { cle: 'Musique', valeur: 'Björk', valeur_em: '· Sigur Rós', description: 'Une scène musicale exportée sans commune mesure avec la taille du pays.' },
        { cle: 'Politique', valeur: '930', valeur_em: 'apr. J-C.', description: 'Fondation de l’Alþingi, plus ancien parlement au monde encore en activité.' },
      ],
      fetes: [
        { mois: 'Jan' },
        { mois: 'Fév', nom: 'Þorrablót', isWarm: true },
        { mois: 'Mar' },
        { mois: 'Avr' },
        { mois: 'Mai' },
        { mois: 'Jui', nom: 'Fête nat.' },
        { mois: 'Jul', nom: 'Nuit blanche' },
        { mois: 'Aoû' },
        { mois: 'Sep' },
        { mois: 'Oct' },
        { mois: 'Nov', nom: 'Airwaves', isWarm: true },
        { mois: 'Déc', nom: 'Aurores' },
      ],
    },
    gastronomie: [
      {
        numero: 1,
        categorie: 'Poisson',
        nom: 'Plokk',
        nom_em: 'fiskur',
        description: 'Cabillaud effeuillé, pommes de terre, béchamel, pain de seigle noir. Le confort ultime.',
        image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 2,
        categorie: 'Agneau',
        nom: 'Kjöt',
        nom_em: 'súpa',
        description: 'Soupe d’agneau aux racines et à l’angélique. Servie brûlante après une journée dehors.',
        image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 3,
        categorie: 'Fermenté',
        nom: 'Skyr',
        nom_em: '',
        description: 'Produit laitier millénaire, entre yaourt et fromage frais. Nature ou aux baies sauvages.',
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 4,
        categorie: 'Rue',
        nom: 'Pylsur',
        nom_em: '',
        description: 'Le hot-dog islandais, agneau et bœuf, avec deux moutardes et oignons crispy. Culte.',
        image_url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?q=80&w=600&auto=format&fit=crop',
      },
    ],
    pratique: {
      formalites: [
        { cle: 'Espace Schengen', val: 'Oui' },
        { cle: 'Visa UE', val: 'Non requis' },
        { cle: 'Passeport valide', val: '3 mois après retour' },
        { cle: 'Séjour max', val: '90 j / 180 j', isMono: true },
      ],
      transport: [
        { cle: 'Vol Paris → KEF', val: '3 h 30', isMono: true },
        { cle: 'Location 4x4', val: 'Recommandée' },
        { cle: 'Ring Road', val: '1 332 km', isMono: true },
        { cle: 'Bus interurbains', val: 'Straeto — été' },
      ],
      budget: [
        { cle: 'Café espresso', val: '≈ 4,50 €', isMono: true },
        { cle: 'Repas moyen', val: '28 – 40 €', isMono: true },
        { cle: 'Hôtel 3★ / nuit', val: '180 – 260 €', isMono: true },
        { cle: 'Journée / pers.', val: '≈ 220 €', isMono: true },
      ],
      sante: [
        { cle: 'Carte européenne', val: 'CEAM valide' },
        { cle: 'Vaccins requis', val: 'Aucun' },
        { cle: 'Eau du robinet', val: 'Excellente' },
        { cle: 'Urgences', val: '112', isMono: true },
      ],
    },
    meteo: {
      ville: 'Reykjavík',
      temperature_actuelle: 11,
      conditions: 'Nuageux, vent d’ouest 22 km/h',
      details: 'précipitations 40 % · UV 3',
      mois_temperatures: [22, 20, 24, 28, 32, 36, 38, 36, 30, 26, 22, 20],
    },
    securite: {
      niveau_label: 'Très sûr',
      niveau_score: 5,
      conseils: [
        { titre: 'Vents extrêmes.', description: 'Vérifier vedur.is avant chaque déplacement, ne jamais forcer une portière en tempête.' },
        { titre: 'Routes F (hautes terres).', description: '4x4 obligatoire, ouvertes de fin juin à mi-septembre seulement.' },
        { titre: 'Activité sismique.', description: 'App Safetravel installée, itinéraire déposé à l’auberge de départ.' },
      ],
    },
  },
  JP: {
    code: 'JP',
    nom: 'Japon',
    slogan: 'tradition & cimes',
    subtitle: 'Des sanctuaires millénaires de Kyoto aux sommets volcaniques des Alpes japonaises. Une immersion unique où la rigueur du geste rencontre la splendeur sauvage.',
    region: 'Asie de l’Est · Archipel volcanique',
    saison_recommandee: 'mars → mai & oct → nov',
    latitude: '35°41′ N',
    longitude: '139°41′ E',
    fuseau: 'UTC +09:00',
    continent: 'Asie',
    superficie_court: '377',
    superficie_detail: '377 975 km²',
    population_court: '125M',
    population_detail: '≈ 334 hab/km²',
    capitale: 'Tokyo',
    capitale_pop: '≈ 14M hab',
    langue: 'Japonais',
    langue_sub: 'Anglais dans les gares',
    monnaie_code: 'JPY',
    monnaie_nom: 'yen',
    taux_change: '1 € ≈ 163 JPY',
    presentation_titre: 'Entre forêts de cèdres et sentiers sacrés.',
    presentation_paragraphes: [
      'Le Japon ne se résume pas à ses mégapoles futuristes. Hors des métropoles s’étend un royaume de sommets escarpés, de forêts primaires de cèdres et de pèlerinages historiques foulés depuis plus d’un millénaire.',
      'Le sentier Kumano Kodō, inscrit à l’UNESCO, et les Alpes de Nagano offrent des treks de classe mondiale, jalonnés de ryokans traditionnels où l’on dîne en yukata après un bain thermal bouillant.',
      'La gastronomie locale, le respect absolu de la nature (Shinto) et la ponctualité exemplaire des trains (Shinkansen) font du Japon l’un des territoires d’aventure les plus fascinants et sereins de la planète.',
    ],
    citation_texte: '« Le voyageur qui ne sait pas s’arrêter ne verra jamais la fleur du cerisier. »',
    citation_auteur: 'Bashō — Maître du Haïku',
    points_interet_carte: [
      { nom: 'Tokyo', isCapital: true, top: '60%', left: '75%' },
      { nom: 'Kyoto', top: '65%', left: '55%' },
      { nom: 'Osaka', top: '68%', left: '52%' },
      { nom: 'Sapporo', top: '25%', left: '80%' },
      { nom: 'Fukuoka', top: '75%', left: '30%' },
    ],
    carte_echelle: '1 : 5 500 000',
    carte_repere: 'Carte des préfectures',
    highlights: [
      {
        icon: 'calendar',
        titre: 'Meilleure',
        sous_titre: 'saison',
        description: 'Avril pour les cerisiers en fleurs (Sakura), Octobre-Novembre pour les érables flamboyants (Kōyō).',
      },
      {
        icon: 'plane',
        titre: 'Vol',
        sous_titre: 'direct',
        description: 'Paris → Tokyo Haneda · 13 h 40. Vols réguliers Air France et ANA. Pass JR pour les liaisons train.',
      },
      {
        icon: 'compass',
        titre: 'Relief',
        sous_titre: 'montagneux',
        description: '73 % du pays est montagneux, idéal pour la randonnée estivale et le ski de poudreuse en hiver à Hokkaido.',
      },
    ],
    destinations: [
      {
        isBig: true,
        image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
        categorie: 'Pèlerinage · Kii',
        titre: 'Kumano',
        titre_em: 'Kodō',
        meta_1: '33°43′ N',
        meta_2: '3 h d’Osaka',
        meta_3: 'Printemps · Automne',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
        categorie: 'Capitale · Métropole',
        titre: 'Tokyo',
        titre_em: '',
        meta_1: 'Hub mondial',
        meta_2: 'Toute l’année',
        meta_3: 'High-Tech',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?q=80&w=800&auto=format&fit=crop',
        categorie: 'Histoire · Temples',
        titre: 'Kyoto',
        titre_em: '',
        meta_1: 'UNESCO',
        meta_2: '2000 temples',
        meta_3: 'Tradition',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
        categorie: 'Volcan · Symbole',
        titre: 'Mont',
        titre_em: 'Fuji',
        meta_1: '3 776 m',
        meta_2: 'Juillet → Août',
        meta_3: 'Lever de soleil',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=800&auto=format&fit=crop',
        categorie: 'Poudreuse · Neige',
        titre: 'Hokkaido',
        titre_em: '',
        meta_1: 'Nord',
        meta_2: 'Hiver',
        meta_3: 'Grands espaces',
      },
    ],
    activites: [
      {
        categorie: 'rand',
        difficulte: 'Modérée',
        difficulte_type: 'med',
        saison: 'Avr → Nov',
        image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop',
        tag: 'Trek — Pèlerinage',
        titre: 'Traversée du',
        titre_em: 'Nakahechi',
        description: '70 km sur les pas des empereurs. Ryokans, forêts sacrées et chutes de Nachi.',
        duree: '5 jours',
        prix: '€580',
      },
      {
        categorie: 'nature',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Juil → Août',
        image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
        tag: 'Sommet — Volcan',
        titre: 'Ascension du',
        titre_em: 'Mont Fuji',
        description: 'Montée de nuit pour assister au Goraiko (lever de soleil) au sommet du volcan sacré.',
        duree: '2 jours',
        prix: '€210',
      },
      {
        categorie: 'aqua',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: "Toute l'année",
        image_url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=800&auto=format&fit=crop',
        tag: 'Thermes — Onsen',
        titre: 'Bains thermaux de',
        titre_em: 'Hakone',
        description: 'Bains chauds volcaniques en plein air face aux panoramas du mont Fuji.',
        duree: '1 jour',
        prix: '€65',
      },
      {
        categorie: 'cult',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: "Toute l'année",
        image_url: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?q=80&w=800&auto=format&fit=crop',
        tag: 'Culture — Cérémonie',
        titre: 'Art du thé à',
        titre_em: 'Kyoto',
        description: 'Cérémonie ancestrale du matcha dans un pavillon traditionnel zen.',
        duree: '2 h',
        prix: '€45',
      },
    ],
    culture: {
      citation: 'L’harmonie (Wa), le respect (Kei), la pureté (Sei) et la tranquillité (Jaku) forment le cœur battant de la pensée nippone.',
      citation_em: 'Wa',
      citation_auteur: 'Sen no Rikyū · Maître de thé',
      faits: [
        { cle: 'Spiritualité', valeur: 'Shinto', valeur_em: '& Bouddhisme', description: 'Culte des esprits de la nature (Kami) présent dans chaque arbre et cascade.' },
        { cle: 'Hospitalité', valeur: 'Omotenashi', valeur_em: '', description: 'L’art du service dévoué et sans attente en retour, poussé à son paroxysme.' },
        { cle: 'Artisans', valeur: 'Takumi', valeur_em: '', description: 'Des maîtres artisans qui consacrent 50 ans à polir une lame ou tisser la soie.' },
        { cle: 'Nature', valeur: 'Shinrin-yoku', valeur_em: '', description: 'La pratique médicale reconnue des bains de forêt bienfaisants.' },
      ],
      fetes: [
        { mois: 'Jan', nom: 'Shogatsu' },
        { mois: 'Fév', nom: 'Setsubun' },
        { mois: 'Mar', nom: 'Hina' },
        { mois: 'Avr', nom: 'Hanami', isWarm: true },
        { mois: 'Mai', nom: 'Golden W.' },
        { mois: 'Jui', nom: 'Matsuri' },
        { mois: 'Jul', nom: 'Gion' },
        { mois: 'Aoû', nom: 'Obon', isWarm: true },
        { mois: 'Sep', nom: 'Tsukimi' },
        { mois: 'Oct', nom: 'Jidai' },
        { mois: 'Nov', nom: 'Kōyō' },
        { mois: 'Déc', nom: 'Omisoka' },
      ],
    },
    gastronomie: [
      {
        numero: 1,
        categorie: 'Tradition',
        nom: 'Kaiseki',
        nom_em: 'Ryōri',
        description: 'Haute gastronomie saisonnière servie en multiples plats raffinés dans les ryokans.',
        image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 2,
        categorie: 'Nouilles',
        nom: 'Ramen',
        nom_em: 'Artisanal',
        description: 'Bouillon mijoté 18 heures, nouilles fraîches fermes, tranche de chashu et œuf mariné.',
        image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 3,
        categorie: 'Mer',
        nom: 'Sashimi',
        nom_em: 'Frais',
        description: 'Thon rouge, saumon et daurade découpés au millimètre à la criée du matin.',
        image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 4,
        categorie: 'Rue',
        nom: 'Takoyaki',
        nom_em: '',
        description: 'Bouchées croustillantes fourrées au poulpe, sauce umami et bonite séchée dansante.',
        image_url: 'https://images.unsplash.com/photo-1526318897999-73d8c1157e93?q=80&w=600&auto=format&fit=crop',
      },
    ],
    pratique: {
      formalites: [
        { cle: 'Exemption de visa', val: 'Oui (< 90 j)' },
        { cle: 'Passeport valide', val: 'Validité du séjour' },
        { cle: 'Formulaire Visit Japan', val: 'En ligne (QR Code)' },
        { cle: 'Séjour max', val: '90 jours', isMono: true },
      ],
      transport: [
        { cle: 'Vol Paris → Tokyo', val: '13 h 40', isMono: true },
        { cle: 'Train Shinkansen', val: 'JR Pass / Suica' },
        { cle: 'Réseau ferroviaire', val: 'Inégalé mondialement' },
        { cle: 'Conduite', val: 'À gauche (permis trad.)' },
      ],
      budget: [
        { cle: 'Bol de ramen', val: '≈ 6 – 9 €', isMono: true },
        { cle: 'Repas moyen izakaya', val: '20 – 35 €', isMono: true },
        { cle: 'Hôtel / Ryokan nuit', val: '90 – 250 €', isMono: true },
        { cle: 'Journée / pers.', val: '≈ 140 €', isMono: true },
      ],
      sante: [
        { cle: 'Assurance voyage', val: 'Indispensable' },
        { cle: 'Vaccins requis', val: 'Aucun' },
        { cle: 'Eau du robinet', val: '100% potable' },
        { cle: 'Urgences', val: '119 / 110', isMono: true },
      ],
    },
    meteo: {
      ville: 'Tokyo',
      temperature_actuelle: 21,
      conditions: 'Ensoleillé, brise légère',
      details: 'précipitations 10 % · UV 5',
      mois_temperatures: [18, 20, 26, 32, 36, 40, 44, 46, 38, 30, 24, 19],
    },
    securite: {
      niveau_label: 'Très sûr',
      niveau_score: 5,
      conseils: [
        { titre: 'Sécurité publique absolue.', description: 'L’un des pays les plus sûrs au monde, criminalité quasi-nulle même la nuit.' },
        { titre: 'Risque sismique.', description: 'Bâtiments aux normes antisismiques de pointe, suivre les consignes en cas d’alerte.' },
        { titre: 'Règles de savoir-vivre.', description: 'Ne pas manger en marchant, trier rigoureusement ses déchets, silence dans les trains.' },
      ],
    },
  },
  FR: {
    code: 'FR',
    nom: 'France',
    slogan: 'massifs & terroirs',
    subtitle: 'Des crêtes acérées du Mont-Blanc aux calanques turquoise de Méditerranée. Un concentré mondial de sentiers mythiques, de gastronomie et de patrimoine.',
    hero_image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop',
    region: 'Europe de l’Ouest · Alpes & Terroirs',
    saison_recommandee: 'mai → octobre',
    latitude: '46°36′ N',
    longitude: '02°20′ E',
    fuseau: 'UTC +01:00',
    continent: 'Europe',
    superficie_court: '551',
    superficie_detail: '551 695 km²',
    population_court: '68M',
    population_detail: '≈ 106 hab/km²',
    capitale: 'Paris',
    capitale_pop: '≈ 2.1M hab',
    langue: 'Français',
    langue_sub: 'Anglais en zone touristique',
    monnaie_code: 'EUR',
    monnaie_nom: 'euro',
    taux_change: 'Devise locale',
    presentation_titre: 'La diversité des reliefs à portée de sentier.',
    presentation_paragraphes: [
      'Plus de 180 000 kilomètres de sentiers balisés (GR®, GRP®) sillonnent l’hexagone, reliant les sommets alpins aux falaises de Bretagne et aux causses du Massif Central.',
      'Chaque massif possède son identité forgée par le terroir, les bergers et les refuges gardés où l’on partage une fondue ou une potée après 8 heures de marche.',
      'Le Tour du Mont-Blanc, le GR20 corse ou la traversée des Pyrénées forment le graal de tout randonneur d’aventure.',
    ],
    citation_texte: '« Marcher, c’est retrouver le rythme naturel du corps et l’immensité du regard. »',
    citation_auteur: 'Sylvain Tesson — Écrivain voyageur',
    points_interet_carte: [
      { nom: 'Paris', isCapital: true, top: '35%', left: '48%' },
      { nom: 'Chamonix', top: '60%', left: '78%' },
      { nom: 'Marseille', top: '85%', left: '65%' },
      { nom: 'Bordeaux', top: '70%', left: '30%' },
      { nom: 'Ajaccio', top: '92%', left: '88%' },
    ],
    carte_echelle: '1 : 3 500 000',
    carte_repere: 'Carte des massifs',
    highlights: [
      {
        icon: 'calendar',
        titre: 'Meilleure',
        sous_titre: 'saison',
        description: 'Juin à Septembre pour les refuges d’altitude et la haute montagne. Mai-Juin & Sept-Oct pour le Sud et la Corse.',
      },
      {
        icon: 'plane',
        titre: 'Accès',
        sous_titre: 'direct',
        description: 'TGV haute vitesse reliant Paris aux Alpes, Pyrénées et Méditerranée en 2 à 4 heures.',
      },
      {
        icon: 'compass',
        titre: 'Réseau',
        sous_titre: 'GR®',
        description: '180 000 km de sentiers balisés par la FFRandonnée et un réseau dense de refuges gardés.',
      },
    ],
    destinations: [
      {
        isBig: true,
        image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop',
        categorie: 'Haute Montagne · Alpes',
        titre: 'Massif du',
        titre_em: 'Mont-Blanc',
        meta_1: '4 807 m',
        meta_2: 'Chamonix',
        meta_3: 'TMB Mythique',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=800&auto=format&fit=crop',
        categorie: 'Sauvage · Corse',
        titre: 'GR20',
        titre_em: 'Corse',
        meta_1: '180 km',
        meta_2: '16 étapes',
        meta_3: 'Arêtes rocheuses',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop',
        categorie: 'Capitale · Lumière',
        titre: 'Paris',
        titre_em: '',
        meta_1: 'Culture',
        meta_2: 'Patrimoine',
        meta_3: 'Musées',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=800&auto=format&fit=crop',
        categorie: 'Méditerranée · Mer',
        titre: 'Calanques',
        titre_em: '',
        meta_1: 'Cassis',
        meta_2: 'Falaises blanches',
        meta_3: 'Mer turquoise',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1549144511-f099e773c147?q=80&w=800&auto=format&fit=crop',
        categorie: 'Pyrénées · Frontière',
        titre: 'Gavarnie',
        titre_em: '',
        meta_1: 'Cirque UNESCO',
        meta_2: 'Cascade 422m',
        meta_3: 'Randonnée',
      },
    ],
    activites: [
      {
        categorie: 'rand',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Juin → Sep',
        image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800&auto=format&fit=crop',
        tag: 'Trek — International',
        titre: 'Tour du',
        titre_em: 'Mont-Blanc',
        description: '170 km autour du toit de l’Europe traversant France, Italie et Suisse.',
        duree: '9 jours',
        prix: '€890',
      },
      {
        categorie: 'rand',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Juin → Oct',
        image_url: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=800&auto=format&fit=crop',
        tag: 'Trek — Légende',
        titre: 'Intégrale du',
        titre_em: 'GR20',
        description: 'Le sentier de grande randonnée le plus technique et spectaculaire d’Europe.',
        duree: '14 jours',
        prix: '€1150',
      },
      {
        categorie: 'aqua',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: 'Avr → Oct',
        image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=800&auto=format&fit=crop',
        tag: 'Kayak — Calanques',
        titre: 'Kayak de mer à',
        titre_em: 'En-Vau',
        description: 'Navigation entre les failles calcaires vertigineuses et baignade dans les eaux cristallines.',
        duree: '1 jour',
        prix: '€65',
      },
    ],
    culture: {
      citation: 'En France, la gastronomie n’est pas seulement un repas, c’est un patrimoine immatériel inscrit dans le temps et le partage.',
      citation_em: 'patrimoine',
      citation_auteur: 'UNESCO · Comité du patrimoine mondial',
      faits: [
        { cle: 'Terroirs', valeur: '1 200+', valeur_em: 'fromages', description: 'Une diversité de spécialités AOP ancrée dans chaque vallée et haut plateau.' },
        { cle: 'Patrimoine', valeur: '52 sites', valeur_em: 'UNESCO', description: 'Châteaux de la Loire, abbayes romanes et citadelles Vauban préservées.' },
        { cle: 'Montagne', valeur: 'Refuges', valeur_em: 'FFCAM', description: 'Une tradition d’accueil montagnard chaleureux et de gardiens passionnés.' },
        { cle: 'Artisanat', valeur: 'Savoir-faire', valeur_em: '', description: 'Coutellerie de Laguiole, lainages des Pyrénées et poteries provençales.' },
      ],
      fetes: [
        { mois: 'Jan' },
        { mois: 'Fév', nom: 'Carnaval' },
        { mois: 'Mar' },
        { mois: 'Avr' },
        { mois: 'Mai', nom: 'Cannes' },
        { mois: 'Jui', nom: 'Fête Musique', isWarm: true },
        { mois: 'Jul', nom: '14 Juillet', isWarm: true },
        { mois: 'Aoû', nom: 'Festivals' },
        { mois: 'Sep', nom: 'Patrimoine' },
        { mois: 'Oct', nom: 'Vendanges' },
        { mois: 'Nov' },
        { mois: 'Déc', nom: 'Lumières' },
      ],
    },
    gastronomie: [
      {
        numero: 1,
        categorie: 'Montagne',
        nom: 'Fondue',
        nom_em: 'Savoyarde',
        description: 'Beaufort, Comté et Abondance fondus au vin blanc sec de Savoie avec pain de campagne.',
        image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 2,
        categorie: 'Sud',
        nom: 'Bouilla',
        nom_em: 'baisse',
        description: 'Soupe de poissons de roche marseillaise avec rouille dorée et croûtons aillés.',
        image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 3,
        categorie: 'Plateau',
        nom: 'Aligot',
        nom_em: 'de l’Aubrac',
        description: 'Purée de pommes de terre étirée à la tome fraîche au fil des burons de l’Aubrac.',
        image_url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?q=80&w=600&auto=format&fit=crop',
      },
      {
        numero: 4,
        categorie: 'Douceur',
        nom: 'Tarte',
        nom_em: 'aux myrtilles',
        description: 'Pâte sablée craquante garnie de brimbelles sauvages récoltées en crête.',
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
      },
    ],
    pratique: {
      formalites: [
        { cle: 'Espace Schengen', val: 'Membre UE' },
        { cle: 'Carte d’identité / Pass', val: 'Valide pour citoyens UE' },
        { cle: 'Permis de conduire', val: 'Valide en France' },
        { cle: 'Monnaie', val: 'Euro (€)', isMono: true },
      ],
      transport: [
        { cle: 'Réseau TGV', val: 'Rapide & Bas carbone' },
        { cle: 'Location voiture', val: 'Facile en gare/aéroport' },
        { cle: 'Navettes de vallée', val: 'Actives en saison été' },
        { cle: 'Numéro d’urgence', val: '112 / 15', isMono: true },
      ],
      budget: [
        { cle: 'Café en terrasse', val: '≈ 2,50 – 3,50 €', isMono: true },
        { cle: 'Menu du jour', val: '16 – 24 €', isMono: true },
        { cle: 'Nuit en refuge demi-pension', val: '50 – 70 €', isMono: true },
        { cle: 'Journée moyenne', val: '≈ 95 €', isMono: true },
      ],
      sante: [
        { cle: 'Secours en montagne', val: 'PGHM / CRS (112)' },
        { cle: 'Carte Vitale / CEAM', val: 'Prise en charge directe' },
        { cle: 'Eau en montagne', val: 'Filtrer en alpage' },
        { cle: 'Pharmacies', val: 'Réseau dense' },
      ],
    },
    meteo: {
      ville: 'Chamonix',
      temperature_actuelle: 18,
      conditions: 'Ciel dégagé, vent faible',
      details: 'précipitations 0 % · UV 6',
      mois_temperatures: [10, 14, 20, 26, 32, 36, 38, 36, 30, 24, 16, 11],
    },
    securite: {
      niveau_label: 'Très sûr',
      niveau_score: 5,
      conseils: [
        { titre: 'Météo changeante en montagne.', description: 'Consulter les bulletins du PGHM et Météo France avant toute sortie en altitude.' },
        { titre: 'Équipement adéquat.', description: 'Prévoir fond de sac étanche, polaire, coupe-vent et chaussures de tige adaptée.' },
        { titre: 'Chiens de protection (Patous).', description: 'Ralentir, contourner calmement le troupeau sans geste brusque.' },
      ],
    },
  },
  CA: {
    nom: 'Canada',
    slogan: 'Grands espaces & Terres boréales',
    subtitle: 'Des sommets acérés des Rocheuses aux immensités boréales du Yukon, le Canada est le sanctuaire ultime du trek et du bivouac sauvage.',
    region: 'Amérique du Nord · Parcs Nationaux',
    saison_recommandee: 'juin → septembre',
    latitude: '56°08′ N',
    longitude: '106°20′ O',
    fuseau: 'UTC -03:30 à -08:00',
    continent: 'Amérique du Nord',
    superficie_court: '9.98M',
    superficie_detail: '9 984 670 km²',
    population_court: '40M',
    population_detail: '≈ 4 hab/km²',
    capitale: 'Ottawa',
    capitale_pop: '≈ 1.4M hab',
    langue: 'Anglais & Français',
    langue_sub: 'Bilinguisme officiel',
    monnaie_code: 'CAD',
    monnaie_nom: 'Dollar canadien',
    taux_change: '1 € ≈ 1.48 CAD',
    presentation_titre: 'La démesure de la nature à l’état brut.',
    presentation_paragraphes: [
      'Deuxième plus vaste pays du monde, le Canada offre des territoires sauvages d’une envergure inégalée. Entre forêts boréales infinies, lacs turquoise d’origine glaciaire et toundra arctique, chaque itinéraire est une immersion totale.',
      'Les parcs de Banff et Jasper dans les Rocheuses constituent le cœur battant du trekking nord-américain, tandis que la côte Pacifique et l’île de Vancouver invitent aux grandes traversées côtières.',
      'L’autonomie y est reine : gestion des vivres, protection contre la faune sauvage (ours) et navigation boussole/GPS sont les prérequis d’une aventure réussie.',
    ],
    citation_texte: '« Le Canada n’est pas un pays que l’on visite, c’est un espace qui vous transforme à jamais. »',
    citation_auteur: 'Carnets du Grand Nord · Expédition LKDV',
    points_interet_carte: [
      { nom: 'Ottawa', isCapital: true, top: '78%', left: '76%' },
      { nom: 'Banff (Rocheuses)', top: '64%', left: '32%' },
      { nom: 'Jasper', top: '58%', left: '30%' },
      { nom: 'Yukon (Kluane)', top: '35%', left: '18%' },
      { nom: 'Gaspésie', top: '72%', left: '84%' },
    ],
    carte_echelle: '1 : 12 000 000',
    carte_repere: 'Carte des Parcs Nationaux',
    highlights: [
      {
        icon: 'mountain',
        titre: 'Superficie',
        sous_titre: 'démesurée',
        description: '9,98M km² : deuxième plus grand pays au monde par sa superficie terrestre, s’étendant sur 6 fuseaux horaires.',
      },
      {
        icon: 'compass',
        titre: 'Sanctuaires',
        sous_titre: 'nationaux',
        description: '48 parcs nationaux dont Banff et Jasper préservant les glaciers, la taïga et les grands mammifères nord-américains.',
      },
      {
        icon: 'calendar',
        titre: 'Densité',
        sous_titre: 'sauvage',
        description: '4 hab/km² : une concentration urbaine au sud laissant 80 % du territoire sous forme de nature sauvage intacte.',
      },
    ],
    destinations: [
      {
        isBig: true,
        image_url: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1200&auto=format&fit=crop',
        categorie: 'Parc National · Alberta',
        titre: 'Banff & Lake Louise',
        titre_em: 'Rocheuses',
        meta_1: '51°10′ N',
        meta_2: '1h30 de Calgary',
        meta_3: 'Été · Hiver',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop',
        categorie: 'Glaciers · Alberta',
        titre: 'Jasper & Icefields',
        titre_em: '',
        meta_1: 'Backcountry',
        meta_2: 'Juin → Sept',
        meta_3: 'Trek',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?q=80&w=800&auto=format&fit=crop',
        categorie: 'Côte Sauvage · C-B',
        titre: 'Île de Vancouver',
        titre_em: '',
        meta_1: 'West Coast Trail',
        meta_2: 'Pacifique',
        meta_3: 'Forêt pluviale',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
        categorie: 'Sommets · Québec',
        titre: 'Monts Chic-Chocs',
        titre_em: '',
        meta_1: 'Gaspésie',
        meta_2: 'Trek d’altitude',
        meta_3: 'Caribous',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?q=80&w=800&auto=format&fit=crop',
        categorie: 'Grand Nord · Yukon',
        titre: 'Kluane & Saint-Élie',
        titre_em: '',
        meta_1: 'Mont Logan',
        meta_2: 'Expédition',
        meta_3: 'Aurores',
      },
    ],
    activites: [
      {
        categorie: 'rand',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Juil → Sep',
        image_url: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=800&auto=format&fit=crop',
        tag: 'Rocheuses — Trek',
        titre: 'Skyline Trail',
        titre_em: 'Jasper',
        description: '44 km en crête au-dessus de la limite des arbres. Panorama 360° sur les glaciers, 3 jours d’autonomie.',
        duree: '3 jours',
        prix: 'CAD 120',
      },
      {
        categorie: 'aqua',
        difficulte: 'Modérée',
        difficulte_type: 'med',
        saison: 'Juin → Sep',
        image_url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?q=80&w=800&auto=format&fit=crop',
        tag: 'Canoë — Ontario',
        titre: 'Canoë-camping',
        titre_em: 'Algonquin',
        description: 'Navigation de lac en lac avec portages en forêt boréale. Bivouacs solitaires sur les îles.',
        duree: '4 jours',
        prix: 'CAD 240',
      },
      {
        categorie: 'nature',
        difficulte: 'Facile',
        difficulte_type: 'easy',
        saison: 'Sep → Mars',
        image_url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?q=80&w=800&auto=format&fit=crop',
        tag: 'Aurores — Yukon',
        titre: 'Nuits boréales',
        titre_em: 'Whitehorse',
        description: 'Observation des aurores boréales dans le ciel pur du Grand Nord canadien avec guide astronome.',
        duree: '1 nuit',
        prix: 'CAD 180',
      },
      {
        categorie: 'rand',
        difficulte: 'Difficile',
        difficulte_type: 'hard',
        saison: 'Mai → Sep',
        image_url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?q=80&w=800&auto=format&fit=crop',
        tag: 'Côte — Pacifique',
        titre: 'West Coast',
        titre_em: 'Trail',
        description: '75 km le long des falaises côtières, ponts suspendus et échelles le long de l’océan Pacifique.',
        duree: '6 jours',
        prix: 'CAD 280',
      },
    ],
    culture: {
      citation: 'Le Canada est un espace de silence et de démesure.',
      citation_em: 'démesure',
      citation_auteur: 'Exploration du Grand Nord · LKDV',
      faits: [
        { cle: 'Premières Nations', valeur: '630+', valeur_em: 'nations', description: 'Une histoire millénaire et des traditions de respect de la terre vivantes.' },
        { cle: 'Lacs du Monde', valeur: '60%', valeur_em: 'du total', description: 'Le Canada abrite plus de lacs que l’ensemble du reste du monde réuni.' },
        { cle: 'Parcs Nationaux', valeur: '330 000', valeur_em: 'km²', description: 'Une surface protégée plus vaste que de nombreux pays européens.' },
      ],
      fetes: [
        { mois: 'Juin', nom: 'Solstice d’été boréal' },
        { mois: 'Juillet', nom: 'Fête du Canada', isWarm: true },
        { mois: 'Septembre', nom: 'Saison des Couleurs d’automne' },
      ],
    },
    gastronomie: [
      { numero: 1, categorie: 'Tradition', nom: 'Sirop d’érable pur', nom_em: 'Québec', description: 'Récolté artisanalement au printemps dans les cabanes à sucre.', image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600' },
      { numero: 2, categorie: 'Pacifique', nom: 'Saumon sauvage au cèdre', nom_em: 'C-B', description: 'Fumé au feu de bois de cèdre rouge selon les traditions autochtones.', image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=600' },
      { numero: 3, categorie: 'Énergie Trek', nom: 'Pemmican traditionnel', nom_em: 'Nordique', description: 'Protéines séchées et baies sauvages, l’aliment historique des trappeurs.', image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=600' },
      { numero: 4, categorie: 'Convivialité', nom: 'Poutine forestière', nom_em: 'Québec', description: 'Frites croustillantes, fromage en grains et réduction de champignons sauvages.', image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=600' },
    ],
    pratique: {
      formalites: [
        { cle: 'Passeport', val: 'Valide 6 mois après retour' },
        { cle: 'AVE (eTA)', val: 'Obligatoire par avion (7 CAD)', isMono: true },
        { cle: 'Permis parcs', val: 'Pass Découverte Parcs Canada' },
      ],
      transport: [
        { cle: 'Entrée', val: 'Vols directs Montréal / Calgary / Vancouver' },
        { cle: 'Sur place', val: 'Location SUV / Van aménagé recommandée' },
        { cle: 'Pistes', val: 'Transcanadienne & routes forestières' },
      ],
      budget: [
        { cle: 'Bivouac / Nuit', val: '15 - 35 CAD / emplacement', isMono: true },
        { cle: 'Ravitaillement', val: '40 - 70 CAD / jour / pers' },
        { cle: 'Permis trek', val: '12 - 25 CAD / nuit en backcountry' },
      ],
      sante: [
        { cle: 'Urgences', val: '911 (Secours héliportés via balise)' },
        { cle: 'Eau', val: 'Filtration 0.1 micron obligatoire' },
        { cle: 'Faune', val: 'Spray anti-ours obligatoire en zone Rocheuses' },
      ],
    },
    meteo: {
      ville: 'Banff',
      temperature_actuelle: 14,
      conditions: 'Ensoleillé avec passages nuageux',
      details: 'précipitations 10 % · UV 5',
      mois_temperatures: [-10, -6, 0, 6, 12, 18, 23, 22, 15, 8, -2, -8],
    },
    securite: {
      niveau_label: 'Très sûr',
      niveau_score: 5,
      conseils: [
        { titre: 'Sécurité Faune (Ours).', description: 'Porter en permanence un spray anti-ours accessible et faire du bruit sur les sentiers.' },
        { titre: 'Climat subarctique.', description: 'Gel possible même en été à plus de 2 000 m : système multicouche thermique requis.' },
        { titre: 'Zones sans réseau.', description: 'Emporter systématiquement une balise de détresse satellite (Garmin InReach).' },
      ],
    },
  },
};

// ─── HELPERS DE FORMATAGE GÉOGRAPHIQUE ───────────────────────────────────────

function formatArea(area: number | null | undefined): { court: string; detail: string } {
  if (area == null || isNaN(area) || area <= 0) return { court: '—', detail: 'Non renseigné' };
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(area));
  return {
    court: formatted,
    detail: `${formatted} km²`,
  };
}

function formatLanguages(languages: string[] | null | undefined): { primary: string; sub: string } {
  if (!languages || languages.length === 0) {
    return { primary: 'Non renseigné', sub: '' };
  }
  if (languages.length === 1) {
    return { primary: languages[0], sub: 'Langue officielle' };
  }
  return {
    primary: languages.join(', '),
    sub: `${languages.length} langues officielles`,
  };
}

function formatCurrency(code: string | null | undefined, name: string | null | undefined, rawCurrency: string | null | undefined) {
  const cCode = code || (rawCurrency ? rawCurrency.match(/\(([A-Z]{3})\)/)?.[1] ?? '' : '');
  const cName = name || (rawCurrency ? rawCurrency.replace(/\s*\([A-Z]{3}\)/, '').trim() : 'Devise');
  const complet = rawCurrency || (cCode ? `${cName} (${cCode})` : cName);
  return {
    code: cCode || '—',
    nom: cName || 'Devise',
    complet: complet || '—',
  };
}

function parseSources(sourcesStr?: string | null): { url: string; label: string }[] {
  if (!sourcesStr) return [];
  return sourcesStr
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('http://') || s.startsWith('https://'))
    .map((url) => {
      try {
        const u = new URL(url);
        let domain = u.hostname.replace(/^www\./, '');
        if (domain.includes('wikipedia.org')) domain = 'Wikipédia';
        else if (domain.includes('diplomatie.gouv.fr')) domain = 'France Diplomatie';
        else if (domain.includes('universalis.fr')) domain = 'Encyclopædia Universalis';
        else if (domain.includes('worldometers.info')) domain = 'Worldometers';
        else if (domain.includes('terdav.com')) domain = 'Terres d’Aventure';
        else if (domain.includes('europa.eu')) domain = 'Union Européenne';
        else if (domain.includes('agence-adocc.com')) domain = 'Agence ADOCC';
        return { url, label: domain };
      } catch {
        return { url, label: 'Lien documentaire' };
      }
    });
}

// ─── GÉNÉRATEUR COMPLET BASÉ SUR LES DONNÉES RÉELLES COUNTRIES_GEO ───────────

export function getCompleteCountryDetail(
  countryCode: string,
  geoCountry?: CountryGeo | null
): CountryDetail {
  const codeUpper = (geoCountry?.iso_a2 || countryCode).toUpperCase();
  const base = ALL_COUNTRIES.find((c) => c.code.toUpperCase() === codeUpper) || {
    code: codeUpper,
    nom: geoCountry?.name || codeUpper,
    continent: geoCountry?.continent || 'Monde',
    capital: geoCountry?.capital || 'Capitale',
    meilleure_saison: 'Mai–Oct',
    danger_level: 'low' as const,
    tags: ['Aventure', 'Nature', 'Découverte'],
    monnaie: geoCountry?.currency_code || 'EUR',
    published: true,
  };
  const custom: Partial<CountryDetail> = COUNTRY_DETAILS[codeUpper] || {};

  const name = geoCountry?.name || custom.nom || base.nom;
  const capital = geoCountry?.capital || custom.capitale || base.capital || 'Capitale';
  const continent = geoCountry?.continent || custom.continent || base.continent || 'Monde';
  const subregion = geoCountry?.subregion || custom.region || `${continent} · Terres d'aventure`;
  const timezone = geoCountry?.timezone || custom.fuseau || 'UTC';
  const languagesList = geoCountry?.languages && geoCountry.languages.length > 0 ? geoCountry.languages : (custom.langue ? [custom.langue] : []);
  const areaInfo = geoCountry?.area_km2 ? formatArea(geoCountry.area_km2) : { court: custom.superficie_court || '—', detail: custom.superficie_detail || '—' };
  const currencyInfo = formatCurrency(
    geoCountry?.currency_code || custom.monnaie_code,
    geoCountry?.currency_name || custom.monnaie_nom,
    geoCountry?.currency || base.monnaie
  );
  const sourcesRaw = geoCountry?.sources || custom.sources || undefined;
  const sourcesList = parseSources(sourcesRaw);

  return {
    code: codeUpper,
    iso_a3: geoCountry?.iso_a3 || undefined,
    nom: name,
    nom_en: geoCountry?.name_en || custom.nom_en || undefined,
    slogan: custom.slogan || 'nature & sentiers',
    subtitle: custom.subtitle || `Explorez ${name}, une destination remarquable située en ${continent} (${subregion}). Sommets, culture locale et paysages grandioses.`,
    subtitle_is_custom: !!custom.subtitle,
    region: subregion,
    subregion: geoCountry?.subregion || undefined,
    saison_recommandee: custom.saison_recommandee || base.meilleure_saison || 'mai → octobre',
    latitude: custom.latitude || '—',
    longitude: custom.longitude || '—',
    fuseau: timezone,
    timezone: geoCountry?.timezone || undefined,
    continent: continent,
    superficie_court: areaInfo.court,
    superficie_detail: areaInfo.detail,
    capitale: capital,
    capitale_pop: custom.capitale_pop,
    langue: formatLanguages(languagesList).primary,
    langue_sub: formatLanguages(languagesList).sub || custom.langue_sub || '',
    languages: languagesList,
    monnaie_code: currencyInfo.code,
    monnaie_nom: currencyInfo.nom,
    monnaie: currencyInfo.complet,
    taux_change: custom.taux_change || (currencyInfo.code === 'EUR' ? 'Devise locale (Euro)' : `${currencyInfo.nom} (${currencyInfo.code})`),
    sources: sourcesRaw,
    sources_list: sourcesList,
    presentation_titre: custom.presentation_titre || `Une terre d'aventure et de grands espaces.`,
    presentation_paragraphes: custom.presentation_paragraphes || [
      `Situé en ${continent} (${subregion}), ${name} s'étend sur une superficie de ${areaInfo.detail} avec pour capitale ${capital}.`,
      `La région offre une diversité remarquable de reliefs propices aux traversées pédestres, à l'immersion dans la nature et à la découverte du patrimoine local.`,
      `Que ce soit pour les itinéraires de plusieurs jours ou les excursions culturelles, ${name} est une étape de choix pour les voyageurs autonomes.`,
    ],
    citation_texte: custom.citation_texte || `« Le monde est un livre et ceux qui ne voyagent pas n'en lisent qu'une page. »`,
    citation_auteur: custom.citation_auteur || `Carnets d'exploration · LKDV`,
    points_interet_carte: custom.points_interet_carte || [
      { nom: capital, isCapital: true, top: '50%', left: '50%' },
      { nom: 'Parc Naturel', top: '35%', left: '35%' },
      { nom: 'Massif & Cimes', top: '65%', left: '65%' },
      { nom: 'Points d’eau', top: '75%', left: '25%' },
    ],
    carte_echelle: custom.carte_echelle || '1 : 4 000 000',
    carte_repere: custom.carte_repere || `Carte générale · ${subregion}`,
    highlights: custom.highlights || [
      {
        icon: 'calendar',
        titre: 'Meilleure',
        sous_titre: 'saison',
        description: `Période recommandée : ${custom.saison_recommandee || base.meilleure_saison || 'Mai à Octobre'} pour explorer ${name} dans les meilleures conditions.`,
      },
      {
        icon: 'plane',
        titre: 'Accès',
        sous_titre: '& capitale',
        description: `Vols et liaisons internationales desservant ${capital}. Fuseau horaire : ${timezone}.`,
      },
      {
        icon: 'compass',
        titre: 'Territoire',
        sous_titre: '& relief',
        description: `Superficie de ${areaInfo.detail} au sein de la région ${subregion}. Monnaie officielle : ${currencyInfo.complet}.`,
      },
    ],
    destinations: custom.destinations || [
      {
        isBig: true,
        image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop',
        categorie: `Capitale · ${subregion}`,
        titre: capital,
        titre_em: '',
        meta_1: 'Point d’entrée',
        meta_2: timezone,
        meta_3: 'Histoire & Culture',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
        categorie: 'Grands Espaces',
        titre: `Parcs & Cimes de ${name}`,
        titre_em: '',
        meta_1: 'Nature',
        meta_2: 'Saison optimale',
        meta_3: 'Randonnée',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop',
        categorie: 'Sentiers & Pistes',
        titre: 'Routes & Traverses',
        titre_em: '',
        meta_1: 'Aventure',
        meta_2: 'Autonomie',
        meta_3: 'Trek',
      },
      {
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
        categorie: 'Villages & Haltes',
        titre: 'Haltes Traditionnelles',
        titre_em: '',
        meta_1: 'Patrimoine',
        meta_2: 'Terroir',
        meta_3: 'Rencontres',
      },
    ],
    activites: custom.activites || [],
    culture: custom.culture || {
      citation: `En ${name}, les traditions locales et le respect de la nature se transmettent de génération en génération.`,
      citation_em: 'Tradition',
      citation_auteur: `Mémoire & Culture · ${name}`,
      faits: [
        { cle: 'Langues', valeur: formatLanguages(languagesList).primary, valeur_em: '', description: `Langues d'usage et officielles parlées sur le territoire.` },
        { cle: 'Monnaie', valeur: currencyInfo.complet, valeur_em: '', description: `Unité monétaire utilisée pour l'ensemble des échanges locaux.` },
        { cle: 'Fuseau', valeur: timezone, valeur_em: '', description: `Décalage horaire standard applicable dans le pays.` },
        { cle: 'Région', valeur: subregion, valeur_em: '', description: `Position géographique et découpage régional.` },
      ],
      fetes: (custom.culture as any)?.fetes || [],
    },
    gastronomie: custom.gastronomie || [],
    pratique: custom.pratique || {
      formalites: [], // Aucune donnée en base — carte masquée
      transport: [
        { cle: 'Fuseau horaire', val: timezone, isMono: true },
      ],
      budget: [
        { cle: 'Monnaie officielle', val: currencyInfo.complet, isMono: true },
        { cle: 'Code devise', val: currencyInfo.code, isMono: true },
      ],
      sante: [], // Aucune donnée en base — carte masquée
    },
    meteo: custom.meteo || undefined,
    securite: custom.securite || undefined,
  };
}

