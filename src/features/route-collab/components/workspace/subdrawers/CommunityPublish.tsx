'use client';

import { useMemo, useRef, useState } from 'react';
import { buildPublicRouteShare } from '../../../communityShare';
import { hasRoutePermission } from '../../../permissions';
import { Block, Btn, Note } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';

/**
 * 10.9 : publier la VERSION PUBLIÉE dans la communauté. Propriétaire seulement (droit `route.manage_privacy`,
 * revérifié par le serveur) ; sans version publiée, rien à publier et la ligne le dit. L'aperçu est celui que le
 * serveur construira (`buildPublicRouteShare`) : zone de départ masquée, aucune coordonnée exacte, ni nuit, ni sac,
 * ni membres. Rien ne part avant la confirmation.
 */
type Audience = 'abonnies' | 'public';
type Phase = 'idle' | 'confirm' | 'sending' | 'done' | 'error';

const AUDIENCE_LABEL: Record<Audience, string> = {
  abonnies: 'Mes abonnés',
  public: 'Public',
};

const ERROR_TEXT: Record<string, string> = {
  unauthenticated: 'Connectez-vous pour publier.',
  forbidden: 'Seul le propriétaire de l’itinéraire peut le publier dans la communauté.',
  not_found: 'Itinéraire introuvable côté serveur : enregistrez-le d’abord.',
  no_published: 'Aucune version publiée : publiez d’abord une version.',
  rejected: 'La communauté a refusé cette publication.',
  invalid: 'Demande invalide.',
};

export function CommunityPublish() {
  const { workspace, currentUserId, canManageMembers } = useRouteWorkspace();
  const me = workspace.members.find((m) => m.userId === currentUserId) ?? null;
  const [phase, setPhase] = useState<Phase>('idle');
  const [audience, setAudience] = useState<Audience>('abonnies');
  const [caption, setCaption] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  // Une seule clé d'idempotence par intention : un double clic ou une relance ne publie pas deux fois.
  const requestId = useRef<string | null>(null);
  const share = useMemo(() => buildPublicRouteShare(workspace), [workspace]);

  if (!canManageMembers || !hasRoutePermission(me, 'route.manage_privacy')) return null;

  if (!share) {
    return (
      <Block title="Communauté" testId="community-publish">
        <Note>Aucune version publiée : publiez d’abord une version pour la partager dans la communauté.</Note>
      </Block>
    );
  }

  const send = async () => {
    setPhase('sending');
    if (!requestId.current && typeof crypto !== 'undefined' && 'randomUUID' in crypto) requestId.current = crypto.randomUUID();
    try {
      const res = await fetch('/api/itineraire/share-community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          audience,
          ...(caption.trim() ? { caption: caption.trim() } : {}),
          ...(requestId.current ? { clientRequestId: requestId.current } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; idempotent?: boolean };
      if (res.ok && body.status === 'ok') {
        setMessage(body.idempotent ? 'Déjà publié : aucun doublon créé.' : 'Publié dans la communauté.');
        setPhase('done');
        return;
      }
      setMessage(ERROR_TEXT[body.status ?? ''] ?? 'Publication impossible pour le moment. Réessayez.');
      setPhase('error');
    } catch {
      setMessage('Réseau indisponible : rien n’a été publié. Réessayez.');
      setPhase('error');
    }
  };

  const facts = [
    `${share.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`,
    share.ascentM != null ? `${share.ascentM} m D+` : 'D+ inconnu',
    `${share.stagesCount} étape${share.stagesCount > 1 ? 's' : ''}`,
    `version ${share.revisionNo}`,
  ].join(' · ');

  return (
    <Block title="Communauté" testId="community-publish">
      {phase === 'idle' || phase === 'done' || phase === 'error' ? (
        <>
          {message ? (
            <Note tone={phase === 'error' ? 'warn' : undefined}>
              <span data-testid="community-publish-result" role="status">
                {message}
              </span>
            </Note>
          ) : null}
          {phase !== 'done' ? (
            <Btn testId="community-publish-open" onClick={() => setPhase('confirm')}>
              Publier dans la communauté
            </Btn>
          ) : null}
        </>
      ) : (
        <div data-testid="community-publish-preview">
          <Note>Voici ce que les autres verront de la version v{share.revisionNo} :</Note>
          <ul className="rts-note">
            <li data-testid="community-preview-title">{share.title}</li>
            <li data-testid="community-preview-facts">{facts}</li>
            <li data-testid="community-preview-line">
              {share.line.length > 0 ? `Tracé simplifié (${share.line.length} points)` : 'Aucun tracé : tout le parcours est dans la zone privée'}
            </li>
            <li data-testid="community-preview-mask">
              Zone de départ masquée sur {share.radiusM} m (le départ exact, les nuits, le sac et les membres ne sont jamais publiés)
            </li>
          </ul>
          <label className="rts-field">
            Public concerné
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="rts-field">
            Un mot (facultatif)
            <textarea value={caption} maxLength={2000} rows={3} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <div className="rts-actions">
            <Btn tone="primary" testId="community-publish-confirm" disabled={phase === 'sending'} onClick={() => void send()}>
              {phase === 'sending' ? 'Publication…' : `Confirmer : publier (${AUDIENCE_LABEL[audience].toLowerCase()})`}
            </Btn>
            <Btn testId="community-publish-cancel" disabled={phase === 'sending'} onClick={() => setPhase('idle')}>
              Annuler
            </Btn>
          </div>
        </div>
      )}
    </Block>
  );
}
