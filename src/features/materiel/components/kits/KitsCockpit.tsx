'use client';

import { motion, useDragControls } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useKitsOrder } from '@/features/materiel/store/useKitsOrder';
import { KitsKpiCockpitCard } from './KitsKpiCockpitCard';
import { KitPreparationCockpitCard } from './KitPreparationCockpitCard';
import { KitBuilder } from './KitBuilder';
import { KitsActiveCockpitCard } from './KitsActiveCockpitCard';
import { TemplateStore } from './TemplateStore';
import type { KitListItem } from '@/features/materiel/services/getKits';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { PublicKit } from '@/features/materiel/services/getPublicKits';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

// Emplacements — formation 2 - 1 - 2 sur mobile, 3 / 1 / 2 sur desktop
// Indexés par position (0, 1, 2, 3, 4) pour permettre le déplacement et re-packing fluide comme dans Départ
const SLOT_CLASS = [
  'col-span-6 md:[grid-column:1/9] md:[grid-row:1/2] h-auto md:h-full',
  'col-span-6 md:[grid-column:9/13] md:[grid-row:1/2] h-auto md:h-full',
  'col-span-12 md:[grid-column:1/13] md:[grid-row:2/3] min-h-0 h-auto md:h-full',
  'col-span-6 md:[grid-column:1/7] md:[grid-row:3/4] h-auto md:h-full',
  'col-span-6 md:[grid-column:7/13] md:[grid-row:3/4] h-auto md:h-full',
];

const LABEL: Record<string, string> = {
  kpi: 'Indicateurs clés',
  preparation: 'Statut de préparation',
  builder: 'Assembleur & IA',
  kit: 'Kit actif',
  templates: 'Modèles communautaires',
};

// Variantes d'entrée staggerée des widgets
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const widgetVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

interface Props {
  kits: KitListItem[];
  inventory: InventoryItem[];
  publicKits: PublicKit[];
  products: ProductSuggestion[];
}

