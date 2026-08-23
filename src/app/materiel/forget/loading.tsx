/** loading.tsx — /materiel/forget */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/25 backdrop-blur-sm animate-pulse ${className}`} />
);

export default function ForgetLoading() {
  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24" aria-busy="true" aria-label="Chargement de l'assistant anti-oubli…">
      <S className="h-6 w-48 mb-6" />
      <S className="h-20 w-full mb-6 rounded-2xl" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-3.5 rounded-2xl bg-white/20 border border-white/30 animate-pulse flex items-center gap-3">
            <S className="h-5 w-5 rounded-full flex-shrink-0" />
            <S className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
