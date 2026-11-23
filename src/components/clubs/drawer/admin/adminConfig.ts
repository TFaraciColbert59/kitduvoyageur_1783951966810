import type { ClubCapability, ClubCapabilityDomain, ClubCapabilityMeta } from '@/features/clubs/types';
import { CLUB_CAPABILITY_CATALOG } from '@/features/clubs/types';

export type AdminPoleId = 'pilotage' | 'community' | 'operations' | 'team';

export type AdminLensId =
  | 'overview'
  | 'settings'
  | 'security-audit'
  | 'members-access'
  | 'salons'
  | 'moderation'
  | 'events-ops'
  | 'loans-gear'
  | 'budget'
  | 'challenges'
  | 'team-roles'
  | 'role-matrix';

export interface AdminLensDef {
  id: AdminLensId;
  poleId: AdminPoleId;
  label: string;
  shortLabel: string;
  /** Si vide, visible dès que l'utilisateur a accès à l'espace Admin. Sinon OR sur la liste. */
  requiredAny: readonly ClubCapability[];
}

export interface AdminPoleDef {
  id: AdminPoleId;
  label: string;
  lenses: readonly AdminLensDef[];
}

export const ADMIN_POLES: readonly AdminPoleDef[] = [
  {
    id: 'pilotage',
    label: 'Pilotage',
    lenses: [
      {
        id: 'overview',
        poleId: 'pilotage',
        label: 'Vue d’ensemble',
        shortLabel: 'Synthèse',
        requiredAny: [],
      },
      {
        id: 'settings',
        poleId: 'pilotage',
        label: 'Paramètres & Identité',
        shortLabel: 'Paramètres',
        requiredAny: ['club.edit_settings', 'club.manage_billing_settings'],
      },
      {
        id: 'security-audit',
        poleId: 'pilotage',
        label: 'Sécurité & Audit',
        shortLabel: 'Sécurité',
        requiredAny: [
          'members.view_audit_log',
          'club.transfer_ownership',
          'club.delete',
        ],
      },
    ],
  },
  {
    id: 'community',
    label: 'Communauté',
    lenses: [
      {
        id: 'members-access',
        poleId: 'community',
        label: 'Adhésions & Invitations',
        shortLabel: 'Adhésions',
        requiredAny: ['members.review_requests', 'members.manage_invites'],
      },
      {
        id: 'salons',
        poleId: 'community',
        label: 'Salons du club',
        shortLabel: 'Salons',
        requiredAny: [
          'salons.create',
          'salons.edit_settings',
          'salons.archive_or_delete',
        ],
      },
      {
        id: 'moderation',
        poleId: 'community',
        label: 'Modération & Signalements',
        shortLabel: 'Modération',
        requiredAny: [
          'moderation.resolve_reports',
          'salons.moderate_messages',
          'members.mute',
          'members.ban_or_kick',
          'highlights.moderate',
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: 'Opérations',
    lenses: [
      {
        id: 'events-ops',
        poleId: 'operations',
        label: 'Événements & Bénévoles',
        shortLabel: 'Événements',
        requiredAny: [
          'volunteers.manage_shifts',
          'events.manage_registrations',
          'events.create_official',
          'events.edit_or_cancel_any',
          'events.manage_routes',
        ],
      },
      {
        id: 'loans-gear',
        poleId: 'operations',
        label: 'Matériel & Prêts',
        shortLabel: 'Matériel',
        requiredAny: [
          'gear.approve_club_loans',
          'gear.manage_club_inventory',
          'gear.manage_standard_kits',
        ],
      },
      {
        id: 'budget',
        poleId: 'operations',
        label: 'Budget collaboratif',
        shortLabel: 'Budget',
        requiredAny: [
          'budget.view',
          'budget.propose_expense',
          'budget.approve_and_manage',
        ],
      },
      {
        id: 'challenges',
        poleId: 'operations',
        label: 'Défis du club',
        shortLabel: 'Défis',
        requiredAny: ['challenges.manage'],
      },
    ],
  },
  {
    id: 'team',
    label: 'Équipe & Droits',
    lenses: [
      {
        id: 'team-roles',
        poleId: 'team',
        label: 'Membres & Grades',
        shortLabel: 'Équipe',
        requiredAny: ['members.manage_roles', 'permissions.delegate'],
      },
      {
        id: 'role-matrix',
        poleId: 'team',
        label: 'Matrice des rôles',
        shortLabel: 'Matrice',
        requiredAny: ['permissions.delegate'],
      },
    ],
  },
] as const;

export interface CapabilityDomainGroup {
  domain: ClubCapabilityDomain;
  domainLabel: string;
  items: ClubCapabilityMeta[];
}

export const CAPABILITY_DOMAIN_GROUPS: readonly CapabilityDomainGroup[] = (() => {
  const map = new Map<ClubCapabilityDomain, CapabilityDomainGroup>();
  for (const item of CLUB_CAPABILITY_CATALOG) {
    let group = map.get(item.domain);
    if (!group) {
      group = { domain: item.domain, domainLabel: item.domainLabel, items: [] };
      map.set(item.domain, group);
    }
    group.items.push(item);
  }
  return Array.from(map.values());
})();
