import type { TranslationKeys } from './fr';
import { compasStepsEs } from './compas-steps.es';
import { compasScreenEs } from './compas-screen.es';
import { compasSheetsEs } from './compas-sheets.es';
import { compasAlertsEs } from './compas-alerts.es';
import { compasServerEs } from './compas-server.es';
import { compasUnitsEs } from './compas-units.es';
import { compasEngineEs } from './compas-engine.es';

/**
 * Espace de noms `compas` (ES). Même forme que `compas.fr.ts`, imposée par le type.
 * « Compas » reste un nom propre (le produit). Registre « usted », traduction naturelle.
 */
export const compasEs: TranslationKeys['compas'] = {
  sheets: compasSheetsEs,
  start: {
    lockedStep: 'Disponible tras su primera elección',
    createError: 'No hemos podido crear su aventura.',
    stepsNav: 'Etapas del Compas',
    invitationsLabel: 'Invitaciones recibidas',
    invitationsTitle: 'Le han invitado',
    requestLabel: 'Su petición',
    title: '¿Adónde quiere ir?',
    subtitle:
      'Describa su aventura con sus propias palabras. Compas prepara el resto: recorrido, fechas, noches, desplazamientos, material y presupuesto.',
    placeholder: '«5 días de trekking en el Vercors, 3 personas, en refugios, a principios de julio»',
    understoodTitle: 'Esto es lo que he entendido',
    precise: 'Añadir detalles (opcional)',
    activityGroup: 'Actividad',
    moreActivities: 'Más',
    duration: 'Duración',
    people: 'Personas',
    daysOne: '{count} día',
    daysOther: '{count} días',
    peopleOne: '{count} persona',
    peopleOther: '{count} personas',
    stepperLess: '{label}: menos',
    stepperMore: '{label}: más',
    auto: 'auto',
    creating: 'Creando su aventura…',
    submit: 'Preparar mi aventura',
    signInPrompt: '{link} para guardar su aventura.',
    signInLink: 'Inicie sesión',
    mapLabel: 'Mapa del recorrido',
    mapEmpty: 'El mapa se completa en cuanto se elige un recorrido.',
  },
  prep: {
    label: 'Preparación de su aventura',
    titleDone: 'Su aventura está lista',
    titleFailed: 'Preparación interrumpida',
    titleStopped: 'Preparación detenida',
    titleRunning: 'Preparando su aventura…',
    understand: 'Comprender su petición',
    understandSub: 'Dónde, cuánto tiempo, quién y qué le apetece',
    itinerary: 'Trazar el itinerario',
    itinerarySub: 'Lugares reales en el mapa, distancias medidas',
    rest: 'Noches, desplazamientos, material y presupuesto',
    restSub: 'Tarifas del Compas, nada inventado',
    done: 'Resumen',
    doneSub: 'Después podrá ajustarlo todo, etapa por etapa',
    stateDone: 'hecho',
    stateRun: 'en curso',
    stateHalt: 'interrumpido',
    stateTodo: 'pendiente',
    positionNote:
      'Si lo autoriza, su posición sirve para preparar el desplazamiento de ida; se redondea a 1 km aproximadamente antes de cualquier envío. Sin ella, ese desplazamiento queda por completar.',
    viewAdventure: 'Ver mi aventura',
    editRequest: 'Precisar mi petición',
    retry: 'Reanudar',
    stop: 'Detener',
  },
  skeleton: {
    opening: 'Abriendo el Compas…',
  },
  trial: {
    note: 'Prueba sin cuenta: se elimina tras 7 días sin visita.',
    keep: 'Conservar mi viaje',
  },
  ai: {
    noticeRun:
      'Una IA puede ayudar a leer su petición, proponer etapas y redactar consejos. Todo lo que sugiere se indica como tal y Compas lo verifica.',
    noticeDone:
      'La IA ha participado en este plan: sus etapas llevan la marca «Propuesta por la IA» y sus consejos «Sugerencia de la IA».',
    privacyLink: 'Qué recibe',
  },
  credit: {
    geoapify: 'Powered by Geoapify',
  },
  ...compasStepsEs,
  ...compasScreenEs,
  ...compasAlertsEs,
  ...compasServerEs,
  ...compasUnitsEs,
  ...compasEngineEs,
};
