/** loading.tsx — /materiel — skeleton grille Mon Matériel */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function MaterielLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 pt-3 pb-24" aria-busy="true" aria-label="Chargement…">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0, 1, 2].map((i) => <S key={i} className="h-16" />)}
      </div>
      {/* Grid 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <S key={i} className="h-36" />)}
      </div>
    </div>
  );
}
