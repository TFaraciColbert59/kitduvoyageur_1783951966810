/**
 * Catalogue des notifications d'activité et de leurs réglages (fiches O01 S6.20).
 *
 * Ce fichier ne contient que des TYPES réellement émis par le dépôt/la base
 * (triggers `notify()` / `notify_activity()`, inserts serveur des équipages et
 * invitations de voyage). Il ne fabrique ni club, ni segment, ni sport : les
 * colonnes `notification_preferences` sont déjà libres par `notification_type`
 * et n'exigent donc aucune migration.
 *
 * Les quatre catégories historiques (`user_profiles.notification_prefs`) sont
 * conservées pour compatibilité. L'API recalcule leur valeur à partir des
 * préférences fines afin que les deux contrats ne divergent pas.
 */

export type NotificationPreferenceGroupId =
  | 'social'
  | 'clubs'
  | 'challenges'
  | 'gear'
  | 'orders'
  | 'system';

export type LegacyNotificationGroup = 'social' | 'loans' | 'orders' | 'system';

export interface NotificationTypeDefinition {
  /** Valeur exacte de `notifications.type` / `notification_preferences.notification_type`. */
  type: string;
  label: string;
  detail: string;
  group: NotificationPreferenceGroupId;
  /** Catégorie historique écrite dans `user_profiles.notification_prefs`. */
  legacyGroup: LegacyNotificationGroup;
  /**
   * `notify()` force l'email à false pour ces types (regroupés dans le digest).
   * Le réglage email est donc affiché désactivé plutôt que de laisser croire
   * qu'il changerait quelque chose.
   */
  emailLocked?: boolean;
  /**
   * Le producteur insère seulement la ligne in-app (trigger `notify_activity`
   * ou insert serveur) : aucun email/push n'est enfilé aujourd'hui. Les canaux
   * correspondants sont affichés désactivés, pas simulés.
   */
  inAppOnly?: boolean;
}

export interface NotificationGroupDefinition {
  id: NotificationPreferenceGroupId;
  label: string;
  detail: string;
}

export interface LegacyNotificationCategoryDefinition {
  id: LegacyNotificationGroup;
  label: string;
  detail: string;
}

export const NOTIFICATION_GROUPS: readonly NotificationGroupDefinition[] = [
  {
    id: 'social',
    label: 'Social',
    detail: 'Publications, carnets, abonnements et invitations de voyage.',
  },
  {
    id: 'clubs',
    label: 'Clubs et équipages',
    detail:
      'Invitations, demandes, tâches et dépenses des équipages. Les discussions de club partagent le type « mention » avec les publications, réglé dans Social.',
  },
  {
    id: 'challenges',
    label: 'Défis',
    detail: 'Fin d’un défi auquel tu participes.',
  },
  {
    id: 'gear',
    label: 'Matériel et prêts',
    detail: 'Demandes de prêt et retards de retour.',
  },
  {
    id: 'orders',
    label: 'Commandes',
    detail: 'Confirmation, expédition, livraison et annulation.',
  },
  {
    id: 'system',
    label: 'Système',
    detail: 'Trophées et signalements pris en compte.',
  },
];

export const LEGACY_NOTIFICATION_CATEGORIES: readonly LegacyNotificationCategoryDefinition[] = [
  {
    id: 'social',
    label: 'Social',
    detail: 'Publications, carnets, abonnements, équipages et voyages.',
  },
  { id: 'loans', label: 'Prêts', detail: 'Matériel prêté ou emprunté.' },
  { id: 'orders', label: 'Commandes', detail: 'Suivi des commandes LKDV.' },
  { id: 'system', label: 'Système', detail: 'Défis, trophées et signalements.' },
];

/**
 * Types émis aujourd'hui, avec leur catégorie historique. Un type absent de
 * cette liste n'est ni affiché ni modifiable : aucune case vide n'est créée.
 */
