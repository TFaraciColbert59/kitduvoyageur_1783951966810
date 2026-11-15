'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  HighlightView,
  RouteCommunityMedia,
  RouteCommunitySummary,
  StreetViewResult,
  TrailPhotoMarker,
} from '@/features/highlights';
import {
  CommunityRoutePanel,
  HighlightComposer,
  HighlightDrawer,
  StreetViewPanel,
  TrailViewPanel,
  type HighlightDraft,
} from '@/components/highlights';
import { XpEmpty, XpEyebrow, XpRow, XpRows } from './blocks';
import type { SheetContext } from './context';

type SubView =
  | null
  | { kind: 'composer' }
  | { kind: 'highlight'; highlight: HighlightView }
  | { kind: 'streetview' }
  | { kind: 'trailview' }
  | { kind: 'community' };

interface RouteMediaPayload {
  streetView: StreetViewResult;
  trailMarkers: TrailPhotoMarker[];
  communityMedia: RouteCommunityMedia;
  communitySummary: RouteCommunitySummary;
}

/**
 * C03 dans le tiroir d'un itinéraire (ToolsTabs 'trail') :
 * - K5.13/K5.14/K5.15 : Highlights sur le parcours + composer + vote + conseil + photo + sauvegarde
 * - K2.25/K2.26 : Vue de rue (et repli Trail View sans coordonnée)
 * - S3.05/S3.24 : Médias communauté et tags multi-sources du parcours
 */
