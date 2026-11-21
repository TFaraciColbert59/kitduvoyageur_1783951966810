'use client';

import React, { useState } from 'react';
import { Backpack, ChevronRight, Euro } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import '@/features/community/v2/create/create-v2.css';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import {
  MOMENT_EXPENSE_CATEGORIES,
} from '@/features/carnet/detail/momentTypes';
import type { CreateMomentResult } from '@/features/carnet/detail/useCarnetEdits';
import type { CarnetKitItemRow } from '@/features/carnet/detail/types';
import { CarnetPlaceSearchField } from './CarnetPlaceSearchField';

export type CarnetLogTabId = 'spend' | 'kit';

export interface CarnetLogCreateSheetProps {
  initialTab?: CarnetLogTabId;
  day: number;
  defaultPlace?: string;
  kitItems: CarnetKitItemRow[];
  onSubmit: (input: unknown, file: File | null) => Promise<CreateMomentResult>;
  onClose: () => void;
}

const LOG_TABS: ReadonlyArray<{
  id: CarnetLogTabId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'spend', label: 'Dépense', icon: <Euro size={20} aria-hidden="true" /> },
  { id: 'kit', label: 'Objet du kit', icon: <Backpack size={20} aria-hidden="true" /> },
];

/**
 * Tiroir « Dépense / Objet du kit » dans la coque CommunitySheetShell (style unifié avec les autres drawers).
 */
export function CarnetLogCreateSheet({
  initialTab = 'spend',
  day,
  defaultPlace = '',
  kitItems,
  onSubmit,
  onClose,
}: CarnetLogCreateSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tabIndex, setTabIndex] = useState(() => (initialTab === 'kit' ? 1 : 0));
  const activeTab: CarnetLogTabId = LOG_TABS[tabIndex]?.id ?? 'spend';

  const [place, setPlace] = useState(defaultPlace);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(MOMENT_EXPENSE_CATEGORIES[0]);
  const [spendNote, setSpendNote] = useState('');
  const [itemId, setItemId] = useState(kitItems[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (activeTab === 'spend') {
      const parsed = Number(amount.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Indique un montant valide.');
        return;
      }
      setBusy(true);
      setError(null);
      const res = await onSubmit(
        {
          type: 'spend',
          day,
          place,
          amountEur: parsed,
          category,
          caption: spendNote.trim() || category,
        },
        null,
      );
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast('Dépense ajoutée au carnet', 'success');
      onClose();
      return;
    }

    const selected = kitItems.find((i) => i.id === itemId);
    if (!selected) {
      setError('Aucun objet du kit disponible à associer.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSubmit(
      {
        type: 'kit',
        day,
        place,
        itemId: selected.id,
        caption: selected.name,
      },
      null,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast('Objet du kit ajouté au carnet', 'success');
    onClose();
  };

  const selectedKitItem = kitItems.find((i) => i.id === itemId) ?? null;

  const panes = [
    <div key="spend" className="lkdv-cv2c-pane">
      <div className="lkdv-carnet-species-preview" aria-label="Aperçu de la dépense">
        <div
          className="lkdv-carnet-species-preview-media"
          style={{ background: 'rgba(27, 67, 50, 0.08)' }}
        >
          <div className="lkdv-carnet-species-preview-empty" style={{ color: '#1b4332' }}>
            <Euro size={24} aria-hidden="true" />
            <span>{amount.trim() ? `${amount.trim()} €` : '0,00 €'}</span>
          </div>
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
        </div>
        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{spendNote.trim() || category}</b>
            <i>{place.trim() ? `${category} · ${place.trim()}` : category}</i>
          </div>
        </div>
      </div>

      <CarnetPlaceSearchField
        label={`Lieu (Jour ${day})`}
        value={place}
        onChange={setPlace}
      />
      <div className="lkdv-cv2c-row-2">
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Montant (€)</span>
          <input
            type="text"
            inputMode="decimal"
            className="lkdv-cv2-input"
            value={amount}
            maxLength={12}
            placeholder="12,50"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Catégorie</span>
          <select
            className="lkdv-cv2-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {MOMENT_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Libellé</span>
        <input
          type="text"
          className="lkdv-cv2-input"
          value={spendNote}
          maxLength={80}
          placeholder="Casse-croûte, refuge, navette…"
          onChange={(e) => setSpendNote(e.target.value)}
        />
      </div>
    </div>,
    <div key="kit" className="lkdv-cv2c-pane">
      <div className="lkdv-carnet-species-preview" aria-label="Aperçu de l’objet du kit">
        <div
          className="lkdv-carnet-species-preview-media"
          style={{ background: 'rgba(27, 67, 50, 0.08)' }}
        >
          <div className="lkdv-carnet-species-preview-empty" style={{ color: '#1b4332' }}>
            <Backpack size={24} aria-hidden="true" />
            <span>
              {selectedKitItem?.weightG ? `${selectedKitItem.weightG} g` : 'Kit'}
            </span>
          </div>
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
        </div>
        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{selectedKitItem?.name ?? 'Aucun objet'}</b>
            <i>{place.trim() || `Utilisé à J${day}`}</i>
          </div>
        </div>
      </div>

      <CarnetPlaceSearchField
        label={`Lieu (Jour ${day})`}
        value={place}
        onChange={setPlace}
      />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Objet du kit</span>
        {kitItems.length > 0 ? (
          <select
            className="lkdv-cv2-input"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {kitItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="lkdv-cv2-field-hint">
            Aucun objet dans le kit de ce carnet pour le moment.
          </p>
        )}
      </div>
    </div>,
  ];

  const footer = (
    <div className="lkdv-cv2c-footbar">
      {error ? (
        <p className="lkdv-cv2c-server" role="alert">
          {error}
        </p>
      ) : null}
      <div className="lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact">
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
          disabled={busy || (activeTab === 'kit' && kitItems.length === 0)}
          onClick={() => void submit()}
        >
          {busy ? 'Envoi…' : `Ajouter à J${day}`}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <CommunitySheetShell
      open
      onClose={onClose}
      kind="create"
      guestNotice={!user?.id || user.is_anonymous === true}
      label="Ajouter une dépense ou un objet du kit"
      capsule={{
        items: LOG_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
        active: tabIndex,
        onChange: (idx) => {
          setTabIndex(idx);
          setError(null);
        },
        ariaLabel: 'Type d’ajout',
      }}
      panes={panes}
      resetKey={activeTab}
      footer={footer}
    />
  );
}