export const NOTIFICATION_TYPES: readonly NotificationTypeDefinition[] = [
  {
    type: 'post_liked',
    label: 'J’aime sur une publication',
    detail: 'Quelqu’un a aimé l’une de tes publications.',
    group: 'social',
    legacyGroup: 'social',
    emailLocked: true,
  },
  {
    type: 'post_commented',
    label: 'Commentaire sur une publication',
    detail: 'Quelqu’un a commenté l’une de tes publications.',
    group: 'social',
    legacyGroup: 'social',
  },
  {
    type: 'carnet_liked',
    label: 'J’aime sur un carnet',
    detail: 'Quelqu’un a aimé l’un de tes carnets.',
    group: 'social',
    legacyGroup: 'social',
    emailLocked: true,
  },
  {
    type: 'carnet_commented',
    label: 'Commentaire sur un carnet',
    detail: 'Quelqu’un a commenté l’un de tes carnets.',
    group: 'social',
    legacyGroup: 'social',
  },
  {
    type: 'mention',
    label: 'Mention',
    detail: 'Tu es mentionné·e dans une publication ou une discussion de club.',
    group: 'social',
    legacyGroup: 'social',
    inAppOnly: true,
  },
  {
    type: 'new_follower',
    label: 'Nouvel abonné',
    detail: 'Quelqu’un s’est abonné à ton profil.',
    group: 'social',
    legacyGroup: 'social',
    emailLocked: true,
    inAppOnly: true,
  },
  {
    type: 'post_repost',
    label: 'Publication republiée',
    detail: 'L’une de tes publications a été republiée.',
    group: 'social',
    legacyGroup: 'social',
    inAppOnly: true,
  },
  {
    type: 'trip_invitation',
    label: 'Invitation à un voyage',
    detail: 'Quelqu’un t’invite à rejoindre un voyage.',
    group: 'social',
    legacyGroup: 'social',
  },
  {
    type: 'group_invite',
    label: 'Invitation à un équipage',
    detail: 'Un équipage t’a invité·e.',
    group: 'clubs',
    legacyGroup: 'social',
  },
  {
    type: 'group_join_request',
    label: 'Demande pour rejoindre un équipage',
    detail: 'Quelqu’un demande à rejoindre l’un de tes équipages.',
    group: 'clubs',
    legacyGroup: 'social',
    inAppOnly: true,
  },
  {
    type: 'group_join_accepted',
    label: 'Demande acceptée',
    detail: 'Ta demande pour rejoindre un équipage a été acceptée.',
    group: 'clubs',
    legacyGroup: 'social',
    inAppOnly: true,
  },
  {
    type: 'group_join_rejected',
    label: 'Demande non retenue',
    detail: 'Ta demande pour rejoindre un équipage n’a pas été retenue.',
    group: 'clubs',
    legacyGroup: 'social',
    inAppOnly: true,
  },
  {
    type: 'group_task_assigned',
    label: 'Tâche assignée',
    detail: 'Une tâche d’équipage t’a été assignée.',
    group: 'clubs',
    legacyGroup: 'social',
  },
  {
    type: 'group_expense_added',
    label: 'Dépense ajoutée',
    detail: 'Une dépense a été ajoutée à un équipage.',
    group: 'clubs',
    legacyGroup: 'social',
  },
  {
    type: 'challenge_completed',
    label: 'Défi terminé',
    detail: 'Tu viens de terminer un défi.',
    group: 'challenges',
    legacyGroup: 'system',
    inAppOnly: true,
  },
  {
    type: 'loan_request',
    label: 'Demande de prêt',
    detail: 'Quelqu’un souhaite emprunter ton matériel.',
    group: 'gear',
    legacyGroup: 'loans',
    inAppOnly: true,
  },
  {
    type: 'loan_due',
    label: 'Prêt en retard',
    detail: 'Un prêt arrive à échéance.',
    group: 'gear',
    legacyGroup: 'loans',
    inAppOnly: true,
  },
  {
    type: 'order_confirmed',
    label: 'Commande confirmée',
    detail: 'Ta commande est confirmée.',
    group: 'orders',
    legacyGroup: 'orders',
    inAppOnly: true,
  },
  {
    type: 'order_shipped',
    label: 'Commande expédiée',
    detail: 'Ta commande est expédiée.',
    group: 'orders',
    legacyGroup: 'orders',
    inAppOnly: true,
  },
  {
    type: 'order_delivered',
    label: 'Commande livrée',
    detail: 'Ta commande est livrée.',
    group: 'orders',
    legacyGroup: 'orders',
    inAppOnly: true,
  },
  {
    type: 'order_cancelled',
    label: 'Commande annulée',
    detail: 'Ta commande est annulée.',
    group: 'orders',
    legacyGroup: 'orders',
    inAppOnly: true,
  },
  {
    type: 'badge_earned',
    label: 'Trophée débloqué',
    detail: 'Un trophée vient d’être débloqué.',
    group: 'system',
    legacyGroup: 'system',
    inAppOnly: true,
  },
  {
    type: 'group_report_received',
    label: 'Signalement pris en compte',
    detail: 'Ton signalement a été enregistré par la modération.',
    group: 'system',
    legacyGroup: 'system',
    inAppOnly: true,
  },
];

