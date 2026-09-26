import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileCheck2,
  Footprints,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  deriveActivityState,
  type ActivityStateCheck,
  type ActivityStateCheckStatus,
  type ActivityStateInput,
} from './activityStateModel';

const CHECK_ICONS: Record<ActivityStateCheck['id'], LucideIcon> = {
  route: Footprints,
  checklist: CheckCircle2,
  equipment: PackageCheck,
  safety: ShieldCheck,
  documents: FileCheck2,
};

const STATUS_ICONS: Record<ActivityStateCheckStatus, LucideIcon> = {
  ready: Check,
  attention: CircleAlert,
  blocked: CircleX,
};

const STATUS_LABELS: Record<ActivityStateCheckStatus, string> = {
  ready: 'Validé',
  attention: 'À vérifier',
  blocked: 'Bloquant',
};

export interface ActivityStateDrawerProps {
  input: ActivityStateInput;
}

export function ActivityStateDrawer({ input }: ActivityStateDrawerProps) {
  const state = deriveActivityState(input);
  const ctaIsLaunch = state.cta.kind === 'launch';
  const showNextAction = state.nextAction != null && state.nextAction.href !== state.cta.href;

  return (
    <div className="hub-state-drawer space-y-3" data-testid="activity-state-drawer">
      <section className="hub-state-drawer__hero lkv-appear rounded-[var(--lkv-radius-card)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
              Centre de départ
            </p>
            <h2 className="mt-1 text-[22px] font-semibold leading-6 tracking-[-0.3px] text-[var(--lkv-text-primary)]">
              {state.headline}
            </h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[var(--lkv-text-secondary)]">
              {state.summary}
            </p>
          </div>
          <div
            aria-label={`${state.validatedChecks} contrôles validés sur ${state.totalChecks}`}
            className="hub-state-drawer__score flex h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-2xl px-2"
          >
            <span className="text-[17px] font-semibold tabular-nums text-white">
              {state.validatedChecks}/{state.totalChecks}
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-white/55">
              contrôles
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="hub-state-drawer__pill inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
            <CalendarClock size={13} aria-hidden="true" />
            {state.timingLabel}
          </span>
          {state.blockerCount > 0 ? (
            <span className="hub-state-drawer__pill inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
              <CircleX size={13} aria-hidden="true" />
              {state.blockerCount} blocage{state.blockerCount > 1 ? 's' : ''}
            </span>
          ) : state.attentionCount > 0 ? (
            <span className="hub-state-drawer__pill inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
              <CircleAlert size={13} aria-hidden="true" />
              {state.attentionCount} vigilance{state.attentionCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="hub-state-drawer__pill inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
              <Sparkles size={13} aria-hidden="true" />
              Prêt à partir
            </span>
          )}
        </div>
      </section>

      <Link
        href={state.cta.href}
        data-cta-kind={state.cta.kind}
        className={`hub-state-drawer__cta group flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
          ctaIsLaunch ? 'is-launch' : 'is-prepare'
        }`}
      >
        <span className="hub-state-drawer__cta-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          {ctaIsLaunch ? (
            <CheckCircle2 size={19} aria-hidden="true" />
          ) : (
            <ArrowRight size={19} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-white/58">
            {ctaIsLaunch ? 'Lancer maintenant' : 'Centre de départ'}
          </span>
          <span className="mt-0.5 block text-[16px] font-semibold tracking-[-0.2px] text-white">
            {state.cta.label}
          </span>
        </span>
        <ArrowRight
          size={18}
          className="shrink-0 text-white/70 transition-transform duration-200 ease-out group-active:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </Link>

      <section aria-label="Contrôles de départ" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Contrôles de départ
          </h3>
          <span className="text-[11px] font-medium text-[var(--lkv-text-muted)]">
            {state.validatedChecks}/{state.totalChecks} validés
          </span>
        </div>
        <ul className="space-y-1.5">
          {state.checks.map((check) => {
            const CheckIcon = CHECK_ICONS[check.id];
            const StatusIcon = STATUS_ICONS[check.status];
            return (
              <li key={check.id}>
                <Link
                  href={check.href}
                  className="hub-state-drawer__check group flex min-h-[58px] w-full items-center gap-3 rounded-2xl px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
                >
                  <span className="hub-state-drawer__check-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    <CheckIcon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[var(--lkv-text-primary)]">
                        {check.label}
                      </span>
                      <span
                        className={`hub-state-drawer__status hub-state-drawer__status--${check.status}`}
                      >
                        <StatusIcon size={10} aria-hidden="true" />
                        {STATUS_LABELS[check.status]}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-4 text-[var(--lkv-text-secondary)]">
                      {check.value}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-white/42 transition-transform duration-200 ease-out group-active:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {showNextAction && state.nextAction ? (
        <Link
          href={state.nextAction.href}
          className="hub-state-drawer__next group flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--lkv-text-muted)]">
              À faire maintenant
            </span>
            <span className="mt-0.5 block truncate text-[14px] font-semibold text-[var(--lkv-text-primary)]">
              {state.nextAction.title}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-[var(--lkv-text-secondary)]">
              {state.nextAction.description}
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-white/60" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export default ActivityStateDrawer;
