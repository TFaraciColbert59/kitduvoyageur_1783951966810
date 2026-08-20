import { cn } from '@/lib/utils';
type ProgressTone = 'sage' | 'warn' | 'danger';
export function ProgressBar({
  value, tone = 'sage', label,
}: { value: number; tone?: ProgressTone; label: string }) {
  const fillCls = {
    sage: 'bg-gradient-to-r from-sage-500 to-sage-300',
    warn: 'bg-gradient-to-r from-warn to-warn/60',
    danger: 'bg-gradient-to-r from-danger to-danger/60',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full rounded-full bg-stone-200/70 overflow-hidden"
    >
      <div className={cn('h-full transition-[width] duration-300 ease-glass', fillCls)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
