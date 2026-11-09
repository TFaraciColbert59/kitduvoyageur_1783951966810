/**
 * Jeu de données de la maquette, réservé à la PRÉVISUALISATION DE DESIGN.
 *
 * Activé uniquement quand `CRM_DESIGN_PREVIEW=1` et hors production : il permet de
 * capturer les écrans réels (drawers, formulaires) sans base migrée, pour la
 * comparaison à `bundle/references/maquette/*.dc.html`. Jamais servi en production.
 *
 * Les valeurs sont celles de la maquette (Tony, @randonneur_alpin, SOS des Écrins,
 * remboursement 89,90 €…), pas des données de membres réels.
 */
import type {
  Agent, AuditRow, CaseDetail, InboxItem, InboxPayload, Member360, OrderDetail,
  PoleCode, RequestDetail, RequestItem, Role, StaffContext
} from '../../lib/rpc';
import type { ReasonCode } from './reason-codes';
import { BUNDLED_REASON_CODES } from './reason-codes';
import type { SosAlert } from '../sos/sos-screen';

export function previewEnabled(): boolean {
  return process.env.CRM_DESIGN_PREVIEW === '1' && process.env.NODE_ENV !== 'production';
}

const now = new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.parse(now) - m * 60_000).toISOString();
const inMinutes = (m: number) => new Date(Date.parse(now) + m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(Date.parse(now) - d * 86_400_000).toISOString();

export const demoContext: StaffContext = {
  role: 'super_admin',
  poles: [
    { code: 'CONF', role: 'super_admin' }, { code: 'MEMB', role: 'super_admin' }, { code: 'COMM', role: 'super_admin' },
    { code: 'CONT', role: 'super_admin' }, { code: 'PRIA', role: 'super_admin' }, { code: 'CROI', role: 'super_admin' },
    { code: 'TECH', role: 'super_admin' }
  ] as { code: PoleCode; role: Role }[],
  solo: true,
  staff: true,
  display_name: 'Tony',
  initials: 'TF',
  email: 'tony@lekitduvoyageur.fr',
  sensitive_today: 3,
  sensitive_cap: 10
};

export const demoPoles = {
  poles: [
    { code: 'CONF', label: 'Confiance', count: 14, role: 'super_admin' },
    { code: 'MEMB', label: 'Membres', count: 3, role: 'super_admin' },
    { code: 'COMM', label: 'Commerce', count: 2, role: 'super_admin' },
    { code: 'CONT', label: 'Contenus', count: 21, role: 'super_admin' },
    { code: 'PRIA', label: 'Produit et IA', count: 0, role: 'super_admin' },
    { code: 'CROI', label: 'Croissance', count: 0, role: 'super_admin' },
    { code: 'TECH', label: 'Technique', count: 1, role: 'super_admin' }
  ] as { code: PoleCode; label: string; count: number; role: Role | null }[]
};

const item = (partial: Partial<InboxItem> & Pick<InboxItem, 'key' | 'source' | 'id' | 'group' | 'title' | 'subtitle' | 'pole'>): InboxItem => ({
  urgency: 'normale', due_at: null, created_at: now, badges: [], meta: {}, ...partial
});

export const demoInbox: InboxPayload = {
  items: [
    item({ key: 'sos:1', source: 'sos', id: 'd1000000-0000-4000-8000-000000000001', group: 'urgence_haute', pole: 'CONF', urgency: 'haute', title: 'SOS déclenché — massif des Écrins', subtitle: 'Confiance · membre @lea.montagne · position partagée', due_at: inMinutes(2), created_at: minutesAgo(3), badges: ['Personne n’a pris', '2 min'], meta: { member: { id: 'd1200000-0000-4000-8000-000000000002', name: '@lea.montagne', since: 'mars 2025', reports_90d: 0, strikes: 0 }, rule: { label: 'Urgence vitale', scale: 'SOS → notification immédiate → e-mail après 5 min → escalade super admin' }, linked: ['2 sorties partagées cette semaine', '1 contact d’urgence déclaré'], member_id: 'd1200000-0000-4000-8000-000000000002' } }),
    item({ key: 'post_report:1', source: 'post_report', id: 'd1000000-0000-4000-8000-000000000002', group: 'delai_bientot', pole: 'CONF', title: 'Commentaire signalé 3 fois — sous un carnet GR20', subtitle: 'Confiance · harcèlement ×2, spam ×1 · auteur @randonneur_alpin', due_at: inMinutes(12), created_at: minutesAgo(48), badges: ['Reste 12 min'], meta: { member: { id: 'd1200000-0000-4000-8000-000000000001', name: '@randonneur_alpin', since: 'mars 2025', reports_90d: 4, strikes: 1 }, rule: { label: 'Harcèlement ou insulte', scale: 'Échelle : message privé → masquage → suspension 7 jours → 30 jours → bannissement.' }, linked: ['2 autres commentaires du même auteur signalés cette semaine'], ai: { label: 'Masquer le commentaire', confidence: 0.92 }, member_id: 'd1200000-0000-4000-8000-000000000001' } }),
    item({ key: 'support_ticket:1', source: 'support_ticket', id: 'd1000000-0000-4000-8000-000000000003', group: 'delai_bientot', pole: 'MEMB', title: 'Ticket : « je n’arrive pas à partager mon carnet »', subtitle: 'Membres · ouvert il y a 3 h 40 · réponse préparée par l’agent Support', due_at: inMinutes(20), created_at: minutesAgo(220), badges: ['Reste 20 min'] }),
    item({ key: 'request:1', source: 'request', id: 'd1000000-0000-4000-8000-000000000004', group: 'a_valider', pole: 'COMM', title: 'Remboursement de 89,90 € — commande LKDV-10482', subtitle: 'Commerce · préparé par l’agent « Remboursements » · motif : produit défectueux', created_at: minutesAgo(25), badges: ['Agent IA', 'Votre validation'] }),
    item({ key: 'post_report:2', source: 'post_report', id: 'd1000000-0000-4000-8000-000000000005', group: 'a_valider', pole: 'CONF', title: 'Publication signalée — spam probable', subtitle: 'Confiance · l’agent Trieur propose « masquer » · confiance haute', created_at: minutesAgo(34), badges: ['Agent IA', 'Votre décision'] }),
    item({ key: 'terrain_report:1', source: 'terrain_report', id: 'd1000000-0000-4000-8000-000000000006', group: 'signalements', pole: 'CONT', title: 'Passerelle signalée effondrée — vallée de la Clère', subtitle: 'Contenus · signalement terrain · 2 confirmations', created_at: daysAgo(1), badges: ['Hier'] }),
    item({ key: 'contribution:20', source: 'contribution', id: 'd1000000-0000-4000-8000-000000000007', group: 'contributions', pole: 'CONT', title: '20 contributions de lieux à vérifier', subtitle: 'Contenus · points d’eau, refuges, sommets · traitement en lot possible', created_at: daysAgo(2), badges: ['Lot'] }),
    item({ key: 'alert:1', source: 'alert', id: 'd1000000-0000-4000-8000-000000000008', group: 'signalements', pole: 'TECH', title: 'Pic d’erreurs sur une tâche planifiée', subtitle: 'Technique · signalé par l’agent Surveillant d’erreurs · relance possible', created_at: minutesAgo(70), badges: ['Agent IA'] })
  ],
  counts: { total: 34, urgent: 4, urgent_high: 1, due_soon: 3, reports: 14, approvals: 2, contributions: 20, by_pole: { CONF: 14, MEMB: 3, COMM: 2, CONT: 21, PRIA: 0, CROI: 0, TECH: 1 } },
  sla: { held_days: 6, treated_today: 12, target_today: 46 }
};

export const demoReasonCodes: ReasonCode[] = BUNDLED_REASON_CODES;

export const demoCaseDetail: CaseDetail = {
  source: 'post_report',
  id: 'd1000000-0000-4000-8000-000000000002',
  pole: 'CONF',
  target: {
    kind: 'commentaire',
    id: 'd1100000-0000-4000-8000-000000000001',
    title: 'Commentaire sous le carnet « GR20 — les 16 jours »',
    body: '« Tu marches encore avec tes vieilles chaussures ? Sérieux, tu ferais mieux de rester chez toi, on n’a pas besoin de touristes qui se croient en expédition. Tout le monde sait que tu es une imposture ici. »',
    author_id: 'd1200000-0000-4000-8000-000000000001',
    author_name: '@randonneur_alpin',
    created_at: minutesAgo(38),
    media: ['/media/signalement-demo.svg']
  },
  reports: [
    { id: 'r1', reason: 'harcèlement', created_at: minutesAgo(170), reporter_id: null },
    { id: 'r2', reason: 'harcèlement', created_at: minutesAgo(160), reporter_id: null },
    { id: 'r3', reason: 'spam', created_at: minutesAgo(150), reporter_id: null }
  ],
  member: { id: 'd1200000-0000-4000-8000-000000000001', name: '@randonneur_alpin', reports_90d: 4, active_strikes: 1, member_since: 'mars 2025', account_status: 'active', publications: 41 },
  rule: { code: 'harcelement', label: 'Harcèlement ou insulte', scale: 'message privé → masquage → suspension 7 jours → 30 jours → bannissement' },
  linked: [
    { id: 'd1100000-0000-4000-8000-000000000002', label: '2 autres commentaires du même auteur signalés cette semaine' },
    { id: 'd1100000-0000-4000-8000-000000000003', label: '1 blocage réciproque avec une membre du même carnet' }
  ],
  ai_suggestion: { label: 'Harcèlement probable', confidence: 0.72, agent: 'Agent Trieur' },
  history: [
    { at: '12 oct.', label: 'Message privé (harcèlement)' },
    { at: '28 oct.', label: 'Commentaire masqué' }
  ],
  next_step: 'Prochaine marche : suspension 7 jours',
  deadline_at: inMinutes(12),
  actions: [
    { command: 'comment_hide', label: 'Masquer', primary: true, tone: 'danger' },
    { command: 'comment_report_resolve', label: 'Laisser', primary: true, tone: 'positive' },
    { command: 'member_suspend', label: 'Sanctionner', primary: true, tone: 'danger' },
    { command: 'comment_remove', label: 'Supprimer le commentaire', primary: false, tone: 'danger' },
    { command: 'member_adjust_trust', label: 'Ajuster le score de confiance', primary: false, tone: 'default' }
  ],
  already_decided: false
};

export const demoMember: Member360 = {
  id: 'd1200000-0000-4000-8000-000000000001',
  display_name: '@randonneur_alpin',
  email_masked: 'to•••@proton.me',
  phone_masked: '+33 6 •• •• •• 42',
  member_since: '2025-03-04',
  account_status: 'active',
  suspended_until: null,
  trust_score: 42,
  loyalty_level: 'Sage',
  activity: { posts: 18, comments: 141, carnets: 4, voyages: 3, orders: 2, reports_against: 4, last_seen: minutesAgo(60) },
  profile_visibility: 'public',
  two_fa_enabled: false,
  email_consent: false,
  documents_count: 1,
  gps_proofs: 9,
  warning_expires_at: '2027-10-28',
  ai_summary: 'Randonneur actif dans les Alpes et en Corse : 41 publications, 6 carnets, 2 commandes. Ton souvent vif dans les commentaires ; 4 signalements en 90 jours, tous sur des commentaires. Aucun litige de paiement.',
  orders: [
    { number: 'LKDV-10471', amount_cents: 6480, status: 'livrée', at: daysAgo(3) },
    { number: 'LKDV-10213', amount_cents: 12900, status: 'livrée', at: daysAgo(27) }
  ],
  sessions: { count: 2, device: 'iPhone, navigateur', last_seen: minutesAgo(60) },
  support: { open_tickets: 0 },
  activity_events: [
    { kind: 'avertissement', label: 'Signalement en cours', detail: 'commentaire sous « Traversée du GR20 »', at: minutesAgo(38), group: 'À venir' },
    { kind: 'publication', label: 'A publié un carnet · « Traversée du GR20 en 9 jours »', at: '2026-11-06T10:00:00+01:00', group: 'Novembre 2026' },
    { kind: 'commande', label: 'Commande LKDV-10471 livrée · 2 articles · 64,80 €', at: '2026-11-03T10:00:00+01:00', group: 'Novembre 2026' },
    { kind: 'moderation', label: 'Commentaire masqué · harcèlement · par Tony', at: '2026-10-28T10:00:00+01:00', group: 'Octobre 2026' },
    { kind: 'sortie', label: 'Sortie enregistrée · 14,2 km · massif du Mont-Blanc', at: '2026-10-19T10:00:00+01:00', group: 'Octobre 2026' },
    { kind: 'message', label: 'Message privé de rappel des règles · par Tony', at: '2026-10-12T10:00:00+01:00', group: 'Octobre 2026' }
  ],
  notes: [
    { id: 'n1', body: 'A reconnu le ton inadéquat après le rappel du 12 octobre. À surveiller sur les fils GR20.', author: 'Tony', created_at: daysAgo(28) },
    { id: 'n2', body: 'Demande de récupération de compte traitée (double compte supprimé).', author: 'Tony', created_at: daysAgo(61) }
  ],
  strikes: [{ id: 's1', reason: 'Harcèlement', created_at: daysAgo(21), expires_at: daysAgo(-344), active: true }],
  actions: [
    { command: 'member_suspend', label: 'Suspendre', tone: 'danger' },
    { command: 'member_ban', label: 'Bannir', tone: 'danger' },
    { command: 'member_revoke_sessions', label: 'Déconnecter partout', tone: 'default' },
    { command: 'member_adjust_trust', label: 'Ajuster la confiance', tone: 'default' },
    { command: 'member_export_gdpr', label: 'Exporter (RGPD)', tone: 'default' }
  ]
};

const demoRequestItem: RequestItem = {
  id: 'd1300000-0000-4000-8000-000000000001',
  command: 'order_refund',
  label: 'Remboursement de 89,90 € — commande LKDV-10482',
  author: 'Agent Remboursements',
  created_at: minutesAgo(25),
  expires_at: inMinutes(4310),
  amount_cents: 8990,
  solo: true
};

export const demoRequest: RequestDetail = {
  ...demoRequestItem,
  params: { order_id: 'LKDV-10482', amount_cents: 8900, reason_code: 'produit_defectueux', payment_intent: 'pi_3N•••' },
  fingerprint: 'sha256:9f2c41b7e8d0a6c5…',
  target_label: 'Commande LKDV-10482 — Léa Montagne',
  self_authored: true,
  second_human_required: false,
  confirmation_hint: 'Tapez le montant : 89,90 €',
  paid_cents: 12980,
  refunded_cents: 0,
  refundable_cents: 12980,
  paid_at: daysAgo(6),
  card_brand: 'Visa',
  card_last4: '4417',
  member_orders: 3,
  evidence: ['2 photos du membre', 'échange de 4 messages'],
  risk: { level: 'faible', facts: ['Premier remboursement de ce membre', 'Aucun litige bancaire en cours'] },
  items: [
    { label: 'Réchaud ultra-léger', qty: 1, amount_cents: 8990 },
    { label: 'Cartouche gaz 230 g', qty: 2, amount_cents: 3990 }
  ]
};

export const demoAgents: { agents: Agent[]; solo: boolean; bricks: unknown; review: { total: number; done: number } } = {
  solo: true,
  review: { total: 10, done: 4 },
  bricks: [],
  agents: [
    { id: 'a1', name: 'Trieur de signalements', role: 'trieur', pole: 'CONF', status: 'active', enabled: true, hourly_cap: 60, used_last_hour: 12, proposals_24h: 38, accepted_rate: 0.92, tools: ['post_hide', 'comment_hide', 'story_moderate'], last_run_at: minutesAgo(4), last_error: null , description: 'Lit un signalement, propose un motif, prépare un message. Ne sanctionne jamais.'},
    { id: 'a2', name: 'Remboursements', role: 'remboursements', pole: 'COMM', status: 'active', enabled: true, hourly_cap: 10, used_last_hour: 1, proposals_24h: 2, accepted_rate: 1, tools: ['order_refund', 'order_cancel'], last_run_at: minutesAgo(18), last_error: null , description: 'Lit une commande, prépare une demande de remboursement. Aucun accès à Stripe.'},
    { id: 'a3', name: 'Support', role: 'support', pole: 'MEMB', status: 'active', enabled: true, hourly_cap: 30, used_last_hour: 9, proposals_24h: 5, accepted_rate: 0.8, tools: ['ticket_reply', 'ticket_set_status'], last_run_at: minutesAgo(2), last_error: null , description: 'Lit un ticket, cherche dans l’aide, prépare une réponse. Envoi après votre relecture.'},
    { id: 'a4', name: 'Résumeur de fiches', role: 'resumeur', pole: 'MEMB', status: 'active', enabled: true, hourly_cap: 120, used_last_hour: 0, proposals_24h: 17, accepted_rate: null, tools: ['member_summary'], last_run_at: minutesAgo(96), last_error: 'NVIDIA indisponible (503)' , description: 'Lecture seule. N’a jamais accès aux documents d’identité ni à l’orientation.'},
    { id: 'a5', name: 'Relecteur de fiches pays', role: 'relecteur', pole: 'CONT', status: 'active', enabled: true, hourly_cap: 20, used_last_hour: 3, proposals_24h: 9, accepted_rate: 0.67, tools: ['country_content_review'], last_run_at: minutesAgo(41), last_error: null , description: 'Lit une fiche, propose une correction sourcée. Publication par vous.'},
    { id: 'a6', name: 'Surveillant d’erreurs', role: 'surveillant', pole: 'TECH', status: 'active', enabled: true, hourly_cap: 6, used_last_hour: 1, proposals_24h: 1, accepted_rate: null, status_label: 'Signale un pic', tools: ['errors_view', 'alert_resolve'], last_run_at: minutesAgo(1), last_error: null, description: 'Lit les erreurs, relance une tâche en échec une fois. Aucune écriture en base.' }
  ]
};

export const demoAudit: { rows: AuditRow[]; next_before: string | null } = {
  next_before: null,
  rows: [
    { id: '1', created_at: minutesAgo(6), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'comment_hide', target_kind: 'comment', target_id: 'c_8f2…', target_label: 'Commentaire c_8f2…', summary: 'visible → masqué', reason: 'harcelement', before: { moderation_state: 'visible' , description: 'Lit les erreurs, relance une tâche en échec une fois. Aucune écriture en base.'}, after: { moderation_state: 'hidden' }, request_id: null, solo: true, pii: false, ip: '92.184.•••.•••', request_ref: null },
    { id: '2', created_at: minutesAgo(12), actor: 'Agent Trieur', actor_kind: 'agent', role: null, command: 'post_report_resolve', target_kind: 'post_report', target_id: 'Signalement p_31a…', target_label: 'Signalement p_31a…', summary: 'en attente → traité', reason: 'spam', before: { status: 'pending' }, after: { status: 'reviewed' }, request_id: null, solo: false, pii: false, ip: null, request_ref: null },
    { id: '3', created_at: minutesAgo(27), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'order_refund', target_kind: 'order', target_id: 'LKDV-10482', target_label: 'LKDV-10482', summary: '0,00 € → 89,00 € remboursés', reason: 'produit_defectueux', before: { refunded_cents: 0 }, after: { refunded_cents: 8900 }, request_id: 'd1300000…0001', solo: true, pii: false, ip: '92.184.•••.•••', request_ref: 'req_8f2c' },
    { id: '4', created_at: minutesAgo(52), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'member_360', target_kind: 'user', target_id: '@randonneur_alpin', target_label: 'Membre @randonneur_alpin', summary: '—', reason: 'controle', before: null, after: null, request_id: null, solo: false, pii: true, ip: '92.184.•••.•••', request_ref: null },
    { id: '5', created_at: minutesAgo(78), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'member_adjust_trust', target_kind: 'user', target_id: '@randonneur_alpin', target_label: 'Membre @randonneur_alpin', summary: 'confiance 58 → 62', reason: 'reparation', before: { trust_score: 58 }, after: { trust_score: 62 }, request_id: null, solo: false, pii: false, ip: '92.184.•••.•••', request_ref: null },
    { id: '6', created_at: minutesAgo(96), actor: 'Agent Support', actor_kind: 'agent', role: null, command: 'ticket_reply', target_kind: 'ticket', target_id: 'Ticket #1042', target_label: 'Ticket #1042', summary: '— → en attente du membre', reason: null, before: null, after: { status: 'waiting' }, request_id: null, solo: false, pii: false, ip: null, request_ref: null },
    { id: '7', created_at: minutesAgo(121), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'feature_flag_toggle', target_kind: 'flag', target_id: 'crm_design_preview', target_label: 'Indicateur crm_design_preview', summary: 'désactivé → activé', reason: 'recette', before: { enabled: false }, after: { enabled: true }, request_id: null, solo: false, pii: false, ip: '92.184.•••.•••', request_ref: null },
    { id: '8', created_at: minutesAgo(180), actor: 'Tony', actor_kind: 'humain', role: 'super_admin', command: 'reveal_pii', target_kind: 'user', target_id: '@randonneur_alpin', target_label: 'Membre @randonneur_alpin', summary: 'e-mail affiché', reason: 'verification_identite', before: null, after: null, request_id: null, solo: false, pii: true, ip: '92.184.•••.•••', request_ref: null }
  ]
};

export const demoSos: SosAlert = {
  id: 'd1000000-0000-4000-8000-000000000001',
  member: 'Léa Montagne',
  member_id: 'd1200000-0000-4000-8000-000000000002',
  group_size: 2,
  trip: 'Traversée des Écrins — 4 jours',
  created_at: minutesAgo(3),
  taken_by: null,
  taken_at: null,
  lat: 44.9246,
  lng: 6.3452,
  accuracy_m: 12,
  position_at: minutesAgo(1),
  status: 'open',
  contacts: [
    { label: 'Contact d’urgence 1 — Camille (sœur)', phone: '+33 6 12 34 56 78' },
    { label: 'Contact d’urgence 2 — Refuges des Écrins', phone: '+33 4 92 00 00 00' }
  ]
};

export const demoOrder: OrderDetail = {
  id: 'd1400000-0000-4000-8000-000000000001',
  number: 'LKDV-10482',
  status: 'paid',
  total_cents: 8990,
  currency: 'EUR',
  created_at: daysAgo(6),
  customer: { id: 'd1200000-0000-4000-8000-000000000001', name: 'Léa Montagne' },
  payment: { intent_id: 'pi_3N•••', status: 'succeeded', refunded_cents: 0 },
  items: [
    { label: 'Kit Randonnée — sac 30 L', qty: 1, amount_cents: 6900 },
    { label: 'Gourde filtrante 1 L', qty: 1, amount_cents: 2090 }
  ],
  actions: [
    { command: 'order_refund', label: 'Rembourser', tone: 'danger' },
    { command: 'order_ship', label: 'Marquer expédiée', tone: 'default' },
    { command: 'order_cancel', label: 'Annuler la commande', tone: 'danger' }
  ]
};

export const demoTechnique = {
  errors: [
    { id: 'e1', at: minutesAgo(12), source: 'crm-realtime', message: 'rt_send_failed : publication introuvable', count: 3 },
    { id: 'e2', at: minutesAgo(74), source: 'agent', message: 'NVIDIA 503 — reprise prévue', count: 1 }
  ],
  jobs: [
    { id: 'j1', name: 'cron/agents', last_run_at: minutesAgo(4), status: 'ok', failures: 0 },
    { id: 'j2', name: 'cron/sla', last_run_at: minutesAgo(9), status: 'ok', failures: 0 },
    { id: 'j3', name: 'cron/purge', last_run_at: daysAgo(1), status: 'ok', failures: 0 }
  ],
  advisors_hint: 'Dernier relevé : 3 erreurs (vues SECURITY DEFINER). À rejouer après application des migrations.',
  bricks: [
    { id: 'service_role', label: 'Actions Auth d’administration', ready: false, fallback: 'Brique désactivée faute de clé.' },
    { id: 'stripe_test', label: 'Remboursements Stripe', ready: false, fallback: 'Brique désactivée faute de clé test.' },
    { id: 'nvidia', label: 'Agents IA (NVIDIA NIM)', ready: false, fallback: 'Agents éteints.' },
    { id: 'resend', label: 'Alertes e-mail (Resend)', ready: false, fallback: 'Alertes dans le CRM seulement.' },
    { id: 'cron_secret', label: 'Tâches planifiées', ready: false, fallback: 'Aucun cron ne peut s’exécuter.' }
  ],
  realtime: { connected: true, channels: ['admin:queue', 'admin:presence'] }
};

/** Retourne la fixture correspondant à une RPC `admin.*` en mode prévisualisation. */
export function previewData(fn: string): unknown {
  switch (fn) {
    case 'my_context': return demoContext;
    case 'inbox': return demoInbox;
    case 'inbox_item': return demoCaseDetail;
    case 'member_360': return demoMember;
    case 'order_detail': return demoOrder;
    case 'requests_pending': return { items: [demoRequestItem] };
    case 'request_detail': return demoRequest;
    case 'agents_overview': return demoAgents;
    case 'audit_page': return demoAudit;
    case 'poles_summary': return demoPoles;
    case 'technique_status': return demoTechnique;
    case 'sos_board': return { items: [{ ...demoSos }] };
    case 'reason_codes': return { codes: demoReasonCodes };
    default: return undefined;
  }
}

export type { SosAlert };
export { argsKey } from './fixtures-helpers';
