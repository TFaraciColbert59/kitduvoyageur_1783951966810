export const DB_TARGET_BYTES: number;
export const MAX_REPORT_AGE_DAYS: number;
export function evaluateDailyReport(
  row:
    | { day?: string; db_bytes?: number | string | null; alerts?: string[] | null }
    | null
    | undefined,
  now?: Date,
): { ok: boolean; problems: string[]; notes: string[] };
