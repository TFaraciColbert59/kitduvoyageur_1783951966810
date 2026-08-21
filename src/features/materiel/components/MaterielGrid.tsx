'use client';
import styles from './MaterielGrid.module.css';
import SpotlightTracker from '@/components/ui/SpotlightTracker';
import { useMaterielOrder } from '@/features/materiel/store/useMaterielOrder';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { GearCardDepart } from './cards/GearCardDepart';
import { GearCardForget } from './cards/GearCardForget';
import { GearCardKits } from './cards/GearCardKits';
import { GearCardInventaire } from './cards/GearCardInventaire';
import { GearCardAlertes } from './cards/GearCardAlertes';
import { GearCardDispo } from './cards/GearCardDispo';

const AREAS = ['depart', 'forget', 'kits', 'inventaire', 'alertes', 'dispo'] as const;

// Classes littérales pour que Tailwind les génère (JIT ne lit pas les template literals).
const AREA_CLASS: Record<string, string> = {
  depart: '[grid-area:depart]',
  forget: '[grid-area:forget]',
  kits: '[grid-area:kits]',
  inventaire: '[grid-area:inventaire]',
  alertes: '[grid-area:alertes]',
  dispo: '[grid-area:dispo]',
};

/** MaterielGrid — grille des 6 cartes (desktop en zones nommées, mobile réordonnable persisté). */
export function MaterielGrid({ data }: { data: MaterielSummary }) {
  const { order, move } = useMaterielOrder();

  const renderCard = (area: string) => {
    const cardClass = 'spotlight h-full';
    switch (area) {
      case 'depart': return <GearCardDepart data={data.depart} className={cardClass} />;
      case 'forget': return <GearCardForget data={data.forget} className={cardClass} />;
      case 'kits': return <GearCardKits data={data.kits} className={cardClass} />;
      case 'inventaire': return <GearCardInventaire data={data.inventaire} className={cardClass} />;
      case 'alertes': return <GearCardAlertes data={data.alertes} className={cardClass} />;
      case 'dispo': return <GearCardDispo data={data.dispo} className={cardClass} />;
      default: return null;
    }
  };

  return (
    <>
      {/* Desktop : grille à zones nommées (ordre fixe, conforme prompt) */}
      <div className={`${styles.grid} hidden md:grid`}>
        {AREAS.map((area) => (
          <SpotlightTracker key={area} className={AREA_CLASS[area]}>
            {renderCard(area)}
          </SpotlightTracker>
        ))}
      </div>

      {/* Mobile : empilé dans l'ordre persistant, réordonnable */}
      <div className="md:hidden flex flex-col gap-[var(--grid-gap)]">
        {order.map((area, idx) => (
          <div key={area}>
            <div className="flex justify-end gap-1 mb-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => move(idx, idx - 1)}
                aria-label="Monter la carte"
                className="bg-white/30 h-7 w-7 rounded-full text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === order.length - 1}
                onClick={() => move(idx, idx + 1)}
                aria-label="Descendre la carte"
                className="bg-white/30 h-7 w-7 rounded-full text-sm disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            {renderCard(area)}
          </div>
        ))}
      </div>
    </>
  );
}