/**
 * Périmètre demandé par S6.20 mais sans producteur de notification dans les
 * données actuelles : l'interface l'annonce, elle ne crée pas de fausse case.
 */
export const UNAVAILABLE_NOTIFICATION_SCOPES = [
  {
    id: 'sport',
    label: 'Sports',
    reason:
      'Aucune notification sportive n’est émise par les données actuelles : le réglage ne serait relié à rien.',
  },
  {
    id: 'segment',
    label: 'Segments',
    reason:
      'Aucun producteur de notification de segment n’est branché : le réglage ne serait relié à rien.',
  },
] as const;

export const NOTIFICATION_TYPE_BY_ID: ReadonlyMap<string, NotificationTypeDefinition> = new Map<
  string,
  NotificationTypeDefinition
>(
  NOTIFICATION_TYPES.map(
    (definition): [string, NotificationTypeDefinition] => [definition.type, definition]
  )
);

export const NOTIFICATION_GROUP_BY_ID: ReadonlyMap<
  NotificationPreferenceGroupId,
  NotificationGroupDefinition
> = new Map<NotificationPreferenceGroupId, NotificationGroupDefinition>(
  NOTIFICATION_GROUPS.map(
    (group): [NotificationPreferenceGroupId, NotificationGroupDefinition] => [group.id, group]
  )
);

export function isKnownNotificationType(type: string): boolean {
  return NOTIFICATION_TYPE_BY_ID.has(type);
}

export function notificationTypesForGroup(
  group: NotificationPreferenceGroupId
): NotificationTypeDefinition[] {
  return NOTIFICATION_TYPES.filter((definition) => definition.group === group);
}

export function notificationTypesForLegacyGroup(
  group: LegacyNotificationGroup
): NotificationTypeDefinition[] {
  return NOTIFICATION_TYPES.filter((definition) => definition.legacyGroup === group);
}

/** Valeurs par défaut identiques à `notify()` : app actif, email verrouillé ou in-app seulement sinon. */
export function defaultNotificationPreference(
  definition: NotificationTypeDefinition
): { inApp: boolean; email: boolean; push: boolean } {
  if (definition.inAppOnly) {
    return { inApp: true, email: false, push: false };
  }
  return { inApp: true, email: !definition.emailLocked, push: true };
}

export function computeLegacyCategories(
  preferences: ReadonlyArray<{ type: string; inApp: boolean }>
): Record<LegacyNotificationGroup, boolean> {
  const enabled = new Set(
    preferences.filter((preference) => preference.inApp).map((preference) => preference.type)
  );
  const categories: Record<LegacyNotificationGroup, boolean> = {
    social: false,
    loans: false,
    orders: false,
    system: false,
  };
  for (const definition of NOTIFICATION_TYPES) {
    if (enabled.has(definition.type)) categories[definition.legacyGroup] = true;
  }
  return categories;
}
