import { z } from 'zod';
import { COMMANDS, commandByCommand, type CommandDef } from '@/lib/catalog';
import { apiError } from '@/lib/errors';

// Messages zod en français (QA : aucun « Invalid input » à l'écran). Les messages
// personnalisés de nos schémas restent prioritaires sur la locale.
z.config(z.locales.fr());

/**
 * Validation zod des paramètres, commande par commande.
 *
 * Source : `src/lib/catalog.ts` (généré depuis 04_CATALOGUE_ACTIONS.md) et le
 * contrat RPC `admin.run_command(p_command, p_params)`. Le catalogue ne décrit pas
 * les paramètres ; on applique donc la règle suivante, stricte et documentée :
 *  - seuls les champs connus du domaine de la commande sont acceptés
 *    (`additionalProperties: false` via `.strict()`) ;
 *  - les commandes de type « point d'entrée » (view/list/board/detail) n'ont pas
 *    de cible obligatoire ;
 *  - `reason_code` est exigé quand le catalogue marque « motif obligatoire » ;
 *  - la base reste l'arbitre final : elle valide les valeurs, les transitions et
 *    le rôle ; nos schémas ne font que refuser tôt une forme inattendue.
 */

const id = z.string().trim().min(1, 'Identifiant requis').max(128);
const shortText = z.string().trim().min(1, 'Texte requis').max(280);
const plainText = z.string().max(4000);
const cents = z.number().int().min(1, 'Montant positif attendu').max(10_000_000);
const whole = z.number().int().min(0).max(1_000_000);
const flag = z.boolean();
const isoDate = z.string().trim().min(10, 'Date attendue').max(40);
const textList = z.array(z.string().trim().min(1).max(200)).min(1).max(50);
const values = z.record(z.string(), z.unknown());

/**
 * Vocabulaire de champs. Chaque champ est validé une seule fois, puis réutilisé
 * dans les schémas de domaine.
 */
const FIELD_TYPES = {
  // identifiants de cible
  user_id: id,
  user_ids: textList,
  member_id: id,
  post_id: id,
  comment_id: id,
  story_id: id,
  carnet_id: id,
  moment_id: id,
  club_id: id,
  group_id: id,
  place_id: id,
  place_ids: textList,
  product_id: id,
  listing_id: id,
  order_id: id,
  trip_id: id,
  kit_id: id,
  review_id: id,
  report_id: id,
  message_id: id,
  attachment_id: id,
  topic_id: id,
  reply_id: id,
  contribution_id: id,
  guide_id: id,
  content_id: id,
  event_id: id,
  badge_id: id,
  withdrawal_id: id,
  attribution_id: id,
  share_id: id,
  conversion_id: id,
  partner_id: id,
  program_id: id,
  offer_id: id,
  promotion_id: id,
  code_id: id,
  booking_id: id,
  preorder_id: id,
  entitlement_id: id,
  alert_id: id,
  sos_id: id,
  error_id: id,
  job_id: id,
  media_id: id,
  photo_id: id,
  qa_id: id,
  checkpoint_id: id,
  request_id: id,
  audit_id: z.union([z.string().trim().min(1).max(40), z.number().int().nonnegative()]),
  agent_id: id,
  flag_id: id,
  target_id: id,
  id,
  ticket_id: id,
  payment_intent: id,
  keep_id: id,
  merge_ids: textList,
  member_ids: textList,
  // décisions et états
  reason_code: z.string().trim().min(1, 'Motif requis').max(64),
  reason: plainText,
  note: plainText,
  body: plainText,
  message: plainText,
  subject: shortText,
  status: z.string().trim().min(1).max(40),
  decision: z.string().trim().min(1).max(40),
  moderation_state: z.string().trim().min(1).max(40),
  action: z.string().trim().min(1).max(40),
  kind: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(64),
  role: z.string().trim().min(1).max(40),
  pole: z.string().trim().min(1).max(16),
  // valeurs
  amount_cents: cents,
  price_cents: cents,
  refund_cents: cents,
  stock: whole,
  points: whole,
  quota: whole,
  limit: whole,
  before: plainText,
  after: plainText,
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  enabled: flag,
  verified: flag,
  approved: flag,
  private: flag,
  hidden: flag,
  featured: flag,
  until: isoDate,
  expires_at: isoDate,
  date_from: isoDate,
  date_to: isoDate,
  days: z.number().int().min(0).max(3650),
  hours: z.number().int().min(0).max(8760),
  minutes: z.number().int().min(0).max(10080),
  carrier: shortText,
  tracking_number: shortText,
  sku: shortText,
  country_code: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/, 'Code pays à deux lettres attendu'),
  locale: z.string().trim().min(2).max(10),
  segment: shortText,
  cohort: shortText,
  source_urls: textList,
  values,
  payload: values,
  filters: values,
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  target_ids: textList,
  event: shortText,
  query: plainText,
  confirmation: z.string().trim().length(8).regex(/^[a-f0-9]{8}$/i, 'Code de confirmation à 8 caractères attendu'),
  cache_key: shortText,
  job: shortText,
  template: shortText,
  url: z.string().trim().url(),
  email: z.string().trim().email()
} satisfies Record<string, z.ZodType>;

