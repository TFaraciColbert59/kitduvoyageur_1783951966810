import { cn } from '@/lib/utils';
export function Metric({
  value, size = 'lg', tone = 'default', className,
}: { value: React.ReactNode; size?: 'md' | 'lg' | 'xl'; tone?: 'default' | 'sage' | 'danger'; className?: string }) {
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
    </span>
  );
}
