'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { activityById } from '../catalog';
import { A_VERIFIER } from '../engine/trust';
import { packWeight, resolvedGear } from '../engine/gear';
import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
import { knownGaps } from '../engine/itinerary';
import { daySteps } from '../engine/itinerary';
import { dayMetrics, metricsFor } from '../engine/metrics';
import { weatherParts } from '../engine/weather';
import { bookWeightLabel, gearToVerifyCount, plural } from '../engine/labels';
import type { AdventurePrepDraft, GearNeed, ItineraryModel, PlaceRef } from '../types';
import { saveAdventure } from '../saveAdventure';
import { PrepMap } from './PrepMap';
import type { PrepSheetId } from './PrepSheets';

export interface DepartureStepProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

// Jours a rendre a l'ecran 3, apres application de la selection du plateau.
//
// Le rail J1/J2/J3 pilote le hub ET le preparateur : c'est le meme store. Sans
// cette fonction, l'ecran 3 rendait les trois jours d'un bloc et l'onglet
// restaait sans effet ici. La fonction est deliberement forgiving : une
// selection hors borne (jour supprime, voyage raccourci entre deux rendus)
// retombe sur la vue complete plutot que de laisser un ecran vide.
export function focusedDayNumbers(totalDays: number, selectedDay: number | null): number[] {
  const all = Array.from({ length: Math.max(1, Math.trunc(totalDays) || 0) }, (_, i) => i + 1);
  if (selectedDay === null) return all;
  return all.includes(selectedDay) ? [selectedDay] : all;
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

function routeCoords(draft: AdventurePrepDraft, model: ItineraryModel | null): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const push = (lat: number | null, lon: number | null) => {
    if (lat === null || lon === null) return;
    const last = coords[coords.length - 1];
    if (last && last[0] === lat && last[1] === lon) return;
    coords.push([lat, lon]);
  };
  // Le trace mesure prime : les etapes reellement situees, dans l ordre du
  // parcours. Le couple departure/arrivee ne sert que de bornage quand le
  // modele n a pas encore de geolocalisation.
  if (model) {
    const ordered = [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order);
    for (const step of ordered) push(step.lat, step.lon);
  }
  push(draft.route.origin?.lat ?? null, draft.route.origin?.lon ?? null);
  if (draft.route.shape === 'aller_simple') {
    push(draft.route.destination?.lat ?? null, draft.route.destination?.lon ?? null);
  }
  return coords;
}

export function DepartureStep({ onOpenSheet }: DepartureStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const syncGear = useAdventurePrepStore((state) => state.syncGear);
  // Meme source de verite que le plateau jour du hub : l'onglet choisi plus
  // haut pilote l'ecran 3, il ne decore pas.
  const selectedDay = useDayFocusStore((state) => state.selectedDay);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  // L abort est partage : un demontage ou une deuxieme tentative doit annuler
  // la premiere, sinon un plan arrive apres le depart de l ecran.
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    syncGear();
  }, [syncGear, draft.activities.primary, draft.activities.nights.length]);

  useEffect(() => () => {
    abort.current?.abort();
  }, []);

  // L identifiant de voyage vient de la reponse de la base. Tant qu il n
  // est pas la, aucun depart vers le hub : une redirection sans ligne creee
  // afficherait un hub vide, pire qu un echec visible.
  const saveCurrentAdventure = useCallback(async () => {
    if (save === 'saving') return;

    setSaveError(null);
    setSave('saving');

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    try {
      const outcome = await saveAdventure(
        draft,
        {
          post: (url, body, init) =>
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              ...(init.signal ? { signal: init.signal } : {}),
            }),
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      if (outcome.status !== 'saved') {
        setSave('idle');
        setSaveError(outcome.message);
        return;
      }

      setSave('saved');
      router.push('/hub');
    } finally {
      if (!controller.signal.aborted) abort.current = null;
    }
  }, [draft, router, save]);
