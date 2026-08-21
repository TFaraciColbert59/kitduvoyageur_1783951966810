import { cn } from '@/lib/utils';
type ProgressTone = 'sage' | 'warn' | 'danger';
export function ProgressBar({
  value, tone = 'sage', label,
}: { value: number; tone?: ProgressTone; label: string }) {
  const fillCls = {
    sage: 'bg-gradient-to-r from-emerald-700 via-sage-500 to-emerald-400 shadow-[0_0_8px_rgba(91,127,85,0.4)]',
    warn: 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(200,154,59,0.4)]',
    danger: 'bg-gradient-to-r from-rose-700 to-rose-400 shadow-[0_0_8px_rgba(168,68,58,0.4)]',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full rounded-full bg-white/40 border border-white/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-glass', fillCls)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
