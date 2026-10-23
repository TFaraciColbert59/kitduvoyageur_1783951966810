import type { compasServerFr } from './compas-server.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/**
 * Espace de noms `compas.server` (DE). Même forme que `compas-server.fr.ts`, imposée par le
 * type. Messages des actions serveur du Compas ; registre « Sie ».
 */
export const compasServerDe: Shape<typeof compasServerFr> = {
  server: {
    common: {
      invalidRequest: 'Ungültige Anfrage',
      accessDenied: 'Zugriff verweigert',
      serverError: 'Serverfehler',
      invalidId: 'Ungültige Kennung',
      invalidSlug: 'Ungültige URL-Kennung',
      invalidTrip: 'Ungültige Reise',
      tripNotFoundOrDenied: 'Reise nicht gefunden, oder Sie haben keinen Zugriff darauf.',
      signInToEdit: 'Melden Sie sich an, um die Reise zu bearbeiten.',
      editorsOnly: 'Nur Organisatoren und Bearbeitende können die Ausrüstung ändern.',
    },
    placeSearch: {
      tooMany: 'Zu viele Ortssuchen hintereinander: Warten Sie einige Minuten.',
      unavailable: 'Die Ortssuche ist gerade nicht verfügbar: Versuchen Sie es gleich noch einmal.',
    },
    carrier: {
      notInTrip: 'Diese Person gehört nicht zur Reise.',
      failed: 'Der Träger konnte nicht geändert werden.',
      noItems: 'Keine Gegenstände zuzuweisen',
      tooManyItems: 'Zu viele Gegenstände auf einmal zuzuweisen',
      duplicateItem: 'Ein Gegenstand kommt doppelt vor',
      stuckVerifiedOne:
        'Die Zuweisung ist fehlgeschlagen und konnte nicht vollständig rückgängig gemacht werden: {count} Gegenstand hat seinen neuen Träger behalten. Prüfen Sie die Ausrüstung.',
      stuckVerifiedOther:
        'Die Zuweisung ist fehlgeschlagen und konnte nicht vollständig rückgängig gemacht werden: {count} Gegenstände haben ihren neuen Träger behalten. Prüfen Sie die Ausrüstung.',
      stuckUnsureOne:
        'Die Zuweisung ist fehlgeschlagen und konnte nicht vollständig rückgängig gemacht werden: {count} Gegenstand hat seinen neuen Träger womöglich behalten. Prüfen Sie die Ausrüstung.',
      stuckUnsureOther:
        'Die Zuweisung ist fehlgeschlagen und konnte nicht vollständig rückgängig gemacht werden: {count} Gegenstände haben ihren neuen Träger womöglich behalten. Prüfen Sie die Ausrüstung.',
    },
    product: {
      unavailable: 'Produkt nicht verfügbar.',
      linkFailed: 'Dieses Produkt konnte nicht verknüpft werden.',
      addFailed: 'Dieses Produkt konnte nicht zur Ausrüstung hinzugefügt werden.',
    },
    inventory: {
      nameRequired: 'Ein Name ist erforderlich.',
      signIn: 'Melden Sie sich an, um Ihr Inventar zu verwalten.',
      addFailed: 'Dieser Gegenstand konnte nicht zu Ihrem Inventar hinzugefügt werden.',
      updateFailed: 'Dieser Gegenstand konnte nicht aktualisiert werden.',
    },
    envelope: {
      invalidAmount: 'Ungültiger Betrag',
      saveFailed: 'Das Budget konnte nicht gespeichert werden.',
    },
    dates: {
      invalidDate: 'Ungültiges Datum',
      endBeforeStart: 'Das Ende muss nach dem Beginn liegen.',
      invalid: 'Ungültige Termine',
      saveFailed: 'Die Termine konnten nicht gespeichert werden.',
    },
    activity: {
      invalid: 'Ungültige Aktivität',
      saveFailed: 'Die Aktivität konnte nicht geändert werden.',
    },
    preferences: {
      invalid: 'Ungültige Vorlieben',
      saveFailed: 'Ihre Vorlieben konnten nicht gespeichert werden.',
    },
    place: {
      invalid: 'Ungültiger Ort',
      notFound: '„{place}“ wurde auf der Karte nicht gefunden.',
      notInhabited: '„{place}“ ist weder Ort noch Region noch Land: Nennen Sie einen Ort („ab Lyon“).',
      destinationSaveFailed: 'Das Ziel konnte nicht gespeichert werden.',
      originSaveFailed: 'Der Startpunkt konnte nicht gespeichert werden.',
    },
    departureTime: {
      invalid: 'Ungültige Uhrzeit',
      saveFailed: 'Die Startzeit konnte nicht gespeichert werden.',
    },
    duration: {
      invalid: 'Ungültige Dauer',
      saveFailed: 'Die Dauer konnte nicht gespeichert werden.',
    },
    party: {
      invalid: 'Ungültige Personenzahl',
      saveFailed: 'Die Personenzahl konnte nicht geändert werden.',
    },
    lodging: {
      invalid: 'Ungültige Unterkunft',
      noStep: 'Keine Etappe für diese Nacht.',
      saveFailed: 'Die Unterkunft konnte nicht gespeichert werden.',
    },
    stays: {
      needStartDate: 'Wählen Sie zuerst das Startdatum der Reise.',
      noDestination: 'Die Reise hat kein Ziel.',
      liveDisabled: 'Live-Suche nicht verfügbar: Die Partnerschlüssel sind nicht aktiviert.{detail}',
      tooMany: 'Zu viele Suchen: Versuchen Sie es in einigen Minuten erneut.',
      providerFailed: 'Der Anbieter hat nicht geantwortet: Versuchen Sie es später erneut. ({detail})',
      partner: 'Partner',
    },
    myKits: {
      signIn: 'Melden Sie sich an, um Ihre Ausrüstungen zu sehen.',
      readFailed: 'Ihre Ausrüstungen konnten nicht geladen werden.',
      itemsReadFailed: 'Die Gegenstände Ihrer Ausrüstungen konnten nicht geladen werden.',
      unnamed: 'Ausrüstung ohne Namen',
    },
    kit: {
      notFound: 'Ausrüstung nicht gefunden.',
      tripKitReadFailed: 'Die Ausrüstung der Reise konnte nicht geladen werden.',
      addFailed: 'Die Gegenstände der Ausrüstung konnten nicht hinzugefügt werden.',
      nameTooShort: 'Name zu kurz',
      nameTooLong: 'Name zu lang',
      tooMany: 'Zu viele Ausrüstungen auf einmal: Warten Sie eine Minute.',
      tripKitEmpty: 'Die Ausrüstung der Reise ist leer: Fügen Sie zuerst Gegenstände hinzu.',
      createFailed: 'Die Ausrüstung konnte nicht erstellt werden.',
      itemsSaveFailed: 'Die Gegenstände der Ausrüstung konnten nicht gespeichert werden.',
    },
    routes: {
      searchInvalid: 'Ungültige Suche',
      signInSearch: 'Melden Sie sich an, um eine Route zu suchen.',
      searchUnavailable: 'Suche nicht verfügbar.',
      signInOutings: 'Melden Sie sich an, um Ihre Touren zu sehen.',
      numbered: 'Route Nr. {id}',
      invalid: 'Ungültige Route',
      notFound: 'Route nicht gefunden.',
      takenByTitled:
        'Diese Route wird bereits von Ihrem Abenteuer „{title}“ genutzt. Öffnen Sie es über das Menü der Abenteuer.',
      takenByOther: 'Diese Route wird bereits von einem anderen Ihrer Abenteuer genutzt.',
      applyFailed: 'Diese Route konnte nicht gewählt werden.',
    },
    interpret: {
      invalidText: 'Satz zu kurz oder zu lang',
      tooMany: 'Zu viele Anfragen hintereinander: Warten Sie einige Minuten.',
      unavailable: 'Das Verstehen ist gerade nicht verfügbar: Versuchen Sie es gleich noch einmal.',
    },
    aiNotes: {
      delai_depasse: 'Die KI hat zu lange gebraucht: von den Regeln des Compas gelesen.',
      quota_epuise: 'Tägliches KI-Kontingent erreicht: von den Regeln des Compas gelesen.',
      ia_eteinte: 'Von den Regeln des Compas gelesen (KI ausgeschaltet).',
      compteur_illisible:
        'KI vorsorglich angehalten (Zähler unlesbar): von den Regeln des Compas gelesen.',
      provider_indisponible: 'KI nicht verfügbar: von den Regeln des Compas gelesen.',
      reponse_invalide: 'Unbrauchbare Antwort der KI: von den Regeln des Compas gelesen.',
    },
    verdictNotes: {
      delai_depasse: 'Die KI hat zu lange gebraucht: Die obigen Signale bleiben maßgeblich.',
      quota_epuise: 'Tägliches KI-Kontingent erreicht: Die obigen Signale bleiben maßgeblich.',
      ia_eteinte: 'KI ausgeschaltet: Die obigen Signale bleiben maßgeblich.',
      compteur_illisible:
        'KI vorsorglich angehalten (Zähler unlesbar): Die obigen Signale bleiben maßgeblich.',
      provider_indisponible: 'KI nicht verfügbar: Die obigen Signale bleiben maßgeblich.',
      reponse_invalide: 'Unbrauchbare Antwort der KI: Die obigen Signale bleiben maßgeblich.',
      langue: 'Erklärungen der KI gibt es in dieser Sprache noch nicht: Die obigen Signale bleiben maßgeblich.',
    },
    verdict: {
      signIn: 'Melden Sie sich an, um eine Erklärung zu erhalten.',
      tooMany: 'Zu viele Erklärungen hintereinander: Warten Sie einige Minuten.',
      unavailable: 'Erklärung gerade nicht verfügbar: Versuchen Sie es gleich noch einmal.',
    },
    create: {
      signIn: 'Melden Sie sich an, um ein Abenteuer zu erstellen.',
      tooMany: 'Zu viele Abenteuer hintereinander erstellt: Warten Sie eine Minute.',
      failed: 'Das Abenteuer konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
      openFailed: 'Abenteuer erstellt, konnte aber nicht geöffnet werden: Öffnen Sie es im Hub.',
    },
    openTrip: {
      signIn: 'Melden Sie sich an, um eine Reise zu öffnen.',
      failed: 'Diese Reise konnte nicht geöffnet werden.',
    },
    pois: {
      signIn: 'Melden Sie sich an, um interessante Orte in der Nähe zu sehen.',
    },
    traveller: {
      invalid: 'Ungültiges Profil',
      signIn: 'Melden Sie sich an, um Ihr Reiseprofil zu speichern.',
      needAccount: 'Erstellen Sie Ihr Konto, um Ihr Reiseprofil zu speichern.',
      notTown: '„{place}“ ist weder Stadt noch Dorf: Geben Sie Ihren Wohnort ein („Lyon“).',
      saveFailed: 'Ihr Reiseprofil konnte nicht gespeichert werden.',
    },
    itemHistory: {
      invalid: 'Ungültiger Gegenstand.',
      signIn: 'Melden Sie sich an, um den Verlauf zu sehen.',
      notFound: 'Gegenstand nicht gefunden, oder Sie haben keinen Zugriff darauf.',
      connectionLost: 'Verbindung unterbrochen: Bitte erneut versuchen.',
    },
    invitation: {
      untitledTrip: 'Reise',
      someone: 'Eine Person von LKDV',
      closed: 'Diese Einladung ist nicht mehr offen.',
      notFound: 'Einladung nicht gefunden.',
      notInvitee: 'Diese Einladung ist für jemand anderen bestimmt.',
      signIn: 'Melden Sie sich an, um zu antworten.',
      tooMany: 'Zu viele Antworten: Warten Sie eine Minute.',
      failed: 'Antworten ist gerade nicht möglich.',
    },
    resa: {
      signIn: 'Melden Sie sich an, um Angebote zu suchen.',
      needDestination: 'Geben Sie ein Ziel an.',
      needOrigin: 'Geben Sie Ihren Abfahrtsort oder Flughafen an.',
      partnerDisabled: 'Partner für diese Kategorie nicht aktiviert: Live-Suche nicht verfügbar.{detail}',
      partnerFailed: 'Der Partner hat nicht geantwortet: Versuchen Sie es später erneut. ({detail})',
      signInActivities: 'Melden Sie sich an, um die Aktivitäten zu sehen.',
    },
    bottle: {
      signIn: 'Melden Sie sich an, um eine Flaschenpost zu verschicken.',
      ownersOnly: 'Nur die Organisatoren verwalten die Flaschenpost.',
      readFailed: 'Ihre Flaschenposten konnten nicht geladen werden.',
      untitled: 'Flaschenpost',
      someone: 'Reisende Person',
      noCountry: 'Noch kein Zielland: Wählen Sie zuerst, wohin Sie reisen.',
      suspended: 'Ihr Konto ist nach einer Meldung für Gruppen gesperrt.',
      lowTrust: 'Vertrauen {trust}/100: Für eine Flaschenpost braucht es {threshold}.',
      tooManyOwned: 'Sie haben bereits {count} öffentliche Anzeigen (höchstens {max}).',
      titleTooShort: 'Titel zu kurz',
      titleTooLong: 'Titel zu lang',
      messageTooLong: 'Nachricht zu lang',
      adultRequired: 'Bestätigen Sie, dass Sie volljährig sind (18 Jahre oder älter).',
      returnBeforeDeparture: 'Die Rückkehr liegt vor der Abfahrt.',
      tooMany: 'Zu viele Flaschenposten auf einmal: Warten Sie einen Moment.',
      launchBlocked: 'Verschicken nicht möglich.',
      launchFailed: 'Die Flaschenpost konnte nicht verschickt werden.',
      notFound: 'Flaschenpost nicht gefunden.',
      alreadyHandled: 'Anfrage bereits bearbeitet.',
      groupFull: 'Die Gruppe ist voll.',
      answerFailed: 'Antwort nicht gespeichert.',
    },
    autofill: {
      limitUnavailable: 'Die Vorbereitung ist vorübergehend nicht verfügbar: Versuchen Sie es in einigen Minuten erneut.',
      limitSite:
        'Der Compas bereitet gerade sehr viele Reisen vor: Ich mache in {minutes} Min. von selbst weiter.',
      limitPersonal: 'Viele Vorbereitungen hintereinander: Ich mache in {minutes} Min. von selbst weiter.',
      needDays: 'Sagen Sie mir, wie viele Tage, oder wählen Sie die Termine.',
      stoppedMidway: 'Vorbereitung mittendrin angehalten: „Rückgängig“ entfernt das Erledigte, dann beginnen Sie neu.',
      alreadyFilled: 'Diese Reise ist bereits vorbereitet: Machen Sie die Vorbereitung zuerst rückgängig, um neu zu beginnen.',
      naturalAnchor: '„{name}“ für {place} gewählt (Naturraum, passend zur Aktivität).',
      positionUnreadable:
        'Ihr Standort konnte nicht gelesen werden: Sagen Sie, wohin Sie fahren („in Annecy“, „im Vercors“…).',
      nearHome:
        'Kein Ort angegeben: in Ihrer Nähe vorbereitet ({place}). Ändern Sie es unter „Wo“, wenn Sie an etwas anderes gedacht haben.',
      needPlaceOuting:
        'Teilen Sie Ihren Standort oder sagen Sie, wohin Sie fahren („in Annecy“, „im Wald von Fontainebleau“…).',
      needPlace: 'Sagen Sie mir, wohin Sie fahren („nach Nepal“, „in den Vercors“…).',
      period: 'Vorgeschlagener Zeitraum: {month} ({why}). Ändern Sie ihn unter „Wann“, wenn er nicht passt.',
      catalogRoute: 'Nächstgelegene Route aus dem Katalog gewählt: {name}.',
      catalogRouteNumbered: 'Nr. {id}',
      calcError: 'Rechenfehler',
      trailStagesNotFound:
        'Etappen des Wanderwegs „{trail}“ nicht auf der Karte gefunden: Reiseplan auf echten Orten des Gebiets berechnet.',
      islandBlockedKept:
        'Reiseplan unverändert beibehalten: Ohne den Umriss der Insel lässt sich für keinen Vorschlag belegen, dass er auf der Insel liegt. Ich versuche es bei Ihrem nächsten Besuch erneut.',
      islandBlockedNone:
        'Keine Etappen für „{place}“ vorgeschlagen: Ohne den Umriss der Insel lässt sich für keinen Vorschlag belegen, dass er auf der Insel liegt, daher eine Etappe pro Tag vor Ort. Ich versuche es bei Ihrem nächsten Besuch erneut.',
      plannedFailed: 'Der Reiseplan konnte nicht berechnet werden: {reason}.',
      plannedFailedAi:
        'Der Reiseplan konnte nicht berechnet werden: {reason}. Reiseplan vom Spezialisten vorgeschlagen, jeder Ort auf der Karte geprüft.',
      aiOff:
        'Ohne KI keine detaillierten Etappen für „{place}“: eine Etappe pro Tag vor Ort. Nennen Sie unter „Wo“ eine Region oder einen Ort für Etappen an echten Orten.',
      countryFailed: 'Mehrere Standorte im Land konnten nicht geplant werden: {reason}.',
      keptLate:
        'Reiseplan unverändert beibehalten: Der neue Vorschlag kam nicht rechtzeitig. Ich versuche es bei Ihrem nächsten Besuch erneut.',
      detailUnavailable:
        'Detaillierter Reiseplan vorerst nicht verfügbar: eine Etappe pro Tag vor Ort. Ich versuche es bei Ihrem nächsten Besuch erneut, oder präzisieren Sie ihn unter Route.',
      droppedOne:
        '{count} vorgeschlagener Ort wurde auf der Karte nicht gefunden: Die Etappe bleibt am vorigen Ort.',
      droppedOther:
        '{count} vorgeschlagene Orte wurden auf der Karte nicht gefunden: Diese Etappen bleiben am vorigen Ort.',
      manyMissing:
        'Mehrere Orte des Reiseplans gibt es auf der Karte nicht: Ich frage bei Ihrem nächsten Besuch erneut.',
      backtrack:
        'Der Reiseplan geht auf einer Durchquerung zurück: Ich frage bei Ihrem nächsten Besuch erneut.',
      reordered: 'Etappen in eine direktere Reihenfolge gebracht: etwa {km} km weniger Straße.',
      estimatedOne:
        '{count} Etappe mit geschätzter Distanz (Strecke nicht berechnet): zu prüfen.',
      estimatedOther:
        '{count} Etappen mit geschätzter Distanz (Strecke nicht berechnet): zu prüfen.',
      stoppedNothing: 'Vorbereitung angehalten: Es wurde nichts geschrieben.',
      stepsSaveFailed: 'Reiseplan nicht gespeichert: Versuchen Sie es gleich noch einmal.',
      stoppedKept:
        'Vorbereitung auf Ihren Wunsch angehalten: Der Reiseplan bleibt erhalten; Übernachtungen, Ausrüstung und Budget sind nicht erledigt. „Rückgängig“ entfernt alles.',
      kitSaveFailed: 'Ausrüstung nicht gespeichert (Schreibfehler): Starten Sie „Alles vorbereiten“ erneut.',
      budgetSaveFailed: 'Budget nicht gespeichert (Schreibfehler): Starten Sie „Alles vorbereiten“ erneut.',
      optionalGear:
        'Empfohlene Ausrüstung nicht im Budget enthalten: {amount} € im Shop, falls Sie sie nicht haben (optional).',
      plan: {
        islandPlacesUnavailable: 'Orte der Insel nicht verfügbar (Kartendienst nicht erreichbar)',
        islandAltitudesMissing: 'Höhen der Orte der Insel nicht gefunden',
        islandZoneSaid: 'Große Insel: ein Gebiet von {km} km um „{place}“, den von Ihnen genannten Ort.',
        islandZoneHigh:
          'Große Insel: ein Gebiet von {km} km um {place}, wo die Orte der Insel am höchsten liegen{highest}. Höhen von Orten, nicht von Gipfeln.',
        islandZoneHighest: ' (bis {meters} m)',
        islandOwnMassif: 'ihre Berge',
        climbingBaseOne:
          'Klettern: Standort {at}, am Fuß von „{site}“ ({count} Klettergebiet im Umkreis von 2 km, Daten von OpenStreetMap).',
        climbingBaseOther:
          'Klettern: Standort {at}, am Fuß von „{site}“ ({count} Klettergebiete im Umkreis von 2 km, Daten von OpenStreetMap).',
        skiBaseOne:
          'Ski: Standort {at}, am Fuß von „{site}“ ({count} Skigebiet{lifts} im Umkreis von 5 km, Daten von OpenStreetMap).',
        skiBaseOther:
          'Ski: Standort {at}, am Fuß von „{site}“ ({count} Skigebiete{lifts} im Umkreis von 5 km, Daten von OpenStreetMap).',
        skiLiftsOne: ' und {count} Liftstation',
        skiLiftsOther: ' und {count} Liftstationen',
        riverDescent:
          'Flussfahrt ({river}): {km} km auf dem Wasser in {days} Tagen, {from} {to}, jeden Abend am Wasser.',
        riverFailed: 'Flussfahrt nicht möglich ({reason}): Aufenthalt auf dem Wasser von einem Standort aus.',
        riverNoLine: 'Lauf von „{river}“ auf der Karte nicht gefunden',
        riverNoPlaces: 'keine Orte entlang des Abschnitts gefunden',
        riverNoVillage: 'kein Dorf am Ufer entlang des Abschnitts',
        islandNoContour:
          'Umriss der Insel auf der Karte nicht gefunden, für keinen Ort lässt sich belegen, dass er auf der Insel liegt',
        islandMassifFailed:
          'Berge der Insel nicht gefunden ({reason}): Gebiet in der Mitte der Insel gewählt.',
        zoneUnavailable: 'Orte im Gebiet nicht verfügbar (Kartendienst nicht erreichbar)',
        zoneUnavailableDiag: 'Orte im Gebiet nicht verfügbar (Kartendienst nicht erreichbar: {diag})',
        tooFewPlaces: 'zu wenige Übernachtungsorte im Gebiet ({count} gefunden)',
        tooFewDistinct:
          'nur {distinct} Übernachtungsort(e) in einer Tagesetappe ({count} Orte im Gebiet)',
        itineraryOne:
          'Reiseplan {shape}, aufgebaut auf echten Orten der Karte ({count} Übernachtungsort){via}.',
        itineraryOther:
          'Reiseplan {shape}, aufgebaut auf echten Orten der Karte ({count} Übernachtungsorte){via}.',
        shapeTraverse: 'als Durchquerung',
        shapeLoop: 'als Rundtour',
        shapeBase: 'von einem Standort aus',
        via: ', über {places}',
        countryUnavailable: 'Orte im Land nicht verfügbar (Kartendienst nicht erreichbar)',
        countryUnavailableDiag:
          'Orte im Land nicht verfügbar (Kartendienst nicht erreichbar: {diag})',
        countryTooFew: 'zu wenige Orte, um Standorte im Land festzulegen ({count} gefunden)',
        countryVehicle: ' Die Wege zwischen den Standorten erfolgen mit dem Fahrzeug (Luftlinie).',
        countryOne:
          'Reiseplan mit {count} Standort, ohne KI auf echten Orten der Karte berechnet: {bases}.{vehicle}',
        countryOther:
          'Reiseplan mit {count} Standorten, ohne KI auf echten Orten der Karte berechnet: {bases}.{vehicle}',
        baseDays: '{name} ({days} T)',
        pointToPointUnavailable: 'Orte zwischen beiden Punkten nicht verfügbar (Kartendienst nicht erreichbar)',
        pointToPointUnavailableDiag:
          'Orte zwischen beiden Punkten nicht verfügbar (Kartendienst nicht erreichbar: {diag})',
        pointToPointTooFew: 'zu wenige Übernachtungsorte zwischen {from} und {to} ({count} gefunden)',
        pointToPointOne:
          'Reiseplan {from} {to}, aufgebaut auf echten Orten der Karte ({count} Übernachtungsort, etwa {km} km pro Tag).',
        pointToPointOther:
          'Reiseplan {from} {to}, aufgebaut auf echten Orten der Karte ({count} Übernachtungsorte, etwa {km} km pro Tag).',
        pointToPointFailed: 'Reiseplan {from} {to} nicht möglich ({reason}): rund um {place} geplant.',
      },
      undo: {
        running: 'Eine Vorbereitung läuft: Warten Sie, bis sie fertig ist, oder halten Sie sie an, und machen Sie dann rückgängig.',
        nothing: 'Nichts rückgängig zu machen.',
      },
      refresh: {
        tooMany: 'Viele Änderungen hintereinander: Warten Sie einige Minuten.',
        cut: 'Vorbereitung mittendrin abgebrochen: Starten Sie „Alles vorbereiten“ erneut, um sie abzuschließen, oder machen Sie sie rückgängig.',
        running: 'Es läuft bereits eine Vorbereitung.',
        saveFailed: 'Anpassung nicht gespeichert: Bitte erneut versuchen.',
        keptSteps: 'Reiseplan bearbeitet, beibehalten',
        keptNightsOne: '{count} von Ihnen gewählte Nacht, beibehalten',
        keptNightsOther: '{count} von Ihnen gewählte Nächte, beibehalten',
        keptItemsOne: '{count} bereits geänderter Gegenstand im Rucksack, beibehalten',
        keptItemsOther: '{count} bereits geänderte Gegenstände im Rucksack, beibehalten',
        keptBudgetOne: '{count} bearbeitete Budgetzeile, beibehalten',
        keptBudgetOther: '{count} bearbeitete Budgetzeilen, beibehalten',
        labelOne: '{parts} angepasst',
        labelOther: '{parts} angepasst',
        parts: {
          steps: 'Reiseplan',
          nights: 'Übernachtungen',
          transport: 'Anreise',
          kit: 'Rucksack',
          budget: 'Kosten',
        },
      },
    },
  },
};
