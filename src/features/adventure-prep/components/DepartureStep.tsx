'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { activityById } from '../catalog';
import { A_VERIFIER } from '../engine/trust';
import { packWeight, resolvedGear } from '../engine/gear';
import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
import { knownGaps } from '../engine/itinerary';
import { bookWeightLabel, gearToVerifyCount, plural } from '../engine/labels';
import type { AdventurePrepDraft, GearNeed, PlaceRef } from '../types';
import { blockersBeforeSave, buildAdventureGenerateRequest } from '../adventureRequest';
import { PrepMap } from './PrepMap';
import type { PrepSheetId } from './PrepSheets';

export interface DepartureStepProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

interface OpenPoint {
  id: string;
  label: string;
  sheet: PrepSheetId | null;
}

function openPointsOf(draft: AdventurePrepDraft, gear: readonly GearNeed[]): OpenPoint[] {
  const points: OpenPoint[] = [];
  const pending = gearToVerifyCount(gear, draft.packedGearIds);
  if (pending > 0) {
    points.push({
      id: 'equipement',
      label: `Équipement : ${pending} ${plural(pending, 'élément')} à confirmer`,
      sheet: 'gear',
    });
  }
  for (const gap of draft.itinerary ? knownGaps(draft.itinerary) : []) {
    points.push({ id: `gap-${gap.id}`, label: gap.label, sheet: null });
  }
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  if (meals.length > 0) {
    points.push({
      id: 'repas',
      label: `Repas : ${meals.length} à organiser`,
      sheet: 'consumables',
    });
  }
  if (!draft.activities.primary) {
    points.push({ id: 'activite', label: 'Activité à choisir', sheet: null });
  }
  if (!draft.route.origin) {
    points.push({ id: 'depart', label: 'Point de départ à vérifier', sheet: 'place' });
  }
  if (!draft.calendar.startDate) {
    points.push({ id: 'date', label: 'Date de départ à vérifier', sheet: 'calendar' });
  }
  const headcount = draft.group.adults + draft.group.children;
  if (draft.group.mode === 'groupe' && headcount > 1 && draft.group.knownMembers.length === 0) {
    points.push({ id: 'participants', label: 'Participants : personne n’est encore attribué', sheet: 'participants' });
  }
  return points;
}

function routeCoords(draft: AdventurePrepDraft): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const push = (place: PlaceRef | null) => {
    if (!place) return;
    const last = coords[coords.length - 1];
    if (last && last[0] === place.lat && last[1] === place.lon) return;
    coords.push([place.lat, place.lon]);
  };
  push(draft.route.origin);
  if (draft.route.shape === 'aller_simple') push(draft.route.destination);
  return coords;
}

