import { cn } from '@/lib/utils';
type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';
const badgeTones: Record<BadgeTone, string> = {
  sage:   'bg-sage-500/15 text-sage-600 ring-sage-500/20',
  warn:   'bg-warn/15 text-warn ring-warn/25',
  danger: 'bg-danger/15 text-danger ring-danger/25',
  info:   'bg-info/15 text-info ring-info/25',
  stone:  'bg-stone-600/15 text-stone-600 ring-stone-600/20',
};
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] leading-4 ring-1 backdrop-blur',
      badgeTones[tone]
    )}>
      {children}
    </span>
  );
}
