/**
 * Espace de noms `compas.server` (FR, langue source) : les messages que les actions serveur
 * du Compas renvoient à l'écran (erreurs, refus, notes de la préparation). PLAN-100 6.1.
 *
 * Traduits CÔTÉ SERVEUR dans la langue de la requête (`getRequestLocale`), par
 * `src/features/compas/server/serverText.ts` : l'écran affiche `res.error` tel quel.
 * Le français est celui d'avant l'extraction, au caractère près (les tests existants le
 * vérifient). Données (lieu, nombre, titre) en emplacements `{var}` ; pluriels
 * `…One` / `…Other` choisis par `plural()`.
 */
export const compasServerFr = {
  server: {
    common: {
      invalidRequest: 'Requête invalide',
      accessDenied: 'Accès refusé',
      serverError: 'Erreur serveur',
      invalidId: 'Identifiant invalide',
      invalidSlug: 'Slug invalide',
      invalidTrip: 'Voyage invalide',
      tripNotFoundOrDenied: 'Voyage introuvable ou non autorisé.',
      signInToEdit: 'Connecte-toi pour modifier le voyage.',
      editorsOnly: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.',
    },
    placeSearch: {
      tooMany: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
      unavailable: 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.',
    },
    carrier: {
      notInTrip: 'Cette personne ne fait pas partie du voyage.',
      failed: 'Impossible de changer le porteur.',
      noItems: 'Aucun objet à répartir',
      tooManyItems: 'Trop d’objets à répartir d’un coup',
      duplicateItem: 'Un objet est en double',
      stuckVerifiedOne:
        'La répartition a échoué et n’a pas pu être entièrement annulée : {count} objet a gardé son nouveau porteur. Vérifie le kit.',
      stuckVerifiedOther:
        'La répartition a échoué et n’a pas pu être entièrement annulée : {count} objets ont gardé leur nouveau porteur. Vérifie le kit.',
      stuckUnsureOne:
        'La répartition a échoué et n’a pas pu être entièrement annulée : {count} objet a pu garder son nouveau porteur. Vérifie le kit.',
      stuckUnsureOther:
        'La répartition a échoué et n’a pas pu être entièrement annulée : {count} objets ont pu garder leur nouveau porteur. Vérifie le kit.',
    },
    product: {
      unavailable: 'Produit indisponible.',
      linkFailed: 'Impossible de relier ce produit.',
      addFailed: 'Impossible d’ajouter ce produit au kit.',
    },
    inventory: {
      nameRequired: 'Le nom est requis.',
      signIn: 'Connecte-toi pour gérer ton inventaire.',
      addFailed: 'Impossible d’ajouter cet objet à l’inventaire.',
      updateFailed: 'Impossible de mettre à jour cet objet.',
    },
    envelope: {
      invalidAmount: 'Montant invalide',
      saveFailed: 'Impossible d’enregistrer l’enveloppe.',
    },
    dates: {
      invalidDate: 'Date invalide',
      endBeforeStart: 'La fin doit suivre le début.',
      invalid: 'Dates invalides',
      saveFailed: 'Impossible d’enregistrer les dates.',
    },
    activity: {
      invalid: 'Activité invalide',
      saveFailed: 'Impossible de changer l’activité.',
    },
    preferences: {
      invalid: 'Préférences invalides',
      saveFailed: 'Impossible d’enregistrer les préférences.',
    },
    place: {
      invalid: 'Lieu invalide',
      notFound: '« {place} » introuvable sur la carte.',
      notInhabited:
        '« {place} » n’est pas un lieu habité, une région ou un pays : dis une ville (« depuis Lyon »).',
      destinationSaveFailed: 'Impossible d’enregistrer la destination.',
      originSaveFailed: 'Impossible d’enregistrer le lieu de départ.',
    },
    departureTime: {
      invalid: 'Heure invalide',
      saveFailed: 'Impossible d’enregistrer l’heure de départ.',
    },
    duration: {
      invalid: 'Durée invalide',
      saveFailed: 'Impossible d’enregistrer la durée.',
    },
    party: {
      invalid: 'Nombre de personnes invalide',
      saveFailed: 'Impossible de changer le nombre de personnes.',
    },
    lodging: {
      invalid: 'Hébergement invalide',
      noStep: 'Aucune étape pour cette nuit.',
      saveFailed: 'Impossible d’enregistrer l’hébergement.',
    },
    stays: {
      needStartDate: 'Choisis d’abord la date de départ du voyage.',
      noDestination: 'Le voyage n’a pas de destination.',
      liveDisabled:
        'Recherche en direct indisponible : les clés partenaires ne sont pas activées.{detail}',
      tooMany: 'Trop de recherches : réessaie dans quelques minutes.',
      providerFailed: 'Le fournisseur n’a pas répondu : réessaie plus tard. ({detail})',
      partner: 'partenaire',
    },
    myKits: {
      signIn: 'Connecte-toi pour voir tes kits.',
      readFailed: 'Impossible de lire tes kits.',
      itemsReadFailed: 'Impossible de lire les objets de tes kits.',
      unnamed: 'Kit sans nom',
    },
    kit: {
      notFound: 'Kit introuvable.',
      tripKitReadFailed: 'Impossible de lire le kit du voyage.',
      addFailed: 'Impossible d’ajouter les objets du kit.',
      nameTooShort: 'Nom trop court',
      nameTooLong: 'Nom trop long',
      tooMany: 'Trop de kits d’un coup : patiente une minute.',
      tripKitEmpty: 'Le kit du voyage est vide : ajoute d’abord des objets.',
      createFailed: 'Impossible de créer le kit.',
      itemsSaveFailed: 'Impossible d’enregistrer les objets du kit.',
    },
    routes: {
      searchInvalid: 'Recherche invalide',
      signInSearch: 'Connecte-toi pour chercher un parcours.',
      searchUnavailable: 'Recherche indisponible.',
      signInOutings: 'Connecte-toi pour voir tes sorties.',
      numbered: 'Parcours n° {id}',
      invalid: 'Parcours invalide',
      notFound: 'Parcours introuvable.',
      takenByTitled:
        'Ce parcours est déjà celui de ton aventure « {title} ». Ouvre-la depuis le menu des aventures.',
      takenByOther: 'Ce parcours est déjà utilisé par une autre de tes aventures.',
      applyFailed: 'Impossible de choisir ce parcours.',
    },
    interpret: {
      invalidText: 'Phrase trop courte ou trop longue',
      tooMany: 'Trop de demandes d’affilée : patiente quelques minutes.',
      unavailable: 'Compréhension indisponible pour le moment : réessaie dans un instant.',
    },
    /** Note quand la phrase est lue sans l'IA (une par raison d'échec de l'IA). */
    aiNotes: {
      delai_depasse: 'L’IA a mis trop de temps : lu par les règles du Compas.',
      quota_epuise: 'Quota IA du jour atteint : lu par les règles du Compas.',
      ia_eteinte: 'Lu par les règles du Compas (IA éteinte).',
      compteur_illisible:
        'IA coupée par prudence (compteur illisible) : lu par les règles du Compas.',
      provider_indisponible: 'IA indisponible : lu par les règles du Compas.',
      reponse_invalide: 'Réponse IA inexploitable : lu par les règles du Compas.',
    },
    /** Même note pour le verdict expliqué : les signaux de l'écran restent la référence. */
    verdictNotes: {
      delai_depasse: 'L’IA a mis trop de temps : les signaux ci-dessus restent la référence.',
      quota_epuise: 'Quota IA du jour atteint : les signaux ci-dessus restent la référence.',
      ia_eteinte: 'Lu par les règles du Compas (IA éteinte).',
      compteur_illisible:
        'IA coupée par prudence (compteur illisible) : les signaux ci-dessus restent la référence.',
      provider_indisponible: 'IA indisponible : les signaux ci-dessus restent la référence.',
      reponse_invalide: 'Réponse IA inexploitable : les signaux ci-dessus restent la référence.',
      langue: 'L’IA n’explique pas encore dans cette langue : les signaux ci-dessus restent la référence.',
    },
    verdict: {
      signIn: 'Connecte-toi pour obtenir une explication.',
      tooMany: 'Trop d’explications d’affilée : patiente quelques minutes.',
      unavailable: 'Explication indisponible pour le moment : réessaie dans un instant.',
    },
    create: {
      signIn: 'Connecte-toi pour créer une aventure.',
      tooMany: 'Trop de créations d’affilée : patiente une minute.',
      failed: 'L’aventure n’a pas pu être créée. Réessaie.',
      openFailed: 'Aventure créée mais impossible de l’ouvrir : ouvre-la depuis le Hub.',
    },
    openTrip: {
      signIn: 'Connecte-toi pour ouvrir un voyage.',
      failed: 'Impossible d’ouvrir ce voyage.',
    },
    pois: {
      signIn: 'Connecte-toi pour voir les points autour.',
    },
    traveller: {
      invalid: 'Profil invalide',
      signIn: 'Connecte-toi pour enregistrer ton profil voyageur.',
      needAccount: 'Crée ton compte pour enregistrer ton profil voyageur.',
      notTown: '« {place} » n’est pas une ville ou un village : écris ta commune (« Lyon »).',
      saveFailed: 'Impossible d’enregistrer ton profil voyageur.',
    },
    itemHistory: {
      invalid: 'Objet invalide.',
      signIn: 'Connecte-toi pour voir l’historique.',
      notFound: 'Objet introuvable ou non autorisé.',
      connectionLost: 'Connexion perdue : réessaie.',
    },
    invitation: {
      untitledTrip: 'Voyage',
      someone: 'Un voyageur LKDV',
      closed: 'Cette invitation n’est plus ouverte.',
      notFound: 'Invitation introuvable.',
      notInvitee: 'Cette invitation est destinée à quelqu’un d’autre.',
      signIn: 'Connecte-toi pour répondre.',
      tooMany: 'Trop de réponses : patiente une minute.',
      failed: 'Réponse impossible pour le moment.',
    },
    resa: {
      signIn: 'Connecte-toi pour chercher des offres.',
      needDestination: 'Indique une destination.',
      needOrigin: 'Indique ta ville ou ton aéroport de départ.',
      partnerDisabled:
        'Partenaire non activé pour cette catégorie : recherche en direct indisponible.{detail}',
      partnerFailed: 'Le partenaire n’a pas répondu : réessaie plus tard. ({detail})',
      signInActivities: 'Connecte-toi pour voir les activités.',
    },
    bottle: {
      signIn: 'Connecte-toi pour lancer une bouteille à la mer.',
      ownersOnly: 'Seuls les organisateurs gèrent la bouteille à la mer.',
      readFailed: 'Impossible de lire tes bouteilles.',
      untitled: 'Bouteille à la mer',
      someone: 'Voyageur',
      noCountry: 'Pays de destination non renseigné : choisis d’abord où tu pars.',
      suspended: 'Ton compte est restreint pour les groupes suite à un signalement.',
      lowTrust: 'Confiance {trust}/100 : il faut {threshold} pour lancer une bouteille.',
      tooManyOwned: 'Tu as déjà {count} annonces publiques (maximum {max}).',
      titleTooShort: 'Titre trop court',
      titleTooLong: 'Titre trop long',
      messageTooLong: 'Message trop long',
      adultRequired: 'Certifie avoir 18 ans ou plus.',
      returnBeforeDeparture: 'Le retour précède le départ.',
      tooMany: 'Trop de bouteilles d’un coup : patiente.',
      launchBlocked: 'Lancement impossible.',
      launchFailed: 'Impossible de lancer la bouteille.',
      notFound: 'Bouteille introuvable.',
      alreadyHandled: 'Candidature déjà traitée.',
      groupFull: 'Le groupe est complet.',
      answerFailed: 'Réponse non enregistrée.',
    },
    /** « Tout préparer » (`autofillActions.ts`) : refus, notes du résumé, réadaptation. */
    autofill: {
      limitUnavailable: 'Préparation momentanément indisponible : réessaie dans quelques minutes.',
      limitSite:
        'Le Compas prépare beaucoup de voyages en ce moment : je reprends seul dans {minutes} min.',
      limitPersonal: 'Beaucoup de préparations d’affilée : je reprends seul dans {minutes} min.',
      needDays: 'Dis-moi combien de jours, ou choisis les dates.',
      stoppedMidway:
        'Préparation arrêtée en cours de route : « Annuler » retire ce qui est fait, puis relance.',
      alreadyFilled: 'Le voyage est déjà prérempli : annule d’abord pour relancer.',
      naturalAnchor: '« {name} » retenu pour {place} (lieu naturel, adapté à l’activité).',
      positionUnreadable:
        'Position illisible : dis où tu pars (« à Annecy », « dans le Vercors »…).',
      nearHome:
        'Lieu non précisé : préparé près de chez toi ({place}). Change-le dans « Où » si tu pensais à un autre endroit.',
      needPlaceOuting:
        'Partage ta position ou dis où tu sors (« à Annecy », « en forêt de Fontainebleau »…).',
      needPlace: 'Dis-moi où tu pars (« au Népal », « dans le Vercors »…).',
      period: 'Période proposée : {month} ({why}). Change-la dans « Quand » si elle ne te va pas.',
      catalogRoute: 'Parcours du catalogue le plus proche choisi : {name}.',
      catalogRouteNumbered: 'n° {id}',
      calcError: 'erreur de calcul',
      islandBlockedKept:
        'Itinéraire gardé tel quel : sans le contour de l’île, aucune proposition ne peut être prouvée sur l’île. Je réessaie à ta prochaine visite.',
      islandBlockedNone:
        'Aucune étape proposée pour « {place} » : sans le contour de l’île, aucune proposition ne peut être prouvée sur l’île, donc une étape par jour sur le lieu. Je réessaie à ta prochaine visite.',
      plannedFailed: 'Itinéraire calculé impossible : {reason}.',
      plannedFailedAi:
        'Itinéraire calculé impossible : {reason}. Itinéraire proposé par le spécialiste, chaque lieu vérifié sur la carte.',
      aiOff:
        'Sans IA, pas d’étapes détaillées pour « {place} » : une étape par jour sur le lieu. Précise une région ou une ville dans « Où » pour des étapes sur des lieux réels.',
      countryFailed: 'Bases multiples du pays impossibles : {reason}.',
      keptLate:
        'Itinéraire gardé tel quel : la nouvelle proposition n’est pas arrivée à temps. Je réessaie à ta prochaine visite.',
      detailUnavailable:
        'Itinéraire détaillé indisponible pour le moment : une étape par jour sur le lieu. Je réessaie à ta prochaine visite, ou affine-le dans Parcours.',
      droppedOne:
        '{count} lieu(x) proposé(s) introuvable(s) sur la carte : étape gardée au lieu précédent.',
      droppedOther:
        '{count} lieu(x) proposé(s) introuvable(s) sur la carte : étape gardée au lieu précédent.',
      manyMissing:
        'Plusieurs lieux de l’itinéraire n’existent pas sur la carte : je le redemande à ta prochaine visite.',
      backtrack:
        'Itinéraire en allers-retours pour une traversée : je le redemande à ta prochaine visite.',
      reordered: 'Étapes remises dans un ordre plus direct : environ {km} km de route en moins.',
      estimatedOne:
        '{count} étape avec une distance estimée (itinéraire non calculé) : à vérifier.',
      estimatedOther:
        '{count} étapes avec une distance estimée (itinéraire non calculé) : à vérifier.',
      stoppedNothing: 'Préparation arrêtée : rien n’a été écrit.',
      stepsSaveFailed: 'Itinéraire non enregistré : réessaie dans un instant.',
      stoppedKept:
        'Préparation arrêtée à ta demande : l’itinéraire est gardé, nuits, kit et budget ne sont pas faits. « Annuler » retire tout.',
      kitSaveFailed: 'Kit non enregistré (erreur d’écriture) : relance « Tout préparer ».',
      budgetSaveFailed: 'Budget non enregistré (erreur d’écriture) : relance « Tout préparer ».',
      optionalGear:
        'Matériel conseillé non compté au budget : {amount} € à la boutique si tu ne l’as pas (facultatif).',
      /** Itinéraire calculé (lieux réels de la carte) : notes et raisons d'un repli. */
      plan: {
        islandPlacesUnavailable: 'lieux de l’île indisponibles (service de carte injoignable)',
        islandAltitudesMissing: 'altitudes des lieux de l’île introuvables',
        islandZoneSaid:
          'Grande île : zone de {km} km autour de « {place} », le lieu que tu as dit.',
        islandZoneHigh:
          'Grande île : zone de {km} km autour de {place}, là où les lieux habités sont les plus hauts de l’île{highest}. Altitudes des lieux, pas des sommets.',
        islandZoneHighest: ' (jusqu’à {meters} m)',
        islandOwnMassif: 'son massif',
        climbingBaseOne:
          'Escalade : base {at}, au pied de « {site} » ({count} sites d’escalade à moins de 2 km, référentiel OpenStreetMap).',
        climbingBaseOther:
          'Escalade : base {at}, au pied de « {site} » ({count} sites d’escalade à moins de 2 km, référentiel OpenStreetMap).',
        skiBaseOne:
          'Ski : base {at}, au pied de « {site} » ({count} domaine skiable{lifts} à moins de 5 km, référentiel OpenStreetMap).',
        skiBaseOther:
          'Ski : base {at}, au pied de « {site} » ({count} domaines skiables{lifts} à moins de 5 km, référentiel OpenStreetMap).',
        skiLiftsOne: ' et {count} gare de remontée',
        skiLiftsOther: ' et {count} gares de remontée',
        riverDescent:
          'Descente de rivière ({river}) : {km} km d’eau en {days} jours, {from} {to}, un soir au bord de l’eau.',
        riverFailed:
          'Descente de rivière impossible ({reason}) : séjour sur l’eau depuis une base.',
        riverNoLine: 'tracé de « {river} » introuvable sur la carte',
        riverNoPlaces: 'aucun lieu trouvé le long du tronçon',
        riverNoVillage: 'aucun village au bord de l’eau sur le tronçon',
        islandNoContour:
          'contour de l’île introuvable sur la carte, aucun lieu ne peut être prouvé sur l’île',
        islandMassifFailed:
          'Massif de l’île non trouvé ({reason}) : zone prise au centre de l’île.',
        zoneUnavailable: 'lieux de la zone indisponibles (service de carte injoignable)',
        zoneUnavailableDiag:
          'lieux de la zone indisponibles (service de carte injoignable : {diag})',
        tooFewPlaces: 'trop peu de lieux où dormir dans la zone ({count} trouvés)',
        tooFewDistinct:
          '{distinct} lieu(x) où dormir seulement à distance d’étape ({count} lieux dans la zone)',
        itineraryOne:
          'Itinéraire {shape} construit sur des lieux réels de la carte ({count} lieu où dormir){via}.',
        itineraryOther:
          'Itinéraire {shape} construit sur des lieux réels de la carte ({count} lieux où dormir){via}.',
        shapeTraverse: 'en traversée',
        shapeLoop: 'en boucle',
        shapeBase: 'depuis une base',
        via: ', en passant par {places}',
        countryUnavailable: 'lieux du pays indisponibles (service de carte injoignable)',
        countryUnavailableDiag:
          'lieux du pays indisponibles (service de carte injoignable : {diag})',
        countryTooFew: 'trop peu de lieux où poser des bases dans le pays ({count} trouvés)',
        countryVehicle: ' Les changements de base se font en véhicule (distances à vol d’oiseau).',
        countryOne:
          'Itinéraire en {count} base calculé sans l’IA sur des lieux réels de la carte : {bases}.{vehicle}',
        countryOther:
          'Itinéraire en {count} bases calculé sans l’IA sur des lieux réels de la carte : {bases}.{vehicle}',
        baseDays: '{name} ({days} j)',
      },
      undo: {
        running: 'Une préparation est en cours : attends sa fin ou arrête-la, puis annule.',
        nothing: 'Rien à annuler.',
      },
      refresh: {
        tooMany: 'Beaucoup de changements d’affilée : patiente quelques minutes.',
        cut: 'Préparation coupée en cours de route : relance « Tout préparer » pour la finir, ou annule-la.',
        running: 'Une préparation est déjà en cours.',
        saveFailed: 'Réadaptation non enregistrée : réessaie.',
        keptSteps: 'itinéraire retouché, gardé',
        keptNightsOne: '{count} nuit choisie par toi, gardée',
        keptNightsOther: '{count} nuits choisies par toi, gardées',
        keptItemsOne: '{count} objet du sac déjà touché, gardé',
        keptItemsOther: '{count} objets du sac déjà touchés, gardés',
        keptBudgetOne: '{count} ligne de budget modifiée, gardée',
        keptBudgetOther: '{count} lignes de budget modifiées, gardées',
        labelOne: '{parts} réadapté',
        labelOther: '{parts} réadaptés',
        /** Mêmes mots que `PART_LABEL` (moteur), vérifiés par les tests. */
        parts: {
          steps: 'itinéraire',
          nights: 'nuits',
          transport: 'trajet',
          kit: 'sac',
          budget: 'budget',
        },
      },
    },
  },
} as const;
