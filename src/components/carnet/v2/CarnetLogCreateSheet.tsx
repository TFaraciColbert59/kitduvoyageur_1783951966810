'use client';

import React, { useEffect, useState } from 'react';
import { Backpack, ChevronRight, Euro, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import '@/features/community/v2/create/create-v2.css';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { MOMENT_EXPENSE_CATEGORIES } from '@/features/carnet/detail/momentTypes';
import type { CreateMomentResult } from '@/features/carnet/detail/useCarnetEdits';
import type { CarnetKitItemRow, CarnetParticipant } from '@/features/carnet/detail/types';
import { CarnetPlaceSearchField } from './CarnetPlaceSearchField';

export type CarnetLogTabId = 'spend' | 'kit';

export interface CarnetLogCreateSheetProps {
  initialTab?: CarnetLogTabId;
  day: number;
  defaultPlace?: string;
  kitItems: CarnetKitItemRow[];
  participants?: CarnetParticipant[];
  onKitItemAdded?: (item: CarnetKitItemRow) => void;
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
 * Tiroir « Dépense / Objet du kit » dans la coque CommunitySheetShell.
 * Pour « Objet du kit », permet d'ajouter un produit acheté/ajouté en cours de route
 * dans le kit d'un participant, de l'afficher dans la timeline ET de l'imputer au budget.
 */
export function CarnetLogCreateSheet({
  initialTab = 'spend',
  day,
  defaultPlace = '',
  kitItems,
  participants = [],
  onKitItemAdded,
  onSubmit,
  onClose,
}: CarnetLogCreateSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tabIndex, setTabIndex] = useState(() => (initialTab === 'kit' ? 1 : 0));
  const activeTab: CarnetLogTabId = LOG_TABS[tabIndex]?.id ?? 'spend';

  // Dépense
  const [place, setPlace] = useState(defaultPlace);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(MOMENT_EXPENSE_CATEGORIES[0]);
  const [spendNote, setSpendNote] = useState('');

  // Objet du kit en cours de route (couplé au budget)
  const [kitParticipantId, setKitParticipantId] = useState<string>(
    () =>
      participants.find((p) => p.userId === user?.id)?.userId ??
      participants[0]?.userId ??
      'self',
  );
  const [kitProductName, setKitProductName] = useState('');
  const [kitSelectedId, setKitSelectedId] = useState<string>('');
  const [kitPrice, setKitPrice] = useState('');
  const [kitWeight, setKitWeight] = useState('');
  const [kitSuggestions, setKitSuggestions] = useState<
    Array<{ id: string; label: string; sublabel: string }>
  >([]);
  const [kitDropdownOpen, setKitDropdownOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'kit' || !kitDropdownOpen) return;
    const q = kitProductName.trim();
    if (q.length < 2) {
      setKitSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/materiel/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data: { results?: Array<{ id: string; type: string; label: string; sublabel: string }> }) => {
          if (!cancelled && Array.isArray(data.results)) {
            setKitSuggestions(
              data.results
                .filter((r) => r.type === 'item')
                .map((r) => ({ id: r.id, label: r.label, sublabel: r.sublabel })),
            );
          }
        })
        .catch(() => {});
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, kitDropdownOpen, kitProductName]);

  const selectedParticipant =
    participants.find((p) => p.userId === kitParticipantId) ?? participants[0] ?? null;

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

    const trimmedProduct = kitProductName.trim();
    if (!trimmedProduct) {
      setError('Indique le nom du produit ajouté au kit.');
      return;
    }
    const parsedPrice = kitPrice.trim() ? Number(kitPrice.replace(',', '.')) : 0;
    if (kitPrice.trim() && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError('Indique un prix valide.');
      return;
    }
    const parsedWeight = kitWeight.trim() ? Number(kitWeight.replace(',', '.')) : 0;
    const itemId = kitSelectedId || `kit-route-${Date.now()}`;
    const ownerLabel = selectedParticipant?.name ? ` · Kit de ${selectedParticipant.name}` : '';
    const priceLabel = parsedPrice > 0 ? ` · ${parsedPrice % 1 === 0 ? parsedPrice.toFixed(0) : parsedPrice.toFixed(2).replace('.', ',')} €` : '';

    setBusy(true);
    setError(null);

    const kitRes = await onSubmit(
      {
        type: 'kit',
        day,
        place,
        itemId,
        caption: `${trimmedProduct}${ownerLabel}${priceLabel}`,
      },
      null,
    );
    if (!kitRes.ok) {
      setBusy(false);
      setError(kitRes.error);
      return;
    }

    onKitItemAdded?.({
      id: itemId,
      name: trimmedProduct,
      detail: selectedParticipant?.name ? `Ajouté en route · ${selectedParticipant.name}` : 'Ajouté en route',
      weightG: Number.isFinite(parsedWeight) && parsedWeight > 0 ? Math.round(parsedWeight) : null,
      color: null,
      category: 'Matériel',
      verdict: null,
    });

    if (parsedPrice > 0) {
      await onSubmit(
        {
          type: 'spend',
          day,
          place,
          amountEur: parsedPrice,
          category: 'Matériel',
          caption: `${trimmedProduct}${ownerLabel}`,
        },
        null,
      );
    }

    setBusy(false);
    toast(
      parsedPrice > 0
        ? 'Produit ajouté au kit, timeline et budget'
        : 'Produit ajouté au kit et à la timeline',
      'success',
    );
    onClose();
  };

  const parsedAmount = Number(amount.replace(',', '.'));
  const formattedAmount =
    amount.trim() && Number.isFinite(parsedAmount)
      ? `${parsedAmount % 1 === 0 ? parsedAmount.toFixed(0) : parsedAmount.toFixed(2).replace('.', ',')} €`
      : '0 €';

  const parsedKitPrice = Number(kitPrice.replace(',', '.'));
  const formattedKitPrice =
    kitPrice.trim() && Number.isFinite(parsedKitPrice) && parsedKitPrice > 0
      ? `${parsedKitPrice % 1 === 0 ? parsedKitPrice.toFixed(0) : parsedKitPrice.toFixed(2).replace('.', ',')} €`
      : null;

  const spendPreview = (
    <div
      aria-label="Aperçu de la dépense"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 20,
        border: '1px solid rgba(27, 67, 50, 0.14)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(242, 247, 238, 0.88))',
        boxShadow: '0 6px 18px rgba(16, 32, 25, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(27, 67, 50, 0.09)',
            color: '#1b4332',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Euro size={12} aria-hidden="true" />
          <span>{category}</span>
        </span>
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(23, 43, 36, 0.07)',
            color: '#34473e',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Jour {day}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {spendNote.trim() || `Dépense · ${category}`}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#56665d',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place.trim() || 'Lieu à préciser à l’étape suivante'}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: '#1b4332',
            flexShrink: 0,
          }}
        >
          {formattedAmount}
        </div>
      </div>
    </div>
  );

  const kitPreview = (
    <div
      aria-label="Aperçu de l’objet du kit"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 20,
        border: '1px solid rgba(27, 67, 50, 0.14)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(242, 247, 238, 0.88))',
        boxShadow: '0 6px 18px rgba(16, 32, 25, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(27, 67, 50, 0.09)',
            color: '#1b4332',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Backpack size={12} aria-hidden="true" />
          <span>{selectedParticipant ? `Kit · ${selectedParticipant.name}` : 'Équipement'}</span>
        </span>
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(23, 43, 36, 0.07)',
            color: '#34473e',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Jour {day}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {kitProductName.trim() || 'Nouveau produit…'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#56665d',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place.trim() || `Ajouté à J${day}`}
            {kitWeight.trim() ? ` · ${kitWeight.trim()} g` : ''}
          </div>
        </div>
        {formattedKitPrice ? (
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: '#1b4332',
              flexShrink: 0,
            }}
          >
            {formattedKitPrice}
          </div>
        ) : null}
      </div>
    </div>
  );

  const panes = [
    <div key="spend" className="lkdv-cv2c-pane">
      {spendPreview}
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
      <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />
    </div>,
    <div key="kit" className="lkdv-cv2c-pane">
      {kitPreview}
      {participants.length > 0 ? (
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Kit du participant</span>
          <select
            className="lkdv-cv2-input"
            value={kitParticipantId}
            onChange={(e) => setKitParticipantId(e.target.value)}
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="lkdv-cv2-field" style={{ position: 'relative' }}>
        <span className="lkdv-cv2-field-label">Produit acheté / ajouté</span>
        <div className="lkdv-carnet-pokedex-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={kitProductName}
            maxLength={80}
            autoComplete="off"
            placeholder="Cartouche de gaz, chaussettes, bâton…"
            onFocus={() => setKitDropdownOpen(true)}
            onChange={(e) => {
              setKitProductName(e.target.value);
              setKitSelectedId('');
              setKitDropdownOpen(true);
            }}
          />
        </div>
        {kitDropdownOpen && (kitSuggestions.length > 0 || kitItems.length > 0) ? (
          <div
            role="listbox"
            aria-label="Produits existants"
            style={{
              marginTop: 6,
              borderRadius: 16,
              border: '1px solid rgba(27, 67, 50, 0.14)',
              background: 'rgba(255, 255, 255, 0.96)',
              boxShadow: '0 10px 26px rgba(15, 23, 42, 0.1)',
              overflow: 'hidden',
              maxHeight: 140,
              overflowY: 'auto',
            }}
          >
            {(kitSuggestions.length > 0
              ? kitSuggestions
              : kitItems.slice(0, 6).map((i) => ({ id: i.id, label: i.name, sublabel: 'Kit du carnet' }))
            ).map((item, idx) => (
              <button
                key={`${item.id}-${idx}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setKitProductName(item.label);
                  setKitSelectedId(item.id);
                  setKitDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  border: 0,
                  borderBottom: '1px solid rgba(27, 67, 50, 0.08)',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{item.label}</span>
                <span style={{ fontSize: 11, color: '#56665d' }}>{item.sublabel}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="lkdv-cv2c-row-2">
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Coût (€ · budget)</span>
          <input
            type="text"
            inputMode="decimal"
            className="lkdv-cv2-input"
            value={kitPrice}
            maxLength={12}
            placeholder="25,00"
            onChange={(e) => setKitPrice(e.target.value)}
          />
        </div>
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Poids (g)</span>
          <input
            type="text"
            inputMode="numeric"
            className="lkdv-cv2-input"
            value={kitWeight}
            maxLength={8}
            placeholder="230"
            onChange={(e) => setKitWeight(e.target.value)}
          />
        </div>
      </div>

      <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />
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
          disabled={busy}
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
