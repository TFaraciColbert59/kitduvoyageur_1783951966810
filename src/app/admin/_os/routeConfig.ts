import type { IconName } from './Symbol';

/**
 * Configuration statique des routes Admin OS (copy FR reprise du design).
 * Les VALEURS (métriques, lignes, badges) sont fournies côté serveur par
 * `osQueries.ts` — ici uniquement libellés, icônes et destinations.
 */

export type OsTone = 'good' | 'info' | 'warn' | 'danger';
export type PanelKind = 'chart' | 'table' | 'services';

export interface OsMetric {
  label: string;
  value: string;
  delta?: string;
  icon: IconName;
  tone?: OsTone;
}

export interface OsRow {
  title: string;
  detail: string;
  value: string;
  tone: OsTone;
}

export interface InspectorContent {
  title: string;
  subtitle: string;
  headline: string;
  text: string;
  rows: OsRow[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  badgeKey?: 'community' | 'support' | 'system';
}

export interface RouteStatic {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  metricDefs: { label: string; icon: IconName }[];
  leftTitle: string;
  leftLabel: string;
  leftKind: PanelKind;
  rightTitle: string;
  rightLabel: string;
}

export const NAV: NavItem[] = [
  { id: 'overview', label: "Vue d'ensemble", icon: 'home', href: '/admin' },
  { id: 'users', label: 'Utilisateurs', icon: 'users', href: '/admin/utilisateurs' },
  { id: 'community', label: 'Communauté', icon: 'community', href: '/admin/communaute', badgeKey: 'community' },
  { id: 'compas', label: 'Compas & voyages', icon: 'compass', href: '/admin/compas' },
  { id: 'gear', label: 'Matériel & kits', icon: 'backpack', href: '/admin/produits' },
  { id: 'market', label: 'Marketplace', icon: 'bag', href: '/admin/commandes' },
  { id: 'moderation', label: 'Trust & Safety', icon: 'shield', href: '/admin/moderation' },
  { id: 'support', label: 'Support', icon: 'support', href: '/admin/support', badgeKey: 'support' },
  { id: 'analytics', label: 'Analytics', icon: 'chart', href: '/admin/analytics' },
  { id: 'system', label: 'Système', icon: 'system', href: '/admin/systeme', badgeKey: 'system' },
  { id: 'securite', label: 'Sécurité', icon: 'lock', href: '/admin/securite' },
];

export const ROUTES: Record<string, RouteStatic> = {
  overview: {
    id: 'overview',
    eyebrow: 'MISSION CONTROL',
    title: 'Mission Control',
    subtitle: 'Une lecture instantanée de ce qui compte vraiment sur LKDV.',
    ctaLabel: 'Exporter le rapport',
    ctaHref: '',
    metricDefs: [
      { label: 'Utilisateurs actifs', icon: 'pulse' },
      { label: 'Marketplace', icon: 'bag' },
      { label: 'Trust platform', icon: 'check' },
      { label: 'À traiter', icon: 'warning' },
    ],
    leftTitle: 'Live Pulse',
    leftLabel: 'TEMPS RÉEL',
    leftKind: 'chart',
    rightTitle: 'Priority Queue',
    rightLabel: 'DÉCISIONS',
  },
  users: {
    id: 'users',
    eyebrow: 'IDENTITY & TRUST',
    title: 'Utilisateurs',
    subtitle: 'Identité, confiance, organisations, accès et historique de sécurité.',
    ctaLabel: 'Créer un utilisateur',
    ctaHref: '/admin/utilisateurs',
    metricDefs: [
      { label: 'Total utilisateurs', icon: 'users' },
      { label: 'Vérifiés', icon: 'check' },
      { label: 'À risque', icon: 'warning' },
      { label: 'Organisations', icon: 'community' },
    ],
    leftTitle: 'User Directory',
    leftLabel: 'IDENTITÉS',
    leftKind: 'table',
    rightTitle: 'Trust Signals',
    rightLabel: 'RISQUE',
  },
  community: {
    id: 'community',
    eyebrow: 'COMMUNITY OPS',
    title: 'Communauté',
    subtitle: 'Santé du réseau social, contenus, clubs, groupes, carnets et contribution.',
    ctaLabel: 'Voir la modération',
    ctaHref: '/admin/moderation',
    metricDefs: [
      { label: 'Membres', icon: 'community' },
      { label: 'Carnets', icon: 'report' },
      { label: 'Clubs actifs', icon: 'users' },
      { label: 'Signalements', icon: 'shield' },
    ],
    leftTitle: 'Community Pulse',
    leftLabel: 'CONTENUS',
    leftKind: 'chart',
    rightTitle: 'Top Communities',
    rightLabel: 'CLUBS & GROUPES',
  },
  compas: {
    id: 'compas',
    eyebrow: 'ADVENTURE INTELLIGENCE',
    title: 'Compas & voyages',
    subtitle: 'Préparations IA, itinéraires, météo, risques, budgets et intégrations voyage.',
    ctaLabel: 'Voir les voyages',
    ctaHref: '/admin/compas',
    metricDefs: [
      { label: 'Voyages suivis', icon: 'compass' },
      { label: 'Étapes planifiées', icon: 'check' },
      { label: 'Budget suivi', icon: 'bag' },
      { label: 'À revoir', icon: 'warning' },
    ],
    leftTitle: 'Preparation Runs',
    leftLabel: 'GÉNÉRATIONS',
    leftKind: 'table',
    rightTitle: 'Intelligence Stack',
    rightLabel: 'IA & DONNÉES',
  },
  gear: {
    id: 'gear',
    eyebrow: 'GEAR GRAPH',
    title: 'Matériel & kits',
    subtitle: 'Inventaires utilisateurs, produits canoniques, kits, compatibilité et sécurité.',
    ctaLabel: 'Ajouter un produit',
    ctaHref: '/admin/produits/nouveau',
    metricDefs: [
      { label: 'Produits', icon: 'backpack' },
      { label: 'En stock', icon: 'check' },
      { label: 'Valeur stock', icon: 'bag' },
      { label: 'Alertes stock', icon: 'warning' },
    ],
    leftTitle: 'Gear Intelligence',
    leftLabel: 'INVENTAIRE',
    leftKind: 'table',
    rightTitle: 'Kit Readiness',
    rightLabel: 'PRÉPARATION',
  },
  market: {
    id: 'market',
    eyebrow: 'COMMERCE',
    title: 'Marketplace',
    subtitle: 'Vente, location, prêt, occasion, paiements, confiance et litiges.',
    ctaLabel: 'Voir les commandes',
    ctaHref: '/admin/commandes',
    metricDefs: [
      { label: 'GMV total', icon: 'bag' },
      { label: 'Commandes', icon: 'pulse' },
      { label: 'Retraits en attente', icon: 'clock' },
      { label: 'Litiges ouverts', icon: 'shield' },
    ],
    leftTitle: 'Transactions',
    leftLabel: 'COMMERCE',
    leftKind: 'table',
    rightTitle: 'Trust & Verification',
    rightLabel: 'SÉCURITÉ',
  },
  moderation: {
    id: 'moderation',
    eyebrow: 'TRUST & SAFETY',
    title: 'Trust & Safety',
    subtitle: 'Signalements, preuves, sanctions, appels et décisions à haut risque.',
    ctaLabel: 'Voir la file',
    ctaHref: '/admin/moderation',
    metricDefs: [
      { label: 'Queue critique', icon: 'warning' },
      { label: 'En attente', icon: 'clock' },
      { label: 'Approuvés', icon: 'check' },
      { label: 'Rejetés', icon: 'shield' },
    ],
    leftTitle: 'Safety Queue',
    leftLabel: 'PRIORITÉ',
    leftKind: 'table',
    rightTitle: 'Policy Signals',
    rightLabel: 'AUTOMATION',
  },
  support: {
    id: 'support',
    eyebrow: 'CASE MANAGEMENT',
    title: 'Support',
    subtitle: 'Tickets, utilisateurs, commandes, voyages et incidents réunis dans un dossier unique.',
    ctaLabel: 'Voir les dossiers',
    ctaHref: '/admin/support',
    metricDefs: [
      { label: 'Dossiers ouverts', icon: 'support' },
      { label: 'Critiques', icon: 'warning' },
      { label: 'Retraits à traiter', icon: 'clock' },
      { label: 'Résolus (audit)', icon: 'check' },
    ],
    leftTitle: 'Support Inbox',
    leftLabel: 'DOSSIERS',
    leftKind: 'table',
    rightTitle: 'Service Health',
    rightLabel: 'ÉQUIPE',
  },
  analytics: {
    id: 'analytics',
    eyebrow: 'SIGNALS',
    title: 'Analytics',
    subtitle: 'Usage, activation, rétention, conversion et performance de chaque boucle produit.',
    ctaLabel: 'Voir les signaux',
    ctaHref: '/admin/analytics',
    metricDefs: [
      { label: 'Utilisateurs', icon: 'pulse' },
      { label: 'Commandes', icon: 'users' },
      { label: 'Panier moyen', icon: 'check' },
      { label: 'Conversion', icon: 'chart' },
    ],
    leftTitle: 'Product Activity',
    leftLabel: 'USAGE',
    leftKind: 'chart',
    rightTitle: 'Activation Funnel',
    rightLabel: 'FUNNEL',
  },
  system: {
    id: 'system',
    eyebrow: 'PLATFORM',
    title: 'System Control',
    subtitle: 'Services, releases, jobs, feature flags, incidents, données et audit.',
    ctaLabel: 'Voir le journal',
    ctaHref: '/admin/audit',
    metricDefs: [
      { label: 'Base de données', icon: 'check' },
      { label: 'Latence DB', icon: 'pulse' },
      { label: 'Migrations', icon: 'clock' },
      { label: 'Intégrations', icon: 'warning' },
    ],
    leftTitle: 'Service Matrix',
    leftLabel: 'PRODUCTION',
    leftKind: 'services',
    rightTitle: 'Release Control',
    rightLabel: 'DÉPLOIEMENT',
  },
  securite: {
    id: 'securite',
    eyebrow: 'ZERO TRUST',
    title: 'Sécurité',
    subtitle: 'Double authentification, rôles, sessions et accès sensibles.',
    ctaLabel: 'Gérer le MFA',
    ctaHref: '/admin/securite',
    metricDefs: [
      { label: 'Administrateurs', icon: 'shield' },
      { label: 'Rôles actifs', icon: 'users' },
      { label: 'MFA actif', icon: 'lock' },
      { label: 'Actions auditées', icon: 'report' },
    ],
    leftTitle: 'Access Control',
    leftLabel: 'ACCÈS',
    leftKind: 'table',
    rightTitle: 'Audit Trail',
    rightLabel: 'TRAÇABILITÉ',
  },
};

export function routeStatic(id: string): RouteStatic {
  return ROUTES[id] ?? ROUTES['overview'];
}