export function DepartureStep({ onOpenSheet }: DepartureStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const syncGear = useAdventurePrepStore((state) => state.syncGear);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  // L abort est partage : un demontage ou une deuxieme tentative doit annuler
  // la premiere, sinon un plan arrive apres le depart de l ecran.
  const abort = useRef<AbortController | null>(null);
  // Cle d idempotence : une par tentative. Si la reponse se perd, le reessai
  // rejoue la MEME requete et la route renvoie le plan deja cree au lieu d en
  // fabriquer un second.
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    syncGear();
  }, [syncGear, draft.activities.primary, draft.activities.nights.length]);

  useEffect(() => () => {
    abort.current?.abort();
  }, []);

  const saveAdventure = useCallback(async () => {
    if (save === 'saving') return;
    const blockers = blockersBeforeSave(draft);
    if (blockers.length > 0) {
      setSaveError(`Il manque ${blockers.join(', ')} avant d enregistrer ton aventure.`);
      return;
    }

    setSaveError(null);
    setSave('saving');

    const controller = new AbortController();
    abort.current = controller;
    idempotencyKey.current = idempotencyKey.current ?? crypto.randomUUID();

    try {
      const response = await fetch('/api/adventure/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify(buildAdventureGenerateRequest(draft)),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Le detail technique reste cote serveur : l ecran ne montre qu une
        // phrase actionnable, jamais un code HTTP ni une charge utile brute.
        setSave('idle');
        setSaveError(
          response.status === 401
            ? 'Connecte-toi pour enregistrer ton aventure, puis reessaie.'
            : 'Ton aventure n a pas pu etre enregistree. Reessaie dans un instant.'
        );
        return;
      }

      const payload = (await response.json()) as { planId?: string };
      if (!payload.planId) {
        setSave('idle');
        setSaveError('Le parcours a ete enregistre sans identifiant. Verifie ton hub.');
        return;
      }

      setSave('saved');
      router.push('/hub');
    } catch (error) {
      if (controller.signal.aborted) return;
      setSave('idle');
      setSaveError('Impossible de joindre le serveur. Verifie ta connexion, puis reessaie.');
    }
  }, [draft, router, save]);
  const activity = activityById(draft.activities.primary);
  const title = draft.coverName ?? 'Ton aventure';
  
  const gear = resolvedGear(draft);
  const weight = packWeight(gear);
  const gearPending = gearToVerifyCount(gear, draft.packedGearIds);
  const gearSummaryText = gearPending > 0 
    ? `${gearPending} ${plural(gearPending, 'élément')} à confirmer`
    : bookWeightLabel(weight);
    
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  
  const knownMembers = draft.group.knownMembers.length;
  const headcount = draft.group.adults + draft.group.children;
  
  const points = openPointsOf(draft, gear);

  return (
    <div className="prep-screen">
      <div className="prep-body">
        
        {/* Couverture compacte */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ 
            width: 44, height: 44, flex: 'none',
            borderRadius: 'var(--lkv-radius-md)',
            backgroundColor: 'var(--green-tint)',
            color: 'var(--green-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon name={activity?.icon ?? 'activity'} size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="prep-title" style={{ fontSize: 'var(--f-body)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {title}
            </h1>
            <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
              {activity ? `${activity.label} · ${draft.calendar.durationDays ?? A_VERIFIER} jour${draft.calendar.durationDays === 1 ? '' : 's'}` : A_VERIFIER}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenSheet('coverage')}
            icon={<Icon name="pencil" size={18} aria-hidden="true" />}
            aria-label="Modifier la couverture"
          >
            Modifier
          </Button>
        </div>
        
        {/* Blocs résumés */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--prep-block-gap)', marginBottom: 'var(--space-4)' }}>
          
          <button type="button" className="prep-block" onClick={() => onOpenSheet('gear')} style={{ padding: 'var(--space-3)', width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 'var(--card-radius)', backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
              <Icon name="backpack" size={24} style={{ color: 'var(--green)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--lkv-text-primary)' }}>Équipement</div>
                <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)' }}>
                  {gearSummaryText}
                  <span style={{ display: 'block', fontSize: 'var(--lkv-text-caption, 13px)', color: 'var(--lkv-text-subtle)' }}>
                    {weight.grams !== null && weight.grams > 0 ? bookWeightLabel(weight) : 'Poids du sac à estimer'}
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={20} style={{ color: 'var(--lkv-text-subtle)' }} />
            </div>
          </button>
          
          <button type="button" className="prep-block" onClick={() => onOpenSheet('consumables')} style={{ padding: 'var(--space-3)', width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 'var(--card-radius)', backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
              <Icon name="droplets" size={24} style={{ color: 'var(--green)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--lkv-text-primary)' }}>Eau et repas</div>
                <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)' }}>
                  {meals.length === 0 ? 'Couvert' : `${meals.length} repas à organiser`}
                </div>
              </div>
              <Icon name="chevron-right" size={20} style={{ color: 'var(--lkv-text-subtle)' }} />
            </div>
          </button>
          
          <button type="button" className="prep-block" onClick={() => onOpenSheet('participants')} style={{ padding: 'var(--space-3)', width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 'var(--card-radius)', backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
              <Icon name="users" size={24} style={{ color: 'var(--green)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--lkv-text-primary)' }}>Participants</div>
                <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)' }}>
                  {headcount} personne{headcount > 1 ? 's' : ''} {knownMembers > 0 && `(${knownMembers} confirmé${knownMembers > 1 ? 's' : ''})`}
                </div>
              </div>
              
              {knownMembers > 0 && (
                <div style={{ display: 'flex' }}>
                   {draft.group.knownMembers.slice(0, 3).map((m, i) => (
                     <div key={m} style={{
                       width: 32, height: 32, borderRadius: 'var(--lkv-radius-full)', backgroundColor: 'var(--green-tint)', border: '2px solid var(--surface)',
                       display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--green-ink)',
                       marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i
                     }}>
                       {m.charAt(0).toUpperCase()}
                     </div>
                   ))}
                </div>
              )}
              
              <Icon name="chevron-right" size={20} style={{ color: 'var(--lkv-text-subtle)' }} />
            </div>
          </button>
        </div>
        
        {points.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)', backgroundColor: 'var(--amber-bg)', padding: 'var(--space-3)', borderRadius: 'var(--card-radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber-ink)', fontWeight: 600, marginBottom: 8 }}>
              <Icon name="alert-circle" size={20} />
              <span>À vérifier avant de partir</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 24, fontSize: 'var(--f-sec)', color: 'var(--amber-ink)' }}>
              {points.map((p) => (
                <li key={p.id} style={{ marginBottom: 4 }}>{p.label}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <PrepMap name={title} routeCoords={routeCoords(draft)} scopeLabel="Ensemble" />
        </div>
        
      </div>
      
      <div className="prep-footer">
        {saveError ? (
          <p className="prep-missing" role="alert" style={{ margin: 0, width: '100%' }}>
            {saveError}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          className="prep-footer__primary"
          loading={save === 'saving'}
          onClick={saveAdventure}
          icon={save === 'saved' ? <Icon name="check" size={20} aria-hidden="true" /> : undefined}
          style={{ width: '100%' }}
        >
          {save === 'saved' ? 'Enregistré' : 'Enregistrer mon aventure'}
        </Button>
      </div>
    </div>
  );
}
