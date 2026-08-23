/** loading.tsx — /materiel/alertes */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function AlertesLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24" aria-busy="true" aria-label="Chargement des alertes…">
      <S className="h-6 w-40 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/20 border border-white/30 animate-pulse flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <S className="h-4 w-1/3" />
              <S className="h-3 w-2/3" />
            </div>
            <S className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
