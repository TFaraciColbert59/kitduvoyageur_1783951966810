// Clubs du Monde LKDV. Les 12 premiers existent déjà en base (enrichis) ;
// les 6 suivants sont créés pour couvrir famille, accessibilité, femmes,
// littoral, vélo et patrimoine.
export const CLUBS = [
  {
    key: 'alpinisme', name: 'Randonnée Alpine', slug: 'randonnee-alpine', emoji: '⛰️',
    type: 'activite', category: 'Randonnée & Alpinisme', privacy: 'open',
    description: "Le club des sorties en altitude : courses, formations, entraide et bonne humeur. Tous niveaux, encadrement bénévole.",
    cover: ['mountain', 0], president: 'camille-rochat', moderators: ['claire-montfort'],
    topics: [
      { author: 'camille-rochat', title: 'Calendrier des sorties hiver 2026-2027', content: "Le calendrier est en ligne : 14 sorties, 4 week-ends, 2 formations sécurité. Les inscriptions ouvrent lundi à 9 h. Merci de lire les prérequis avant de vous inscrire.", days: 6, pinned: true },
      { author: 'claire-montfort', title: 'Retour sur la soirée cartographie', content: "46 personnes présentes, un vrai succès. Les diapos sont disponibles au local et en pièce jointe. Prochain atelier : lecture de pente et choix d'itinéraire.", days: 12 },
      { author: 'etienne-vasseur', title: 'Ponts fermés dans les Écrins', content: "Après les crues, deux ponts sont fermés entre le refuge du Pavé et le col. Itinéraire de repli balisé, mais prévoyez 45 minutes de plus.", days: 3 },
    ],
    events: [
      { title: 'Soirée cartographie & itinéraires', date: 12, max: 50, location: 'Lyon, local du club' },
      { title: 'Week-end formation sécurité', date: 34, max: 16, location: 'Bugey' },
    ],
  },
  {
    key: 'ski', name: 'Ski & Alpinisme', slug: 'ski-alpinisme', emoji: '🎿',
    type: 'activite', category: 'Ski de randonnée', privacy: 'open',
    description: "Ski de randonnée, couloirs et courses hivernales. On part tôt, on rentre contents, on partage les traces.",
    cover: ['snow', 0], president: 'sofia-marchetti', moderators: ['camille-rochat'],
    topics: [
      { author: 'sofia-marchetti', title: 'Conditions dans le val Ferret', content: "Neige de printemps correcte au-dessus de 2 000 m. Attention aux coulées en versant sud l'après-midi. Départs avant 7 h recommandés.", days: 4, pinned: true },
      { author: 'camille-rochat', title: 'Sortie bilingue franco-italienne', content: "Samedi, sortie ouverte auxItaliens du club. Rendez-vous 6 h 30 au parking des Grands Montets. Niveau ski de rando confirmé.", days: 9 },
    ],
    events: [{ title: 'Sortie ski de rando — val Ferret', date: 8, max: 12, location: 'Chamonix' }],
  },
  {
    key: 'bikepacking', name: 'Bikepacking Europe', slug: 'bikepacking-europe', emoji: '🚲',
    type: 'activite', category: 'Vélo & Bikepacking', privacy: 'open',
    description: "Itinérances à vélo, gravel et bivouac. Partages d'itinéraires, entraide mécanique et départs collectifs.",
    cover: ['van', 1], president: 'thomas-mercier', moderators: ['franck-delorme'],
    topics: [
      { author: 'thomas-mercier', title: 'GTJ gravel : mon itinéraire 5 jours', content: "480 km, 6 800 m de D+, cinq bivouacs. GPX dispo en MP. Les points d'eau sont rares entre Saint-Claude et Morez, prévoyez 3 litres.", days: 5, pinned: true },
      { author: 'franck-delorme', title: 'Atelier réglage dérailleur', content: "Samedi au local, 14 h. Apportez votre vélo et vos outils. On vérifie aussi les freins avant l'hiver.", days: 15 },
      { author: 'camille-vidal', title: 'Sacoches étanches : retour d’expérience', content: "Trois semaines de pluie bretonne. Les sacoches à fermeture enroulée tiennent mieux que les zip. Je partage mes références.", days: 22 },
    ],
    events: [{ title: 'Départ collectif gravel — Jura', date: 21, max: 20, location: 'Saint-Claude' }],
  },
  {
    key: 'vanlife', name: 'Vanlife France', slug: 'vanlife-france', emoji: '🚐',
    type: 'activite', category: 'Van & Road trip', privacy: 'open',
    description: "Vivre et voyager en van, sans laisser de traces. Aménagement, stationnement, mécanique et bonnes adresses.",
    cover: ['van', 2], president: 'camille-vidal', moderators: ['maxime-perrot'],
    topics: [
      { author: 'camille-vidal', title: 'Aires tolérées sur la côte atlantique', content: "Mise à jour de la carte : 18 aires tolèrent les vans hors saison, 6 sont désormais fermées. Vérifiez les panneaux sur place.", days: 7, pinned: true },
      { author: 'maxime-perrot', title: 'Travailler depuis le van au Portugal', content: "Retour d'un mois entre Lisbonne et Sintra. Le réseau est correct, mais il faut anticiper les zones blanches. Je partage mes spots.", days: 19 },
    ],
    events: [{ title: 'Rencontre vanlife — Biscarrosse', date: 26, max: 30, location: 'Biscarrosse' }],
  },
  {
    key: 'photo', name: 'Photo Nature & Voyage', slug: 'photo-nature-voyage', emoji: '📷',
    type: 'activite', category: 'Photographie', privacy: 'open',
    description: "La photo comme pretext pour marcher lentement. Ateliers lumière, affûts, partage de portfolios et sorties à l'aube.",
    cover: ['mountain', 8], president: 'nour-belkacem', moderators: ['marie-aubry'],
    topics: [
      { author: 'nour-belkacem', title: 'Atelier lumière d’altitude — samedi', content: "Rendez-vous 5 h 30, montée au lac Blanc. Priorité aux membres qui n'ont jamais fait d'affût. Apportez un trépied si vous en avez un.", days: 3, pinned: true },
      { author: 'marie-aubry', title: 'Série « Névé » : les tirages sont arrivés', content: "Douze tirages disponibles au local. Les bénéfices financent l'entretien du sentier du Pas de l'Aiguille.", days: 14 },
      { author: 'julien-rocher', title: 'Drone et zones protégées : rappel', content: "Le survol des zones Natura 2000 est interdit sans autorisation. Une image ne justifie jamais une infraction. On en parle au prochain atelier.", days: 8 },
    ],
    events: [{ title: 'Affût au lever du soleil', date: 10, max: 10, location: 'Chamonix' }],
  },
  {
    key: 'ultra', name: 'Ultra Trail & Dénivelé', slug: 'ultra-trail-denivele', emoji: '🏃',
    type: 'activite', category: 'Trail & Ultra', privacy: 'open',
    description: "Sorties longues, préparation UTMB, nutrition et récupération. On partage les traces et les galères.",
    cover: ['mountain', 4], president: 'sophie-garnier', moderators: ['hugo-blanchard'],
    topics: [
      { author: 'sophie-garnier', title: 'Stage « ultra et récupération » — novembre', content: "Deux jours, deux places restantes. Au programme : sortie longue, atelier nutrition, sommeil et récupération. Dossier de motivation en MP.", days: 5, pinned: true },
      { author: 'hugo-blanchard', title: 'Trousse de secours pour ultra', content: "Le minimum vital tient dans 180 g. J'ai pesé chaque élément et partagé la liste. À adapter selon la course.", days: 16 },
    ],
    events: [{ title: 'Sortie longue — Aiguilles Rouges', date: 15, max: 12, location: 'Chamonix' }],
  },
  {
    key: 'bivouac', name: 'Bushcraft & Survie', slug: 'bushcraft-survie', emoji: '🏕️',
    type: 'activite', category: 'Bivouac & Survie douce', privacy: 'open',
    description: "Dormir dehors, léger et respectueux. Techniques de bivouac, abris, feu, météo et lecture de terrain.",
    cover: ['camp', 0], president: 'benjamin-nkosi', moderators: ['lucas-barbier'],
    topics: [
      { author: 'benjamin-nkosi', title: 'Bivouac débutant : la check-list', content: "Tente, duvet, matelas, eau, lampe, nourriture, couche chaude. Rien d'autre pour une première nuit. Le reste s'ajoute avec l'expérience.", days: 4, pinned: true },
      { author: 'lucas-barbier', title: 'Bivouac à moins de 40 € : mon retour', content: "Tarp, duvet ancien, matelas mousse. J'ai dormi trois nuits, je ne recommande pas le matelas mousse sous 5 °C.", days: 11 },
      { author: 'sarah-cohen', title: 'Choisir un spot sans pollution lumineuse', content: "Carte de pollution lumineuse + carte IGN + deux heures de marche. J'organise une sortie « ciel noir » en novembre.", days: 20 },
    ],
    events: [{ title: 'Bivouac de printemps — Vercors', date: 40, max: 40, location: 'Vercors' }],
  },
  {
    key: 'canada', name: 'Canada Sauvage', slug: 'canada-sauvage', emoji: '🍁',
    type: 'destination', category: 'Canada', privacy: 'open',
    description: "Laurentides, Rockies, Colombie-Britannique. Itinéraires, permis, faune et bonnes pratiques.",
    cover: ['forest', 2], president: 'anna-kovacs', moderators: ['mathieu-cabanel'],
    topics: [
      { author: 'anna-kovacs', title: 'Permis de randonnée : ce qui change en 2027', content: "Plusieurs parcs nationaux passent à la réservation obligatoire. J'ai compilé les dates et les liens officiels.", days: 9, pinned: true },
      { author: 'mathieu-cabanel', title: 'Trois semaines dans les Rockies', content: "Récit et budget : 2 100 € tout compris, hors vols. Les refuges sont chers, le bivouac réglementé.", days: 25 },
    ],
    events: [{ title: 'Soirée Canada — itinéraires', date: 18, max: 40, location: 'En ligne' }],
  },
  {
    key: 'japon', name: 'Explorateurs du Japon', slug: 'explorateurs-du-japon', emoji: '⛩️',
    type: 'destination', category: 'Japon', privacy: 'open',
    description: "Kumano Kodo, Nakasendo, Alpes japonaises. Randonner au Japon, entre temples, ryokans et forêts de cèdres.",
    cover: ['city', 0], president: 'mei-ling-chen', moderators: ['suzanne-roche'],
    topics: [
      { author: 'mei-ling-chen', title: 'Kumano Kodo : quel tronçon choisir ?', content: "Trois jours suffisent pour Nakahechi. Les ryokans se réservent des mois à l'avance, surtout en automne.", days: 6, pinned: true },
      { author: 'suzanne-roche', title: 'Livres pour préparer le Japon à pied', content: "Deux récits et un guide pratique. Je les ai mis de côté à la librairie.", days: 21 },
    ],
    events: [{ title: 'Rencontre Japon — récits de marche', date: 30, max: 25, location: 'Nantes' }],
  },
  {
    key: 'himalaya', name: 'Népal & Himalaya', slug: 'nepal-himalaya', emoji: '🏔️',
    type: 'destination', category: 'Himalaya', privacy: 'open',
    description: "Trek au Népal, acclimatation, permis et respect des vallées. Expériences, conseils et entraide.",
    cover: ['mountain', 7], president: 'etienne-vasseur', moderators: ['camille-rochat'],
    topics: [
      { author: 'etienne-vasseur', title: 'Acclimatation : les règles à ne pas négliger', content: "Monter lentement, dormir bas, boire, redescendre au premier signe. Aucun sommet ne vaut une évacuation.", days: 2, pinned: true },
      { author: 'camille-rochat', title: 'Permis TIMS et sagarmatha : mise à jour', content: "Les tarifs ont changé en octobre. Comptez 20 € de plus par personne. Les agences locales peuvent s'en occuper.", days: 13 },
    ],
    events: [{ title: 'Soirée Népal — retour de trek', date: 24, max: 35, location: 'Lyon' }],
  },
  {
    key: 'norvege', name: 'Roadtrip Norvège', slug: 'roadtrip-norvege', emoji: '🇳🇴',
    type: 'destination', category: 'Norvège', privacy: 'open',
    description: "Fiords, plateaux et bivouacs sous le soleil de minuit. Itinéraires, ferry, météo et droits d'accès.",
    cover: ['coast', 0], president: 'damien-legrand', moderators: ['camille-vidal'],
    topics: [
      { author: 'damien-legrand', title: 'Trois semaines de road trip en Norvège', content: "Budget, ferries, spots de bivouac et deux jours de pluie. Le droit d'accès (allemannsretten) permet beaucoup, mais pas tout.", days: 8, pinned: true },
      { author: 'camille-vidal', title: 'Van en Norvège : ce qu’il faut savoir', content: "Les routes sont lentes, les ferry chers, les aires rares. Prévoyez large et vérifiez la météo chaque matin.", days: 17 },
    ],
    events: [{ title: 'Atelier itinéraire Norvège', date: 33, max: 20, location: 'En ligne' }],
  },
  {
    key: 'escalade', name: 'Escalade & Bloc', slug: 'escalade-bloc', emoji: '🧗',
    type: 'activite', category: 'Escalade', privacy: 'open',
    description: "De la moulinette au bloc, en salle et dehors. Partenaires de cordée, sécurité et sorties conviviales.",
    cover: ['mountain', 14], president: 'theo-marchand', moderators: ['nour-belkacem'],
    topics: [
      { author: 'theo-marchand', title: 'Bloc accessible : les salles qui s’adaptent', content: "Trois salles de la région ont adapté leurs structures. Je partage les photos et les contacts.", days: 10, pinned: true },
      { author: 'nour-belkacem', title: 'Partenaires de cordée — recherche', content: "Je cherche un partenaire pour du 6a en falaise, dispo le week-end. Matériel complet.", days: 27 },
    ],
    events: [{ title: 'Session bloc & café', date: 11, max: 15, location: 'Lyon' }],
  },
  {
    key: 'famille', name: 'Rando en Famille', slug: 'rando-en-famille', emoji: '👨‍👩‍👧',
    type: 'activite', category: 'Famille', privacy: 'open',
    description: "Des sorties courtes, joyeuses et adaptées aux enfants. Astuces, itinéraires testés et goûters partagés.",
    cover: ['coast', 4], president: 'helene-mercier', moderators: ['antoine-chastel', 'nadia-cherif'],
    topics: [
      { author: 'helene-mercier', title: 'Douze boucles testées avec enfants', content: "Classées par âge et par temps de trajet, avec les points de goûter et les toilettes. Fiche complète en pièce jointe.", days: 5, pinned: true },
      { author: 'antoine-chastel', title: 'Marcher avec un enfant de 6 ans', content: "Le secret : un goûter par heure, des chaussures correctes et zéro objectif de distance. On adapte au rythme.", days: 12 },
      { author: 'nadia-cherif', title: 'Sortie accessible en joëlette', content: "Deux bénévoles disponibles le 9 novembre. On cherche une famille qui veut tester.", days: 20 },
    ],
    events: [{ title: 'Rando-goûter d’automne', date: 9, max: 30, location: 'Nantes' }],
  },
  {
    key: 'access', name: 'Sentiers pour Tous', slug: 'sentiers-pour-tous', emoji: '♿',
    type: 'activite', category: 'Accessibilité', privacy: 'open',
    description: "Randonner quel que soit son corps : joëlette, fauteuil tout-terrain, pentes, revêtements et entraide.",
    cover: ['mountain', 9], president: 'theo-marchand', moderators: ['nadia-cherif'],
    topics: [
      { author: 'theo-marchand', title: '18 sentiers testés en fauteuil', content: "Classés par pente, revêtement et accès voiture. Trois fiches sont mises à jour cette semaine.", days: 7, pinned: true },
      { author: 'nadia-cherif', title: 'Besoin de bénévoles pour la joëlette', content: "Deux bénévoles suffisent par sortie. Formation de 30 minutes avant le départ. Merci de vous signaler.", days: 15 },
    ],
    events: [{ title: 'Sortie en joëlette — Calanques', date: 13, max: 12, location: 'Marseille' }],
  },
  {
    key: 'femmes', name: 'Femmes en Sentier', slug: 'femmes-en-sentier', emoji: '🌿',
    type: 'activite', category: 'Inclusion', privacy: 'open',
    description: "Un club pour se sentir légitime partout : sorties non mixtes, ateliers et sororité en montagne.",
    cover: ['forest', 0], president: 'fatou-diallo', moderators: ['amelie-fontaine', 'claire-montfort'],
    topics: [
      { author: 'fatou-diallo', title: 'Bivouac de printemps : 40 inscriptions', content: "Il nous faut deux encadrantes de plus. L'atelier montage de tente est déjà pris.", days: 4, pinned: true },
      { author: 'amelie-fontaine', title: 'Reprendre la marche après une grossesse', content: "Je partage mon expérience et les fiches de sorties très courtes. Aucune pression de performance.", days: 18 },
    ],
    events: [{ title: 'Bivouac initiation — Vercors', date: 40, max: 40, location: 'Vercors' }],
  },
  {
    key: 'littoral', name: 'Randonnée Littorale', slug: 'randonnee-littorale', emoji: '🌊',
    type: 'activite', category: 'Littoral', privacy: 'open',
    description: "Sentiers côtiers, marées, vents et paysages. De la Bretagne à la Méditerranée, à pied et en kayak.",
    cover: ['coast', 2], president: 'yann-le-goff', moderators: ['maelle-guerin', 'loic-berthier'],
    topics: [
      { author: 'yann-le-goff', title: 'Marées et coefficients : les bases', content: "Règle simple : ne jamais partir sans deux sources météo et l'horaire de marée. Le sentier côtier se coupe en quelques minutes.", days: 3, pinned: true },
      { author: 'maelle-guerin', title: 'Île de Ré en hiver', content: "16 km, du vent, personne. Le sentier est officiellement fermé par endroits après les tempêtes. Vérifier en mairie.", days: 14 },
    ],
    events: [{ title: 'Sentier des douaniers — sortie', date: 16, max: 20, location: 'Crozon' }],
  },
  {
    key: 'velo', name: 'Cyclo & Gravel', slug: 'cyclo-gravel', emoji: '🚴',
    type: 'activite', category: 'Cyclotourisme', privacy: 'open',
    description: "Grandes traversées à vélo, EuroVelo et itinérances gravel. Entretien, itinéraires et départs collectifs.",
    cover: ['van', 0], president: 'franck-delorme', moderators: ['thomas-mercier'],
    topics: [
      { author: 'franck-delorme', title: 'EuroVelo 6 : notre itinéraire 10 jours', content: "Dijon à Strasbourg, 600 km, neuf étapes. Les pistes sont excellentes, les hébergements abordables hors saison.", days: 6, pinned: true },
      { author: 'thomas-mercier', title: 'Gravel dans le Jura : attention aux chaussées', content: "Deux secteurs sont boueux après la pluie. Pneus de 40 mm minimum recommandés.", days: 16 },
    ],
    events: [{ title: 'Départ collectif vélo — Dijon', date: 19, max: 25, location: 'Dijon' }],
  },
  {
    key: 'patrimoine', name: 'Sentiers & Patrimoine', slug: 'sentiers-patrimoine', emoji: '🏛️',
    type: 'activite', category: 'Culture & Patrimoine', privacy: 'open',
    description: "Marcher pour comprendre : patrimoine, géologie, histoire et récits locaux, avec des guides passionnés.",
    cover: ['city', 1], president: 'emilie-chardin', moderators: ['mathieu-cabanel', 'suzanne-roche'],
    topics: [
      { author: 'emilie-chardin', title: 'Balade contée dans les Calanques', content: "Deux heures, huit siècles d'histoire. Samedi 14 h, inscription obligatoire, 25 places.", days: 5, pinned: true },
      { author: 'mathieu-cabanel', title: 'Qui entretient les sentiers de l’Oisans ?', content: "Trois semaines d'entretiens, une enquête à paraître. Les bénévoles font 80 % du travail, souvent sans subvention.", days: 11 },
    ],
    events: [{ title: 'Balade contée — Avignon', date: 7, max: 25, location: 'Avignon' }],
  },
];

export const CLUB_BY_KEY = new Map(CLUBS.map((c) => [c.key, c]));
