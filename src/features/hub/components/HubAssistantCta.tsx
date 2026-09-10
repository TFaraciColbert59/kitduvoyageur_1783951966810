import Link from 'next/link';
import Icon from '@/components/ui/Icon';

/**
 * H5 (D7-partiel) — Entrée assistant IA depuis le hub.
 * /copilote reste la route (0 entrant historique) ; la fusion UI complète
 * (assistant contextuel dans la coquille) est au backlog post-H.
 */
export function HubAssistantCta({ contextLabel }: { contextLabel: string }) {
  return (
    <Link
      href="/copilote"
      className="glass p-4 rounded-[var(--lkv-radius-card)] flex items-center gap-3 min-h-[44px]"
      aria-label={`Assistant IA — ${contextLabel}`}
    >
      <Icon
        name="sparkles"
        size={18}
        className="shrink-0 text-[var(--lkv-text-secondary)]"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[var(--lkv-text-primary)]">
          Assistant IA
        </span>
        <span className="block text-[11px] text-[var(--lkv-text-secondary)] truncate">
          {contextLabel}
        </span>
      </span>
      <Icon
        name="arrow-right"
        size={14}
        className="text-[var(--lkv-text-muted)]"
        aria-hidden="true"
      />
    </Link>
  );
}

export default HubAssistantCta;
