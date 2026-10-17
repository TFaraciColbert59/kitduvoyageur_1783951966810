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
  },
} as const;