/**
 * Titre affiche de l aventure, du plus certain au moins certain.
 *
 * 1. le nom saisi par la personne ;
 * 2. le titre propose par le modele lors de la generation reelle ;
 * 3. un libelle neutre, qui ne pretend pas etre une donnee.
 */
function coverTitle(draft: AdventurePrepDraft): string {
  const saisi = draft.coverName?.trim();
  if (saisi) return saisi;
  const propose = draft.itinerary?.title?.trim();
  if (propose) return propose;
  return 'Ton aventure';
}

/**
 * Ligne d aide sous le titre.
 *
 * Elle ne renvoie JAMAIS « A verifier » en bloc : chaque partie est ajoutee
 * seulement si elle est connue. Une duree connue reste donc lue meme quand
 * l activite ne l a pas ete.
 */
function coverSubtitle(draft: AdventurePrepDraft): string {
  const parts: string[] = [];
  const activity = activityById(draft.activities.primary);
  if (activity) parts.push(activity.label);
  const days = draft.calendar.durationDays;
  if (days !== null && Number.isFinite(days)) parts.push(`${days} jour${days === 1 ? '' : 's'}`);
  if (parts.length === 0) return A_VERIFIER;
  return parts.join(' · ');
}

  const activity = activityById(draft.activities.primary);
  const title = coverTitle(draft);
  
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
  const model = draft.itinerary;
  const visibleDays = model === null ? [] : focusedDayNumbers(model.days, selectedDay);

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
              {coverSubtitle(draft)}
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
        
        {model && (
          <>
            <div className="prep-metrics">
              {metricsFor(model, 'aventure').map((metric) => (
                <div key={metric.id} className="prep-metric">
                  <span className="prep-metric__label">{metric.label}</span>
                  <span
                    className="prep-metric__value"
                    data-unknown={metric.state === 'a_verifier' ? 'true' : undefined}
                  >
                    {metric.formatted}
                  </span>
                            {metric.note ? (
                              <span className="prep-metric__note">{metric.note}</span>
                            ) : null}
                </div>
              ))}
            </div>

            <div className="prep-programme">
              <div className="prep-programme__list">
                {visibleDays.map((day) => (
                  <section key={day} className="prep-programme__day">
                    <header className="prep-programme__dayhead">
                      <span className="prep-programme__daylabel">Jour {day}</span>
                      <span className="prep-programme__weather">
                        {(() => {
                          const parts = weatherParts(model.weather[day - 1] ?? null);
                          return (
                            <>
                              <span className="prep-programme__sky">{parts.condition}</span>
                              {parts.measures ? (
                                <span className="prep-programme__measures">{parts.measures}</span>
                              ) : null}
                            </>
                          );
                        })()}
                      </span>
                    </header>
                    <div className="prep-programme__daymetrics">
                      {dayMetrics(model, day).map((metric) => (
                          <div key={metric.id} className="prep-metric prep-metric--jour">
                            <span className="prep-metric__label">{metric.label}</span>
                            <span
                              className="prep-metric__value"
                              data-unknown={metric.state === 'a_verifier' ? 'true' : undefined}
                            >
                              {metric.formatted}
                            </span>
                            {metric.note ? (
                              <span className="prep-metric__note">{metric.note}</span>
                            ) : null}
                          </div>
                        ))}
                    </div>
                    <ul className="prep-programme__steps">
                      {daySteps(model, day).map((item) => (
                        <li key={item.id} className="prep-programme__step">
                          <Icon name={item.icon || 'map-pin'} size={16} aria-hidden="true" />
                          <span className="prep-programme__steptitle">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </>
        )}

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
          <PrepMap name={title} routeCoords={routeCoords(draft, model)} scopeLabel="Ensemble" />
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
          onClick={saveCurrentAdventure}
          icon={save === 'saved' ? <Icon name="check" size={20} aria-hidden="true" /> : undefined}
          style={{ width: '100%' }}
        >
          {save === 'saved' ? 'Enregistré' : 'Enregistrer mon aventure'}
        </Button>
      </div>
    </div>
  );
}
