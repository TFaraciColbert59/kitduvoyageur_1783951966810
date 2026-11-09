/**
 * Accès aux RPC `admin.*` depuis les Server Components.
 *
 * Règle du chantier : une RPC absente ou en erreur ne fabrique JAMAIS de données.
 * On renvoie `{ data: null, cause, solution }` et l'écran rend un état vide ou une
 * erreur avec « Réessayer ».
 */
import { supabaseServer } from '../../lib/supabase/server';
import { BUNDLED_REASON_CODES, type ReasonCode } from './reason-codes';
import type {
  Agent,
  AuditRow,
  CaseDetail,
  InboxItem,
  InboxPayload,
  Member360,
  OrderDetail,
  PoleCode,
  RequestDetail,
  Role,
  StaffContext
} from '../../lib/rpc';

export type RpcFailure = { cause: string; solution: string; missing: boolean };
export type RpcResult<T> = { data: T | null; failure: RpcFailure | null };

type PostgrestError = { message: string; code?: string };

/** Point d'entrée unique et seul endroit typé « large » du CRM. */
type AdminClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (count: number) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };
};

function friendly(error: PostgrestError): RpcFailure {
  const message = error.message ?? '';
  const code = error.code ?? '';
  if (code === 'PGRST202' || /could not find the function|does not exist|schema cache/i.test(message)) {
    return {
      cause: 'Cette partie du socle de données n’est pas encore installée sur la base.',
      solution: 'L’écran s’affichera dès que la migration correspondante sera appliquée. Le reste du CRM continue de fonctionner.',
      missing: true
    };
  }
  if (code === '42501' || /permission denied|not authorized|row-level security/i.test(message)) {
    return {
      cause: 'Votre rôle ne permet pas cette lecture.',
      solution: 'Demandez un droit temporaire (motif obligatoire) ou connectez-vous avec un compte disposant du pôle concerné.',
      missing: false
    };
  }
  if (/aal2|mfa|jwt/i.test(message)) {
    return {
      cause: 'La double authentification n’est pas active sur cette session.',
      solution: 'Activez la double authentification pour continuer.',
      missing: false
    };
  }
  return {
    cause: 'La base n’a pas répondu à cette demande.',
    solution: 'Vérifiez la connexion, puis réessayez. Si le problème dure, consultez l’écran Technique.',
    missing: false
  };
}

export async function adminRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<RpcResult<T>> {
  try {
    const supabase = await supabaseServer();
    const client = supabase.schema('admin') as unknown as AdminClient;
    const { data, error } = await client.rpc(fn, args);
    if (error) return { data: null, failure: friendly(error) };
    return { data: (data as T) ?? null, failure: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Configuration publique incomplète/i.test(message)) {
      return {
        data: null,
        failure: {
          cause: 'La configuration publique du CRM est incomplète sur cet environnement.',
          solution: 'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis redéployez.',
          missing: true
        }
      };
    }
    return {
      data: null,
      failure: {
        cause: 'La connexion à la base a échoué.',
        solution: 'Vérifiez votre connexion, puis réessayez.',
        missing: false
      }
    };
  }
}

/* ── Lectures typées (une fonction par RPC du contrat) ─────────────── */

export const getContext = () => adminRpc<StaffContext>('my_context');
export const getInbox = () => adminRpc<InboxPayload>('inbox');
export const getInboxItem = (source: string, id: string) => adminRpc<CaseDetail>('inbox_item', { p_source: source, p_id: id });
export const getMember360 = (id: string) => adminRpc<Member360>('member_360', { p_user_id: id });
export const getOrderDetail = (id: string) => adminRpc<OrderDetail>('order_detail', { p_order_id: id });
export const getRequestsPending = () => adminRpc<{ items: import('../../lib/rpc').RequestItem[] }>('requests_pending');
export const getRequestDetail = (id: string) => adminRpc<RequestDetail>('request_detail', { p_id: id });
export const getAgentsOverview = () => adminRpc<{ agents: Agent[]; solo: boolean; bricks: unknown }>('agents_overview');
export const getAuditPage = (args: { before?: string | null; limit?: number; filters?: Record<string, unknown> } = {}) =>
  adminRpc<{ rows: AuditRow[]; next_before: string | null }>('audit_page', {
    p_before: args.before ?? null,
    p_limit: args.limit ?? 50,
    p_filters: args.filters ?? {}
  });
export const getPolesSummary = () => adminRpc<{ poles: { code: PoleCode; label: string; count: number; role: Role | null }[] }>('poles_summary');
export const getTechniqueStatus = () =>
  adminRpc<{
    errors: { id: string; at: string; source: string; message: string; count: number }[];
    jobs: { id: string; name: string; last_run_at: string | null; status: string; failures: number }[];
    advisors_hint: string | null;
    bricks: { id: string; label: string; ready: boolean; fallback: string }[];
    realtime: { connected: boolean; channels: string[] } | null;
  }>('technique_status');
export const getSosBoard = () =>
  adminRpc<{
    items: {
      id: string;
      member: string;
      member_id: string | null;
      group_size: number | null;
      trip: string | null;
      created_at: string;
      taken_by: string | null;
      taken_at: string | null;
      lat: number | null;
      lng: number | null;
      accuracy_m: number | null;
      position_at: string | null;
      status: 'open' | 'taken' | 'closed';
      contacts: { label: string; phone: string | null }[];
    }[];
  }>('sos_board');

export { BUNDLED_REASON_CODES } from './reason-codes';
export type { ReasonCode } from './reason-codes';

/** Motifs depuis `admin.reason_codes` : RPC, sinon table de référence, sinon bundle. */
export async function getReasonCodes(): Promise<ReasonCode[]> {
  const viaRpc = await adminRpc<{ codes: ReasonCode[] } | ReasonCode[]>('reason_codes');
  if (viaRpc.data) {
    const list = Array.isArray(viaRpc.data) ? viaRpc.data : viaRpc.data.codes;
    if (Array.isArray(list) && list.length > 0) return list;
  }
  try {
    const supabase = await supabaseServer();
    const client = supabase.schema('admin') as unknown as AdminClient;
    const { data, error } = await client
      .from('reason_codes')
      .select('code,label,member_text,severity,zero_tolerance')
      .order('code')
      .limit(50);
    if (!error && Array.isArray(data) && data.length > 0) return data as ReasonCode[];
  } catch {
    /* base indisponible : liste du bundle */
  }
  return BUNDLED_REASON_CODES;
}

/* ── Confort d'affichage ──────────────────────────────────────────── */

/** Compte des éléments par groupe de la file (jamais un chiffre inventé : 0 si vide). */
export function countGroups(items: InboxItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.group] = (counts[item.group] ?? 0) + 1;
  return counts;
}
