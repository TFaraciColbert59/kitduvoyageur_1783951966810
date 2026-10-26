'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import ReportSheet from '@/components/social/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetTopBar } from './CarnetTopBar';
import { CarnetCard, type CarnetPlaceFocus } from './CarnetCard';
import { CarnetDrawer, type CarnetDrawerId } from './CarnetDrawer';
import type { CarnetPageId } from './CarnetPages';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetPostDrawer } from './CarnetPostDrawer';
import { CarnetMapCard } from './CarnetMapCard';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { CarnetStatsPane } from './panes/CarnetStatsPane';
import { CarnetLikesPane } from './panes/CarnetLikesPane';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import { CarnetSharePane } from './panes/CarnetSharePane';
import { CarnetManagePane } from './panes/CarnetManagePane';
import { downloadGpx } from './downloadGpx';

export interface CarnetScreenProps {
  detail: CarnetDetail;
}

/** Fiche carnet : écran verrouillé, la carte est la seule surface. */
export function CarnetScreen({ detail }: CarnetScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [drawer, setDrawer] = useState<CarnetDrawerId | null>(null);
  /** Sous-onglet du sous-drawer statistiques, choisi par la stat cliquée. */
  const [statTab, setStatTab] = useState<CarnetStatsTab>('distance');
  /** Page du carrousel média, gardée pendant la session de l'écran. */
  const [page, setPage] = useState<CarnetPageId>('posts');
  const [postIndex, setPostIndex] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<CarnetPlaceFocus | null>(null);

  const requireAuth = useCallback(() => {
    toast(user?.id ? 'Créez un compte pour enregistrer ou commenter.' : 'Connectez-vous pour continuer.', 'info');
    router.push(`/connexion?next=/carnets/${detail.id}`);
  }, [detail.id, router, toast, user?.id]);

  const engagement = useCarnetEngagement({
    carnetId: detail.id,
    initial: detail.engagement,
    userId: currentUserId,
    onRequireAuth: requireAuth,
  });
  const comments = useCarnetComments({ carnetId: detail.id, user });

  useEffect(() => {
    void engagement.registerView();
  }, [engagement.registerView]);

  const detailView = useMemo(
    () => ({
      ...detail,
      engagement: {
        ...detail.engagement,
        liked: engagement.liked,
        likes: engagement.likes,
        favorited: engagement.favorited,
      },
    }),
    [detail, engagement.favorited, engagement.liked, engagement.likes],
  );

  const shareUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/carnets/${detail.id}`),
    [detail.id],
  );

  const openStat = (target: CarnetStatsTab) => {
    setStatTab(target);
    setDrawer('stats');
  };

  /* La couverture du carnet est le fond de page, derrière un voile dégradé qui
     garde le texte lisible. Sans couverture — ou si l'URL ne se charge pas
     (404, hôte bloqué) — le canvas vert du Compte reste visible tel quel. */
  const coverUrl = useMemo(() => detail.coverImage?.trim() || null, [detail.coverImage]);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    if (!coverUrl) return;
    let alive = true;
    setCoverFailed(false);
    const probe = new window.Image();
    probe.onerror = () => {
      if (alive) setCoverFailed(true);
    };
    probe.src = coverUrl;
    return () => {
      alive = false;
    };
  }, [coverUrl]);

  const showCover = Boolean(coverUrl) && !coverFailed;
  const coverCss = useMemo(
    () => (coverUrl ? { backgroundImage: `url("${coverUrl.replace(/["\\]/g, '')}")` } : undefined),
    [coverUrl],
  );

  return (
    <div className="ckp-screen lkdv-account-glass" data-type-scale="compte">
      <header className="ckp-screen-header">
        <CarnetTopBar
          title={detail.title}
          onOpenCarnet={() => setPage('etapes')}
          onCreate={() => router.push('/carnets/nouveau')}
          onSearch={() => router.push('/communaute')}
        />
      </header>

      <main className="ckp-screen-body">
        {drawer ? (
          <CarnetDrawer detail={detailView} drawer={drawer} onDrawerChange={setDrawer} onClose={() => setDrawer(null)}>
            {drawer === 'stats' ? (
              <CarnetStatsPane detail={detailView} tab={statTab} onTabChange={setStatTab} />
            ) : null}
            {drawer === 'comments' ? (
              <CarnetCommentsPane
                comments={comments.comments}
                loading={comments.loading}
                canWrite={canWrite}
                currentUserId={currentUserId}
                onSend={comments.send}
                onRemove={comments.remove}
                onRequireAuth={requireAuth}
              />
            ) : null}
            {drawer === 'likes' ? <CarnetLikesPane detail={detailView} currentUserId={currentUserId} /> : null}
            {drawer === 'share' ? (
              <CarnetSharePane
                url={shareUrl}
                title={detail.title}
                onCopied={() => toast('Lien copié.', 'success')}
              />
            ) : null}
            {drawer === 'manage' ? (
              <CarnetManagePane
                detail={detailView}
                url={shareUrl}
                onExport={() => {
                  const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `${detail.title.replace(/[^a-zA-Z0-9]/g, '_')}-carnet.json`;
                  link.click();
                  URL.revokeObjectURL(link.href);
                  toast('Carnet exporté.', 'success');
                }}
                onDeleted={() => router.push('/carnets')}
              />
            ) : null}
          </CarnetDrawer>
        ) : postIndex !== null ? (
          <CarnetPostDrawer
            detail={detailView}
            index={postIndex}
            onIndexChange={setPostIndex}
            onClose={() => setPostIndex(null)}
            comments={comments}
            canWrite={canWrite}
            currentUserId={currentUserId}
            onRequireAuth={requireAuth}
            onOpenViewer={setViewerIndex}
            onLike={() => void engagement.toggleLike()}
            onShare={() => setDrawer('share')}
          />
        ) : (
          <>
            <CarnetCard
            detail={detailView}
            page={page}
            onPageChange={setPage}
            canWrite={canWrite}
            onRequireAuth={requireAuth}
            onOpenCarnet={() => setPage('parcours')}
            onOpenStat={openStat}
            onOpenComments={() => setDrawer('comments')}
            onOpenLikes={() => setDrawer('likes')}
            onOpenParcours={() => setPage('parcours')}
            onOpenManage={() => setDrawer('manage')}
            onLike={() => void engagement.toggleLike()}
            onSave={() => void engagement.toggleFavorite()}
            onOpenMenu={() => setMenuOpen((value) => !value)}
            onFocusPlace={setMapFocus}
            menu={
              <CarnetMoreMenu
                open={menuOpen}
                saved={engagement.favorited}
                isOwner={detail.isOwner}
                onSave={() => void engagement.toggleFavorite()}
                onShare={() => setDrawer('share')}
                onCopy={() => {
                  void navigator.clipboard.writeText(shareUrl);
                  toast('Lien copié.', 'success');
                }}
                onReport={() => setReportOpen(true)}
                onManage={() => setDrawer('manage')}
                onClose={() => setMenuOpen(false)}
              />
            }
            onOpenPost={(index) => setPostIndex(index)}
            onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
          />
          </>
        )}
        <CarnetMapCard detail={detailView} focus={mapFocus} />
      </main>

      <AccountBottomBar />

      {viewerIndex !== null ? (
        <CarnetMediaViewer
          items={detail.photoMoments}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}

      <ReportSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={detail.id}
        contentType="carnet"
        onSubmitReport={async (reason, details) => {
          if (!currentUserId) {
            requireAuth();
            return;
          }
          const { error } = await createClient()
            .from('comment_reports')
            .insert({
              comment_id: detail.id,
              reporter_id: currentUserId,
              reason: details ? `${reason} — ${details}` : reason,
              table_name: 'carnets',
            });
          toast(error ? 'Le signalement n’a pas pu être envoyé.' : 'Signalement envoyé. Merci.', error ? 'error' : 'success');
          setReportOpen(false);
        }}
      />
    </div>
  );
}

export default CarnetScreen;
