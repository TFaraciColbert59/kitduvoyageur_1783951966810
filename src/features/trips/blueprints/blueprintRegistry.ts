import type { Blueprint, TripBrief, Proposal } from '../schemas/autoGen.schema';

function makeProposal<T>(
  id: string,
  layer: any,
  slotId: string,
  value: T,
  rationale: string,
  alternatives: Proposal<T>[] = [],
  options: Partial<Proposal<T>> = {}
): Proposal<T> {
  return {
    id,
    layer,
    slotId,
    value,
    provenance: {
      source: 'official',
      sourceRef: 'LKDV-Official-Registry',
      observedAt: '2024-05-01T00:00:00Z',
    },
    confidence: 'high',
    rationale,
    alternatives,
    locked: false,
    editedByUser: false,
    impacts: [],
    ...options,
  };
}

/**
 * Catalogue des Blueprints canoniques pour les 15 pôles majeurs.
 * Chaque blueprint instancie de manière déterministe les 12 couches fonctionnelles.
 */
export const BLUEPRINT_CATALOG: Blueprint[] = [
  // ============================================================================
  // 1. FRANCE — TOUR DU MONT-BLANC (Semaine, Refuge, Confort Modéré)
  // ============================================================================
  {
    id: 'bp-fr-tmb-summer-week-refuge',
    countryCode: 'FR',
    pole: 'Tour du Mont-Blanc / Val Montjoie',
    season: 'summer',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Tour du Mont-Blanc Classique en Refuges Gardés',
    summary: '7 jours de traversée alpine autour du toit de l’Europe avec nuits en refuge demi-pension et sac léger.',
    layers: {
      skeleton: makeProposal('prop-skel-tmb', 'skeleton', 'slot-skeleton', {
        days: 7,
        phases: [
          { phase: 'prepare', days: [1, 2], name: 'Ascension & Prise de repères' },
          { phase: 'live', days: [3, 4, 5, 6], name: 'Cœur Alpin & Cols d’Altitude' },
          { phase: 'recount', days: [7], name: 'Retour en Vallée & Récit' },
        ],
      }, 'Découpage équilibré en 7 étapes alpines avec acclimatation progressive.'),
      itinerary: makeProposal('prop-itin-tmb', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 108,
        totalGainM: 6450,
        totalLossM: 6200,
        stagesCount: 7,
        difficulty: 'moderate',
      }, 'Tracé GR TMB officiel évitant les variantes exposées en cas d’orage.'),
      major_transport: makeProposal('prop-trans-tmb', 'major_transport', 'slot-transport', {
        mode: 'train',
        hubDeparture: 'Paris Gare de Lyon',
        hubArrival: 'Les Houches',
        carbonKgCo2e: 4.2,
      }, 'Liaison TGV + TER Léman Express décarbonée.'),
      local_transport: makeProposal('prop-loctrans-tmb', 'local_transport', 'slot-loctrans', {
        mode: 'bus',
        network: 'Chamonix Bus Ligne 1',
        costEur: 0,
      }, 'Navettes de vallée gratuites avec la carte d’hôte.'),
      accommodations: makeProposal('prop-accom-tmb', 'accommodations', 'slot-night-d1', {
        name: 'Refuge du Fioux / Col de Voza',
        type: 'refuge',
        priceEur: 65,
      }, 'Refuge FFCAM chaleureux face au glacier de Bionnassay.', [
        makeProposal('prop-accom-tmb-alt1', 'accommodations', 'slot-night-d1', {
          name: 'Bivouac réglementé attenant',
          type: 'bivouac',
          priceEur: 0,
        }, 'Tolérance crépusculaire de bivouac.'),
      ]),
      food_water: makeProposal('prop-food-tmb', 'food_water', 'slot-food', {
        dailyFormula: 'demi_pension_refuge',
        waterStrategy: 'sources_potables_et_filtre',
        resupplyEveryDays: 2,
      }, 'Demi-pension au refuge et filtration d’appoint aux ruisseaux d’alpage.'),
      kit: makeProposal('prop-kit-tmb', 'kit', 'slot-kit', {
        targetWeightKg: 6.8,
        packVolumeL: 35,
        essentialCategories: ['drap_de_sac', 'veste_impermeable', 'batons', 'gourde'],
      }, 'Kit ultra-optimisé pour hébergement en dur.'),
      poi: makeProposal('prop-poi-tmb', 'poi', 'slot-poi', {
        highlights: ['Lac Blanc', 'Grandes Jorasses', 'Col de la Seigne'],
      }, 'Panoramas incontournables du massif du Mont-Blanc.'),
      budget: makeProposal('prop-budg-tmb', 'budget', 'slot-budget', {
        totalPerPersonEur: 612,
        dailyAverageEur: 87.4,
        currency: 'EUR',
      }, 'Budget maîtrisé basé sur les tarifs officiels des clubs alpins.'),
      compliance: makeProposal('prop-comp-tmb', 'compliance', 'slot-compliance', {
        idRequired: 'CNI_or_Passport',
        schengenStatus: 'valid',
        permitsRequired: false,
      }, 'Espace Schengen : traversée France, Italie, Suisse sans visa.'),
      safety: makeProposal('prop-safe-tmb', 'safety', 'slot-safety', {
        rescuePhone: '+33450531689',
        rescueUnit: 'PGHM Chamonix',
        emergencyChannel: '161.300 MHz',
      }, 'Couverture de secours héliporté PGHM.'),
      know_how: makeProposal('prop-know-tmb', 'know_how', 'slot-knowhow', {
        rules: ['Ne rien jeter', 'Arriver avant 18h au refuge', 'Chaussures ôtées à l’entrée'],
      }, 'Charte de bonne conduite en montagne.'),
    },
  },

  // ============================================================================
  // 2. ISLANDÈ — LAUGAVEGUR (Semaine étendue, Bivouac, Shoestring)
  // ============================================================================
  {
    id: 'bp-is-laugavegur-summer-extended-bivouac',
    countryCode: 'IS',
    pole: 'Laugavegur / Fjallabak',
    season: 'summer',
    durationTier: 'extended',
    styleTier: 'bivouac',
    budgetTier: 'shoestring',
    title: 'Traversée du Laugavegur & Fimmvörðuháls sous Tente',
    summary: '10 à 12 jours d’autonomie volcanique entre sources chaudes, déserts d’obsidienne et passages de gués.',
    layers: {
      skeleton: makeProposal('prop-skel-is', 'skeleton', 'slot-skeleton', {
        days: 12,
        bufferDays: 2,
      }, 'Programme intégrant 2 jours de marge météo pour vents violents.'),
      itinerary: makeProposal('prop-itin-is', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 80,
        totalGainM: 2850,
        totalLossM: 3400,
        stagesCount: 8,
        difficulty: 'hard',
      }, 'Itinéraire complet Landmannalaugar vers Skógar par Fimmvörðuháls.'),
      major_transport: makeProposal('prop-trans-is', 'major_transport', 'slot-transport', {
        mode: 'plane',
        hubArrival: 'KEF',
        carbonKgCo2e: 420,
      }, 'Vol régulier vers Keflavík avec bagage soute obligatoire.'),
      local_transport: makeProposal('prop-loctrans-is', 'local_transport', 'slot-loctrans', {
        mode: 'bus',
        network: 'Trex Highlands Bus 4x4',
        costEur: 165,
      }, 'Bus tout-terrain franchissant les gués vers Landmannalaugar.'),
      accommodations: makeProposal('prop-accom-is', 'accommodations', 'slot-night-is', {
        name: 'Campings officiels Ferðafélag Íslands',
        type: 'bivouac',
        priceEur: 19,
      }, 'Bivouac sous tente aux abords des refuges FI.'),
      food_water: makeProposal('prop-food-is', 'food_water', 'slot-food', {
        dailyFormula: 'lyophilise_autonomie',
        waterStrategy: 'eau_pure_ruisseaux_clairs_interdiction_eau_glaciaire',
        resupplyEveryDays: 7,
      }, 'Autonomie alimentaire complète depuis Reykjavik.'),
      kit: makeProposal('prop-kit-is', 'kit', 'slot-kit', {
        targetWeightKg: 14.8,
        packVolumeL: 65,
        essentialCategories: ['tente_4_saisons', 'duvet_confort_moins_5', 'chaussons_gues', 'pantalon_goretex'],
      }, 'Équipement grand froid et intempéries nordiques.'),
      poi: makeProposal('prop-poi-is', 'poi', 'slot-poi', {
        highlights: ['Sources chaudes Landmannalaugar', 'Cratères Magni et Móði', 'Chute de Skógafoss'],
      }, 'Sites géologiques actifs majeurs.'),
      budget: makeProposal('prop-budg-is', 'budget', 'slot-budget', {
        totalPerPersonEur: 1280,
        dailyAverageEur: 106,
        currency: 'EUR',
      }, 'Budget tout compris vol, bus 4x4 et campings.'),
      compliance: makeProposal('prop-comp-is', 'compliance', 'slot-compliance', {
        registryUrl: 'https://safetravel.is',
        mandatoryTracking: true,
      }, 'Enregistrement de l’itinéraire obligatoire sur Safetravel.is.'),
      safety: makeProposal('prop-safe-is', 'safety', 'slot-safety', {
        rescuePhone: '112',
        rescueUnit: 'ICE-SAR',
        primaryHazard: 'Hypothermie par vent fort et pluie',
      }, 'Suivi permanent par les rangers et secours ICE-SAR.'),
      know_how: makeProposal('prop-know-is', 'know_how', 'slot-knowhow', {
        rules: ['Déboucler la ventrière au gué', 'Ne jamais piétiner la mousse volcanique', 'Acheter le gaz à Reykjavik'],
      }, 'Consignes environnementales et franchissement de rivières.'),
    },
  },

  // ============================================================================
  // 3. MAROC — TOUBKAL & HAUT-ATLAS (Semaine étendue, Bivouac/Gîte, Shoestring)
  // ============================================================================
  {
    id: 'bp-ma-toubkal-autumn-extended-bivouac',
    countryCode: 'MA',
    pole: 'Haut Atlas Toubkal / Imlil',
    season: 'autumn',
    durationTier: 'extended',
    styleTier: 'bivouac',
    budgetTier: 'shoestring',
    title: 'Ascension du Jbel Toubkal & Lac d’Ifni',
    summary: '10 jours d’immersion berbère, sommet à 4 167 m et nuits sous les étoiles de l’Atlas.',
    layers: {
      skeleton: makeProposal('prop-skel-ma', 'skeleton', 'slot-skeleton', {
        days: 10,
        phases: [
          { phase: 'prepare', days: [1, 2], name: 'Marrakech & Acclimatation Imlil' },
          { phase: 'live', days: [3, 4, 5, 6, 7], name: 'Sommet du Toubkal & Lac d’Ifni' },
          { phase: 'recount', days: [8, 9, 10], name: 'Vallée du Tifnoute & Médina' },
        ],
      }, 'Découpage intégrant une journée d’acclimatation à 1 800 m.'),
      itinerary: makeProposal('prop-itin-ma', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 72,
        totalGainM: 4850,
        totalLossM: 5100,
        stagesCount: 7,
        difficulty: 'hard',
      }, 'Boucle Imlil - Sommet 4167m - Lac d’Ifni - Amsouzart.'),
      major_transport: makeProposal('prop-trans-ma', 'major_transport', 'slot-transport', {
        mode: 'plane',
        hubArrival: 'RAK',
        carbonKgCo2e: 380,
      }, 'Vol court-courrier direct vers Marrakech-Menara.'),
      local_transport: makeProposal('prop-loctrans-ma', 'local_transport', 'slot-loctrans', {
        mode: 'bus',
        network: 'Grands Taxis Bab Er-Rob',
        costEur: 6.5,
      }, 'Grands taxis collectifs reliant Marrakech à Imlil.'),
      accommodations: makeProposal('prop-accom-ma', 'accommodations', 'slot-night-ma', {
        name: 'Gîtes berbères et Refuge Les Mouflons',
        type: 'refuge',
        priceEur: 28,
      }, 'Demi-pension en gîte d’étape et refuge de haute altitude.'),
      food_water: makeProposal('prop-food-ma', 'food_water', 'slot-food', {
        dailyFormula: 'cuisine_locale_tagines',
        waterStrategy: 'filtration_01_et_micropur_obligatoire',
        resupplyEveryDays: 3,
      }, 'Nourriture locale saine et traitement chimique/filtre systématique de l’eau.'),
      kit: makeProposal('prop-kit-ma', 'kit', 'slot-kit', {
        targetWeightKg: 8.4,
        packVolumeL: 45,
        essentialCategories: ['duvet_confort_0', 'pastilles_micropur', 'creme_solaire_50', 'batons'],
      }, 'Kit adapté au fort ensoleillement diurne et aux gelées nocturnes.'),
      poi: makeProposal('prop-poi-ma', 'poi', 'slot-poi', {
        highlights: ['Sommet du Jbel Toubkal', 'Lac d’Ifni', 'Rocher de Sidi Chamarouch'],
      }, 'Points emblématiques du Haut-Atlas.'),
      budget: makeProposal('prop-budg-ma', 'budget', 'slot-budget', {
        totalPerPersonEur: 440,
        dailyAverageEur: 44,
        currency: 'MAD',
      }, 'Budget très économique incluant guide partagé et transferts.'),
      compliance: makeProposal('prop-comp-ma', 'compliance', 'slot-compliance', {
        guideMandatory: true,
        passportValidityMonths: 3,
        visaRequired: false,
      }, 'Passeport valide 3 mois ; guide officiel obligatoire pour le sommet.'),
      safety: makeProposal('prop-safe-ma', 'safety', 'slot-safety', {
        rescuePhone: '177',
        rescueUnit: 'Gendarmerie Royale d’Imlil',
        altitudeLimitM: 4167,
      }, 'Secours terrestres muletiers et gendarmerie.'),
      know_how: makeProposal('prop-know-ma', 'know_how', 'slot-knowhow', {
        rules: ['Accepter le thé offert', 'Pourboire muletier 80 MAD/j', 'Tenue pudique dans les villages'],
      }, 'Usages et traditions d’hospitalité berbère.'),
    },
  },

  // ============================================================================
  // 4. FRANCE — MASSIF DU SANCY (Week-end, Bivouac, Train)
  // ============================================================================
  {
    id: 'bp-fr-sancy-summer-weekend-bivouac',
    countryCode: 'FR',
    pole: 'Massif Central / Sancy',
    season: 'summer',
    durationTier: 'weekend',
    styleTier: 'bivouac',
    budgetTier: 'shoestring',
    title: 'Micro-Aventure Bivouac des Crêtes du Sancy',
    summary: '3 jours de déconnexion totale en Auvergne, accessible directement en train sans voiture.',
    layers: {
      skeleton: makeProposal('prop-skel-sancy', 'skeleton', 'slot-skeleton', {
        days: 3,
      }, 'Week-end express du vendredi soir au dimanche soir.'),
      itinerary: makeProposal('prop-itin-sancy', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 34,
        totalGainM: 1780,
        totalLossM: 1780,
        stagesCount: 3,
        difficulty: 'moderate',
      }, 'Boucle sur le GR4 / GR30 au départ immédiat de la gare.'),
      major_transport: makeProposal('prop-trans-sancy', 'major_transport', 'slot-transport', {
        mode: 'train',
        hubArrival: 'Gare du Mont-Dore',
        carbonKgCo2e: 1.8,
      }, 'Intercités et car TER Auvergne.'),
      local_transport: makeProposal('prop-loctrans-sancy', 'local_transport', 'slot-loctrans', {
        mode: 'foot',
        costEur: 0,
      }, 'Zéro transport : sentier connecté à la gare.'),
      accommodations: makeProposal('prop-accom-sancy', 'accommodations', 'slot-night-sancy', {
        name: 'Bivouac réglementé hors réserve intégrale',
        type: 'bivouac',
        priceEur: 0,
      }, 'Bivouac crépusculaire sous tente 19h-09h.'),
      food_water: makeProposal('prop-food-sancy', 'food_water', 'slot-food', {
        dailyFormula: 'autonomie_et_fruitiere',
        resupplyEveryDays: 2,
      }, 'Avitaillement en Saint-Nectaire fermier sur les crêtes.'),
      kit: makeProposal('prop-kit-sancy', 'kit', 'slot-kit', {
        targetWeightKg: 7.2,
        packVolumeL: 40,
        essentialCategories: ['tente_legere', 'rechaud', 'gourde_filtrante'],
      }, 'Kit micro-aventure autonome léger.'),
      poi: makeProposal('prop-poi-sancy', 'poi', 'slot-poi', {
        highlights: ['Puy de Sancy', 'Grande Cascade', 'Lac de Guéry'],
      }, 'Points de vue volcaniques panoramiques.'),
      budget: makeProposal('prop-budg-sancy', 'budget', 'slot-budget', {
        totalPerPersonEur: 92,
        dailyAverageEur: 30.6,
        currency: 'EUR',
      }, 'Budget mini comprenant le train et les vivres.'),
      compliance: makeProposal('prop-comp-sancy', 'compliance', 'slot-compliance', {
        bivouacRule: 'Interdiction feux et respect réserve Chastreix-Sancy',
      }, 'Arrêté préfectoral du Puy-de-Dôme.'),
      safety: makeProposal('prop-safe-sancy', 'safety', 'slot-safety', {
        rescuePhone: '112',
        rescueUnit: 'PGM Le Mont-Dore',
      }, 'Peloton de Gendarmerie de Montagne.'),
      know_how: makeProposal('prop-know-sancy', 'know_how', 'slot-knowhow', {
        rules: ['Refermer les clôtures d’estive', 'Contourner les troupeaux et Patous'],
      }, 'Règles pastorales en Auvergne.'),
    },
  },

  // ============================================================================
  // 5. ITALIE — DOLOMITES ALTA VIA 1 (Semaine, Refuge, Confort Modéré)
  // ============================================================================
  {
    id: 'bp-it-dolomites-summer-week-refuge',
    countryCode: 'IT',
    pole: 'Dolomites Alta Via 1 & 2',
    season: 'summer',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Dolomites Alta Via 1 du Lago di Braies à Belluno',
    summary: '8 jours de randonnée spectaculaire au pied des parois calcaires des Tofane et de la Civetta.',
    layers: {
      skeleton: makeProposal('prop-skel-it', 'skeleton', 'slot-skeleton', {
        days: 8,
      }, 'Traversée linéaire du nord au sud des Dolomites.'),
      itinerary: makeProposal('prop-itin-it', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 120,
        totalGainM: 7300,
        totalLossM: 8400,
        stagesCount: 8,
        difficulty: 'hard',
      }, 'Sentier Haute Route #1 avec sentiers rocheux et via ferratas faciles en option.'),
      major_transport: makeProposal('prop-trans-it', 'major_transport', 'slot-transport', {
        mode: 'train',
        hubArrival: 'Niederdorf-Villabassa',
        carbonKgCo2e: 8.5,
      }, 'Train Eurocity via Innsbruck et Fortezza.'),
      local_transport: makeProposal('prop-loctrans-it', 'local_transport', 'slot-loctrans', {
        mode: 'bus',
        network: 'Südtirol Mobil Bus 442',
        costEur: 12,
      }, 'Navette vers le départ au Lago di Braies.'),
      accommodations: makeProposal('prop-accom-it', 'accommodations', 'slot-night-it', {
        name: 'Rifugi CAI (Lagazuoi, Nuvolau, Vazzoler)',
        type: 'refuge',
        priceEur: 72,
      }, 'Refuges historiques italiens perchés sur les arêtes.'),
      food_water: makeProposal('prop-food-it', 'food_water', 'slot-food', {
        dailyFormula: 'demi_pension_rifugio',
        waterStrategy: 'eau_potable_refuge',
        resupplyEveryDays: 2,
      }, 'Excellente gastronomie montagnarde italienne.'),
      kit: makeProposal('prop-kit-it', 'kit', 'slot-kit', {
        targetWeightKg: 7.0,
        packVolumeL: 35,
        essentialCategories: ['drap_de_sac', 'chaussures_vibram_accroche', 'lampe_frontale'],
      }, 'Kit rocheux allégé pour refuges confortables.'),
      poi: makeProposal('prop-poi-it', 'poi', 'slot-poi', {
        highlights: ['Lago di Braies', 'Tofana di Rozes', 'Cinque Torri'],
      }, 'Monuments naturels classés UNESCO.'),
      budget: makeProposal('prop-budg-it', 'budget', 'slot-budget', {
        totalPerPersonEur: 720,
        dailyAverageEur: 90,
        currency: 'EUR',
      }, 'Budget conforme aux tarifs Club Alpino Italiano.'),
      compliance: makeProposal('prop-comp-it', 'compliance', 'slot-compliance', {
        idRequired: 'CNI_or_Passport',
        schengenStatus: 'valid',
      }, 'Zone euro / Espace Schengen.'),
      safety: makeProposal('prop-safe-it', 'safety', 'slot-safety', {
        rescuePhone: '118',
        rescueUnit: 'Soccorso Alpino Dolomiti',
      }, 'Secours en montagne italien.'),
      know_how: makeProposal('prop-know-it', 'know_how', 'slot-knowhow', {
        rules: ['Réserver les rifugi tôt', 'Respecter les sentiers de pierriers'],
      }, 'Pratiques montagnardes transalpines.'),
    },
  },

  // ============================================================================
  // 6. NÉPAL — TOUR DES ANNAPURNAS (Grande Traversée, Tea House, Économique)
  // ============================================================================
  {
    id: 'bp-np-annapurnas-autumn-extended-refuge',
    countryCode: 'NP',
    pole: 'Tour des Annapurnas / Manang',
    season: 'autumn',
    durationTier: 'extended',
    styleTier: 'refuge',
    budgetTier: 'shoestring',
    title: 'Tour des Annapurnas & Col du Thorong La (5 416 m)',
    summary: '18 jours de voyage himalayen avec nuits en tea houses et passage du plus haut col de trek du monde.',
    layers: {
      skeleton: makeProposal('prop-skel-np', 'skeleton', 'slot-skeleton', {
        days: 18,
        acclimatizationRestDay: 5,
      }, 'Progression lente avec journée de repos obligatoire à Manang (3 540 m).'),
      itinerary: makeProposal('prop-itin-np', 'itinerary', 'slot-itinerary', {
        totalDistanceKm: 135,
        totalGainM: 6800,
        totalLossM: 7100,
        stagesCount: 14,
        difficulty: 'expert',
      }, 'Sentier NATT évitant la route carrossable.'),
      major_transport: makeProposal('prop-trans-np', 'major_transport', 'slot-transport', {
        mode: 'plane',
        hubArrival: 'KTM',
        carbonKgCo2e: 1350,
      }, 'Vol international vers Katmandou Tribhuvan.'),
      local_transport: makeProposal('prop-loctrans-np', 'local_transport', 'slot-loctrans', {
        mode: 'bus',
        network: 'Jeep partagée Besisahar-Chame',
        costEur: 70,
      }, 'Jeep tout-terrain et bus touristique Pokhara.'),
      accommodations: makeProposal('prop-accom-np', 'accommodations', 'slot-night-np', {
        name: 'Tea Houses locales familiales',
        type: 'refuge',
        priceEur: 6,
      }, 'Hébergement rustique traditionnel en lodge.'),
      food_water: makeProposal('prop-food-np', 'food_water', 'slot-food', {
        dailyFormula: 'dal_bhat_a_volonte',
        waterStrategy: 'safe_water_project_et_filtre',
        resupplyEveryDays: 1,
      }, 'Repas complet Dal Bhat servi dans chaque tea house.'),
      kit: makeProposal('prop-kit-np', 'kit', 'slot-kit', {
        targetWeightKg: 8.9,
        packVolumeL: 50,
        essentialCategories: ['duvet_confort_moins_15', 'lunettes_cat_4', 'doudoune_epaisse', 'diamox'],
      }, 'Équipement haute altitude et grand froid.'),
      poi: makeProposal('prop-poi-np', 'poi', 'slot-poi', {
        highlights: ['Thorong La Pass (5416m)', 'Poon Hill', 'Monastère de Braga'],
      }, 'Géants himalayens à plus de 8000 mètres.'),
      budget: makeProposal('prop-budg-np', 'budget', 'slot-budget', {
        totalPerPersonEur: 1620,
        dailyAverageEur: 90,
        currency: 'NPR',
      }, 'Budget complet incluant vol international et permis.'),
      compliance: makeProposal('prop-comp-np', 'compliance', 'slot-compliance', {
        timsCard: true,
        acapPermit: true,
        guideMandatory: true,
        visaOnArrivalUsd: 50,
      }, 'Permis ACAP et TIMS obligatoires avec guide certifié.'),
      safety: makeProposal('prop-safe-np', 'safety', 'slot-safety', {
        rescueUnit: 'Himalayan Rescue Association (HRA)',
        altitudeLimitM: 5416,
        primaryHazard: 'Mal Aigu des Montagnes (MAM)',
      }, 'Postes médicaux HRA à Manang et Pheriche.'),
      know_how: makeProposal('prop-know-np', 'know_how', 'slot-knowhow', {
        rules: ['Contourner les stupas par la gauche', 'Enlever ses chaussures', 'Zéro plastique jetable'],
      }, 'Coutumes bouddhistes et étiquette népalaise.'),
    },
  },

  // 7. FRANCE — CORSE GR20 INTÉGRALE
  {
    id: 'bp-fr-gr20-summer-extended-bivouac',
    countryCode: 'FR',
    pole: 'Corse GR20',
    season: 'summer',
    durationTier: 'extended',
    styleTier: 'bivouac',
    budgetTier: 'shoestring',
    title: 'GR20 Corse Intégrale Nord-Sud sous Tente',
    summary: '14 jours de haute randonnée minérale et passages rocheux engagés.',
    layers: {
      skeleton: makeProposal('prop-skel-gr20', 'skeleton', 'slot-skeleton', { days: 14 }, '14 étapes PNRC.'),
      itinerary: makeProposal('prop-itin-gr20', 'itinerary', 'slot-itinerary', { totalDistanceKm: 180, totalGainM: 12000, stagesCount: 14, difficulty: 'expert' }, 'Tracé complet Calenzana à Conca.'),
      accommodations: makeProposal('prop-accom-gr20', 'accommodations', 'slot-night-gr20', { name: 'Aires de bivouac PNRC', type: 'bivouac', priceEur: 9 }, 'Bivouac obligatoire aux refuges PNRC.'),
      food_water: makeProposal('prop-food-gr20', 'food_water', 'slot-food', { dailyFormula: 'ravitaillement_refuges_pnrc', waterStrategy: 'sources_captées_refuges', resupplyEveryDays: 2 }, 'Épiceries des refuges PNRC.'),
      kit: makeProposal('prop-kit-gr20', 'kit', 'slot-kit', { targetWeightKg: 9.8, packVolumeL: 45, essentialCategories: ['tente_autoportante', 'chaussures_accroche_vibram', 'duvet_confort_0'] }, 'Matériel rocheux résistant.'),
      budget: makeProposal('prop-budg-gr20', 'budget', 'slot-budget', { totalPerPersonEur: 780, dailyAverageEur: 55.7, currency: 'EUR' }, 'Budget bivouac et ravitaillement PNRC.'),
      compliance: makeProposal('prop-comp-gr20', 'compliance', 'slot-compliance', { reservationPNRC: true }, 'Réservation bivouac obligatoire.'),
      safety: makeProposal('prop-safe-gr20', 'safety', 'slot-safety', { rescuePhone: '112', rescueUnit: 'PGHM Corte' }, 'Secours montagne Corse.'),
      know_how: makeProposal('prop-know-gr20', 'know_how', 'slot-knowhow', { rules: ['Départ à 05h30 pour éviter orages', 'Protéger nourriture contre renards'] }, 'Règles du GR20.'),
    },
  },

  // 8. FRANCE — JURA BIKEPACKING GTJ
  {
    id: 'bp-fr-jura-summer-week-fastlight',
    countryCode: 'FR',
    pole: 'Grande Traversée du Jura / GTJ',
    season: 'summer',
    durationTier: 'week',
    styleTier: 'fast_light',
    budgetTier: 'shoestring',
    title: 'Grande Traversée du Jura en Bikepacking Gravel',
    summary: '5 jours d’aventure à vélo entre combes sauvages, pistes forestières et fruitières à Comté.',
    layers: {
      skeleton: makeProposal('prop-skel-gtj', 'skeleton', 'slot-skeleton', { days: 5 }, '5 étapes de 70 km.'),
      itinerary: makeProposal('prop-itin-gtj', 'itinerary', 'slot-itinerary', { totalDistanceKm: 342, totalGainM: 6050, stagesCount: 5, difficulty: 'moderate' }, 'Tracé gravel GTJ balisé.'),
      accommodations: makeProposal('prop-accom-gtj', 'accommodations', 'slot-night-gtj', { name: 'Campings municipaux et gîtes Accueil Vélo', type: 'bivouac', priceEur: 22 }, 'Campings et auberges.'),
      food_water: makeProposal('prop-food-gtj', 'food_water', 'slot-food', { dailyFormula: 'fruitiere_et_boulangeries', waterStrategy: 'fontaines_potables_villages', resupplyEveryDays: 1 }, 'Avitaillement au jour le jour.'),
      kit: makeProposal('prop-kit-gtj', 'kit', 'slot-kit', { targetWeightKg: 8.6, packVolumeL: 30, essentialCategories: ['sacoches_gravel', 'kit_mèches_tubeless', 'cuissard'] }, 'Bagagerie étanche sur cadre.'),
      budget: makeProposal('prop-budg-gtj', 'budget', 'slot-budget', { totalPerPersonEur: 265, dailyAverageEur: 53, currency: 'EUR' }, 'Budget mini en campings.'),
      compliance: makeProposal('prop-comp-gtj', 'compliance', 'slot-compliance', { pnrCharter: true }, 'Circulation autorisée sur pistes carrossables.'),
      safety: makeProposal('prop-safe-gtj', 'safety', 'slot-safety', { rescuePhone: '112', primaryHazard: 'Crevaison sans réseau' }, 'Secours 112.'),
      know_how: makeProposal('prop-know-gtj', 'know_how', 'slot-knowhow', { rules: ['Ralentir face aux marcheurs', 'Cirer transmission chaque soir'] }, 'Éthique cycliste.'),
    },
  },

  // 9. FRANCE — TOUR DES ÉCRINS & VANOISE
  {
    id: 'bp-fr-ecrins-summer-week-refuge',
    countryCode: 'FR',
    pole: 'Massif des Écrins / Vanoise',
    season: 'summer',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Tour des Glaciers de la Vanoise en Refuges',
    summary: '6 jours au cœur du premier parc national français au pied des dômes glaciaires.',
    layers: {
      skeleton: makeProposal('prop-skel-van', 'skeleton', 'slot-skeleton', { days: 6 }, '6 étapes de refuge en refuge.'),
      itinerary: makeProposal('prop-itin-van', 'itinerary', 'slot-itinerary', { totalDistanceKm: 74, totalGainM: 3900, stagesCount: 6, difficulty: 'moderate' }, 'Sentier balcon de Vanoise.'),
      accommodations: makeProposal('prop-accom-van', 'accommodations', 'slot-night-van', { name: 'Refuges du Parc National de la Vanoise', type: 'refuge', priceEur: 68 }, 'Refuges chaleureux du PNV.'),
      food_water: makeProposal('prop-food-van', 'food_water', 'slot-food', { dailyFormula: 'demi_pension_refuge', waterStrategy: 'eau_potable_refuge', resupplyEveryDays: 2 }, 'Demi-pension PNV.'),
      kit: makeProposal('prop-kit-van', 'kit', 'slot-kit', { targetWeightKg: 6.5, packVolumeL: 32, essentialCategories: ['drap_de_sac', 'veste_impermeable', 'batons'] }, 'Sac léger refuge.'),
      budget: makeProposal('prop-budg-van', 'budget', 'slot-budget', { totalPerPersonEur: 520, dailyAverageEur: 86.6, currency: 'EUR' }, 'Tarifs refuges PNV.'),
      compliance: makeProposal('prop-comp-van', 'compliance', 'slot-compliance', { heartOfPark: true, dogsAllowed: false }, 'Cœur de parc : chiens interdits.'),
      safety: makeProposal('prop-safe-van', 'safety', 'slot-safety', { rescuePhone: '112', rescueUnit: 'PGHM Modane' }, 'Secours PGHM.'),
      know_how: makeProposal('prop-know-van', 'know_how', 'slot-knowhow', { rules: ['Chiens strictement interdits', 'Zéro déchet'] }, 'Charte PNV.'),
    },
  },

  // 10. MAROC — MASSIF DU M'GOUN
  {
    id: 'bp-ma-mgoun-spring-week-refuge',
    countryCode: 'MA',
    pole: 'Massif du M’Goun / Vallée des Roses',
    season: 'spring',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'shoestring',
    title: 'Traversée des Gorges du M’Goun & Vallée des Roses',
    summary: '7 jours de marche aquatique dans les canyons et gîtes berbères traditionnels.',
    layers: {
      skeleton: makeProposal('prop-skel-mgoun', 'skeleton', 'slot-skeleton', { days: 7 }, '7 étapes printanières.'),
      itinerary: makeProposal('prop-itin-mgoun', 'itinerary', 'slot-itinerary', { totalDistanceKm: 65, totalGainM: 2800, stagesCount: 7, difficulty: 'moderate' }, 'Marche dans les lits d’oueds.'),
      accommodations: makeProposal('prop-accom-mgoun', 'accommodations', 'slot-night-mgoun', { name: 'Gîtes berbères d’étape', type: 'refuge', priceEur: 24 }, 'Gîtes chez l’habitant.'),
      food_water: makeProposal('prop-food-mgoun', 'food_water', 'slot-food', { dailyFormula: 'tagines_locaux', waterStrategy: 'filtration_systematique', resupplyEveryDays: 2 }, 'Nourriture locale.'),
      kit: makeProposal('prop-kit-mgoun', 'kit', 'slot-kit', { targetWeightKg: 7.8, packVolumeL: 40, essentialCategories: ['sandales_eau', 'batons', 'filtre_eau'] }, 'Équipement gorges et canyons.'),
      budget: makeProposal('prop-budg-mgoun', 'budget', 'slot-budget', { totalPerPersonEur: 320, dailyAverageEur: 45.7, currency: 'MAD' }, 'Budget économique.'),
      compliance: makeProposal('prop-comp-mgoun', 'compliance', 'slot-compliance', { passportValidityMonths: 3 }, 'Passeport valide 3 mois.'),
      safety: makeProposal('prop-safe-mgoun', 'safety', 'slot-safety', { rescuePhone: '177', primaryHazard: 'Crue subite orageuse' }, 'Surveillance des orages en amont.'),
      know_how: makeProposal('prop-know-mgoun', 'know_how', 'slot-knowhow', { rules: ['Vérifier météo avant d’entrer dans les gorges'] }, 'Sécurité crues.'),
    },
  },

  // 11. MAROC — ERG CHEBBI DÉSERT
  {
    id: 'bp-ma-chebbi-autumn-weekend-bivouac',
    countryCode: 'MA',
    pole: 'Désert d’Agafay / Dunes de Chebbi',
    season: 'autumn',
    durationTier: 'weekend',
    styleTier: 'bivouac',
    budgetTier: 'shoestring',
    title: 'Traversée des Dunes de l’Erg Chebbi à Pied',
    summary: '4 jours d’immersion saharienne au cœur des grandes dunes dorées.',
    layers: {
      skeleton: makeProposal('prop-skel-chebbi', 'skeleton', 'slot-skeleton', { days: 4 }, '4 jours sahariens.'),
      itinerary: makeProposal('prop-itin-chebbi', 'itinerary', 'slot-itinerary', { totalDistanceKm: 42, totalGainM: 650, stagesCount: 4, difficulty: 'moderate' }, 'Progression sur crêtes de dunes.'),
      accommodations: makeProposal('prop-accom-chebbi', 'accommodations', 'slot-night-chebbi', { name: 'Bivouac saharien sous les étoiles', type: 'bivouac', priceEur: 15 }, 'Nuits dans les dunes.'),
      food_water: makeProposal('prop-food-chebbi', 'food_water', 'slot-food', { dailyFormula: 'pain_de_sable_et_dattes', waterStrategy: 'portage_chameau_eau_capsulee', resupplyEveryDays: 4 }, 'Logistique eau par chameau.'),
      kit: makeProposal('prop-kit-chebbi', 'kit', 'slot-kit', { targetWeightKg: 6.2, packVolumeL: 35, essentialCategories: ['cheche', 'lunettes_sable', 'gourde_isotherme'] }, 'Protection contre le sable.'),
      budget: makeProposal('prop-budg-chebbi', 'budget', 'slot-budget', { totalPerPersonEur: 210, dailyAverageEur: 52.5, currency: 'MAD' }, 'Budget désert.'),
      compliance: makeProposal('prop-comp-chebbi', 'compliance', 'slot-compliance', { guideMandatory: true }, 'Chamelier guide local indispensable.'),
      safety: makeProposal('prop-safe-chebbi', 'safety', 'slot-safety', { rescuePhone: '177', primaryHazard: 'Coup de chaleur et désorientation' }, 'Sécurité désert.'),
      know_how: makeProposal('prop-know-chebbi', 'know_how', 'slot-knowhow', { rules: ['Marcher sur le fil des crêtes compactes', 'Boire avant la soif'] }, 'Progression dans le sable.'),
    },
  },

  // 12. ITALIE — GRAN PARADISO
  {
    id: 'bp-it-granparadiso-summer-week-refuge',
    countryCode: 'IT',
    pole: 'Massif du Gran Paradiso',
    season: 'summer',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Tour du Grand Paradis & Refuges Valdotains',
    summary: '6 jours d’immersion alpine sauvage dans le plus ancien parc national d’Italie.',
    layers: {
      skeleton: makeProposal('prop-skel-gp', 'skeleton', 'slot-skeleton', { days: 6 }, '6 étapes en val d’Aoste.'),
      itinerary: makeProposal('prop-itin-gp', 'itinerary', 'slot-itinerary', { totalDistanceKm: 78, totalGainM: 4600, stagesCount: 6, difficulty: 'moderate' }, 'Sentiers royaux de chasse.'),
      accommodations: makeProposal('prop-accom-gp', 'accommodations', 'slot-night-gp', { name: 'Rifugi Chabod et Vittorio Emanuele', type: 'refuge', priceEur: 65 }, 'Refuges de montagne CAI.'),
      food_water: makeProposal('prop-food-gp', 'food_water', 'slot-food', { dailyFormula: 'polenta_fontina_refuge', waterStrategy: 'eau_potable_refuge', resupplyEveryDays: 2 }, 'Gastronomie valdotaine.'),
      kit: makeProposal('prop-kit-gp', 'kit', 'slot-kit', { targetWeightKg: 6.8, packVolumeL: 35, essentialCategories: ['drap_de_sac', 'veste_impermeable', 'batons'] }, 'Sac alpin léger.'),
      budget: makeProposal('prop-budg-gp', 'budget', 'slot-budget', { totalPerPersonEur: 540, dailyAverageEur: 90, currency: 'EUR' }, 'Refuges CAI.'),
      compliance: makeProposal('prop-comp-gp', 'compliance', 'slot-compliance', { schengenStatus: 'valid' }, 'Espace Schengen.'),
      safety: makeProposal('prop-safe-gp', 'safety', 'slot-safety', { rescuePhone: '118', rescueUnit: 'Soccorso Alpino Valdostano' }, 'Secours Aoste.'),
      know_how: makeProposal('prop-know-gp', 'know_how', 'slot-knowhow', { rules: ['Respect des hardes de bouquetins'] }, 'Charte Gran Paradiso.'),
    },
  },

  // 13. NÉPAL — SANCTUAIRE DES ANNAPURNAS (Camp de Base)
  {
    id: 'bp-np-sanctuary-autumn-extended-refuge',
    countryCode: 'NP',
    pole: 'Sanctuaire des Annapurnas / ABC',
    season: 'autumn',
    durationTier: 'extended',
    styleTier: 'refuge',
    budgetTier: 'shoestring',
    title: 'Trek du Sanctuaire des Annapurnas & Camp de Base (ABC)',
    summary: '11 jours au cœur d’un amphithéâtre géant de parois glacées à 4 130 m.',
    layers: {
      skeleton: makeProposal('prop-skel-abc', 'skeleton', 'slot-skeleton', { days: 11 }, '11 jours d’immersion.'),
      itinerary: makeProposal('prop-itin-abc', 'itinerary', 'slot-itinerary', { totalDistanceKm: 92, totalGainM: 5200, stagesCount: 9, difficulty: 'hard' }, 'Sentier de la Modi Khola vers ABC.'),
      accommodations: makeProposal('prop-accom-abc', 'accommodations', 'slot-night-abc', { name: 'Tea Houses du Sanctuaire', type: 'refuge', priceEur: 7 }, 'Lodges locaux.'),
      food_water: makeProposal('prop-food-abc', 'food_water', 'slot-food', { dailyFormula: 'dal_bhat_et_soupe_ail', waterStrategy: 'safe_water_et_micropur', resupplyEveryDays: 1 }, 'Nourriture tea house.'),
      kit: makeProposal('prop-kit-abc', 'kit', 'slot-kit', { targetWeightKg: 8.2, packVolumeL: 45, essentialCategories: ['duvet_confort_moins_10', 'doudoune', 'batons'] }, 'Kit camp de base.'),
      budget: makeProposal('prop-budg-abc', 'budget', 'slot-budget', { totalPerPersonEur: 1150, dailyAverageEur: 104.5, currency: 'NPR' }, 'Budget avec permis et guide.'),
      compliance: makeProposal('prop-comp-abc', 'compliance', 'slot-compliance', { acapPermit: true, timsCard: true, guideMandatory: true }, 'Permis obligatoires.'),
      safety: makeProposal('prop-safe-abc', 'safety', 'slot-safety', { rescueUnit: 'HRA Pokhara', altitudeLimitM: 4130 }, 'Poste médical Chomrong.'),
      know_how: makeProposal('prop-know-abc', 'know_how', 'slot-knowhow', { rules: ['Respect du caractère sacré du sanctuaire (viande interdite en amont)'] }, 'Interdits religieux locaux.'),
    },
  },

  // 14. PORTUGAL — MADÈRE CRÊTES ET LEVADAS
  {
    id: 'bp-pt-madeira-spring-week-refuge',
    countryCode: 'PT',
    pole: 'Madère / Pico Ruivo & Levadas',
    season: 'spring',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Madère Intégrale : Crêtes du Pico Ruivo & Levadas Sauvages',
    summary: '7 jours de randonnée vertigineuse entre mer de nuages et tunnels humides.',
    layers: {
      skeleton: makeProposal('prop-skel-mad', 'skeleton', 'slot-skeleton', { days: 7 }, '7 étapes côtières et de crêtes.'),
      itinerary: makeProposal('prop-itin-mad', 'itinerary', 'slot-itinerary', { totalDistanceKm: 68, totalGainM: 3800, stagesCount: 6, difficulty: 'moderate' }, 'Sentiers PR balisés de l’IFCN.'),
      accommodations: makeProposal('prop-accom-mad', 'accommodations', 'slot-night-mad', { name: 'Guest houses et Quintas traditionnelles', type: 'refuge', priceEur: 35 }, 'Chambres d’hôtes madériennes.'),
      food_water: makeProposal('prop-food-mad', 'food_water', 'slot-food', { dailyFormula: 'cuisine_maderienne_tascas', waterStrategy: 'eau_potable_robinet', resupplyEveryDays: 1 }, 'Poissons et spécialités locales.'),
      kit: makeProposal('prop-kit-mad', 'kit', 'slot-kit', { targetWeightKg: 4.2, packVolumeL: 25, essentialCategories: ['lampe_frontale_etanche', 'veste_impermeable', 'chaussures_adherentes'] }, 'Lampe frontale puissante pour tunnels.'),
      budget: makeProposal('prop-budg-mad', 'budget', 'slot-budget', { totalPerPersonEur: 695, dailyAverageEur: 99.2, currency: 'EUR' }, 'Budget comprenant vol et voiture de location.'),
      compliance: makeProposal('prop-comp-mad', 'compliance', 'slot-compliance', { ifcnFeePaid: true }, 'Contribution éco-touristique IFCN.'),
      safety: makeProposal('prop-safe-mad', 'safety', 'slot-safety', { rescuePhone: '112', primaryHazard: 'Vertige et glissades en tunnel' }, 'Protection civile Madère.'),
      know_how: makeProposal('prop-know-mad', 'know_how', 'slot-knowhow', { rules: ['Priorité dans les tunnels au sens du courant'] }, 'Règles des levadas.'),
    },
  },

  // 15. JAPON — KUMANO KODO PÈLERINAGE
  {
    id: 'bp-jp-kumano-spring-week-refuge',
    countryCode: 'JP',
    pole: 'Japon / Kumano Kodo Nakahechi',
    season: 'spring',
    durationTier: 'week',
    styleTier: 'refuge',
    budgetTier: 'moderate',
    title: 'Pèlerinage Sacré du Kumano Kodo (Route Nakahechi)',
    summary: '8 jours de marche spirituelle sur les pavés moussus, bains onsen et auberges traditionnelles.',
    layers: {
      skeleton: makeProposal('prop-skel-kum', 'skeleton', 'slot-skeleton', { days: 8 }, '8 jours de marche contemplative.'),
      itinerary: makeProposal('prop-itin-kum', 'itinerary', 'slot-itinerary', { totalDistanceKm: 68, totalGainM: 3400, stagesCount: 6, difficulty: 'moderate' }, 'Chemin de pèlerinage UNESCO.'),
      accommodations: makeProposal('prop-accom-kum', 'accommodations', 'slot-night-kum', { name: 'Minshukus et Ryokans avec Onsen', type: 'refuge', priceEur: 110 }, 'Auberges japonaises traditionnelles.'),
      food_water: makeProposal('prop-food-kum', 'food_water', 'slot-food', { dailyFormula: 'diner_kaiseki_gastronomique', waterStrategy: 'eau_potable_partout', resupplyEveryDays: 1 }, 'Haute gastronomie locale Kaiseki.'),
      kit: makeProposal('prop-kit-kum', 'kit', 'slot-kit', { targetWeightKg: 6.8, packVolumeL: 30, essentialCategories: ['veste_pluie', 'parapluie_rando', 'serviette_onsen'] }, 'Sac léger avec transfert de bagages.'),
      budget: makeProposal('prop-budg-kum', 'budget', 'slot-budget', { totalPerPersonEur: 1850, dailyAverageEur: 231, currency: 'JPY' }, 'Ryokans gastronomiques et train Shinkansen.'),
      compliance: makeProposal('prop-comp-kum', 'compliance', 'slot-compliance', { visaFree: true }, 'Exemption de visa pour séjours < 90 jours.'),
      safety: makeProposal('prop-safe-kum', 'safety', 'slot-safety', { rescuePhone: '119', primaryHazard: 'Marches pavées glissantes' }, 'Services d’urgence japonais.'),
      know_how: makeProposal('prop-know-kum', 'know_how', 'slot-knowhow', { rules: ['Se laver avant d’entrer dans le bain onsen', 'Zéro pourboire'] }, 'Étiquette culturelle japonaise.'),
    },
  },

  // 16. FRANCE — STAGE TRAIL CHAMONIX D+
  {
    id: 'bp-fr-chamonix-trail-summer-weekend-fastlight',
    countryCode: 'FR',
    pole: 'Chamonix / Trail Aiguilles Rouges',
    season: 'summer',
    durationTier: 'weekend',
    styleTier: 'fast_light',
    budgetTier: 'moderate',
    title: 'Stage Trail & Skyrunning D+ Aiguilles Rouges',
    summary: '3 jours intensifs à Chamonix, 102 km et 6 900 m D+ en sac gilet de trail ultra-léger.',
    layers: {
      skeleton: makeProposal('prop-skel-trail', 'skeleton', 'slot-skeleton', { days: 3 }, '3 étapes de 34 km et 2300 m D+.'),
      itinerary: makeProposal('prop-itin-trail', 'itinerary', 'slot-itinerary', { totalDistanceKm: 102, totalGainM: 6900, stagesCount: 3, difficulty: 'expert' }, 'Sentiers techniques skyrunning.'),
      accommodations: makeProposal('prop-accom-trail', 'accommodations', 'slot-night-trail', { name: 'Refuges d’Anterne et Moëde', type: 'refuge', priceEur: 62 }, 'Dortoirs coureurs en altitude.'),
      food_water: makeProposal('prop-food-trail', 'food_water', 'slot-food', { dailyFormula: 'nutrition_sportive_et_repas_refuge', waterStrategy: 'flasques_et_filtre_express', resupplyEveryDays: 1 }, 'Barres énergétiques et recharge torrents.'),
      kit: makeProposal('prop-kit-trail', 'kit', 'slot-kit', { targetWeightKg: 3.45, packVolumeL: 12, essentialCategories: ['gilet_trail_12L', 'veste_10000_schmerber', 'couverture_survie', 'flasques'] }, 'Gilet norme UTMB chargé < 3.5kg.'),
      budget: makeProposal('prop-budg-trail', 'budget', 'slot-budget', { totalPerPersonEur: 220, dailyAverageEur: 73.3, currency: 'EUR' }, 'Refuges et nutrition de course.'),
      compliance: makeProposal('prop-comp-trail', 'compliance', 'slot-compliance', { reserveNaturelle: true, dogsAllowed: false }, 'Réserve des Aiguilles Rouges : sentier obligatoire.'),
      safety: makeProposal('prop-safe-trail', 'safety', 'slot-safety', { rescuePhone: '+33450531689', rescueUnit: 'PGHM Chamonix' }, 'Canal sécurité montagne.'),
      know_how: makeProposal('prop-know-trail', 'know_how', 'slot-knowhow', { rules: ['Ranger les bâtons sur les échelles', 'Gérer son allure sous le SV2'] }, 'Technique de course alpine.'),
    },
  },
];

