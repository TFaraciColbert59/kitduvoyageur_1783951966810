import { Badge, Card, EmptyState } from '@/components/ui';

export interface Insight {
  title: string;
  body: string;
  tone: 'sage' | 'warn' | 'danger' | 'info';
}

/** W-I-9 AiInsightBanner — bandeau d'insight IA (dérivé des données réelles). */
export function AiInsightBanner({ insights }: { insights: Insight[] }) {
  return (
    <Card className="p-4 flex flex-col gap-2" aria-live="polite">
      {insights.map((i) => (
        <div key={i.title} className="flex items-start gap-2">
          <Badge tone={i.tone}>{i.title}</Badge>
          <p className="text-sm text-[color:var(--lkv-text-secondary)]">{i.body}</p>
        </div>
      ))}
      {insights.length === 0 && (
        <EmptyState compact title="Aucun point d'attention particulier." />
      )}
    </Card>
  );
}
