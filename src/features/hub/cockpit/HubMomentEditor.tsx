'use client';

import { useState } from 'react';
import { CarnetCreateSheet } from '@/components/carnet/v2/CarnetCreateSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useCarnetEdits } from '@/features/carnet/detail/useCarnetEdits';
import type { CockpitData } from './model';
import { createHubTripCarnet } from './carnetActions';
import '@/styles/carnet-v2.css';

type Carnet = NonNullable<CockpitData['carnet']>;
type Props = {
  tripId: string;
  day: number;
  place: string | null;
  kitItems: NonNullable<CockpitData['carnetKitItems']>;
  carnet: Carnet | null | undefined;
  canCreate: boolean;
  onChange: (carnet: Carnet) => void;
  onBack: () => void;
};

function SavedCarnetEditor({ carnet, day, place, kitItems, onChange, onBack }: Pick<Props, 'day' | 'place' | 'kitItems' | 'onChange' | 'onBack'> & { carnet: Carnet }) {
  const { user } = useAuth();
  const { createMoment } = useCarnetEdits({
    carnetId: carnet.id,
    privateMedia: true,
    userId: user?.id ?? null,
    authorName: user?.user_metadata?.full_name ?? null,
    onMomentAdded: (moment) => onChange({
      ...carnet,
      moments: [{
        id: moment.id, day: moment.dayNumber, time: moment.time, title: moment.caption || moment.place || 'Moment', type: moment.type,
        media: moment.imageUrl, audio: moment.meta?.audioUrl,
      }, ...carnet.moments],
    }),
    onMomentRemoved: () => undefined,
  });

  return <>
    <p className="lkdv-cv2-meta">J{day}{place && ` · ${place}`}</p>
    <CarnetCreateSheet day={day} defaultPlace={place ?? undefined} kitItems={kitItems} onSubmit={createMoment} onClose={onBack} embedded />
  </>;
}

export function HubMomentEditor({ tripId, day, place, kitItems, carnet, canCreate, onChange, onBack }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (carnet?.editable) return <SavedCarnetEditor carnet={carnet} day={day} place={place} kitItems={kitItems} onChange={onChange} onBack={onBack} />;
  if (carnet || !canCreate) return <p>{carnet ? 'Demande l’accès en écriture au responsable du carnet.' : 'Le responsable de l’aventure peut ouvrir le carnet.'}</p>;

  async function createCarnet() {
    setPending(true);
    setError(null);
    try {
      const result = await createHubTripCarnet(tripId);
      if ('error' in result) setError(result.error);
      else onChange({ id: result.id, editable: true, moments: [] });
    } catch {
      setError('Le carnet n’a pas pu être créé.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <p>Le voyage n’a pas encore de carnet. Crée-le pour enregistrer ton premier moment.</p>
    <button type="button" className="lkdv-cv2-chip" disabled={pending} onClick={() => void createCarnet()}>
      {pending ? 'Création du carnet…' : 'Créer le carnet privé'}
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}
