'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  CollectionSearchHit,
  CollectionView,
  EditorialGuide,
  InspirationRecommendation,
  ParkPerimeter,
  RouteRef,
} from '@/features/highlights';
import {
  CollectionDrawer,
  CollectionsPanel,
  GuideDrawer,
  InspirationRail,
} from '@/components/highlights';

interface DiscoverPayload {
  recommendations: InspirationRecommendation[];
  guides: EditorialGuide[];
  editorialCollections: CollectionView[];
  park: ParkPerimeter | null;
  parkRoutes: RouteRef[];
}

/**
 * C03 dans Explorer Communauté (Carnets#Découvrir) :
 * - K1.10 : InspirationRail personnalisée
 * - K1.11 / K1.12 : Guides éditoriaux + recherche dans un parc
 * - K5.16 / K5.17 / K5.18 : Collections éditoriales & personnelles partageables
 */
export function C03DiscoverSection() {
  const [discover, setDiscover] = useState<DiscoverPayload | null>(null);
  const [collectionsQuery, setCollectionsQuery] = useState('');
  const [collectionHits, setCollectionHits] = useState<CollectionSearchHit[]>([]);
  const [activeGuide, setActiveGuide] = useState<EditorialGuide | null>(null);
  const [activeCollection, setActiveCollection] = useState<CollectionView | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const loadDiscover = useCallback(async () => {
    try {
      const res = await fetch('/api/highlights/discover', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setDiscover((await res.json()) as DiscoverPayload);
      }
    } catch {
      /* état vide honnête */
    }
  }, []);

  const loadCollections = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/collections?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        items?: CollectionView[];
        hits?: CollectionSearchHit[];
      };
      if (Array.isArray(json.hits)) {
        setCollectionHits(json.hits);
      } else {
        setCollectionHits(
          (json.items ?? []).map((collection) => ({
            collection,
            score: 1,
            reason: 'title' as const,
          })),
        );
      }
    } catch {
      /* fail-closed */
    }
  }, []);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

  useEffect(() => {
    void loadCollections(collectionsQuery);
  }, [collectionsQuery, loadCollections]);

  const mutateCollection = async (body: Record<string, unknown>, okMessage: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            collection?: CollectionView;
            link?: { id?: string; token?: string };
            path?: string;
            error?: string;
          }
        | null;
      if (!res.ok) {
        setFeedback({
          tone: 'error',
          message:
            res.status === 401
              ? 'Connecte-toi pour modifier ou partager cette collection.'
              : json?.error ?? 'Action refusée.',
        });
        return;
      }
      if (json?.collection) setActiveCollection(json.collection);
      const sharePath =
        json?.path ??
        (json?.link?.token ? `/h/c/${encodeURIComponent(json.link.token)}` : null);
      setFeedback({
        tone: 'success',
        message: sharePath ? `${okMessage} (${sharePath})` : okMessage,
      });
      await loadCollections(collectionsQuery);
    } finally {
      setBusy(false);
    }
  };

  if (activeGuide) {
    return (
      <div style={{ marginBottom: 14 }}>
        <GuideDrawer
          guide={activeGuide}
          onClose={() => setActiveGuide(null)}
          park={discover?.park ?? undefined}
          parkRoutes={discover?.parkRoutes ?? []}
        />
      </div>
    );
  }

  if (activeCollection) {
    return (
      <div style={{ marginBottom: 14 }}>
        <CollectionDrawer
          collection={activeCollection}
          onClose={() => {
            setActiveCollection(null);
            setFeedback(null);
          }}
          feedback={feedback}
          busy={busy}
          onMove={(itemId, direction) =>
            void mutateCollection(
              { action: 'move_item', collectionId: activeCollection.id, itemId, direction },
              'Ordre mis à jour.',
            )
          }
          onRemove={(itemId) =>
            void mutateCollection(
              { action: 'remove_item', collectionId: activeCollection.id, itemId },
              'Élément retiré.',
            )
          }
          onVisibility={(visibility) =>
            void mutateCollection(
              { action: 'visibility', collectionId: activeCollection.id, visibility },
              'Visibilité mise à jour.',
            )
          }
          onShare={() =>
            void mutateCollection(
              { action: 'share', collectionId: activeCollection.id, expiresInHours: 168 },
              'Lien de partage généré.',
            )
          }
          onRevoke={(linkId) =>
            void mutateCollection(
              { action: 'revoke_share', collectionId: activeCollection.id, linkId },
              'Lien révoqué.',
            )
          }
        />
      </div>
    );
  }

  const allGuides = discover?.guides ?? [];
  const allCollections = [
    ...collectionHits,
    ...(discover?.editorialCollections ?? [])
      .filter((col) => !collectionHits.some((h) => h.collection.id === col.id))
      .map((collection) => ({
        collection,
        score: 0.5,
        reason: 'theme' as const,
      })),
  ];

  return (
    <section
      aria-label="Inspiration, guides et collections"
      style={{ display: 'grid', gap: 12, marginBottom: 16 }}
    >
      <InspirationRail
        recommendations={discover?.recommendations ?? []}
        onOpen={(candidateId) => {
          const hit = allCollections.find((h) => h.collection.id === candidateId);
          if (hit) setActiveCollection(hit.collection);
          else if (allGuides[0]) setActiveGuide(allGuides[0]);
        }}
      />

      {allGuides.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {allGuides.map((guide) => (
            <button
              key={guide.id}
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => setActiveGuide(guide)}
            >
              Guide · {guide.title}
            </button>
          ))}
        </div>
      ) : null}

      <CollectionsPanel
        hits={allCollections}
        query={collectionsQuery}
        onQueryChange={setCollectionsQuery}
        onOpen={(collectionId) => {
          const hit = allCollections.find((h) => h.collection.id === collectionId);
          if (hit) setActiveCollection(hit.collection);
        }}
      />
    </section>
  );
}
