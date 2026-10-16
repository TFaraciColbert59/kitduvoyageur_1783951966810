import type { compasServerFr } from './compas-server.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/**
 * Espace de noms `compas.server` (ES). Même forme que `compas-server.fr.ts`, imposée par le
 * type. Messages des actions serveur du Compas ; registre « usted ».
 */
export const compasServerEs: Shape<typeof compasServerFr> = {
  server: {
    common: {
      invalidRequest: 'Solicitud no válida',
      accessDenied: 'Acceso denegado',
      serverError: 'Error del servidor',
      invalidId: 'Identificador no válido',
      invalidSlug: 'Identificador de URL no válido',
      invalidTrip: 'Viaje no válido',
      tripNotFoundOrDenied: 'Viaje no encontrado, o no tiene acceso a él.',
      signInToEdit: 'Inicie sesión para modificar el viaje.',
      editorsOnly: 'Solo los organizadores y editores pueden modificar el material.',
    },
    placeSearch: {
      tooMany: 'Demasiadas búsquedas de lugares seguidas: espere unos minutos.',
      unavailable: 'La búsqueda de lugares no está disponible ahora mismo: vuelva a intentarlo en un momento.',
    },
    carrier: {
      notInTrip: 'Esta persona no forma parte del viaje.',
      failed: 'No se ha podido cambiar quién lo lleva.',
      noItems: 'Ningún objeto que asignar',
      tooManyItems: 'Demasiados objetos que asignar a la vez',
      duplicateItem: 'Un objeto aparece dos veces',
      stuckVerifiedOne:
        'La asignación ha fallado y no se ha podido deshacer del todo: {count} objeto ha conservado su nuevo portador. Revise el material.',
      stuckVerifiedOther:
        'La asignación ha fallado y no se ha podido deshacer del todo: {count} objetos han conservado su nuevo portador. Revise el material.',
      stuckUnsureOne:
        'La asignación ha fallado y no se ha podido deshacer del todo: {count} objeto puede haber conservado su nuevo portador. Revise el material.',
      stuckUnsureOther:
        'La asignación ha fallado y no se ha podido deshacer del todo: {count} objetos pueden haber conservado su nuevo portador. Revise el material.',
    },
    product: {
      unavailable: 'Producto no disponible.',
      linkFailed: 'No se ha podido vincular este producto.',
      addFailed: 'No se ha podido añadir este producto al material.',
    },
    inventory: {
      nameRequired: 'Se necesita un nombre.',
      signIn: 'Inicie sesión para gestionar su inventario.',
      addFailed: 'No se ha podido añadir este objeto a su inventario.',
      updateFailed: 'No se ha podido actualizar este objeto.',
    },
    envelope: {
      invalidAmount: 'Importe no válido',
      saveFailed: 'No se ha podido guardar el presupuesto.',
    },
    dates: {
      invalidDate: 'Fecha no válida',
      endBeforeStart: 'El final debe ser posterior al inicio.',
      invalid: 'Fechas no válidas',
      saveFailed: 'No se han podido guardar las fechas.',
    },
    activity: {
      invalid: 'Actividad no válida',
      saveFailed: 'No se ha podido cambiar la actividad.',
    },
    preferences: {
      invalid: 'Preferencias no válidas',
      saveFailed: 'No se han podido guardar sus preferencias.',
    },
    place: {
      invalid: 'Lugar no válido',
      notFound: '«{place}» no se ha encontrado en el mapa.',
      notInhabited: '«{place}» no es una localidad, una región ni un país: indique una localidad («desde Lyon»).',
      destinationSaveFailed: 'No se ha podido guardar el destino.',
      originSaveFailed: 'No se ha podido guardar el punto de salida.',
    },
    departureTime: {
      invalid: 'Hora no válida',
      saveFailed: 'No se ha podido guardar la hora de salida.',
    },
    duration: {
      invalid: 'Duración no válida',
      saveFailed: 'No se ha podido guardar la duración.',
    },
    party: {
      invalid: 'Número de personas no válido',
      saveFailed: 'No se ha podido cambiar el número de personas.',
    },
    lodging: {
      invalid: 'Alojamiento no válido',
      noStep: 'Ninguna etapa para esta noche.',
      saveFailed: 'No se ha podido guardar el alojamiento.',
    },
    stays: {
      needStartDate: 'Elija primero la fecha de salida del viaje.',
      noDestination: 'El viaje no tiene destino.',
      liveDisabled: 'Búsqueda en directo no disponible: las claves de los socios no están activadas.{detail}',
      tooMany: 'Demasiadas búsquedas: vuelva a intentarlo dentro de unos minutos.',
      providerFailed: 'El proveedor no ha respondido: vuelva a intentarlo más tarde. ({detail})',
      partner: 'socio',
    },
    myKits: {
      signIn: 'Inicie sesión para ver sus equipos.',
      readFailed: 'No se han podido cargar sus equipos.',
      itemsReadFailed: 'No se han podido cargar los objetos de sus equipos.',
      unnamed: 'Equipo sin nombre',
    },
    kit: {
      notFound: 'Equipo no encontrado.',
      tripKitReadFailed: 'No se ha podido cargar el material del viaje.',
      addFailed: 'No se han podido añadir los objetos del equipo.',
      nameTooShort: 'Nombre demasiado corto',
      nameTooLong: 'Nombre demasiado largo',
      tooMany: 'Demasiados equipos a la vez: espere un minuto.',
      tripKitEmpty: 'El material del viaje está vacío: añada primero algunos objetos.',
      createFailed: 'No se ha podido crear el equipo.',
      itemsSaveFailed: 'No se han podido guardar los objetos del equipo.',
    },
    routes: {
      searchInvalid: 'Búsqueda no válida',
      signInSearch: 'Inicie sesión para buscar un recorrido.',
      searchUnavailable: 'Búsqueda no disponible.',
      signInOutings: 'Inicie sesión para ver sus salidas.',
      numbered: 'Recorrido n.º {id}',
      invalid: 'Recorrido no válido',
      notFound: 'Recorrido no encontrado.',
      takenByTitled:
        'Este recorrido ya lo usa su aventura «{title}». Ábrala desde el menú de aventuras.',
      takenByOther: 'Este recorrido ya lo usa otra de sus aventuras.',
      applyFailed: 'No se ha podido elegir este recorrido.',
    },
    interpret: {
      invalidText: 'Frase demasiado corta o demasiado larga',
      tooMany: 'Demasiadas peticiones seguidas: espere unos minutos.',
      unavailable: 'La comprensión no está disponible ahora mismo: vuelva a intentarlo en un momento.',
    },
    aiNotes: {
      delai_depasse: 'La IA ha tardado demasiado: leído por las reglas del Compas.',
      quota_epuise: 'Cuota diaria de IA alcanzada: leído por las reglas del Compas.',
      ia_eteinte: 'Leído por las reglas del Compas (IA desactivada).',
      compteur_illisible:
        'IA detenida por precaución (contador ilegible): leído por las reglas del Compas.',
      provider_indisponible: 'IA no disponible: leído por las reglas del Compas.',
      reponse_invalide: 'Respuesta de la IA inutilizable: leído por las reglas del Compas.',
    },
    verdictNotes: {
      delai_depasse: 'La IA ha tardado demasiado: las señales anteriores siguen siendo la referencia.',
      quota_epuise: 'Cuota diaria de IA alcanzada: las señales anteriores siguen siendo la referencia.',
      ia_eteinte: 'IA desactivada: las señales anteriores siguen siendo la referencia.',
      compteur_illisible:
        'IA detenida por precaución (contador ilegible): las señales anteriores siguen siendo la referencia.',
      provider_indisponible: 'IA no disponible: las señales anteriores siguen siendo la referencia.',
      reponse_invalide: 'Respuesta de la IA inutilizable: las señales anteriores siguen siendo la referencia.',
      langue: 'La explicación por IA aún no está disponible en este idioma: las señales anteriores siguen siendo la referencia.',
    },
    verdict: {
      signIn: 'Inicie sesión para obtener una explicación.',
      tooMany: 'Demasiadas explicaciones seguidas: espere unos minutos.',
      unavailable: 'Explicación no disponible ahora mismo: vuelva a intentarlo en un momento.',
    },
    create: {
      signIn: 'Inicie sesión para crear una aventura.',
      tooMany: 'Demasiadas aventuras creadas seguidas: espere un minuto.',
      failed: 'No hemos podido crear la aventura. Vuelva a intentarlo.',
      openFailed: 'Aventura creada, pero no se ha podido abrir: ábrala desde el Hub.',
    },
    openTrip: {
      signIn: 'Inicie sesión para abrir un viaje.',
      failed: 'No se ha podido abrir este viaje.',
    },
    pois: {
      signIn: 'Inicie sesión para ver los puntos de interés cercanos.',
    },
    traveller: {
      invalid: 'Perfil no válido',
      signIn: 'Inicie sesión para guardar su perfil de viajero.',
      needAccount: 'Cree su cuenta para guardar su perfil de viajero.',
      notTown: '«{place}» no es una ciudad ni un pueblo: indique su localidad («Lyon»).',
      saveFailed: 'No se ha podido guardar su perfil de viajero.',
    },
    itemHistory: {
      invalid: 'Objeto no válido.',
      signIn: 'Inicie sesión para ver el historial.',
      notFound: 'Objeto no encontrado, o no tiene acceso a él.',
      connectionLost: 'Conexión perdida: vuelva a intentarlo.',
    },
    invitation: {
      untitledTrip: 'Viaje',
      someone: 'Un viajero LKDV',
      closed: 'Esta invitación ya no está abierta.',
      notFound: 'Invitación no encontrada.',
      notInvitee: 'Esta invitación está destinada a otra persona.',
      signIn: 'Inicie sesión para responder.',
      tooMany: 'Demasiadas respuestas: espere un minuto.',
      failed: 'No se ha podido responder ahora mismo.',
    },
    resa: {
      signIn: 'Inicie sesión para buscar ofertas.',
      needDestination: 'Indique un destino.',
      needOrigin: 'Indique su ciudad o aeropuerto de salida.',
      partnerDisabled: 'Socio no activado para esta categoría: búsqueda en directo no disponible.{detail}',
      partnerFailed: 'El socio no ha respondido: vuelva a intentarlo más tarde. ({detail})',
      signInActivities: 'Inicie sesión para ver las actividades.',
    },
    bottle: {
      signIn: 'Inicie sesión para lanzar un mensaje en una botella.',
      ownersOnly: 'Solo los organizadores gestionan el mensaje en una botella.',
      readFailed: 'No se han podido cargar sus botellas.',
      untitled: 'Mensaje en una botella',
      someone: 'Viajero',
      noCountry: 'Aún no hay país de destino: elija primero adónde va.',
      suspended: 'Su cuenta tiene restringido el acceso a los grupos tras una denuncia.',
      lowTrust: 'Confianza {trust}/100: se necesita {threshold} para lanzar una botella.',
      tooManyOwned: 'Ya tiene {count} anuncios públicos (máximo {max}).',
      titleTooShort: 'Título demasiado corto',
      titleTooLong: 'Título demasiado largo',
      messageTooLong: 'Mensaje demasiado largo',
      adultRequired: 'Confirme que es mayor de edad (18 años o más).',
      returnBeforeDeparture: 'El regreso es anterior a la salida.',
      tooMany: 'Demasiadas botellas a la vez: espere un momento.',
      launchBlocked: 'No se puede lanzar.',
      launchFailed: 'No se ha podido lanzar la botella.',
      notFound: 'Botella no encontrada.',
      alreadyHandled: 'Solicitud ya tramitada.',
      groupFull: 'El grupo está completo.',
      answerFailed: 'Respuesta no guardada.',
    },
    autofill: {
      limitUnavailable: 'La preparación no está disponible temporalmente: vuelva a intentarlo dentro de unos minutos.',
      limitSite:
        'El Compas está preparando muchos viajes ahora mismo: retomaré esto solo dentro de {minutes} min.',
      limitPersonal: 'Muchas preparaciones seguidas: retomaré esto solo dentro de {minutes} min.',
      needDays: 'Indíqueme cuántos días, o elija las fechas.',
      stoppedMidway: 'Preparación detenida a medias: «Deshacer» elimina lo hecho; después, vuelva a empezar.',
      alreadyFilled: 'Este viaje ya está preparado: deshágalo primero para volver a empezar.',
      naturalAnchor: '«{name}» elegido para {place} (espacio natural, adecuado para la actividad).',
      positionUnreadable:
        'No se ha podido leer su ubicación: indique adónde va («en Annecy», «en el Vercors»…).',
      nearHome:
        'Ningún lugar indicado: preparado cerca de usted ({place}). Cámbielo en «Dónde» si pensaba en otro sitio.',
      needPlaceOuting:
        'Comparta su ubicación o indique adónde va («en Annecy», «en el bosque de Fontainebleau»…).',
      needPlace: 'Indíqueme adónde va («a Nepal», «al Vercors»…).',
      period: 'Período sugerido: {month} ({why}). Cámbielo en «Cuándo» si no le conviene.',
      catalogRoute: 'Recorrido más cercano del catálogo elegido: {name}.',
      catalogRouteNumbered: 'n.º {id}',
      calcError: 'error de cálculo',
      trailStagesNotFound:
        'Etapas del sendero «{trail}» no encontradas en el mapa: itinerario calculado sobre lugares reales de la zona.',
      islandBlockedKept:
        'Itinerario conservado tal cual: sin el contorno de la isla, no se puede demostrar que ninguna propuesta esté en la isla. Lo intentaré de nuevo en su próxima visita.',
      islandBlockedNone:
        'Ninguna etapa propuesta para «{place}»: sin el contorno de la isla, no se puede demostrar que ninguna propuesta esté en la isla, así que una etapa por día en el lugar. Lo intentaré de nuevo en su próxima visita.',
      plannedFailed: 'No se ha podido calcular el itinerario: {reason}.',
      plannedFailedAi:
        'No se ha podido calcular el itinerario: {reason}. Itinerario propuesto por el especialista, cada lugar verificado en el mapa.',
      aiOff:
        'Sin IA, no hay etapas detalladas para «{place}»: una etapa por día en el lugar. Indique una región o una localidad en «Dónde» para tener etapas en lugares reales.',
      countryFailed: 'No se han podido planificar varias bases en el país: {reason}.',
      keptLate:
        'Itinerario conservado tal cual: la nueva propuesta no ha llegado a tiempo. Lo intentaré de nuevo en su próxima visita.',
      detailUnavailable:
        'Itinerario detallado no disponible por ahora: una etapa por día en el lugar. Lo intentaré de nuevo en su próxima visita, o precíselo en Recorrido.',
      droppedOne:
        '{count} lugar propuesto no se ha encontrado en el mapa: la etapa se queda en el lugar anterior.',
      droppedOther:
        '{count} lugares propuestos no se han encontrado en el mapa: esas etapas se quedan en el lugar anterior.',
      manyMissing:
        'Varios lugares del itinerario no existen en el mapa: volveré a pedirlo en su próxima visita.',
      backtrack:
        'El itinerario retrocede en una travesía: volveré a pedirlo en su próxima visita.',
      reordered: 'Etapas puestas en un orden más directo: unos {km} km menos de carretera.',
      estimatedOne:
        '{count} etapa con una distancia estimada (ruta no calculada): por comprobar.',
      estimatedOther:
        '{count} etapas con una distancia estimada (ruta no calculada): por comprobar.',
      stoppedNothing: 'Preparación detenida: no se ha escrito nada.',
      stepsSaveFailed: 'Itinerario no guardado: vuelva a intentarlo en un momento.',
      stoppedKept:
        'Preparación detenida a petición suya: el itinerario se conserva; noches, material y presupuesto no están hechos. «Deshacer» lo elimina todo.',
      kitSaveFailed: 'Material no guardado (error de escritura): vuelva a lanzar «Prepararlo todo».',
      budgetSaveFailed: 'Presupuesto no guardado (error de escritura): vuelva a lanzar «Prepararlo todo».',
      optionalGear:
        'Material recomendado no contabilizado en el presupuesto: {amount} € en la tienda si no lo tiene (opcional).',
      plan: {
        islandPlacesUnavailable: 'lugares de la isla no disponibles (servicio de mapas inaccesible)',
        islandAltitudesMissing: 'altitudes de los lugares de la isla no encontradas',
        islandZoneSaid: 'Isla grande: una zona de {km} km alrededor de «{place}», el lugar indicado.',
        islandZoneHigh:
          'Isla grande: una zona de {km} km alrededor de {place}, donde las localidades de la isla están más altas{highest}. Altitudes de lugares, no de cumbres.',
        islandZoneHighest: ' (hasta {meters} m)',
        islandOwnMassif: 'sus montañas',
        climbingBaseOne:
          'Escalada: base {at}, al pie de «{site}» ({count} lugar de escalada a menos de 2 km, datos de OpenStreetMap).',
        climbingBaseOther:
          'Escalada: base {at}, al pie de «{site}» ({count} lugares de escalada a menos de 2 km, datos de OpenStreetMap).',
        skiBaseOne:
          'Esquí: base {at}, al pie de «{site}» ({count} dominio esquiable{lifts} a menos de 5 km, datos de OpenStreetMap).',
        skiBaseOther:
          'Esquí: base {at}, al pie de «{site}» ({count} dominios esquiables{lifts} a menos de 5 km, datos de OpenStreetMap).',
        skiLiftsOne: ' y {count} estación de remontes',
        skiLiftsOther: ' y {count} estaciones de remontes',
        riverDescent:
          'Descenso del río ({river}): {km} km de agua en {days} días, {from} {to}, cada noche junto al agua.',
        riverFailed: 'Descenso imposible ({reason}): estancia en el agua desde una base.',
        riverNoLine: 'curso de «{river}» no encontrado en el mapa',
        riverNoPlaces: 'ningún lugar encontrado a lo largo del tramo',
        riverNoVillage: 'ningún pueblo ribereño a lo largo del tramo',
        islandNoContour:
          'contorno de la isla no encontrado en el mapa, no se puede demostrar que ningún lugar esté en la isla',
        islandMassifFailed:
          'Montañas de la isla no encontradas ({reason}): zona tomada en el centro de la isla.',
        zoneUnavailable: 'lugares de la zona no disponibles (servicio de mapas inaccesible)',
        zoneUnavailableDiag: 'lugares de la zona no disponibles (servicio de mapas inaccesible: {diag})',
        tooFewPlaces: 'demasiado pocos lugares para dormir en la zona ({count} encontrados)',
        tooFewDistinct:
          'solo {distinct} lugar(es) para dormir a una etapa de distancia ({count} lugares en la zona)',
        itineraryOne:
          'Itinerario {shape} construido sobre lugares reales del mapa ({count} lugar para dormir){via}.',
        itineraryOther:
          'Itinerario {shape} construido sobre lugares reales del mapa ({count} lugares para dormir){via}.',
        shapeTraverse: 'en travesía',
        shapeLoop: 'en bucle',
        shapeBase: 'desde una base',
        via: ', pasando por {places}',
        countryUnavailable: 'lugares del país no disponibles (servicio de mapas inaccesible)',
        countryUnavailableDiag:
          'lugares del país no disponibles (servicio de mapas inaccesible: {diag})',
        countryTooFew: 'demasiado pocos lugares para establecer bases en el país ({count} encontrados)',
        countryVehicle: ' Los traslados entre bases se hacen en vehículo (distancias en línea recta).',
        countryOne:
          'Itinerario de {count} base, calculado sin IA sobre lugares reales del mapa: {bases}.{vehicle}',
        countryOther:
          'Itinerario de {count} bases, calculado sin IA sobre lugares reales del mapa: {bases}.{vehicle}',
        baseDays: '{name} ({days} d)',
        pointToPointUnavailable: 'lugares entre ambos puntos no disponibles',
        pointToPointUnavailableDiag: 'lugares entre ambos puntos no disponibles: {diag}',
        pointToPointTooFew: 'demasiado pocos lugares para dormir entre {from} y {to} ({count} encontrados)',
        pointToPointOne:
          'Itinerario {from} {to} construido sobre lugares reales del mapa ({count} lugar para dormir, unos {km} km diarios).',
        pointToPointOther:
          'Itinerario {from} {to} construido sobre lugares reales del mapa ({count} lugares para dormir, unos {km} km diarios).',
        pointToPointFailed: 'Itinerario {from} {to} imposible ({reason}): preparado alrededor de {place}.',
      },
      undo: {
        running: 'Hay una preparación en curso: espere a que termine o deténgala y después deshaga.',
        nothing: 'Nada que deshacer.',
      },
      refresh: {
        tooMany: 'Muchos cambios seguidos: espere unos minutos.',
        cut: 'Preparación cortada a medias: vuelva a lanzar «Prepararlo todo» para terminarla, o deshágala.',
        running: 'Ya hay una preparación en curso.',
        saveFailed: 'Adaptación no guardada: vuelva a intentarlo.',
        keptSteps: 'itinerario modificado, conservado',
        keptNightsOne: '{count} noche elegida por usted, conservada',
        keptNightsOther: '{count} noches elegidas por usted, conservadas',
        keptItemsOne: '{count} objeto de la mochila ya modificado, conservado',
        keptItemsOther: '{count} objetos de la mochila ya modificados, conservados',
        keptBudgetOne: '{count} línea de presupuesto modificada, conservada',
        keptBudgetOther: '{count} líneas de presupuesto modificadas, conservadas',
        labelOne: '{parts} adaptado',
        labelOther: '{parts} adaptados',
        parts: {
          steps: 'itinerario',
          nights: 'noches',
          transport: 'desplazamientos',
          kit: 'mochila',
          budget: 'gastos',
        },
      },
    },
  },
};
