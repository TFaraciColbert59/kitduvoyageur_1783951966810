import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { KeyboardHelp } from '@/components/shell/keyboard-help';
import { ToastProvider } from '@/ui/toast';
import { POLES } from '@/lib/catalog';
import { getContext, getPolesSummary, getRequestsPending } from '@/components/data/admin-rpc';
import type { PoleCode } from '@/lib/rpc';

export const dynamic = 'force-dynamic';

/** Coque de toutes les pages du CRM : session, compteurs, raccourcis, annonces. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [contextResult, polesResult, requestsResult] = await Promise.all([
    getContext(),
    getPolesSummary(),
    getRequestsPending()
  ]);

  const ctx = contextResult.data;
  const rows = polesResult.data?.poles;
  const poles = POLES.map((pole) => {
    const row = rows?.find((candidate) => candidate.code === pole.code);
    return { code: pole.code as PoleCode, label: row?.label ?? pole.label, count: row ? row.count : null };
  });
  const pending = requestsResult.data?.items ? requestsResult.data.items.length : null;

  return (
    <ToastProvider>
      <AppShell ctx={ctx} poles={poles} pendingApprovals={pending}>
        {children}
      </AppShell>
      <KeyboardHelp />
    </ToastProvider>
  );
}
