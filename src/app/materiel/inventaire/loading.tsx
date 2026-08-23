/** loading.tsx — /materiel/inventaire */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function InventaireLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24" aria-busy="true" aria-label="Chargement de l'inventaire…">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => <S key={i} className="h-20" />)}
      </div>
      {/* Chart placeholder */}
      <S className="h-40 mb-6" />
      {/* Item list */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/15 animate-pulse">
            <S className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <S className="h-4 w-1/2" />
              <S className="h-3 w-1/3" />
            </div>
            <S className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
