'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FIELD_VERDICTS, FieldVerdict } from '@/features/kits/fieldProof';

interface DebriefItem {
  key: string;
  name: string;
  product_id: string | null;
  category: string | null;
  weight_g: number;
}

interface KitDebriefPanelProps {
  kitId: string;
  sessionId: string;
}

const VERDICT_LABEL: Record<FieldVerdict, string> = {
  essentiel: 'Essentiel',
  utile: 'Utile',
  jamais_servi: 'Jamais servi',
  defaillant: 'Défaillant',
  manquait: 'Manquait',
};

/**
 * Débriefing terrain du kit emporté (chantier lignées, Lot 2.3).
 * Friction minimale : chaque tap de verdict est envoyé immédiatement (upsert
 * (hike_session_id, item_key)), donc un débriefing abandonné à mi-chemin garde
 * tout ce qui a été saisi. Entièrement facultatif et repliable.
 */
export default function KitDebriefPanel({ kitId, sessionId }: KitDebriefPanelProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DebriefItem[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, FieldVerdict>>({});
  const [missingNote, setMissingNote] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Charge les articles du kit emporté
  useEffect(() => {
    let active = true;
    fetch('/api/materiel/kits')
      .then((r) => (r.ok ? r.json() : { kits: [] }))
      .then((data: { kits?: unknown[] }) => {
        if (!active) return;
        const kit = (data.kits ?? []).find((k) => (k as { id: string }).id === kitId) as
          | (DebriefItem & { materiel_kit_items: DebriefItem[] })
          | undefined;
        if (kit) {
          setItems(
            (kit.materiel_kit_items ?? []).map((i, idx) => ({
              key: i.product_id ?? `${i.name}-${idx}`,
              name: i.name,
              product_id: i.product_id ?? null,
              category: i.category ?? null,
              weight_g: i.weight_g ?? 0,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kitId]);

  const send = useCallback(
    async (name: string, verdict: FieldVerdict, productId?: string | null) => {
      try {
        const res = await fetch(`/api/kits/${kitId}/field-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hike_session_id: sessionId,
            name,
            product_id: productId ?? null,
            verdict,
          }),
        });
        if (res.ok && mounted.current) {
          setSentCount((c) => c + 1);
        }
      } catch {
        // Silencieux : le débriefing est un plus, jamais un blocage.
      }
    },
    [kitId, sessionId]
  );

  const tapVerdict = (item: DebriefItem, verdict: FieldVerdict) => {
    setVerdicts((v) => ({ ...v, [item.key]: verdict }));
    // Le front n'a pas l'item_key généré par la DB ; la route le dérive depuis
    // product_id (prioritaire) ou le nom normalisé — miroir exact de la génération.
    send(item.name, verdict, item.product_id);
  };

  const submitMissing = () => {
    const note = missingNote.trim();
    if (!note) return;
    setMissingNote('');
    send(note, 'manquait');
  };

  return (
    <div className="bg-white/5 border border-[#C6DCBE]/15 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#A8C8A0]">
            Kit emporté · débriefing
          </div>
          <div className="text-xs text-white/70 mt-0.5">
            {sentCount > 0 ? `${sentCount} avis enregistrés` : '30 secondes, facultatif'}
          </div>
        </div>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {items.length === 0 && (
              <p className="text-xs text-white/50 py-2">Aucun article à débrieffer.</p>
            )}
            {items.map((item) => {
              const chosen = verdicts[item.key];
              return (
                <div key={item.key} className="p-2.5 bg-[#06120C]/50 rounded-xl">
                  <div className="text-xs font-medium flex items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>
                    <span className="font-mono text-[9px] text-white/40 shrink-0">
                      {item.category ?? ''} · {(item.weight_g / 1000).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {FIELD_VERDICTS.filter((v) => v !== 'manquait').map((v) => (
                      <button
                        key={v}
                        onClick={() => tapVerdict(item, v)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          chosen === v
                            ? 'bg-[#A8C8A0] text-[#06120C]'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {VERDICT_LABEL[v]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ce qui manquait */}
          <div className="mt-3">
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#A8C8A0]/80 mb-1.5">
              Ce qui manquait
            </div>
            <div className="flex gap-2">
              <input
                value={missingNote}
                onChange={(e) => setMissingNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitMissing();
                }}
                placeholder="ex. un couteau multi-usages"
                className="flex-1 bg-white/5 border border-[#C6DCBE]/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#A8C8A0]/50"
              />
              <button
                onClick={submitMissing}
                className="px-3 py-2 rounded-lg bg-[#A8C8A0] text-[#06120C] text-xs font-semibold"
              >
                + Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}