/** Types partagés des RPC admin.* (contrat CONTRACT.md). */

export type Role = 'super_admin' | 'responsable' | 'membre';
export type PoleCode = 'CONF' | 'MEMB' | 'COMM' | 'CONT' | 'PRIA' | 'CROI' | 'TECH';

export type InboxGroup = 'urgence_haute' | 'delai_bientot' | 'a_valider' | 'signalements' | 'contributions';
export type InboxSource =
  | 'sos' | 'support_ticket' | 'request' | 'post_report' | 'comment_report' | 'story_report'
  | 'club_report' | 'group_report' | 'place_report' | 'marketplace_report' | 'terrain_report'
  | 'contribution' | 'alert' | 'agent_proposal';

export type InboxItem = {
  key: string; source: InboxSource; id: string; group: InboxGroup;
  title: string; subtitle: string; pole: PoleCode; urgency: 'haute' | 'normale';
  due_at: string | null; created_at: string; badges: string[]; meta?: Record<string, unknown>;
};

export type InboxPayload = {
  items: InboxItem[];
  counts: { total: number; urgent: number; reports: number; approvals: number; contributions: number; by_pole: Record<string, number> };
  sla: { held_days: number; treated_today: number; target_today: number };
};

export type StaffContext = {
  role: Role | null; poles: { code: PoleCode; role: Role }[]; solo: boolean; staff: boolean;
  display_name: string | null; email: string | null;
};

export type CaseDetail = {
  source: InboxSource; id: string; pole: PoleCode;
  target: { kind: string; id: string; title: string; body: string; author_id: string | null; author_name: string | null; created_at: string; media: string[] };
  reports: { id: string; reason: string; created_at: string; reporter_id: string | null }[];
  member: { id: string; name: string; reports_90d: number; active_strikes: number; member_since: string | null; account_status: string } | null;
  rule: { code: string; label: string; scale: string } | null;
  linked: { id: string; label: string }[];
  ai_suggestion: { label: string; confidence: number } | null;
  actions: { command: string; label: string; primary: boolean; tone: 'default' | 'danger' | 'positive' }[];
  already_decided: boolean;
};

export type Member360 = {
  id: string; display_name: string; email_masked: string; phone_masked: string;
  member_since: string | null; account_status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null; trust_score: number | null; loyalty_level: string | null;
  activity: { posts: number; comments: number; carnets: number; orders: number; reports_against: number; last_seen: string | null };
  ai_summary: string | null; notes: { id: string; body: string; author: string; created_at: string }[];
  strikes: { id: string; reason: string; created_at: string; expires_at: string; active: boolean }[];
  actions: { command: string; label: string; tone: 'default' | 'danger' }[];
};

export type OrderDetail = {
  id: string; number: string; status: string; total_cents: number; currency: string;
  created_at: string; customer: { id: string; name: string };
  payment: { intent_id: string | null; status: string; refunded_cents: number };
  items: { label: string; qty: number; amount_cents: number }[];
  actions: { command: string; label: string; tone: 'default' | 'danger' }[];
};

export type RequestItem = { id: string; command: string; label: string; author: string; created_at: string; expires_at: string; amount_cents: number | null; solo: boolean };
export type RequestDetail = RequestItem & {
  params: Record<string, unknown>; fingerprint: string; target_label: string;
  self_authored: boolean; second_human_required: boolean; confirmation_hint: string;
};

export type Agent = {
  id: string; name: string; role: string; pole: PoleCode; status: 'active' | 'paused' | 'stopped';
  enabled: boolean; hourly_cap: number; used_last_hour: number; proposals_24h: number; accepted_rate: number;
  tools: string[]; last_run_at: string | null; last_error: string | null;
};

export type AuditRow = {
  id: string; created_at: string; actor: string; actor_kind: 'humain' | 'agent' | 'systeme'; role: string | null;
  command: string; target_kind: string | null; target_id: string | null; reason: string | null;
  before: unknown; after: unknown; request_id: string | null; solo: boolean; pii: boolean; ip: string | null; request_ref: string | null;
};

export type CommandResult = { ok: boolean; data?: unknown; request_id?: string | null; audit_id?: string | null; message?: string; error?: string };
