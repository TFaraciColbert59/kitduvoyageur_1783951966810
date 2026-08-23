'use client';
import { motion, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
import type { KitListItem } from '@/features/materiel/services/getKits';
import { useDepartOrder } from '@/features/materiel/store/useDepartOrder';
import { LazyExplorerMap } from './LazyExplorerMap';
import { WeatherTimeline48h } from './WeatherTimeline48h';
import { AssignedKitCard } from './AssignedKitCard';
import { ChecklistDonut } from './ChecklistDonut';
import { ConsumablesTiles } from './ConsumablesTiles';
import { ParticipantsEmergency } from './ParticipantsEmergency';
import { KitSwitcher } from './KitSwitcher';
import Link from 'next/link';

// Emplacements — formation 3 / 1 / 2 obligatoire : cartes carrées haut et bas (mobile),
// la carte du milieu prend toute la place restante. Desktop : rangées égales.
const SLOT_CLASS = [
  '[grid-column:1/5] [grid-row:1/2] aspect-square md:aspect-auto md:h-full',
  '[grid-column:5/9] [grid-row:1/2] aspect-square md:aspect-auto md:h-full',
  '[grid-column:9/13] [grid-row:1/2] aspect-square md:aspect-auto md:h-full',
  '[grid-column:1/13] [grid-row:2/3] min-h-0 h-full',
  '[grid-column:1/7] [grid-row:3/4] aspect-square md:aspect-auto md:h-full',
  '[grid-column:7/13] [grid-row:3/4] aspect-square md:aspect-auto md:h-full',
];

const LABEL: Record<string, string> = {
  map: 'Carte',
  weather: 'Météo 5 jours',
  kit: 'Kit assigné',
  checklist: 'Checklist',
  consumables: 'Consommables',
  participants: 'Participants',
};

/** DepartCockpit — grille 3/1/2 : cartes déplaçables 2D via la poignée, grille re-paquée sans trou.
 *  Reçoit maintenant `kits` pour le KitSwitcher intégré (streamé avec les données). */
export function DepartCockpit({
  depart,
  weather,
  kits = [],
}: {
  depart: DepartDetail;
  weather: WeatherForecast | null;
  kits?: { id: string; name: string }[];
}) {
  const { order, setOrder } = useDepartOrder();
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

  return (
    <div className="h-full w-full flex flex-col gap-1.5">
      {/* Sous-header streamé : KitSwitcher + retour, visible une fois les données chargées */}
      {kits.length > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-1.5 px-0">
          <p className="min-w-0 font-display font-semibold text-[13px] leading-tight tracking-tight text-[#17402C] truncate">
            <span className="text-[#365233]">{depart.destination}</span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <KitSwitcher kits={kits} currentId={depart.id} />
            <Link
              href="/materiel"
              className="glass interactive h-7 px-2.5 rounded-full flex items-center text-xs font-semibold text-[#17402C] shrink-0"
            >
              ← Retour
            </Link>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2 items-stretch [grid-template-rows:auto_minmax(0,1fr)_auto] md:[grid-template-rows:repeat(3,minmax(0,1fr))]">
        {order.map((id, index) => {
          let widget: React.ReactNode = null;
          switch (id) {
            case 'map': widget = <LazyExplorerMap trail={depart.trail} />; break;
            case 'weather': widget = <WeatherTimeline48h forecast={weather} />; break;
            case 'kit': widget = <AssignedKitCard kit={depart.assignedKit} />; break;
            case 'checklist': widget = <ChecklistDonut pct={depart.checklistPct} sections={depart.checklistSections} items={depart.checklistItems} title={depart.destination} />; break;
            case 'consumables': widget = <ConsumablesTiles kitId={depart.id} initial={depart.consumables} durationDays={depart.durationDays} participants={depart.participants.length} />; break;
            case 'participants': widget = <ParticipantsEmergency participants={depart.participants} emergencyContact={depart.emergencyContact} kitId={depart.id} />; break;
            default: widget = null;
          }
          if (widget === null) return null;
          return (
            <DraggableCard
              key={id}
              id={id}
              refCb={(el) => { refs.current[id] = el; }}
              slotClass={SLOT_CLASS[index % SLOT_CLASS.length]}
              onDrop={(p) => handleDrop(id, p)}
              isMap={id === 'map'}
            >
              {widget}
            </DraggableCard>
          );
        })}
      </div>
    </div>
  );
}

function DraggableCard({
  id,
  children,
  refCb,
  slotClass,
  onDrop,
  isMap = false,
}: {
  id: string;
  children: React.ReactNode;
  refCb: (el: HTMLDivElement | null) => void;
  slotClass: string;
  onDrop: (p: { x: number; y: number }) => void;
  isMap?: boolean;
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
      className={`relative w-full aspect-square md:aspect-auto md:w-auto md:h-full ${slotClass}`}
      style={{
        touchAction: isMap ? 'pan-x pan-y pinch-zoom' : 'auto',
        ...(dragging ? { willChange: 'transform', zIndex: 30 } : {}),
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="!absolute top-1.5 right-1.5 md:top-2 md:right-2 z-20 h-6 w-6 md:h-8 md:w-8 !rounded-full glass interactive flex items-center justify-center text-[#17402C] cursor-grab touch-none"
        aria-label={`Déplacer le widget ${LABEL[id] ?? id}`}
      >
        <GripVertical size={12} className="md:hidden" aria-hidden="true" />
        <GripVertical size={16} className="hidden md:block" aria-hidden="true" />
      </button>
      {/* La carte Leaflet reçoit les événements touch natifs */}
      <div
        className="h-full [&>article]:h-full [&>article]:flex [&>article]:flex-col"
        style={isMap ? { touchAction: 'pan-x pan-y pinch-zoom' } : undefined}
      >
        {children}
      </div>
    </motion.div>
  );
}