export function KitsCockpit({
  kits = [],
  inventory = [],
  publicKits = [],
  products = [],
}: Props) {
  const { order, setOrder } = useKitsOrder();
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeKits = kits.filter((k) => !k.is_trashed);
  const [selectedKitId, setSelectedKitId] = useState<string>(activeKits[0]?.id ?? '');

  const primaryKit = activeKits.find((k) => k.id === selectedKitId) || activeKits[0] || null;

  const totalWeight = activeKits.reduce((s, k) => s + k.total_weight_g, 0);
  const totalItems = activeKits.reduce((s, k) => s + (k.items?.length ?? 0), 0);
  const shopItems = activeKits.reduce(
    (s, k) => s + (k.items?.filter((i) => !i.product_ownership_id).length ?? 0),
    0
  );

  // Algorithme de réordonnancement 2D par distance euclidienne (identique à Départ)
  const handleDrop = (id: string, point: { x: number; y: number }) => {
    const rects = Object.entries(refs.current)
      .filter(([k, el]) => !!el && k !== id)
      .map(([k, el]) => {
        const r = el!.getBoundingClientRect();
        return { id: k, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      });
    if (rects.length === 0) return;
    const target = rects.reduce<{ id: string; cx: number; cy: number; d: number }>(
      (best, r) => {
        const d = (r.cx - point.x) ** 2 + (r.cy - point.y) ** 2;
        return d < best.d ? { d, id: r.id, cx: r.cx, cy: r.cy } : best;
      },
      { d: Infinity, id: '', cx: 0, cy: 0 }
    );
    const cur = [...order];
    const from = cur.indexOf(id);
    const to = cur.indexOf(target.id);
    if (from === -1 || to === -1) return;
    const dx = point.x - target.cx;
    const dy = point.y - target.cy;
    const insertAt = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? to : to + 1) : dy < 0 ? to : to + 1;
    const [item] = cur.splice(from, 1);
    cur.splice(insertAt, 0, item);
    setOrder(cur);
  };

  return (
    <div className="h-full w-full flex flex-col justify-between gap-2 max-w-[var(--page-max-w)] mx-auto">
      {/* Header unique et interactif avec sélecteur de kit */}
      <div className="shrink-0 flex items-center justify-between gap-1.5 px-0 pt-0.5 pb-1">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="font-display font-semibold text-xs sm:text-[13px] text-[#17402C] shrink-0">
            Kit géré :
          </span>
          {activeKits.length > 0 ? (
            <select
              value={primaryKit?.id ?? ''}
              onChange={(e) => setSelectedKitId(e.target.value)}
              aria-label="Sélectionner le kit à gérer"
              className="glass interactive h-7 py-0 px-2.5 text-[11px] sm:text-xs text-[#17402C] font-bold rounded-full cursor-pointer max-w-[170px] sm:max-w-[260px] truncate outline-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-[#17402C]"
            >
              {activeKits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({(k.total_weight_g / 1000).toFixed(1)}kg)
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-[#5A7064]">Aucun kit</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/materiel"
            className="glass interactive h-7 px-2.5 rounded-full flex items-center text-xs font-semibold text-[#17402C] shrink-0 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-[#17402C]"
          >
            ← Retour
          </Link>
        </div>
      </div>

      {/* Grille Cockpit : Formation 2 - 1 - 2 mobile / 3 - 1 - 2 desktop déplaçable comme dans Départ */}
      <motion.div
        className="flex-1 min-h-0 grid grid-cols-12 gap-2 md:gap-2 items-stretch md:[grid-template-rows:auto_minmax(0,1.8fr)_minmax(0,1fr)] pb-24 md:pb-0 overflow-y-auto md:overflow-hidden no-scrollbar"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {order.map((id, index) => {
          let widget: React.ReactNode = null;
          switch (id) {
            case 'kpi':
              widget = (
                <KitsKpiCockpitCard
                  activeCount={activeKits.length}
                  totalWeightG={totalWeight}
                  totalItemsCount={totalItems}
                  shopItemsCount={shopItems}
                />
              );
              break;
            case 'preparation':
              widget = <KitPreparationCockpitCard kit={primaryKit} />;
              break;
            case 'builder':
              widget = (
                <KitBuilder
                  inventory={inventory}
                  products={products}
                  kits={kits}
                  initialKitItems={[]}
                />
              );
              break;
            case 'kit':
              widget = <KitsActiveCockpitCard kit={primaryKit} />;
              break;
            case 'templates':
              widget = <TemplateStore kits={publicKits} />;
              break;
            default:
              widget = null;
          }
          if (widget === null) return null;
          return (
            <DraggableCard
              key={id}
              id={id}
              refCb={(el) => {
                refs.current[id] = el;
              }}
              slotClass={SLOT_CLASS[index % SLOT_CLASS.length]}
              onDrop={(p) => handleDrop(id, p)}
            >
              {widget}
            </DraggableCard>
          );
        })}
      </motion.div>
    </div>
  );
}

function DraggableCard({
  id,
  children,
  refCb,
  slotClass,
  onDrop,
}: {
  id: string;
  children: React.ReactNode;
  refCb: (el: HTMLDivElement | null) => void;
  slotClass: string;
  onDrop: (p: { x: number; y: number }) => void;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);

  return (
    <motion.div
      ref={refCb}
      layout="position"
      drag
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragSnapToOrigin
      dragElastic={0.08}
      onDragStart={() => setDragging(true)}
      onDragEnd={(_e, info) => {
        setDragging(false);
        onDrop(info.point);
      }}
      variants={widgetVariants}
      className={`relative w-full h-auto md:w-auto md:h-full ${slotClass}`}
      style={{
        ...(dragging ? { willChange: 'transform', zIndex: 30 } : {}),
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="!absolute top-1.5 right-1.5 md:top-2 md:right-2 z-20 h-6 w-6 md:h-8 md:w-8 !rounded-full glass interactive flex items-center justify-center text-[#17402C] cursor-grab touch-none focus-visible:ring-2 focus-visible:ring-[#17402C]"
        aria-label={`Déplacer le widget ${LABEL[id] ?? id}`}
      >
        <GripVertical size={12} className="md:hidden" aria-hidden="true" />
        <GripVertical size={16} className="hidden md:block" aria-hidden="true" />
      </button>
      <div className="h-full min-h-0 overflow-hidden [&>article]:h-full [&>article]:min-h-0 [&>article]:flex [&>article]:flex-col">
        {children}
      </div>
    </motion.div>
  );
}
