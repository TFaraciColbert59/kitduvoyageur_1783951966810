/**
 * Moteur de règles de notifications tactiques de départ (§4B & §5).
 * Calcule les notifications à envoyer selon la date du départ et les alertes météo/vitaux.
 */

export interface DepartNotificationPlan {
  jMinus7?: { title: string; body: string; scheduledAt: string };
  jMinus2?: { title: string; body: string; scheduledAt: string };
  jMinus1?: { title: string; body: string; scheduledAt: string };
  weatherAlert?: { title: string; body: string };
}

export function buildDepartNotificationPlan({
  destination,
  startsAt,
  hasMissingVitals,
  hasRainRisk,
}: {
  destination: string;
  startsAt: string | null;
  hasMissingVitals: boolean;
  hasRainRisk: boolean;
}): DepartNotificationPlan {
  if (!startsAt) return {};

  const target = new Date(startsAt).getTime();
  const now = Date.now();
  if (isNaN(target) || target <= now) return {};

  const plan: DepartNotificationPlan = {};

  // Notification J-7 : Équipements vitaux
  const j7Time = target - 7 * 86400000;
  if (j7Time > now) {
    plan.jMinus7 = {
      title: `J-7 avant ${destination}`,
      body: 'Vérifiez votre équipement vital (tente, duvet, trousse de secours) sur LKDV.',
      scheduledAt: new Date(j7Time).toISOString(),
    };
  }

  // Notification J-2 : Bulletin météo
  const j2Time = target - 2 * 86400000;
  if (j2Time > now) {
    plan.jMinus2 = {
      title: `J-2 Météo pour ${destination}`,
      body: hasRainRisk
        ? 'Risque de pluie détecté. Vérifiez votre veste imperméable et vos couches chaudes.'
        : 'Bulletin météo favorable. Ajustez vos consommables et vivres de course.',
      scheduledAt: new Date(j2Time).toISOString(),
    };
  }

  // Notification J-1 : ICE & Hors-ligne
  const j1Time = target - 1 * 86400000;
  if (j1Time > now) {
    plan.jMinus1 = {
      title: `Départ demain pour ${destination} !`,
      body: 'Vérifiez votre contact d’urgence ICE et préparez la carte hors-ligne.',
      scheduledAt: new Date(j1Time).toISOString(),
    };
  }

  if (hasMissingVitals && (target - now) <= 86400000) {
    plan.weatherAlert = {
      title: `Alerte départ : Équipement vital manquant`,
      body: 'Votre sac de départ a des articles de sécurité vitaux non validés.',
    };
  }

  return plan;
}
