'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';

export interface RehabArt9ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sportLabel: string;
  onConsentAccepted: (consentRecord: {
    scope: 'rehab_health_art9';
    consentVersion: string;
    acceptedAtIso: string;
  }) => void;
}

/**
 * Lot 10 — Consentement explicite RGPD Article 9 (Données de santé / Rééducation) :
 * - Visibilité strictement `private`
 * - Zéro partage social, zéro classement communautaire
 * - Zéro transmission à un LLM / IA tierce
 * - Révocable et exportable (Art. 17 & Art. 20) à tout moment.
 */
export function RehabArt9ConsentModal({
  open,
  onOpenChange,
  sportLabel,
  onConsentAccepted,
}: RehabArt9ConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Protection Données de Santé (RGPD Art. 9)"
      subtitle={sportLabel}
    >
      <div data-testid="xp20-rehab-art9-modal" className="flex flex-col gap-3">
        <div
          className="flex items-start gap-2.5 rounded-2xl p-3 text-[12.5px]"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <strong>Ce profil enregistre des indicateurs de rééducation sensibles.</strong>
            <ul className="list-disc pl-4 text-[12px]" style={{ color: 'var(--xp-hud-ink-muted)' }}>
              <li>Visibilité verrouillée sur <strong>Privé uniquement</strong> (jamais publiée).</li>
              <li>Exclusion automatique des heatmaps, défis clubs et classements.</li>
              <li>Blocage serveur strict de tout envoi vers les services IA / LLM tiers.</li>
              <li>Effacement complet (Art. 17) et export (Art. 20) disponibles en 1 clic.</li>
            </ul>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl p-3 text-[12.5px] font-semibold" style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>
            Je donne mon consentement explicite (RGPD Art. 9.2.a) pour enregistrer localement et
            dans mon espace privé mes séances de rééducation.
          </span>
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={() => {
            onConsentAccepted({
              scope: 'rehab_health_art9',
              consentVersion: '2026-12-01',
              acceptedAtIso: new Date().toISOString(),
            });
            onOpenChange(false);
          }}
          className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[14px] font-extrabold"
          style={{
            background: 'var(--xp-hud-accent)',
            color: 'var(--xp-hud-accent-fg)',
            opacity: checked ? 1 : 0.45,
          }}
        >
          <Lock size={15} aria-hidden="true" />
          <span>Activer le suivi confidentiel</span>
        </button>
      </div>
    </ExplorerNestedSubDrawer>
  );
}
