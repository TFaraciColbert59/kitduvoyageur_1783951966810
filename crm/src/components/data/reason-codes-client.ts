'use client';

import { supabaseBrowser } from '../../lib/supabase/browser';
import { BUNDLED_REASON_CODES, type ReasonCode } from './reason-codes';

type PostgrestError = { message: string; code?: string };
type ReadClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string) => { limit: (count: number) => PromiseLike<{ data: unknown; error: PostgrestError | null }> };
    };
  };
};

/** Motifs depuis `admin.reason_codes` (RPC puis table), repli sur la liste du bundle. */
export async function loadReasonCodes(): Promise<{ codes: ReasonCode[]; source: 'base' | 'bundle' }> {
  try {
    const client = supabaseBrowser().schema('admin') as unknown as ReadClient;
    const viaRpc = await client.rpc('reason_codes', {});
    if (!viaRpc.error && viaRpc.data) {
      const payload = viaRpc.data as { codes?: ReasonCode[] } | ReasonCode[];
      const list = Array.isArray(payload) ? payload : payload.codes;
      if (Array.isArray(list) && list.length > 0) return { codes: list, source: 'base' };
    }
    const table = await client
      .from('reason_codes')
      .select('code,label,member_text,severity,zero_tolerance')
      .order('code')
      .limit(50);
    if (!table.error && Array.isArray(table.data) && table.data.length > 0) {
      return { codes: table.data as ReasonCode[], source: 'base' };
    }
  } catch {
    /* base indisponible */
  }
  return { codes: BUNDLED_REASON_CODES, source: 'bundle' };
}