export type CommandField = keyof typeof FIELD_TYPES;

const COMMON_FIELDS: CommandField[] = ['reason_code', 'reason', 'note'];

/** Champs admis par domaine du catalogue (D1…D19). */
const DOMAIN_FIELDS: Record<string, CommandField[]> = {
  // Comptes et identité
  D1: ['user_id', 'user_ids', 'role', 'pole', 'until', 'days', 'values', 'delta', 'email', 'verified'],
  // Publications
  D2: ['post_id', 'media_id', 'moderation_state', 'decision', 'values', 'hidden'],
  // Stories
  D3: ['story_id', 'comment_id', 'media_id', 'decision', 'moderation_state'],
  // Carnets
  D4: ['carnet_id', 'moment_id', 'comment_id', 'media_id', 'verified', 'private', 'decision'],
  // Clubs
  D5: ['club_id', 'topic_id', 'reply_id', 'member_id', 'verified', 'values', 'decision'],
  // Groupes et messagerie
  D6: ['group_id', 'member_id', 'member_ids', 'message_id', 'attachment_id', 'report_id', 'decision', 'until'],
  // Lieux et terrain
  D7: ['place_id', 'place_ids', 'photo_id', 'review_id', 'report_id', 'verified', 'values', 'keep_id', 'merge_ids', 'decision'],
  // Avis, questions
  D8: ['review_id', 'product_id', 'qa_id', 'report_id', 'verified', 'hidden', 'decision'],
  // Marketplace
  D9: ['listing_id', 'report_id', 'member_id', 'decision', 'reason_code', 'values', 'amount_cents'],
  // Catalogue et stock
  D10: ['product_id', 'price_cents', 'stock', 'values', 'items', 'sku', 'enabled'],
  // Commandes et paiements
  D11: [
    'order_id', 'amount_cents', 'refund_cents', 'payment_intent', 'decision', 'carrier', 'tracking_number',
    'code_id', 'booking_id', 'preorder_id', 'entitlement_id', 'promotion_id', 'status', 'values'
  ],
  // Récompenses et progression
  D12: ['user_id', 'withdrawal_id', 'amount_cents', 'points', 'event_id', 'badge_id', 'delta', 'values', 'decision'],
  // Lignées de kits
  D13: ['kit_id', 'user_id', 'attribution_id', 'share_id', 'amount_cents', 'reason_code', 'decision'],
  // Voyages et sécurité
  D14: ['trip_id', 'sos_id', 'checkpoint_id', 'note', 'status', 'action', 'minutes', 'decision'],
  // Contenus et pays
  D15: ['country_code', 'guide_id', 'content_id', 'contribution_id', 'place_id', 'decision', 'source_urls', 'values', 'target_ids'],
  // Affiliation
  D16: ['partner_id', 'program_id', 'offer_id', 'conversion_id', 'enabled', 'values', 'amount_cents'],
  // IA et réglages
  D17: ['user_id', 'job_id', 'quota', 'enabled', 'cache_key', 'kind', 'values'],
  // Support et notifications
  D18: ['user_id', 'ticket_id', 'status', 'body', 'subject', 'message', 'segment', 'values'],
  // Système, tâches, erreurs
  D19: [
    'flag_id', 'enabled', 'code', 'cohort', 'job', 'error_id', 'alert_id', 'limit', 'before',
    'query', 'filters', 'values', 'status', 'agent_id', 'role', 'user_id'
  ]
};

