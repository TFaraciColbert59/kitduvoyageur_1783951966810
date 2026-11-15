import RuleSimulator from '@/features/progression/components/RuleSimulator';
import PartnerCampaignsPanel from '@/components/progression/PartnerCampaignsPanel';

/**
 * T42 & S6.26 — Administration du barème et campagnes sponsorisées B2B.
 * L'accès est garanti en amont (middleware /admin + is_admin).
 */
export default function AdminProgressionPage() {
  return (
    <main className="min-h-screen bg-[color:var(--lkv-forest-950)] px-4 py-10 font-sans text-[color:var(--sand-50)] sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-white/40">
            Administration · Progression
          </p>
          <h1 className="text-2xl font-semibold text-white">Barème &amp; simulation</h1>
          <p className="text-sm text-white/50">
            Validez les bornes du registre fermé avant toute publication journalisée :
            aucune écriture de solde, aucun changement de règle depuis cet écran.
          </p>
        </header>
        <RuleSimulator />
        <PartnerCampaignsPanel />
      </div>
    </main>
  );
}
