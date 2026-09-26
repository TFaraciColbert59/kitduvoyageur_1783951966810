import { HapticLink } from '../menu/HapticLink';
import type { MobileInfoChip } from '../../mobile/mobileHubEngine';

export interface InfoChipsRowProps {
  chips: MobileInfoChip[];
  label?: string;
}

function chipClasses(tone: MobileInfoChip['tone']): string {
  if (tone === 'warn') {
    return 'border border-[var(--lkv-danger)]/20 bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]';
  }
  if (tone === 'accent') {
    return 'border border-[var(--lkv-primary)]/15 bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]';
  }
  return 'glass-sub-card bg-[color:var(--glass-bg-medium)] bg-[color:var(--card-tint-solid)] text-[var(--lkv-text-primary)]';
}

export function InfoChipsRow({ chips, label = 'Informations clés' }: InfoChipsRowProps) {
  if (chips.length === 0) return null;

  return (
    <section aria-label={label} className="min-w-0">
      <ul
        tabIndex={0}
        className="hub-hscroll -mx-4 flex list-none gap-2 overflow-x-auto rounded-xl px-4 pb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] md:mx-0 md:px-1"
      >
        {chips.map((chip) => {
          const Icon = chip.icon;
          const content = (
            <>
              <Icon size={15} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-extrabold tabular-nums">{chip.value}</span>
                <span className="block max-w-[10rem] truncate text-[9px] font-medium uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
                  {chip.label}
                </span>
              </span>
            </>
          );
          const classes = `hub-chip-control flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 ${chipClasses(chip.tone)}`;
          return (
            <li key={chip.key} className="shrink-0">
              {chip.href ? (
                <HapticLink
                  href={chip.href}
                  ariaLabel={`${chip.value} — ${chip.label}`}
                  className={`${classes} transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]`}
                >
                  {content}
                </HapticLink>
              ) : (
                <div className={classes}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default InfoChipsRow;
