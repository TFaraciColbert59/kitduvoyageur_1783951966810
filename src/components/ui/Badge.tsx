import { cn } from '@/lib/utils';
type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';
const badgeTones: Record<BadgeTone, string> = {
  sage:   'bg-[rgba(91,127,85,0.14)] text-[#17402C] border-[rgba(91,127,85,0.30)] shadow-[0_1px_4px_rgba(91,127,85,0.12)]',
  warn:   'bg-[rgba(200,154,59,0.16)] text-[#8C6418] border-[rgba(200,154,59,0.35)] shadow-[0_1px_4px_rgba(200,154,59,0.12)]',
  danger: 'bg-[rgba(168,68,58,0.16)] text-[#8A241B] border-[rgba(168,68,58,0.35)] shadow-[0_1px_4px_rgba(168,68,58,0.12)]',
  info:   'bg-[rgba(75,107,124,0.16)] text-[#2C4857] border-[rgba(75,107,124,0.35)] shadow-[0_1px_4px_rgba(75,107,124,0.12)]',
  stone:  'bg-[rgba(255,255,255,0.60)] text-[#3F3B34] border-[rgba(255,255,255,0.85)] shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
};
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center h-[24px] px-2.5 rounded-full text-[11.5px] font-semibold tracking-wide border backdrop-blur-md',
      badgeTones[tone]
    )}>
      {children}
    </span>
  );
}
