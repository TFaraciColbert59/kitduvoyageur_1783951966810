import type { SmartPromptAlert, ChecklistItem, Participant } from '../types/trekHub';
import type { WeatherForecast } from './getWeather';
import type { AlertItem } from './getAlerts';
import type { LoanItem } from './getLoans';

export interface SmartPromptsInput {
  items: ChecklistItem[];
  weather?: WeatherForecast | null;
  participants: Participant[];
  emergencyContact?: string | null;
  trailDistanceKm?: number | null;
  inventoryAlerts?: AlertItem[];
  loans?: LoanItem[];
  activityType?: string | null;
}

export interface ActionableAlert extends SmartPromptAlert {
  targetItemId?: string;
  actionType?: 'check_item' | 'scroll_checklist' | 'scroll_weather' | 'edit_emergency' | 'mark_planned' | 'view_dispo' | 'view_admin';
  whyExplanation?: string;
  loanDetail?: { borrower?: string | null; dueDate?: string | null };
}

/**
 * Moteur d'analyse en temps réel pour générer les alertes tactiques (Phase 2).
 * Zéro fiction : alerte uniquement sur les réels manques d'équipement, disponibilité, météo ou sécurité.
 */
export function generateSmartPrompts({
  items = [],
  weather,
  participants = [],
  emergencyContact,
  trailDistanceKm,
  inventoryAlerts = [],
  loans = [],
  activityType,
}: SmartPromptsInput): ActionableAlert[] {
  const alerts: ActionableAlert[] = [];

  // 1. Matériel Actuellement Prêté / Indisponible (Phase 2 - Sévérité Critique)
  for (const item of items) {
    // Si l'item a un prêt actif
    const activeLoan = loans.find(
      (l) => (l.status === 'en_cours' || l.status === 'en_retard') &&
        (item.id && l.product_ownership_id === item.id)
    );

    if (activeLoan) {
      const borrower = activeLoan.borrower_contact || 'un contact';
      const due = activeLoan.due_date ? ` (retour prévu le ${activeLoan.due_date})` : '';
      alerts.push({
        id: `alert-loan-${item.id || item.name}`,
        category: 'equipment',
        severity: 'critical',
        title: `Matériel actuellement prêté : ${item.name}`,
        message: `Cet équipement est prêté à ${borrower}${due}. Pensez à le récupérer avant le départ.`,
        targetSection: 'checklist',
        targetItemId: item.id,
        actionLabel: 'Gérer la disponibilité',
        actionType: 'view_dispo',
        whyExplanation: `Cet article fait partie de votre pack pour ce départ mais est actuellement enregistré comme prêté dans votre gestionnaire de matériel.`,
        loanDetail: { borrower: activeLoan.borrower_contact, dueDate: activeLoan.due_date },
      });
    }
  }

  // 2. Alertes Réelles d'Inventaire (Maintenance / Péremption / Rappel)
  for (const invAlert of inventoryAlerts) {
    if (invAlert.is_resolved) continue;
    // Vérifier si l'alerte concerne un article présent dans ce kit
    const matchedItem = items.find(
      (i) => i.id === invAlert.id || (invAlert.message && invAlert.message.toLowerCase().includes(i.name.toLowerCase()))
    );

    if (matchedItem) {
      alerts.push({
        id: `alert-inv-${invAlert.id}`,
        category: 'equipment',
        severity: invAlert.severity || 'warning',
        title: `Inventaire : ${matchedItem.name}`,
        message: invAlert.message,
        targetSection: 'checklist',
        targetItemId: matchedItem.id,
        actionLabel: 'Vérifier l’équipement',
        actionType: 'scroll_checklist',
        whyExplanation: `Une alerte active est enregistrée dans votre inventaire pour cet article spécifique (${invAlert.type || 'maintenance/sécurité'}).`,
      });
    }
  }

  // 3. Analyse Météo Temps Réel
  if (weather && weather.days && weather.days.length > 0) {
    const rainyDay = weather.days.find((d) => d.precipPct >= 40 || (d.weathercode >= 51 && d.weathercode <= 82));
    const stormyDay = weather.days.find((d) => d.weathercode >= 95);
    const coldDay = weather.days.find((d) => d.tempMinC <= 4);

    if (stormyDay) {
      alerts.push({
        id: 'alert-weather-storm',
        category: 'weather',
        severity: 'critical',
        title: `Risque d’Orage (${stormyDay.day})`,
        message: `Conditions instables prévues (${stormyDay.day}). Évitez les crêtes exposées et vérifiez l’abri.`,
        targetSection: 'weather',
        actionLabel: 'Voir la météo',
        actionType: 'scroll_weather',
        whyExplanation: `Le bulletin météo Open-Meteo pour votre lieu de départ prévoit un risque orageux élevé (code météo ${stormyDay.weathercode}).`,
      });
    } else if (rainyDay) {
      const rainGear = items.find((i) =>
        /pluie|gore-?tex|impermeable|poncho|veste|housse/i.test(i.name)
      );
      const isReady = rainGear ? rainGear.is_checked : false;

      if (!isReady) {
        alerts.push({
          id: 'alert-weather-rain',
          category: 'weather',
          severity: 'warning',
          title: `Pluie prévue (${rainyDay.day} : ${rainyDay.precipPct}%)`,
          message: `Averses attendues (${rainyDay.day}). Emportez votre veste imperméable.`,
          targetSection: 'checklist',
          targetItemId: rainGear?.id,
          actionLabel: rainGear ? `Cocher ${rainGear.name}` : 'Voir les vestes',
          actionType: rainGear ? 'check_item' : 'scroll_checklist',
          whyExplanation: `Des précipitations sont prévues (${rainyDay.precipPct}%) et aucun vêtement de pluie n'est encore validé dans votre sac.`,
        });
      }
    }

    if (coldDay) {
      alerts.push({
        id: 'alert-weather-cold',
        category: 'weather',
        severity: 'warning',
        title: `Températures fraîches (${coldDay.day} : ${coldDay.tempMinC}°C)`,
        message: `Minima de ${coldDay.tempMinC}°C au lever du jour. Un duvet chaud est fortement conseillé.`,
        targetSection: 'checklist',
        actionLabel: 'Vérifier le couchage',
        actionType: 'scroll_checklist',
        whyExplanation: `La température minimale prévue est inférieure à 5°C, ce qui nécessite une isolation thermique adaptée (matelas R-value ≥ 3, duvet confort approprié).`,
      });
    }
  }

  // 4. Analyse du Matériel Vital non coché (Sévérité Critique)
  const uncheckedVital = items.filter(
    (i) =>
      !i.is_checked &&
      (i.is_vital || /tente|abri|duvet|couchage|secours|pharmacie|frontale|lampe|filtre|gourde|boussole|sifflet/i.test(i.name))
  );

  if (uncheckedVital.length > 0) {
    const firstVital = uncheckedVital[0];
    const names = uncheckedVital.slice(0, 2).map((i) => i.name).join(', ');
    const more = uncheckedVital.length > 2 ? ` (+${uncheckedVital.length - 2})` : '';

    const count = uncheckedVital.length;
    const title = count === 1 ? '1 équipement vital manquant' : `${count} équipements vitaux manquants`;
    const message = count === 1 ? `${names} pas encore prêt dans votre sac.` : `${names}${more} pas encore prêts dans votre sac.`;
    const actionLabel = count === 1 ? 'Voir l’article vital' : `Voir les ${count} vitaux`;

    alerts.push({
      id: 'alert-vital-gear',
      category: 'checklist',
      severity: 'critical',
      title,
      message,
      targetSection: 'checklist',
      targetItemId: firstVital.id,
      actionLabel,
      actionType: 'scroll_checklist',
      whyExplanation: `Ces articles sont marqués comme essentiels à votre sécurité et autonomie (abri, couchage, hydratation ou secours).`,
    });
  }

  // 5. Analyse des Autres Articles Restants (Sévérité Info)
  const uncheckedOther = items.filter(
    (i) => !i.is_checked && !uncheckedVital.some((v) => (v.id && v.id === i.id) || v.name === i.name)
  );

  if (uncheckedOther.length > 0 && uncheckedVital.length === 0) {
    const firstOther = uncheckedOther[0];
    const names = uncheckedOther.slice(0, 2).map((i) => i.name).join(', ');
    const more = uncheckedOther.length > 2 ? ` (+${uncheckedOther.length - 2})` : '';
    const count = uncheckedOther.length;
    const title = count === 1 ? '1 article à finaliser dans le sac' : `${count} articles à finaliser dans le sac`;
    const message = count === 1 ? `${names} non encore coché.` : `${names}${more} encore non cochés.`;

    alerts.push({
      id: 'alert-checklist-remaining',
      category: 'checklist',
      severity: 'info',
      title,
      message,
      targetSection: 'checklist',
      targetItemId: firstOther.id,
      actionLabel: 'Vérifier le sac',
      actionType: 'scroll_checklist',
      whyExplanation: `Votre sac n'est pas encore complété à 100%. Consultez la checklist pour valider les derniers articles de confort ou rechange.`,
    });
  }

  // 6. Analyse du Contact d'Urgence ICE
  if (!emergencyContact || emergencyContact.trim() === '' || emergencyContact.includes('00 00')) {
    alerts.push({
      id: 'alert-emergency-contact',
      category: 'medical',
      severity: 'warning',
      title: 'Contact d’urgence non renseigné',
      message: 'Indiquez un numéro joignable en cas d’incident ou de déclenchement du SOS.',
      targetSection: 'participants',
      actionLabel: 'Renseigner contact ICE',
      actionType: 'edit_emergency',
      whyExplanation: `En cas d'accident ou de besoin de secours, le contact ICE (In Case of Emergency) est indispensable pour les équipes médicales et de secours.`,
    });
  }

  // 7. Hydratation & Ravitaillement Eau
  if (trailDistanceKm && trailDistanceKm > 20) {
    alerts.push({
      id: 'alert-water-trail',
      category: 'water',
      severity: 'info',
      title: `Ravitaillement Eau (${trailDistanceKm.toFixed(0)} km)`,
      message: 'Parcours long : prévoyez 2.5L à 3L minimum et localisez les points d’eau.',
      targetSection: 'checklist',
      actionLabel: 'Marquer comme prévu',
      actionType: 'mark_planned',
      whyExplanation: `La distance de cet itinéraire dépasse 20 km. Une hydratation anticipée avec pastilles de purification ou filtre est recommandée.`,
    });
  }

  // Tri strict : critical en premier, puis warning, puis info
  const severityWeight = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);

  return alerts;
}
