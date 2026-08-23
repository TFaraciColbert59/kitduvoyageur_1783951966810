/** loading.tsx — /materiel/kits — skeleton cockpit 3/1/2 */
const S = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl bg-white/20 backdrop-blur-md animate-pulse border border-white/20 ${className}`} />
);

export default function KitsLoading() {
  return (
    <div
      className="h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6rem)] w-full flex flex-col gap-2 p-2 sm:p-3"
      aria-busy="true"
      aria-label="Chargement du cockpit kits…"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <S className="h-7 w-48 rounded-full" />
        <S className="h-7 w-20 rounded-full" />
      </div>

      {/* Grid 3 / 1 / 2 skeleton */}
      <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
        {/* Row 1 */}
        <S className="col-span-12 md:col-span-8 h-20 md:h-24" />
        <S className="col-span-12 md:col-span-4 h-20 md:h-24" />

        {/* Row 2: Assembleur */}
        <S className="col-span-12 h-44 md:h-52" />

        {/* Row 3: Kit actif + Modèles */}
        <S className="col-span-12 md:col-span-6 h-36 md:h-44" />
        <S className="col-span-12 md:col-span-6 h-36 md:h-44" />
      </div>
    </div>
  );
}
