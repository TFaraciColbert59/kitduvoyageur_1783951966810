/** loading.tsx — /materiel/disponibilite */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function DisponibiliteLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24" aria-busy="true" aria-label="Chargement de la disponibilité…">
      <S className="h-6 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/20 border border-white/30 animate-pulse space-y-3">
            <S className="h-5 w-3/4" />
            <S className="h-3 w-1/2" />
            <S className="h-8 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
