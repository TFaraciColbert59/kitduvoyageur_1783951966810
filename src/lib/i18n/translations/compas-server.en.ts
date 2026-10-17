import type { compasServerFr } from './compas-server.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/**
 * Espace de noms `compas.server` (EN). Même forme que `compas-server.fr.ts`, imposée par le
 * type. Messages des actions serveur du Compas ; traduction naturelle, pas mot à mot.
 */
export const compasServerEn: Shape<typeof compasServerFr> = {
  server: {
    common: {
      invalidRequest: 'Invalid request',
      accessDenied: 'Access denied',
      serverError: 'Server error',
      invalidId: 'Invalid identifier',
      invalidSlug: 'Invalid slug',
      invalidTrip: 'Invalid trip',
      tripNotFoundOrDenied: 'Trip not found, or you don’t have access to it.',
      signInToEdit: 'Sign in to edit the trip.',
      editorsOnly: 'Only organisers and editors can change the kit.',
    },
    placeSearch: {
      tooMany: 'Too many place searches in a row: wait a few minutes.',
      unavailable: 'Place search is unavailable right now: try again in a moment.',
    },
    carrier: {
      notInTrip: 'This person isn’t part of the trip.',
      failed: 'Couldn’t change who carries it.',
      noItems: 'No items to assign',
      tooManyItems: 'Too many items to assign at once',
      duplicateItem: 'An item appears twice',
      stuckVerifiedOne:
        'The assignment failed and couldn’t be fully undone: {count} item kept its new carrier. Check the kit.',
      stuckVerifiedOther:
        'The assignment failed and couldn’t be fully undone: {count} items kept their new carrier. Check the kit.',
      stuckUnsureOne:
        'The assignment failed and couldn’t be fully undone: {count} item may have kept its new carrier. Check the kit.',
      stuckUnsureOther:
        'The assignment failed and couldn’t be fully undone: {count} items may have kept their new carrier. Check the kit.',
    },
    product: {
      unavailable: 'Product unavailable.',
      linkFailed: 'Couldn’t link this product.',
      addFailed: 'Couldn’t add this product to the kit.',
    },
    inventory: {
      nameRequired: 'A name is required.',
      signIn: 'Sign in to manage your inventory.',
      addFailed: 'Couldn’t add this item to your inventory.',
      updateFailed: 'Couldn’t update this item.',
    },
    envelope: {
      invalidAmount: 'Invalid amount',
      saveFailed: 'Couldn’t save the budget.',
    },
    dates: {
      invalidDate: 'Invalid date',
      endBeforeStart: 'The end must come after the start.',
      invalid: 'Invalid dates',
      saveFailed: 'Couldn’t save the dates.',
    },
    activity: {
      invalid: 'Invalid activity',
      saveFailed: 'Couldn’t change the activity.',
    },
    preferences: {
      invalid: 'Invalid preferences',
      saveFailed: 'Couldn’t save your preferences.',
    },
    place: {
      invalid: 'Invalid place',
      notFound: '“{place}” wasn’t found on the map.',
      notInhabited: '“{place}” isn’t a town, a region or a country: name a town (“from Lyon”).',
      destinationSaveFailed: 'Couldn’t save the destination.',
      originSaveFailed: 'Couldn’t save the starting point.',
    },
    departureTime: {
      invalid: 'Invalid time',
      saveFailed: 'Couldn’t save the departure time.',
    },
    duration: {
      invalid: 'Invalid duration',
      saveFailed: 'Couldn’t save the duration.',
    },
    party: {
      invalid: 'Invalid number of people',
      saveFailed: 'Couldn’t change the number of people.',
    },
    lodging: {
      invalid: 'Invalid accommodation',
      noStep: 'No stage for this night.',
      saveFailed: 'Couldn’t save the accommodation.',
    },
    stays: {
      needStartDate: 'Choose the trip’s start date first.',
      noDestination: 'The trip has no destination.',
      liveDisabled: 'Live search unavailable: partner keys aren’t enabled.{detail}',
      tooMany: 'Too many searches: try again in a few minutes.',
      providerFailed: 'The provider didn’t respond: try again later. ({detail})',
      partner: 'partner',
    },
    myKits: {
      signIn: 'Sign in to see your kits.',
      readFailed: 'Couldn’t load your kits.',
      itemsReadFailed: 'Couldn’t load the items in your kits.',
      unnamed: 'Untitled kit',
    },
    kit: {
      notFound: 'Kit not found.',
      tripKitReadFailed: 'Couldn’t load the trip’s kit.',
      addFailed: 'Couldn’t add the kit’s items.',
      nameTooShort: 'Name too short',
      nameTooLong: 'Name too long',
      tooMany: 'Too many kits at once: wait a minute.',
      tripKitEmpty: 'The trip’s kit is empty: add some items first.',
      createFailed: 'Couldn’t create the kit.',
      itemsSaveFailed: 'Couldn’t save the kit’s items.',
    },
    routes: {
      searchInvalid: 'Invalid search',
      signInSearch: 'Sign in to search for a route.',
      searchUnavailable: 'Search unavailable.',
      signInOutings: 'Sign in to see your outings.',
      numbered: 'Route no. {id}',
      invalid: 'Invalid route',
      notFound: 'Route not found.',
      takenByTitled:
        'This route is already used by your adventure “{title}”. Open it from the adventures menu.',
      takenByOther: 'This route is already used by another of your adventures.',
      applyFailed: 'Couldn’t choose this route.',
    },
    interpret: {
      invalidText: 'Sentence too short or too long',
      tooMany: 'Too many requests in a row: wait a few minutes.',
      unavailable: 'Understanding is unavailable right now: try again in a moment.',
    },
    aiNotes: {
      delai_depasse: 'The AI took too long: read by the Compas rules.',
      quota_epuise: 'Daily AI quota reached: read by the Compas rules.',
      ia_eteinte: 'Read by the Compas rules (AI turned off).',
      compteur_illisible:
        'AI paused as a precaution (unreadable counter): read by the Compas rules.',
      provider_indisponible: 'AI unavailable: read by the Compas rules.',
      reponse_invalide: 'Unusable AI response: read by the Compas rules.',
    },
    verdictNotes: {
      delai_depasse: 'The AI took too long: the signals above remain the reference.',
      quota_epuise: 'Daily AI quota reached: the signals above remain the reference.',
      ia_eteinte: 'AI turned off: the signals above remain the reference.',
      compteur_illisible:
        'AI paused as a precaution (unreadable counter): the signals above remain the reference.',
      provider_indisponible: 'AI unavailable: the signals above remain the reference.',
      reponse_invalide: 'Unusable AI response: the signals above remain the reference.',
    },
    verdict: {
      signIn: 'Sign in to get an explanation.',
      tooMany: 'Too many explanations in a row: wait a few minutes.',
      unavailable: 'Explanation unavailable right now: try again in a moment.',
    },
    create: {
      signIn: 'Sign in to create an adventure.',
      tooMany: 'Too many adventures created in a row: wait a minute.',
      failed: 'We couldn’t create the adventure. Try again.',
      openFailed: 'Adventure created but it couldn’t be opened: open it from the Hub.',
    },
    openTrip: {
      signIn: 'Sign in to open a trip.',
      failed: 'Couldn’t open this trip.',
    },
  },
};
