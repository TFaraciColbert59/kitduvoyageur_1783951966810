import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { PreparationCockpit } from '@/features/preparation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Préparation du Trek | Le Kit du Voyageur',
  description: 'Centre de préparation de trek : qui participe, quoi emporter, quel poids et audit du sac.',
};

export default function PreparationPage() {
  return (
    <div className="min-h-screen pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Link
          href="/voyages/nouveau"
          className="flex items-center justify-between p-3.5 sm:p-4 bg-emerald-50/90 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-2xl transition-all group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#17402C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#17402C]">
                Nouveau : Moteur de Répartition & Planificateur de Voyage
              </p>
              <p className="text-[11px] text-[#5B7F55]">
                Créez une expédition complète en 5 étapes avec étapes réelles et profil altimétrique
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-[#17402C] group-hover:translate-x-0.5 transition-transform shrink-0">
            <span className="hidden sm:inline">Créer un voyage</span>
            <ArrowRight size={14} />
          </div>
        </Link>
      </div>

      <PreparationCockpit />
    </div>
  );
}
