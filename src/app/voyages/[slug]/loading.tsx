export default function TripLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-label="Chargement du voyage">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--lkv-primary)] border-t-transparent animate-spin" />
    </div>
  );
}
