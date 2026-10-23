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
      langue: 'AI explanations aren’t available in this language yet: the signals above remain the reference.',
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
    pois: {
      signIn: 'Sign in to see points of interest nearby.',
    },
    traveller: {
      invalid: 'Invalid profile',
      signIn: 'Sign in to save your traveller profile.',
      needAccount: 'Create your account to save your traveller profile.',
      notTown: '“{place}” isn’t a town or village: enter your town (“Lyon”).',
      saveFailed: 'Couldn’t save your traveller profile.',
    },
    itemHistory: {
      invalid: 'Invalid item.',
      signIn: 'Sign in to see the history.',
      notFound: 'Item not found, or you don’t have access to it.',
      connectionLost: 'Connection lost: try again.',
    },
    invitation: {
      untitledTrip: 'Trip',
      someone: 'An LKDV traveller',
      closed: 'This invitation is no longer open.',
      notFound: 'Invitation not found.',
      notInvitee: 'This invitation is meant for someone else.',
      signIn: 'Sign in to reply.',
      tooMany: 'Too many replies: wait a minute.',
      failed: 'Couldn’t reply right now.',
    },
    resa: {
      signIn: 'Sign in to search for offers.',
      needDestination: 'Enter a destination.',
      needOrigin: 'Enter your departure town or airport.',
      partnerDisabled: 'Partner not enabled for this category: live search unavailable.{detail}',
      partnerFailed: 'The partner didn’t respond: try again later. ({detail})',
      signInActivities: 'Sign in to see activities.',
    },
    bottle: {
      signIn: 'Sign in to send a message in a bottle.',
      ownersOnly: 'Only organisers manage the message in a bottle.',
      readFailed: 'Couldn’t load your bottles.',
      untitled: 'Message in a bottle',
      someone: 'Traveller',
      noCountry: 'No destination country yet: choose where you’re going first.',
      suspended: 'Your account is restricted from groups following a report.',
      lowTrust: 'Trust {trust}/100: you need {threshold} to send a bottle.',
      tooManyOwned: 'You already have {count} public listings (maximum {max}).',
      titleTooShort: 'Title too short',
      titleTooLong: 'Title too long',
      messageTooLong: 'Message too long',
      adultRequired: 'Confirm that you are 18 or over.',
      returnBeforeDeparture: 'The return is before the departure.',
      tooMany: 'Too many bottles at once: wait a moment.',
      launchBlocked: 'Can’t send it.',
      launchFailed: 'Couldn’t send the bottle.',
      notFound: 'Bottle not found.',
      alreadyHandled: 'Application already handled.',
      groupFull: 'The group is full.',
      answerFailed: 'Reply not saved.',
    },
    autofill: {
      limitUnavailable: 'Preparation is temporarily unavailable: try again in a few minutes.',
      limitSite:
        'The Compas is preparing a lot of trips right now: I’ll pick this up on my own in {minutes} min.',
      limitPersonal: 'Lots of preparations in a row: I’ll pick this up on my own in {minutes} min.',
      needDays: 'Tell me how many days, or choose the dates.',
      stoppedMidway: 'Preparation stopped partway: “Undo” removes what was done, then start again.',
      alreadyFilled: 'This trip is already prepared: undo it first to start again.',
      naturalAnchor: '“{name}” chosen for {place} (natural area, suited to the activity).',
      positionUnreadable:
        'Couldn’t read your location: say where you’re going (“in Annecy”, “in the Vercors”…).',
      nearHome:
        'No place given: prepared near you ({place}). Change it under “Where” if you had somewhere else in mind.',
      needPlaceOuting:
        'Share your location or say where you’re heading (“in Annecy”, “in the Fontainebleau forest”…).',
      needPlace: 'Tell me where you’re going (“to Nepal”, “in the Vercors”…).',
      period: 'Suggested period: {month} ({why}). Change it under “When” if it doesn’t suit you.',
      catalogRoute: 'Closest route from the catalogue chosen: {name}.',
      catalogRouteNumbered: 'no. {id}',
      calcError: 'calculation error',
      trailStagesNotFound:
        'Stages of the “{trail}” trail not found on the map: itinerary calculated on real places in the area.',
      islandBlockedKept:
        'Itinerary kept as it was: without the island’s outline, no suggestion can be proven to be on the island. I’ll try again on your next visit.',
      islandBlockedNone:
        'No stages suggested for “{place}”: without the island’s outline, no suggestion can be proven to be on the island, so one stage per day at the place. I’ll try again on your next visit.',
      plannedFailed: 'Couldn’t calculate the itinerary: {reason}.',
      plannedFailedAi:
        'Couldn’t calculate the itinerary: {reason}. Itinerary suggested by the specialist, every place checked on the map.',
      aiOff:
        'Without AI, no detailed stages for “{place}”: one stage per day at the place. Name a region or a town under “Where” for stages in real places.',
      countryFailed: 'Couldn’t plan several bases in the country: {reason}.',
      keptLate:
        'Itinerary kept as it was: the new suggestion didn’t arrive in time. I’ll try again on your next visit.',
      detailUnavailable:
        'Detailed itinerary unavailable for now: one stage per day at the place. I’ll try again on your next visit, or refine it under Route.',
      droppedOne:
        '{count} suggested place wasn’t found on the map: the stage stays at the previous place.',
      droppedOther:
        '{count} suggested places weren’t found on the map: those stages stay at the previous place.',
      manyMissing:
        'Several places in the itinerary don’t exist on the map: I’ll ask again on your next visit.',
      backtrack:
        'The itinerary doubles back on a point-to-point route: I’ll ask again on your next visit.',
      reordered: 'Stages put in a more direct order: about {km} km less driving.',
      estimatedOne:
        '{count} stage with an estimated distance (route not calculated): to be checked.',
      estimatedOther:
        '{count} stages with an estimated distance (route not calculated): to be checked.',
      stoppedNothing: 'Preparation stopped: nothing was written.',
      stepsSaveFailed: 'Itinerary not saved: try again in a moment.',
      stoppedKept:
        'Preparation stopped at your request: the itinerary is kept; nights, kit and budget aren’t done. “Undo” removes everything.',
      kitSaveFailed: 'Kit not saved (write error): run “Prepare everything” again.',
      budgetSaveFailed: 'Budget not saved (write error): run “Prepare everything” again.',
      optionalGear:
        'Recommended gear not counted in the budget: €{amount} at the shop if you don’t have it (optional).',
      plan: {
        islandPlacesUnavailable: 'places on the island unavailable (map service unreachable)',
        islandAltitudesMissing: 'altitudes of the island’s places not found',
        islandZoneSaid: 'Large island: a {km} km area around “{place}”, the place you named.',
        islandZoneHigh:
          'Large island: a {km} km area around {place}, where the island’s towns and villages are highest{highest}. Altitudes of places, not of summits.',
        islandZoneHighest: ' (up to {meters} m)',
        islandOwnMassif: 'its mountains',
        climbingBaseOne:
          'Climbing: base {at}, at the foot of “{site}” ({count} climbing site within 2 km, OpenStreetMap data).',
        climbingBaseOther:
          'Climbing: base {at}, at the foot of “{site}” ({count} climbing sites within 2 km, OpenStreetMap data).',
        skiBaseOne:
          'Skiing: base {at}, at the foot of “{site}” ({count} ski area{lifts} within 5 km, OpenStreetMap data).',
        skiBaseOther:
          'Skiing: base {at}, at the foot of “{site}” ({count} ski areas{lifts} within 5 km, OpenStreetMap data).',
        skiLiftsOne: ' and {count} lift station',
        skiLiftsOther: ' and {count} lift stations',
        riverDescent:
          'River descent ({river}): {km} km of water over {days} days, {from} {to}, each evening by the water.',
        riverFailed: 'River descent not possible ({reason}): a stay on the water from a base.',
        riverNoLine: 'course of “{river}” not found on the map',
        riverNoPlaces: 'no places found along the stretch',
        riverNoVillage: 'no riverside village along the stretch',
        islandNoContour:
          'island outline not found on the map, no place can be proven to be on the island',
        islandMassifFailed:
          'Island mountains not found ({reason}): area taken at the centre of the island.',
        zoneUnavailable: 'places in the area unavailable (map service unreachable)',
        zoneUnavailableDiag: 'places in the area unavailable (map service unreachable: {diag})',
        tooFewPlaces: 'too few places to sleep in the area ({count} found)',
        tooFewDistinct:
          'only {distinct} place(s) to sleep within a day’s stage ({count} places in the area)',
        itineraryOne:
          'Itinerary {shape} built on real places from the map ({count} place to sleep){via}.',
        itineraryOther:
          'Itinerary {shape} built on real places from the map ({count} places to sleep){via}.',
        shapeTraverse: 'as a point-to-point route',
        shapeLoop: 'as a loop',
        shapeBase: 'from a base',
        via: ', by way of {places}',
        countryUnavailable: 'places in the country unavailable (map service unreachable)',
        countryUnavailableDiag:
          'places in the country unavailable (map service unreachable: {diag})',
        countryTooFew: 'too few places to set up bases in the country ({count} found)',
        countryVehicle: ' Moving between bases is done by vehicle (straight-line distances).',
        countryOne:
          'Itinerary with {count} base, calculated without AI on real places from the map: {bases}.{vehicle}',
        countryOther:
          'Itinerary with {count} bases, calculated without AI on real places from the map: {bases}.{vehicle}',
        baseDays: '{name} ({days} d)',
        pointToPointUnavailable: 'places between the two unavailable (map service unreachable)',
        pointToPointUnavailableDiag: 'places between the two unavailable (map service unreachable: {diag})',
        pointToPointTooFew: 'too few places to sleep between {from} and {to} ({count} found)',
        pointToPointOne:
          'Itinerary {from} {to} built on real places from the map ({count} place to sleep, about {km} km a day).',
        pointToPointOther:
          'Itinerary {from} {to} built on real places from the map ({count} places to sleep, about {km} km a day).',
        pointToPointFailed: 'Itinerary {from} {to} not possible ({reason}): prepared around {place}.',
      },
      undo: {
        running: 'A preparation is in progress: wait for it to finish or stop it, then undo.',
        nothing: 'Nothing to undo.',
      },
      refresh: {
        tooMany: 'Lots of changes in a row: wait a few minutes.',
        cut: 'Preparation cut off partway: run “Prepare everything” again to finish it, or undo it.',
        running: 'A preparation is already in progress.',
        saveFailed: 'Adaptation not saved: try again.',
        keptSteps: 'itinerary edited, kept',
        keptNightsOne: '{count} night you chose, kept',
        keptNightsOther: '{count} nights you chose, kept',
        keptItemsOne: '{count} pack item already changed, kept',
        keptItemsOther: '{count} pack items already changed, kept',
        keptBudgetOne: '{count} edited budget line, kept',
        keptBudgetOther: '{count} edited budget lines, kept',
        labelOne: '{parts} adapted',
        labelOther: '{parts} adapted',
        parts: {
          steps: 'itinerary',
          nights: 'nights',
          transport: 'travel',
          kit: 'pack',
          budget: 'costs',
        },
      },
    },
  },
};
