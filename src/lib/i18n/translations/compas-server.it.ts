import type { compasServerFr } from './compas-server.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/**
 * Espace de noms `compas.server` (IT). Même forme que `compas-server.fr.ts`, imposée par le
 * type. Messages des actions serveur du Compas ; registre « Lei ».
 */
export const compasServerIt: Shape<typeof compasServerFr> = {
  server: {
    common: {
      invalidRequest: 'Richiesta non valida',
      accessDenied: 'Accesso negato',
      serverError: 'Errore del server',
      invalidId: 'Identificativo non valido',
      invalidSlug: 'Identificativo URL non valido',
      invalidTrip: 'Viaggio non valido',
      tripNotFoundOrDenied: 'Viaggio non trovato, oppure non vi ha accesso.',
      signInToEdit: 'Acceda per modificare il viaggio.',
      editorsOnly: 'Solo gli organizzatori e i redattori possono modificare l’attrezzatura.',
    },
    placeSearch: {
      tooMany: 'Troppe ricerche di luoghi di seguito: attenda qualche minuto.',
      unavailable: 'La ricerca di luoghi non è disponibile al momento: riprovi tra poco.',
    },
    carrier: {
      notInTrip: 'Questa persona non fa parte del viaggio.',
      failed: 'Non è stato possibile cambiare chi lo porta.',
      noItems: 'Nessun oggetto da assegnare',
      tooManyItems: 'Troppi oggetti da assegnare in una volta',
      duplicateItem: 'Un oggetto compare due volte',
      stuckVerifiedOne:
        'L’assegnazione non è riuscita e non è stato possibile annullarla del tutto: {count} oggetto ha mantenuto il nuovo portatore. Verifichi l’attrezzatura.',
      stuckVerifiedOther:
        'L’assegnazione non è riuscita e non è stato possibile annullarla del tutto: {count} oggetti hanno mantenuto il nuovo portatore. Verifichi l’attrezzatura.',
      stuckUnsureOne:
        'L’assegnazione non è riuscita e non è stato possibile annullarla del tutto: {count} oggetto potrebbe aver mantenuto il nuovo portatore. Verifichi l’attrezzatura.',
      stuckUnsureOther:
        'L’assegnazione non è riuscita e non è stato possibile annullarla del tutto: {count} oggetti potrebbero aver mantenuto il nuovo portatore. Verifichi l’attrezzatura.',
    },
    product: {
      unavailable: 'Prodotto non disponibile.',
      linkFailed: 'Non è stato possibile collegare questo prodotto.',
      addFailed: 'Non è stato possibile aggiungere questo prodotto all’attrezzatura.',
    },
    inventory: {
      nameRequired: 'Serve un nome.',
      signIn: 'Acceda per gestire il Suo inventario.',
      addFailed: 'Non è stato possibile aggiungere questo oggetto al Suo inventario.',
      updateFailed: 'Non è stato possibile aggiornare questo oggetto.',
    },
    envelope: {
      invalidAmount: 'Importo non valido',
      saveFailed: 'Non è stato possibile salvare il budget.',
    },
    dates: {
      invalidDate: 'Data non valida',
      endBeforeStart: 'La fine deve essere successiva all’inizio.',
      invalid: 'Date non valide',
      saveFailed: 'Non è stato possibile salvare le date.',
    },
    activity: {
      invalid: 'Attività non valida',
      saveFailed: 'Non è stato possibile cambiare l’attività.',
    },
    preferences: {
      invalid: 'Preferenze non valide',
      saveFailed: 'Non è stato possibile salvare le Sue preferenze.',
    },
    place: {
      invalid: 'Luogo non valido',
      notFound: '«{place}» non è stato trovato sulla mappa.',
      notInhabited: '«{place}» non è una località, una regione né un paese: indichi una località («da Lione»).',
      destinationSaveFailed: 'Non è stato possibile salvare la destinazione.',
      originSaveFailed: 'Non è stato possibile salvare il punto di partenza.',
    },
    departureTime: {
      invalid: 'Orario non valido',
      saveFailed: 'Non è stato possibile salvare l’orario di partenza.',
    },
    duration: {
      invalid: 'Durata non valida',
      saveFailed: 'Non è stato possibile salvare la durata.',
    },
    party: {
      invalid: 'Numero di persone non valido',
      saveFailed: 'Non è stato possibile cambiare il numero di persone.',
    },
    lodging: {
      invalid: 'Alloggio non valido',
      noStep: 'Nessuna tappa per questa notte.',
      saveFailed: 'Non è stato possibile salvare l’alloggio.',
    },
    stays: {
      needStartDate: 'Scelga prima la data di partenza del viaggio.',
      noDestination: 'Il viaggio non ha una destinazione.',
      liveDisabled: 'Ricerca in tempo reale non disponibile: le chiavi dei partner non sono attive.{detail}',
      tooMany: 'Troppe ricerche: riprovi tra qualche minuto.',
      providerFailed: 'Il fornitore non ha risposto: riprovi più tardi. ({detail})',
      partner: 'partner',
    },
    myKits: {
      signIn: 'Acceda per vedere le Sue attrezzature.',
      readFailed: 'Non è stato possibile caricare le Sue attrezzature.',
      itemsReadFailed: 'Non è stato possibile caricare gli oggetti delle Sue attrezzature.',
      unnamed: 'Attrezzatura senza nome',
    },
    kit: {
      notFound: 'Attrezzatura non trovata.',
      tripKitReadFailed: 'Non è stato possibile caricare l’attrezzatura del viaggio.',
      addFailed: 'Non è stato possibile aggiungere gli oggetti dell’attrezzatura.',
      nameTooShort: 'Nome troppo corto',
      nameTooLong: 'Nome troppo lungo',
      tooMany: 'Troppe attrezzature in una volta: attenda un minuto.',
      tripKitEmpty: 'L’attrezzatura del viaggio è vuota: aggiunga prima qualche oggetto.',
      createFailed: 'Non è stato possibile creare l’attrezzatura.',
      itemsSaveFailed: 'Non è stato possibile salvare gli oggetti dell’attrezzatura.',
    },
    routes: {
      searchInvalid: 'Ricerca non valida',
      signInSearch: 'Acceda per cercare un percorso.',
      searchUnavailable: 'Ricerca non disponibile.',
      signInOutings: 'Acceda per vedere le Sue uscite.',
      numbered: 'Percorso n. {id}',
      invalid: 'Percorso non valido',
      notFound: 'Percorso non trovato.',
      takenByTitled:
        'Questo percorso è già usato dalla Sua avventura «{title}». La apra dal menu delle avventure.',
      takenByOther: 'Questo percorso è già usato da un’altra delle Sue avventure.',
      applyFailed: 'Non è stato possibile scegliere questo percorso.',
    },
    interpret: {
      invalidText: 'Frase troppo corta o troppo lunga',
      tooMany: 'Troppe richieste di seguito: attenda qualche minuto.',
      unavailable: 'La comprensione non è disponibile al momento: riprovi tra poco.',
    },
    aiNotes: {
      delai_depasse: 'L’IA ha impiegato troppo tempo: letto dalle regole del Compas.',
      quota_epuise: 'Quota giornaliera dell’IA raggiunta: letto dalle regole del Compas.',
      ia_eteinte: 'Letto dalle regole del Compas (IA disattivata).',
      compteur_illisible:
        'IA sospesa per prudenza (contatore illeggibile): letto dalle regole del Compas.',
      provider_indisponible: 'IA non disponibile: letto dalle regole del Compas.',
      reponse_invalide: 'Risposta dell’IA inutilizzabile: letto dalle regole del Compas.',
    },
    verdictNotes: {
      delai_depasse: 'L’IA ha impiegato troppo tempo: i segnali sopra restano il riferimento.',
      quota_epuise: 'Quota giornaliera dell’IA raggiunta: i segnali sopra restano il riferimento.',
      ia_eteinte: 'IA disattivata: i segnali sopra restano il riferimento.',
      compteur_illisible:
        'IA sospesa per prudenza (contatore illeggibile): i segnali sopra restano il riferimento.',
      provider_indisponible: 'IA non disponibile: i segnali sopra restano il riferimento.',
      reponse_invalide: 'Risposta dell’IA inutilizzabile: i segnali sopra restano il riferimento.',
      langue: 'La spiegazione dell’IA non è ancora disponibile in questa lingua: i segnali sopra restano il riferimento.',
    },
    verdict: {
      signIn: 'Acceda per ottenere una spiegazione.',
      tooMany: 'Troppe spiegazioni di seguito: attenda qualche minuto.',
      unavailable: 'Spiegazione non disponibile al momento: riprovi tra poco.',
    },
    create: {
      signIn: 'Acceda per creare un’avventura.',
      tooMany: 'Troppe avventure create di seguito: attenda un minuto.',
      failed: 'Non è stato possibile creare l’avventura. Riprovi.',
      openFailed: 'Avventura creata, ma non è stato possibile aprirla: la apra dall’Hub.',
    },
    openTrip: {
      signIn: 'Acceda per aprire un viaggio.',
      failed: 'Non è stato possibile aprire questo viaggio.',
    },
    pois: {
      signIn: 'Acceda per vedere i punti di interesse vicini.',
    },
    traveller: {
      invalid: 'Profilo non valido',
      signIn: 'Acceda per salvare il Suo profilo di viaggiatore.',
      needAccount: 'Crei il Suo account per salvare il profilo di viaggiatore.',
      notTown: '«{place}» non è una città né un paese: inserisca il Suo comune («Lione»).',
      saveFailed: 'Non è stato possibile salvare il Suo profilo di viaggiatore.',
    },
    itemHistory: {
      invalid: 'Oggetto non valido.',
      signIn: 'Acceda per vedere lo storico.',
      notFound: 'Oggetto non trovato, oppure non vi ha accesso.',
      connectionLost: 'Connessione persa: riprovi.',
    },
    invitation: {
      untitledTrip: 'Viaggio',
      someone: 'Un viaggiatore LKDV',
      closed: 'Questo invito non è più aperto.',
      notFound: 'Invito non trovato.',
      notInvitee: 'Questo invito è destinato a un’altra persona.',
      signIn: 'Acceda per rispondere.',
      tooMany: 'Troppe risposte: attenda un minuto.',
      failed: 'Impossibile rispondere al momento.',
    },
    resa: {
      signIn: 'Acceda per cercare offerte.',
      needDestination: 'Indichi una destinazione.',
      needOrigin: 'Indichi la città o l’aeroporto di partenza.',
      partnerDisabled: 'Partner non attivo per questa categoria: ricerca in tempo reale non disponibile.{detail}',
      partnerFailed: 'Il partner non ha risposto: riprovi più tardi. ({detail})',
      signInActivities: 'Acceda per vedere le attività.',
    },
    bottle: {
      signIn: 'Acceda per lanciare un messaggio in bottiglia.',
      ownersOnly: 'Solo gli organizzatori gestiscono il messaggio in bottiglia.',
      readFailed: 'Non è stato possibile caricare le Sue bottiglie.',
      untitled: 'Messaggio in bottiglia',
      someone: 'Viaggiatore',
      noCountry: 'Ancora nessun paese di destinazione: scelga prima dove va.',
      suspended: 'Il Suo account è escluso dai gruppi in seguito a una segnalazione.',
      lowTrust: 'Fiducia {trust}/100: serve {threshold} per lanciare una bottiglia.',
      tooManyOwned: 'Ha già {count} annunci pubblici (massimo {max}).',
      titleTooShort: 'Titolo troppo corto',
      titleTooLong: 'Titolo troppo lungo',
      messageTooLong: 'Messaggio troppo lungo',
      adultRequired: 'Confermi di essere maggiorenne (18 anni o più).',
      returnBeforeDeparture: 'Il ritorno è precedente alla partenza.',
      tooMany: 'Troppe bottiglie in una volta: attenda un momento.',
      launchBlocked: 'Lancio impossibile.',
      launchFailed: 'Non è stato possibile lanciare la bottiglia.',
      notFound: 'Bottiglia non trovata.',
      alreadyHandled: 'Richiesta già gestita.',
      groupFull: 'Il gruppo è al completo.',
      answerFailed: 'Risposta non salvata.',
    },
    autofill: {
      limitUnavailable: 'La preparazione è temporaneamente non disponibile: riprovi tra qualche minuto.',
      limitSite:
        'Il Compas sta preparando molti viaggi in questo momento: riprenderò da solo tra {minutes} min.',
      limitPersonal: 'Molte preparazioni di seguito: riprenderò da solo tra {minutes} min.',
      needDays: 'Mi indichi quanti giorni, o scelga le date.',
      stoppedMidway: 'Preparazione interrotta a metà: «Annulla» rimuove ciò che è stato fatto, poi ricominci.',
      alreadyFilled: 'Questo viaggio è già preparato: annulli prima la preparazione per ricominciare.',
      naturalAnchor: '«{name}» scelto per {place} (spazio naturale, adatto all’attività).',
      positionUnreadable:
        'Non è stato possibile leggere la Sua posizione: indichi dove va («ad Annecy», «nel Vercors»…).',
      nearHome:
        'Nessun luogo indicato: preparato vicino a Lei ({place}). Lo cambi in «Dove» se pensava a un altro posto.',
      needPlaceOuting:
        'Condivida la Sua posizione o indichi dove va («ad Annecy», «nella foresta di Fontainebleau»…).',
      needPlace: 'Mi indichi dove va («in Nepal», «nel Vercors»…).',
      period: 'Periodo suggerito: {month} ({why}). Lo cambi in «Quando» se non Le va bene.',
      catalogRoute: 'Scelto il percorso più vicino del catalogo: {name}.',
      catalogRouteNumbered: 'n. {id}',
      calcError: 'errore di calcolo',
      trailStagesNotFound:
        'Tappe del sentiero «{trail}» non trovate sulla mappa: itinerario calcolato su luoghi reali dell’area.',
      islandBlockedKept:
        'Itinerario mantenuto com’era: senza il contorno dell’isola non si può dimostrare che alcuna proposta sia sull’isola. Riproverò alla Sua prossima visita.',
      islandBlockedNone:
        'Nessuna tappa proposta per «{place}»: senza il contorno dell’isola non si può dimostrare che alcuna proposta sia sull’isola, quindi una tappa al giorno sul posto. Riproverò alla Sua prossima visita.',
      plannedFailed: 'Non è stato possibile calcolare l’itinerario: {reason}.',
      plannedFailedAi:
        'Non è stato possibile calcolare l’itinerario: {reason}. Itinerario proposto dallo specialista, ogni luogo verificato sulla mappa.',
      aiOff:
        'Senza IA, nessuna tappa dettagliata per «{place}»: una tappa al giorno sul posto. Indichi una regione o una località in «Dove» per avere tappe in luoghi reali.',
      countryFailed: 'Non è stato possibile pianificare più basi nel paese: {reason}.',
      keptLate:
        'Itinerario mantenuto com’era: la nuova proposta non è arrivata in tempo. Riproverò alla Sua prossima visita.',
      detailUnavailable:
        'Itinerario dettagliato non disponibile per ora: una tappa al giorno sul posto. Riproverò alla Sua prossima visita, oppure lo precisi in Percorso.',
      droppedOne:
        '{count} luogo proposto non è stato trovato sulla mappa: la tappa resta nel luogo precedente.',
      droppedOther:
        '{count} luoghi proposti non sono stati trovati sulla mappa: quelle tappe restano nel luogo precedente.',
      manyMissing:
        'Diversi luoghi dell’itinerario non esistono sulla mappa: lo richiederò alla Sua prossima visita.',
      backtrack:
        'L’itinerario torna indietro su una traversata: lo richiederò alla Sua prossima visita.',
      reordered: 'Tappe messe in un ordine più diretto: circa {km} km di strada in meno.',
      estimatedOne:
        '{count} tappa con una distanza stimata (percorso non calcolato): da verificare.',
      estimatedOther:
        '{count} tappe con una distanza stimata (percorso non calcolato): da verificare.',
      stoppedNothing: 'Preparazione fermata: non è stato scritto nulla.',
      stepsSaveFailed: 'Itinerario non salvato: riprovi tra poco.',
      stoppedKept:
        'Preparazione fermata su Sua richiesta: l’itinerario è mantenuto; notti, attrezzatura e budget non sono fatti. «Annulla» rimuove tutto.',
      kitSaveFailed: 'Attrezzatura non salvata (errore di scrittura): rilanci «Preparare tutto».',
      budgetSaveFailed: 'Budget non salvato (errore di scrittura): rilanci «Preparare tutto».',
      optionalGear:
        'Attrezzatura consigliata non conteggiata nel budget: {amount} € in negozio se non la possiede (facoltativo).',
      plan: {
        islandPlacesUnavailable: 'luoghi dell’isola non disponibili (servizio di mappe irraggiungibile)',
        islandAltitudesMissing: 'altitudini dei luoghi dell’isola non trovate',
        islandZoneSaid: 'Isola grande: un’area di {km} km intorno a «{place}», il luogo indicato.',
        islandZoneHigh:
          'Isola grande: un’area di {km} km intorno a {place}, dove le località dell’isola sono più in alto{highest}. Altitudini di luoghi, non di vette.',
        islandZoneHighest: ' (fino a {meters} m)',
        islandOwnMassif: 'le sue montagne',
        climbingBaseOne:
          'Arrampicata: base {at}, ai piedi di «{site}» ({count} sito d’arrampicata entro 2 km, dati OpenStreetMap).',
        climbingBaseOther:
          'Arrampicata: base {at}, ai piedi di «{site}» ({count} siti d’arrampicata entro 2 km, dati OpenStreetMap).',
        skiBaseOne:
          'Sci: base {at}, ai piedi di «{site}» ({count} comprensorio sciistico{lifts} entro 5 km, dati OpenStreetMap).',
        skiBaseOther:
          'Sci: base {at}, ai piedi di «{site}» ({count} comprensori sciistici{lifts} entro 5 km, dati OpenStreetMap).',
        skiLiftsOne: ' e {count} stazione di impianti',
        skiLiftsOther: ' e {count} stazioni di impianti',
        riverDescent:
          'Discesa del fiume ({river}): {km} km d’acqua in {days} giorni, {from} {to}, ogni sera vicino all’acqua.',
        riverFailed: 'Discesa impossibile ({reason}): soggiorno sull’acqua da una base.',
        riverNoLine: 'corso di «{river}» non trovato sulla mappa',
        riverNoPlaces: 'nessun luogo trovato lungo il tratto',
        riverNoVillage: 'nessun paese rivierasco lungo il tratto',
        islandNoContour:
          'contorno dell’isola non trovato sulla mappa, non si può dimostrare che alcun luogo sia sull’isola',
        islandMassifFailed:
          'Montagne dell’isola non trovate ({reason}): area presa al centro dell’isola.',
        zoneUnavailable: 'luoghi dell’area non disponibili (servizio di mappe irraggiungibile)',
        zoneUnavailableDiag: 'luoghi dell’area non disponibili (servizio di mappe irraggiungibile: {diag})',
        tooFewPlaces: 'troppo pochi luoghi per dormire nell’area ({count} trovati)',
        tooFewDistinct:
          'solo {distinct} luogo/i per dormire entro una tappa ({count} luoghi nell’area)',
        itineraryOne:
          'Itinerario {shape} costruito su luoghi reali della mappa ({count} luogo per dormire){via}.',
        itineraryOther:
          'Itinerario {shape} costruito su luoghi reali della mappa ({count} luoghi per dormire){via}.',
        shapeTraverse: 'in traversata',
        shapeLoop: 'ad anello',
        shapeBase: 'da una base',
        via: ', passando per {places}',
        countryUnavailable: 'luoghi del paese non disponibili (servizio di mappe irraggiungibile)',
        countryUnavailableDiag:
          'luoghi del paese non disponibili (servizio di mappe irraggiungibile: {diag})',
        countryTooFew: 'troppo pochi luoghi per stabilire basi nel paese ({count} trovati)',
        countryVehicle: ' Gli spostamenti tra le basi si fanno in veicolo (distanze in linea d’aria).',
        countryOne:
          'Itinerario con {count} base, calcolato senza IA su luoghi reali della mappa: {bases}.{vehicle}',
        countryOther:
          'Itinerario con {count} basi, calcolato senza IA su luoghi reali della mappa: {bases}.{vehicle}',
        baseDays: '{name} ({days} g)',
        pointToPointUnavailable: 'luoghi tra i due punti non disponibili (servizio di mappe irraggiungibile)',
        pointToPointUnavailableDiag:
          'luoghi tra i due punti non disponibili (servizio di mappe irraggiungibile: {diag})',
        pointToPointTooFew: 'troppo pochi luoghi per dormire tra {from} e {to} ({count} trovati)',
        pointToPointOne:
          'Itinerario {from} {to} costruito su luoghi reali della mappa ({count} luogo per dormire, circa {km} km al giorno).',
        pointToPointOther:
          'Itinerario {from} {to} costruito su luoghi reali della mappa ({count} luoghi per dormire, circa {km} km al giorno).',
        pointToPointFailed: 'Itinerario {from} {to} impossibile ({reason}): preparato intorno a {place}.',
      },
      undo: {
        running: 'È in corso una preparazione: attenda che finisca o la fermi, poi annulli.',
        nothing: 'Niente da annullare.',
      },
      refresh: {
        tooMany: 'Molte modifiche di seguito: attenda qualche minuto.',
        cut: 'Preparazione interrotta a metà: rilanci «Preparare tutto» per completarla, oppure la annulli.',
        running: 'È già in corso una preparazione.',
        saveFailed: 'Adattamento non salvato: riprovi.',
        keptSteps: 'itinerario modificato, mantenuto',
        keptNightsOne: '{count} notte scelta da Lei, mantenuta',
        keptNightsOther: '{count} notti scelte da Lei, mantenute',
        keptItemsOne: '{count} oggetto dello zaino già modificato, mantenuto',
        keptItemsOther: '{count} oggetti dello zaino già modificati, mantenuti',
        keptBudgetOne: '{count} voce di budget modificata, mantenuta',
        keptBudgetOther: '{count} voci di budget modificate, mantenute',
        labelOne: '{parts} adattato',
        labelOther: '{parts} adattati',
        parts: {
          steps: 'itinerario',
          nights: 'notti',
          transport: 'spostamenti',
          kit: 'zaino',
          budget: 'spese',
        },
      },
    },
  },
};
