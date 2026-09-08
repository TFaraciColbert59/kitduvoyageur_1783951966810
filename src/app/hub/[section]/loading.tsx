/**
 * H3.4 — Squelette de chargement d'une section du hub.
 */
export default function HubSectionLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement de la section">
      <div className="h-4 w-20 rounded bg-black/5 animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-black/5 animate-pulse" />
        <div className="h-7 w-44 rounded-lg bg-black/5 animate-pulse" />
      </div>
      <div className="glass p-4 rounded-[var(--lkv-radius-card)] h-24 animate-pulse" />
    </div>
  );
}