/** Champs supplémentaires propres à quelques commandes. */
const COMMAND_FIELDS: Record<string, CommandField[]> = {
  member_view_360: ['user_id'],
  member_export_gdpr: ['user_id'],
  member_ban: ['user_id', 'until'],
  member_suspend: ['user_id', 'until', 'days'],
  member_set_staff_role: ['user_id', 'role', 'pole'],
  post_report_resolve: ['report_id', 'post_id', 'decision'],
  comment_report_resolve: ['report_id', 'comment_id', 'decision', 'moderation_state'],
  story_report_resolve: ['report_id', 'story_id', 'decision'],
  club_report_resolve: ['report_id', 'club_id', 'decision'],
  group_report_resolve: ['report_id', 'group_id', 'member_id', 'decision'],
  place_report_resolve: ['report_id', 'place_id', 'decision'],
  marketplace_report_resolve: ['report_id', 'listing_id', 'decision'],
  terrain_report_decide: ['report_id', 'place_id', 'decision'],
  order_refund: ['order_id', 'amount_cents', 'refund_cents'],
  order_cancel: ['order_id', 'amount_cents'],
  order_ship: ['order_id', 'carrier', 'tracking_number'],
  withdrawal_decide: ['withdrawal_id', 'decision'],
  ticket_reply: ['ticket_id', 'body'],
  ticket_set_status: ['ticket_id', 'status'],
  announcement_send: ['segment', 'subject', 'body', 'values'],
  country_content_review: ['country_code', 'guide_id', 'decision'],
  country_guide_regenerate: ['country_code', 'guide_id'],
  sos_ack_close: ['sos_id', 'action', 'note'],
  cron_run_now: ['job'],
  feature_flag_toggle: ['code', 'enabled'],
  ai_kill_switch: ['enabled'],
  agent_resume: ['agent_id'],
  agent_pause: ['agent_id']
};

type ParamsSchema = z.ZodType;

const cache = new Map<string, ParamsSchema>();

function fieldsFor(def: CommandDef): CommandField[] {
  const known = new Set<CommandField>([...COMMON_FIELDS, ...(DOMAIN_FIELDS[def.domain] ?? []), ...(COMMAND_FIELDS[def.command] ?? [])]);
  return [...known];
}

/** Schéma zod strict d'une commande du catalogue. */
export function commandParamsSchema(command: string): ParamsSchema {
  const cached = cache.get(command);
  if (cached) return cached;
  const def = commandByCommand(command);
  if (!def) throw apiError('unknown_command');

  const shape: Record<string, z.ZodType> = {};
  for (const field of fieldsFor(def)) {
    shape[field] = FIELD_TYPES[field].optional();
  }
  // Motif obligatoire : le code est exigé ; `reason` reste accepté en repli métier.
  if (def.reasonRequired) shape.reason_code = FIELD_TYPES.reason_code;

  const schema = z.object(shape).strict();
  cache.set(command, schema);
  return schema;
}

/** JSON Schema (draft 2020-12) d'une commande, pour `tools/list` du MCP. */
export function commandInputJsonSchema(command: string): Record<string, unknown> {
  const json = z.toJSONSchema(commandParamsSchema(command), { io: 'input' }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export type ParsedCommandParams = Record<string, unknown>;

/** Valide les paramètres d'une commande ; lève `unknown_command` ou `invalid_params`. */
export function parseCommandParams(command: string, params: unknown): ParsedCommandParams {
  const def = commandByCommand(command);
  if (!def) throw apiError('unknown_command');
  if (params === undefined || params === null) return {};
  if (typeof params !== 'object' || Array.isArray(params)) throw apiError('invalid_params');

  const parsed = commandParamsSchema(command).safeParse(params);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((issue) => ({
      path: issue.path.length ? issue.path.join('.') : '(racine)',
      message: issue.message
    }));
    throw apiError('invalid_params', issues);
  }
  return parsed.data as ParsedCommandParams;
}

/** Une commande peut-elle être exposée à un agent (jamais `never`) ? */
export function isAgentExposedCommand(command: string): boolean {
  const def = commandByCommand(command);
  return Boolean(def && def.agent !== 'never');
}

/** Charge utile d'un outil MCP : nom, description lisible, schéma strict. */
export function commandToolDescriptor(command: string): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
} | null {
  const def = commandByCommand(command);
  if (!def || def.agent === 'never') return null;
  const mode =
    def.agent === 'propose'
      ? 'Propose une action : la base crée une demande, une personne valide.'
      : 'Lecture seule.';
  return {
    name: def.command,
    description: `${def.label}. ${mode}${def.reasonRequired ? ' Motif obligatoire (reason_code).' : ''}${def.needsValidation ? ' Demande soumise à validation humaine.' : ''}`,
    inputSchema: commandInputJsonSchema(def.command)
  };
}

/** Toutes les commandes du catalogue exposables à un agent. */
export function agentExposedCommands(): CommandDef[] {
  return COMMANDS.filter((def) => def.agent !== 'never');
}
