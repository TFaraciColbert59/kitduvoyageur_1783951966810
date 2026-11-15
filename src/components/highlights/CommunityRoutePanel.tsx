'use client';

import React from 'react';
import type { RouteCommunityMedia, RouteCommunitySummary } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  chipStyle,
  helperStyle,
  labelStyle,
  photoGridStyle,
  photoStyle,
  rowStyle,
  sectionGapStyle,
} from './styles';

export interface CommunityRoutePanelProps {
  routeTitle: string;
  summary: RouteCommunitySummary;
  media: RouteCommunityMedia;
  onClose: () => void;
  onOpenPhoto?: (photoId: string) => void;
}

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${minutes} min`;
}

/**
 * S3.05 / S3.24 — descriptions, tags, photos publiques et activités récentes
 * d'une fiche parcours. Une activité qui masque ses statistiques affiche
 * « masquées » : on ne reconstitue jamais la valeur.
 */
export function CommunityRoutePanel({
  routeTitle,
  summary,
  media,
  onClose,
  onOpenPhoto,
}: CommunityRoutePanelProps) {
  return (
    <DrawerFrame
      eyebrow="Communauté du parcours"
      title={routeTitle}
      subtitle={`${summary.sourceCount} contributeur${summary.sourceCount > 1 ? 's' : ''}`}
      onClose={onClose}
      testId="community-route-panel"
    >
      <div style={sectionGapStyle}>
        {summary.tags.length > 0 ? (
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
            aria-label="Tags communautaires"
          >
            {summary.tags.map((tag) => (
              <span key={tag.tag} style={chipStyle}>
                #{tag.tag} · {tag.sources}
              </span>
            ))}
          </div>
        ) : (
          <p style={helperStyle}>Pas encore assez d’observations pour des tags fiables.</p>
        )}

        <section aria-label="Description communautaire">
          <p style={labelStyle}>Description</p>
          {summary.description ? (
            <p style={bodyStyle}>{summary.description}</p>
          ) : (
            <p style={helperStyle}>Aucune description publique.</p>
          )}
        </section>

        <section aria-label="Photos publiques">
          <p style={labelStyle}>Photos ({media.photos.length})</p>
          {media.photos.length === 0 ? (
            <p style={helperStyle}>Aucune photo publique.</p>
          ) : (
            <div style={photoGridStyle}>
              {media.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPhoto?.(photo.id)}
                  style={{
                    border: 0,
                    padding: 0,
                    background: 'transparent',
                    cursor: onOpenPhoto ? 'pointer' : 'default',
                  }}
                  aria-label={photo.caption ?? 'Ouvrir la photo'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Photo du parcours'}
                    style={photoStyle}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Activités récentes">
          <p style={labelStyle}>Activités récentes</p>
          {media.activities.length === 0 ? (
            <p style={helperStyle}>Aucune activité publique récente.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {media.activities.map((activity) => (
                <li key={activity.id} style={rowStyle}>
                  <div>
                    <p style={{ ...bodyStyle, fontWeight: 600 }}>{activity.displayName}</p>
                    <p style={helperStyle}>
                      {new Date(activity.date).toLocaleDateString('fr-FR')} · {activity.sport}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={bodyStyle}>
                      {activity.distanceKm != null
                        ? `${activity.distanceKm.toFixed(1)} km`
                        : 'Distance masquée'}
                    </p>
                    <p style={helperStyle}>
                      {activity.durationS != null ? duration(activity.durationS) : 'Durée masquée'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DrawerFrame>
  );
}
