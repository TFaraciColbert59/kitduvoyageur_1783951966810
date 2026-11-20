'use client';

import React, { useMemo } from 'react';
import { Camera, Clock, Flag, Quote } from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetMomentItem,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import {
  CarnetHorizontalTimeline,
  type HorizontalTimelineDayGroup,
  type HorizontalTimelineEvent,
  type HorizontalTimelineKind,
} from './CarnetHorizontalTimeline';

interface CarnetFilDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onSelectMoment?: (moment: CarnetMomentItem, index: number) => void;
  onSelectEtape?: (etape: CarnetEtapeDay) => void;
  onSelectNight?: (night: CarnetNightItem) => void;
}

const SPECIES_MATCHERS: Array<{ re: RegExp; label: string }> = [
  { re: /bouquetin|capra|ibex/i, label: 'Pokédex · Bouquetin' },
  { re: /marmotte|marmota/i, label: 'Pokédex · Marmotte' },
  { re: /chamois|rupicapra/i, label: 'Pokédex · Chamois' },
  { re: /gypaète|gypaete|rapace/i, label: 'Pokédex · Gypaète' },
  { re: /edelweiss|leontopodium/i, label: 'Pokédex · Edelweiss' },
  { re: /gentiane/i, label: 'Pokédex · Gentiane' },
  { re: /glacier|sérac|serac|névé/i, label: 'Pokédex · Glacier' },
  { re: /lac/i, label: 'Pokédex · Lac alpin' },
];

function classifyMoment(m: CarnetMomentItem): { kind: HorizontalTimelineKind; badge: string } {
  const text = `${m.quote ?? ''} ${m.place ?? ''}`;
  for (const sp of SPECIES_MATCHERS) {
    if (sp.re.test(text)) {
      return { kind: 'pokedex', badge: sp.label };
    }
  }
  if (
    m.source?.toLowerCase().includes('nature') ||
    m.source?.toLowerCase().includes('species')
  ) {
    return { kind: 'pokedex', badge: 'Pokédex' };
  }
  if (/croisé|rencontré|traileur|randonneur|refuge|échange/i.test(text)) {
    return { kind: 'rencontre', badge: 'Rencontre' };
  }
  return { kind: 'moment', badge: m.imageUrl ? 'Photo' : 'Moment' };
}