export function TrailCommunityPanel({
  ctx,
  routeId,
  routeTitle,
  routeLat,
  routeLng,
}: {
  ctx: SheetContext;
  routeId: string;
  routeTitle: string;
  routeLat: number | null;
  routeLng: number | null;
}) {
  const [highlights, setHighlights] = useState<HighlightView[]>([]);
  const [routeMedia, setRouteMedia] = useState<RouteMediaPayload | null>(null);
  const [subView, setSubView] = useState<SubView>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [obsText, setObsText] = useState('');
  const [obsTags, setObsTags] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [hlRes, rmRes] = await Promise.all([
        fetch(`/api/highlights?targetId=${encodeURIComponent(routeId)}`, {
          headers: { Accept: 'application/json' },
        }),
        fetch(
          `/api/highlights/route-media?routeId=${encodeURIComponent(routeId)}${
            routeLat !== null && routeLng !== null ? `&lat=${routeLat}&lng=${routeLng}` : ''
          }`,
          { headers: { Accept: 'application/json' } },
        ),
      ]);
      if (hlRes.ok) {
        const hlJson = (await hlRes.json()) as { items?: HighlightView[] };
        setHighlights(hlJson.items ?? []);
      }
      if (rmRes.ok) {
        const rmJson = (await rmRes.json()) as RouteMediaPayload;
        setRouteMedia(rmJson);
      }
    } catch {
      /* fail-closed : conserve l'état vide */
    }
  }, [routeId, routeLat, routeLng]);

  useEffect(() => {
    setSubView(null);
    setFeedback(null);
    void loadData();
  }, [loadData]);

  const handleCreateHighlight = async (draft: HighlightDraft) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          kind: draft.kind,
          targetType: 'route',
          targetId: routeId,
          title: draft.title,
          description: draft.description,
          sport: draft.sport,
          areaLabel: draft.areaLabel,
          lat: routeLat,
          lng: routeLng,
          audience: draft.audience,
          hideExactLocation: draft.hideExactLocation,
          hidePhotos: draft.hidePhotos,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { highlight?: HighlightView; error?: string }
        | null;
      if (!res.ok || !json?.highlight) {
        setFeedback({
          tone: 'error',
          message:
            res.status === 401
              ? 'Connecte-toi pour publier un Highlight.'
              : json?.error ?? 'Création impossible.',
        });
      } else {
        setHighlights((prev) => [json.highlight!, ...prev]);
        setSubView({ kind: 'highlight', highlight: json.highlight });
        setFeedback({ tone: 'success', message: 'Highlight créé.' });
      }
    } catch {
      setFeedback({ tone: 'error', message: 'Réseau indisponible.' });
    } finally {
      setBusy(false);
    }
  };

  const mutateHighlight = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { highlight?: HighlightView; error?: string }
        | null;
      if (!res.ok || !json?.highlight) {
        setFeedback({
          tone: 'error',
          message:
            res.status === 401
              ? 'Connecte-toi pour contribuer.'
              : json?.error ?? 'Action refusée.',
        });
      } else {
        const updated = json.highlight;
        setHighlights((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSubView({ kind: 'highlight', highlight: updated });
        setFeedback({ tone: 'success', message: successMsg });
      }
    } catch {
      setFeedback({ tone: 'error', message: 'Réseau indisponible.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveHighlight = async (hl: HighlightView) => {
    if (hl.location) {
      ctx.state.toggleSavedPlace({
        id: `highlight:${hl.id}`,
        name: hl.title,
        kind: 'highlight',
        lat: hl.location.lat,
        lng: hl.location.lng,
      });
    }
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_highlight_to_places',
          highlightId: hl.id,
          title: hl.title,
        }),
      });
      if (res.ok) {
        setFeedback({ tone: 'success', message: 'Enregistré dans « Mes lieux ».' });
      } else if (res.status === 401) {
        setFeedback({ tone: 'success', message: 'Enregistré dans tes lieux locaux sur cet appareil.' });
      }
    } catch {
      setFeedback({ tone: 'success', message: 'Enregistré dans tes lieux locaux.' });
    }
  };

  const handleSubmitObservation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (obsText.trim().length < 3) return;
    setBusy(true);
    try {
      const tags = obsTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/highlights/route-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          text: obsText.trim(),
          tags,
          audience: 'public',
          consentAggregate: true,
        }),
      });
      if (res.ok) {
        setObsText('');
        setObsTags('');
        setFeedback({ tone: 'success', message: 'Retour terrain ajouté.' });
        await loadData();
      } else {
        setFeedback({
          tone: 'error',
          message: res.status === 401 ? 'Connecte-toi pour publier un avis terrain.' : 'Envoi refusé.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (subView?.kind === 'composer') {
    return (
      <HighlightComposer
        kind="place"
        targetLabel={routeTitle}
        defaultArea={ctx.place?.place?.regionName ?? 'Secteur'}
        hasLocation={routeLat !== null && routeLng !== null}
        onClose={() => setSubView(null)}
        onSubmit={handleCreateHighlight}
        feedback={feedback}
        busy={busy}
      />
    );
  }

  if (subView?.kind === 'highlight') {
    const hl = subView.highlight;
    const isSaved = (ctx.state.savedPlaces ?? []).some((p) => p.id === `highlight:${hl.id}`);
    return (
      <HighlightDrawer
        highlight={hl}
        onClose={() => setSubView(null)}
        saved={isSaved}
        feedback={feedback}
        busy={busy}
        onVote={(value) => void mutateHighlight({ action: 'vote', highlightId: hl.id, value }, 'Vote enregistré.')}
        onSave={() => void handleSaveHighlight(hl)}
        onContributeTip={(body) =>
          void mutateHighlight({ action: 'tip', highlightId: hl.id, body }, 'Conseil publié.')
        }
        onContributePhoto={(input) =>
          void mutateHighlight(
            {
              action: 'photo',
              highlightId: hl.id,
              url: input.url,
              caption: input.caption,
              exifStripped: input.exifStripped,
              consentPublic: input.consentPublic,
            },
            'Photo ajoutée.',
          )
        }
      />
    );
  }

  if (subView?.kind === 'streetview' && routeMedia) {
    return (
      <StreetViewPanel
        result={routeMedia.streetView}
        onClose={() => setSubView(null)}
        onFallback={() => setSubView({ kind: 'trailview' })}
      />
    );
  }

  if (subView?.kind === 'trailview' && routeMedia) {
    return (
      <TrailViewPanel
        routeTitle={routeTitle}
        markers={routeMedia.trailMarkers}
        onClose={() => setSubView(null)}
      />
    );
  }

  if (subView?.kind === 'community' && routeMedia) {
    return (
      <>
        <CommunityRoutePanel
          routeTitle={routeTitle}
          summary={routeMedia.communitySummary}
          media={routeMedia.communityMedia}
          onClose={() => setSubView(null)}
        />
        <form onSubmit={handleSubmitObservation} style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <input
            type="text"
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            placeholder="Ton retour terrain sur ce tracé…"
            minLength={3}
            maxLength={300}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(23,43,36,0.18)',
              font: 'inherit',
            }}
          />
          <input
            type="text"
            value={obsTags}
            onChange={(e) => setObsTags(e.target.value)}
            placeholder="Tags (ex: panoramique, boueux, technique)"
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(23,43,36,0.18)',
              font: 'inherit',
            }}
          />
          <button type="submit" className="xp-chip" disabled={busy}>
            {busy ? 'Publication…' : 'Ajouter un avis et des tags (S3.24)'}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <XpEyebrow>Highlights &amp; vues du parcours (C03)</XpEyebrow>
      <XpRows>
        <XpRow
          icon="spark"
          title="Ajouter un Highlight"
          sub="Point fort, point de vue ou tronçon marquant sur cet itinéraire"
          badge={{ label: 'Créer', tone: 'good' }}
          onClick={() => setSubView({ kind: 'composer' })}
        />
        <XpRow
          icon="eye"
          title="Street View / Trail View"
          sub={
            routeMedia
              ? `${routeMedia.trailMarkers.length} repère${routeMedia.trailMarkers.length > 1 ? 's' : ''} Trail View sur la trace`
              : 'Aperçu visuel du départ et du tracé'
          }
          onClick={() => setSubView({ kind: 'trailview' })}
        />
        <XpRow
          icon="cam"
          title="Vue de rue au point"
          sub="Vérifie la couverture Street View ou bascule sur Trail View"
          onClick={() => setSubView({ kind: 'streetview' })}
        />
        <XpRow
          icon="users"
          title="Médias & tags communauté"
          sub={
            routeMedia
              ? `${routeMedia.communityMedia.photos.length} photos · ${routeMedia.communitySummary.tags.length} tags terrain`
              : 'Descriptions, photos publiques et activités récentes'
          }
          onClick={() => setSubView({ kind: 'community' })}
        />
      </XpRows>

      {highlights.length === 0 ? (
        <XpEmpty
          title="Aucun Highlight publié ici"
          hint="Ajoute le premier point fort ou tronçon remarquable de ce parcours."
        />
      ) : (
        <XpRows>
          {highlights.slice(0, 6).map((hl) => (
            <XpRow
              key={hl.id}
              icon="star"
              tone="good"
              title={hl.title}
              sub={`${hl.areaLabel} · ${hl.tips.length} conseil${hl.tips.length > 1 ? 's' : ''}`}
              badge={{ label: `▲ ${hl.score}`, tone: 'muted' }}
              onClick={() => setSubView({ kind: 'highlight', highlight: hl })}
            />
          ))}
        </XpRows>
      )}
    </>
  );
}
