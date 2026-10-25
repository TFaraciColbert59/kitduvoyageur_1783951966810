import { cn } from '@/lib/utils';
export function Metric({
  value, size = 'lg', tone = 'default', unit, className,
}: { value: React.ReactNode; size?: 'md' | 'lg' | 'xl'; tone?: 'default' | 'sage' | 'danger'; unit?: string; className?: string }) {
  const sizeCls = {
    md: 'text-[32px] leading-[38px]',
    lg: 'text-[44px] leading-[48px]',
    xl: 'text-[64px] leading-[68px]',
  }[size];
  const toneCls = {
    default: 'text-[color:var(--label)]',
    sage: 'text-sage-500',
    danger: 'text-danger',
  }[tone];
  return (
    <span className={cn('font-display font-semibold tabular-nums tracking-tight', sizeCls, toneCls, className)}>
      {value}
      {unit && <span className="ml-1 text-[0.55em] font-medium text-[color:var(--label-tertiary)]">{unit}</span>}
    </span>
  );
}