export function CarnetFilDrawerBody({
  detail,
  lensId,
  onSelectMoment,
  onSelectEtape,
  onSelectNight,
}: CarnetFilDrawerBodyProps) {
  const availableDays = useMemo(() => {
    const nums = new Set<number>();
    for (const m of detail.moments) if (m.dayNumber) nums.add(m.dayNumber);
    for (const e of detail.etapes) if (e.dayNumber) nums.add(e.dayNumber);
    for (const n of detail.nights ?? []) if (n.dayNumber) nums.add(n.dayNumber);
    return Array.from(nums).sort((a, b) => a - b);
  }, [detail.moments, detail.etapes, detail.nights]);

  const timelineGroups = useMemo<HorizontalTimelineDayGroup[]>(() => {
    const days = availableDays.length > 0 ? availableDays : [1];
    return days.map((day) => {
      const events: HorizontalTimelineEvent[] = [];
      const etape = detail.etapes.find((e) => e.dayNumber === day);
      const dayStats = detail.days.find((d) => (d.dayNumber ?? d.index) === day);

      if (etape || (dayStats && (dayStats.distanceKm || dayStats.elevationM))) {
        const km = etape?.distanceKm ?? dayStats?.distanceKm ?? null;
        const elev = etape?.elevationM ?? dayStats?.elevationM ?? null;
        const dur = etape?.durationText ?? null;
        const parts = [
          km ? `${Number(km).toFixed(1)} km` : null,
          elev ? `+${Math.round(elev)} m` : null,
          dur,
        ].filter(Boolean);
        events.push({
          id: `perf-${day}`,
          day,
          kind: 'perf',
          badge: 'Performance',
          timeLabel: 'Étape',
          title: etape?.from && etape?.to ? `${etape.from} → ${etape.to}` : `Étape J${day}`,
          subtitle: parts.join(' · ') || etape?.weather || 'Trace du jour',
          onClick: etape && onSelectEtape ? () => onSelectEtape(etape) : undefined,
        });
      }

      const dayMoments = detail.moments
        .filter((m) => m.dayNumber === day)
        .slice()
        .sort((a, b) => (a.time ?? '12:00').localeCompare(b.time ?? '12:00'));

      dayMoments.forEach((m, idx) => {
        const { kind, badge } = classifyMoment(m);
        events.push({
          id: `m-${m.id}`,
          day,
          kind,
          badge,
          timeLabel: m.time || `J${day}`,
          title: m.place || m.authorName || 'Sur le sentier',
          subtitle: m.quote || undefined,
          imageUrl: m.imageUrl,
          onClick: onSelectMoment ? () => onSelectMoment(m, idx) : undefined,
        });
      });

      const night = (detail.nights ?? []).find((n) => n.dayNumber === day);
      if (night) {
        events.push({
          id: `night-${night.id}`,
          day,
          kind: 'night',
          badge: night.type === 'bivouac' ? 'Bivouac' : 'Refuge',
          timeLabel: 'Soir',
          title: night.name,
          subtitle: [night.altitudeM ? `${night.altitudeM} m` : null, night.infos]
            .filter(Boolean)
            .join(' · '),
          onClick: onSelectNight ? () => onSelectNight(night) : undefined,
        });
      }

      return {
        day,
        meta: etape?.weather ? etape.weather.split('·')[0].trim() : undefined,
        events,
      };
    });
  }, [
    availableDays,
    detail.days,
    detail.etapes,
    detail.moments,
    detail.nights,
    onSelectEtape,
    onSelectMoment,
    onSelectNight,
  ]);

  if (lensId === 'moments') {
    const hasAnyEvent = timelineGroups.some((g) => g.events.length > 0);
    if (!hasAnyEvent) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Clock size={22} aria-hidden="true" />
          <b>Aucun moment enregistré</b>
          <p>Les étapes, performances, rencontres, espèces et nuits du voyage défileront ici.</p>
        </div>
      );
    }
    return (
      <CarnetHorizontalTimeline
        groups={timelineGroups}
        ariaLabel="Frise chronologique du voyage"
      />
    );
  }

  if (lensId === 'medias') {
    const days = availableDays.length > 0 ? availableDays : [1];
    const mediaGroups: HorizontalTimelineDayGroup[] = days.map((day) => {
      const photos = detail.photoMoments
        .filter((m) => m.dayNumber === day)
        .slice()
        .sort((a, b) => (a.time ?? '12:00').localeCompare(b.time ?? '12:00'));
      return {
        day,
        events: photos.map((m, idx) => ({
          id: `med-${m.id}`,
          day,
          kind: 'moment',
          badge: 'Photo',
          timeLabel: m.time || `J${day}`,
          title: m.place || 'Photo du jour',
          subtitle: m.quote || undefined,
          imageUrl: m.imageUrl,
          onClick: onSelectMoment ? () => onSelectMoment(m, idx) : undefined,
        })),
      };
    });

    if (!mediaGroups.some((g) => g.events.length > 0)) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Camera size={22} aria-hidden="true" />
          <b>Aucune photo partagée</b>
          <p>Les photos du carnet défileront ici chronologiquement par jour.</p>
        </div>
      );
    }

    return (
      <CarnetHorizontalTimeline
        groups={mediaGroups}
        ariaLabel="Frise horizontale des médias"
      />
    );
  }

  if (lensId === 'rencontres') {
    const days = availableDays.length > 0 ? availableDays : [1];
    const rencontreGroups: HorizontalTimelineDayGroup[] = days.map((day) => {
      const items = detail.moments
        .filter(
          (m) =>
            m.dayNumber === day &&
            (Boolean(m.quote?.trim()) || Boolean(m.authorName?.trim())),
        )
        .slice()
        .sort((a, b) => (a.time ?? '12:00').localeCompare(b.time ?? '12:00'));
      return {
        day,
        events: items.map((m, idx) => ({
          id: `ren-${m.id}`,
          day,
          kind: 'rencontre',
          badge: m.authorName || 'Rencontre',
          timeLabel: m.time || `J${day}`,
          title: m.place || 'Sur le sentier',
          subtitle: m.quote ? `« ${m.quote} »` : undefined,
          imageUrl: m.imageUrl,
          onClick: onSelectMoment ? () => onSelectMoment(m, idx) : undefined,
        })),
      };
    });

    if (!rencontreGroups.some((g) => g.events.length > 0)) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Quote size={22} aria-hidden="true" />
          <b>Aucune rencontre notée</b>
          <p>Les citations et visages croisés défileront ici sur la frise.</p>
        </div>
      );
    }

    return (
      <CarnetHorizontalTimeline
        groups={rencontreGroups}
        ariaLabel="Frise horizontale des rencontres"
      />
    );
  }

  return (
    <div className="lkdv-carnet-empty-card">
      <Flag size={22} aria-hidden="true" />
      <b>Carnet de bord</b>
      <p>Retrouvez chaque instant de la sortie.</p>
    </div>
  );
}
