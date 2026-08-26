'use client';

import { motion, useDragControls } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMaterielOrder } from '@/features/materiel/store/useMaterielOrder';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { GearCardDepart } from './cards/GearCardDepart';
import { GearCardKits } from './cards/GearCardKits';
import { GearCardForget } from './cards/GearCardForget';
import { GearCardAlertes } from './cards/GearCardAlertes';
import { GearCardDispo } from './cards/GearCardDispo';

// Emplacements — formation 2 - 1 - 2 sur mobile et 8/4 + 4/4/4 sur PC (desktop)
// Slot 0 (forget) : Mobile Ligne 1 Gauche (6 cols) | PC Ligne 1 Droite (4 cols)
// Slot 1 (dispo)  : Mobile Ligne 1 Droite (6 cols) | PC Ligne 2 Droite (4 cols)
// Slot 2 (depart) : Mobile Ligne 2 Pleine (12 cols)| PC Ligne 1 Gauche (8 cols)
// Slot 3 (kits)   : Mobile Ligne 3 Gauche (6 cols) | PC Ligne 2 Gauche (4 cols)
// Slot 4 (alertes): Mobile Ligne 3 Droite (6 cols) | PC Ligne 2 Milieu (4 cols)
const SLOT_CLASS = [
  'col-span-6 md:[grid-column:9/13] md:[grid-row:1/2] h-full min-h-0',
  'col-span-6 md:[grid-column:9/13] md:[grid-row:2/3] h-full min-h-0',
  'col-span-12 md:[grid-column:1/9] md:[grid-row:1/2] h-full min-h-0',
  'col-span-6 md:[grid-column:1/5] md:[grid-row:2/3] h-full min-h-0',
  'col-span-6 md:[grid-column:5/9] md:[grid-row:2/3] h-full min-h-0',
];

const LABEL: Record<string, string> = {
  forget: 'À ne pas oublier',
  dispo: 'Disponibilité & Prêts',
  depart: 'Mon Prochain Départ',
  kits: 'Mes Kits',
  alertes: 'Alertes & Diagnostic',
};

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

export function MaterielGrid({ data }: { data: MaterielSummary }) {
  const { order, setOrder } = useMaterielOrder();
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const renderWidget = (id: string) => {
    const cardClass = 'spotlight h-full';
    switch (id) {
      case 'forget':
        return <GearCardForget data={data.forget} className={cardClass} />;
      case 'dispo':
        return <GearCardDispo data={data.dispo} className={cardClass} />;
      case 'depart':
        return <GearCardDepart data={data.depart} className={cardClass} />;
      case 'kits':
        return <GearCardKits data={data.kits} className={cardClass} />;
      case 'alertes':
        return <GearCardAlertes data={data.alertes} className={cardClass} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="grid grid-cols-12 gap-1.5 sm:gap-3 items-stretch w-full max-w-[var(--page-max-w)] mx-auto grid-rows-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:[grid-template-rows:repeat(2,minmax(0,1fr))] pb-0 h-full max-h-full overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {order.map((id, index) => {
        const widget = renderWidget(id);
        if (!widget) return null;

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
      className={`relative w-full h-full min-h-0 ${slotClass}`}
      style={{
        ...(dragging ? { willChange: 'transform', zIndex: 30 } : {}),
      }}
    >
      {/* Bouton de déplacement circulaire Desktop uniquement (masqué sur mobile pour éviter toute collision) */}
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="hidden md:flex !absolute top-2 right-2 z-20 h-8 w-8 !rounded-full glass interactive items-center justify-center text-[#17402C] cursor-grab touch-none border border-white/40 focus-visible:ring-2 focus-visible:ring-[#17402C]"
        aria-label={`Déplacer la carte ${LABEL[id] ?? id}`}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <div className="h-full min-h-0 overflow-hidden [&>article]:h-full [&>article]:min-h-0 [&>article]:flex [&>article]:flex-col">
        {children}
      </div>
    </motion.div>
  );
}