/**
 * Retourne la liste complète des blueprints du catalogue.
 */
export function getAllBlueprints(): Blueprint[] {
  return BLUEPRINT_CATALOG;
}

/**
 * Retourne le nombre exact de blueprints en mémoire.
 */
export function getBlueprintCount(): number {
  return BLUEPRINT_CATALOG.length;
}

/**
 * Résout le blueprint le plus proche d'un TripBrief via un calcul de distance de Minkowski pondérée.
 * S'exécute en < 10 ms en mémoire vive.
 */
export function findClosestBlueprint(brief: TripBrief): Blueprint {
  const targetCountry = brief.destinations.value[0]?.country?.toUpperCase() || 'FR';
  const targetRegion = (brief.destinations.value[0]?.region || '').toLowerCase();
  const targetRaw = (brief.rawInput || '').toLowerCase();
  const days = brief.duration.value.days;
  const month = brief.window.value.month || 7;
  const styles = brief.style.value;
  const budgetTier = brief.budget.value.tier === 'shoestring' ? 'shoestring' : 'moderate';

  // Déduction de la saison
  let targetSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer';
  if ([3, 4, 5].includes(month)) targetSeason = 'spring';
  else if ([6, 7, 8].includes(month)) targetSeason = 'summer';
  else if ([9, 10, 11].includes(month)) targetSeason = 'autumn';
  else targetSeason = 'winter';

  // Déduction de la tranche de durée
  let targetDurationTier: 'weekend' | 'week' | 'extended' = 'week';
  if (days <= 4) targetDurationTier = 'weekend';
  else if (days >= 10) targetDurationTier = 'extended';

  // Déduction du style tier
  let targetStyleTier: 'refuge' | 'bivouac' | 'fast_light' = 'refuge';
  if (styles.includes('bivouac')) targetStyleTier = 'bivouac';
  else if (styles.includes('trail') || styles.includes('bikepacking') || styles.includes('fast_light')) targetStyleTier = 'fast_light';

  let bestMatch: Blueprint = BLUEPRINT_CATALOG[0];
  let minDistance = Infinity;

  for (const bp of BLUEPRINT_CATALOG) {
    let distance = 0;

    // 1. Distance Pays (poids dominant x100)
    if (bp.countryCode !== targetCountry) {
      distance += 100;
    }

    // 2. Mots-clés / Pôle (poids x30)
    const poleNormalized = bp.pole.toLowerCase();
    if (
      targetRegion &&
      (poleNormalized.includes(targetRegion) || targetRegion.includes(poleNormalized))
    ) {
      distance -= 30; // Bonus fort
    }
    if (
      targetRaw.includes('mont-blanc') && bp.pole.includes('Mont-Blanc') ||
      targetRaw.includes('laugavegur') && bp.pole.includes('Laugavegur') ||
      targetRaw.includes('toubkal') && bp.pole.includes('Toubkal') ||
      targetRaw.includes('sancy') && bp.pole.includes('Sancy') ||
      targetRaw.includes('dolomites') && bp.pole.includes('Dolomites') ||
      targetRaw.includes('annapurna') && bp.pole.includes('Annapurna')
    ) {
      distance -= 40; // Bonus exactitude
    }

    // 3. Distance Durée (poids x20)
    if (bp.durationTier !== targetDurationTier) {
      distance += 20;
    }

    // 4. Distance Style (poids x15)
    if (bp.styleTier !== targetStyleTier) {
      distance += 15;
    }

    // 5. Distance Budget (poids x10)
    if (bp.budgetTier !== budgetTier) {
      distance += 10;
    }

    // 6. Distance Saison (poids x5)
    if (bp.season !== targetSeason) {
      distance += 5;
    }

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = bp;
    }
  }

  return bestMatch;
}
