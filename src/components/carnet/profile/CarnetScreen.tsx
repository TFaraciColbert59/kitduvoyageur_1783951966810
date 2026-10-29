'use client';

import React, { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReportSheet from '@/components/social/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetTopBar } from './CarnetTopBar';
import { CarnetCard } from './CarnetCard';
import { CarnetDrawer, type CarnetDrawerId } from './CarnetDrawer';
import type { CarnetPageId } from './CarnetPages';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetPostSheet } from './CarnetPostSheet';
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

  const requireAuth = useCallback(() => {
    toast(user?.id ? 'Créez un compte pour enregistrer ou commenter.' : 'Connectez-vous pour continuer.', 'info');
    router.push(`/connexion?next=/carnets/${detail.id}`);
  }, [detail.id, router, toast, user?.id]);

  /* Export JSON du carnet, déclenché depuis la page Gérer. */
  const exportCarnet = useCallback(() => {
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${detail.title.replace(/[^a-zA-Z0-9]/g, '_')}-carnet.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Carnet exporté.', 'success');
  }, [detail, toast]);

  const engagement = useCarnetEngagement({
    carnetId: detail.id,
    initial: detail.engagement,
    userId: currentUserId,
    onRequireAuth: requireAuth,
  });
  const comments = useCarnetComments({ carnetId: detail.id, user });

  // Lien « commentaires » d'une tuile de la Communauté : ouvre directement la page des commentaires.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('commentaires') === '1') setPage('comments');
  }, []);

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

  /* Handlers passés aux listes et aux composants mémoïsés : identité stable,
     donc aucun rendu en cascade quand l'engagement ou les commentaires bougent.
     Le changement de page du carrousel est une transition : interruptible,
     sans bloquer le geste, rendu visible inchangé. */
  const openPage = useCallback((next: CarnetPageId) => {
    startTransition(() => setPage(next));
  }, []);

  const openCarnetFromTopBar = useCallback(() => openPage('etapes'), [openPage]);
  const openCarnetFromCard = useCallback(() => openPage('parcours'), [openPage]);
  const openManagePage = useCallback(() => openPage('manage'), [openPage]);
  const openPost = useCallback((next: number) => setPostIndex(next), []);
  const closePost = useCallback(() => setPostIndex(null), []);
  const openViewer = useCallback((next: number) => setViewerIndex(next), []);
  const closeViewer = useCallback(() => setViewerIndex(null), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const openShare = useCallback(() => setDrawer('share'), []);
  const openReport = useCallback(() => setReportOpen(true), []);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((value) => !value), []);
  const copied = useCallback(() => toast('Lien copié.', 'success'), [toast]);

  /* Sous-onglet des statistiques : même transition que la page du carrousel. */
  const changeStatTab = useCallback((next: CarnetStatsTab) => {
    startTransition(() => setStatTab(next));
  }, []);

  const openStat = useCallback((target: CarnetStatsTab) => {
    setStatTab(target);
    setDrawer('stats');
  }, []);

  /* Ces deux bascules viennent du hook : on ne dépend que des fonctions,
     jamais de l'objet retourné (recréé à chaque rendu). */
  const { toggleLike: toggleLikeNow, toggleFavorite: toggleFavoriteNow } = engagement;
  const toggleLike = useCallback(() => void toggleLikeNow(), [toggleLikeNow]);
  const toggleFavorite = useCallback(() => void toggleFavoriteNow(), [toggleFavoriteNow]);

  /* Objet stable de la bascule J’aime : sans lui, chaque rendu de l'écran
     recréait la prop et la page J’aime se redessinait pour rien. */
  const likeState = useMemo(
    () => ({ liked: engagement.liked, count: engagement.likes, onToggle: toggleLike }),
    [engagement.liked, engagement.likes, toggleLike],
  );

  const copyLink = useCallback(() => {
    void navigator.clipboard.writeText(shareUrl);
    toast('Lien copié.', 'success');
  }, [shareUrl, toast]);

  const handleDownloadGpx = useCallback(
    () => downloadGpx(detail.title, detail.trace),
    [detail.title, detail.trace],
  );

  const goToCarnets = useCallback(() => router.push('/carnets'), [router]);
  const goToNewCarnet = useCallback(() => router.push('/carnets/nouveau'), [router]);

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
          onOpenCarnet={openCarnetFromTopBar}
          onCreate={goToNewCarnet}
          menuOpen={menuOpen}
          onOpenMenu={toggleMenu}
          menu={
            <CarnetMoreMenu
              open={menuOpen}
              saved={engagement.favorited}
              isOwner={detail.isOwner}
              onSave={toggleFavorite}
              onShare={openShare}
              onCopy={copyLink}
              onReport={openReport}
              onManage={openManagePage}
              onClose={closeMenu}
            />
          }
        />
      </header>

      <main className="ckp-screen-body">
        {drawer ? (
          <CarnetDrawer drawer={drawer} onDrawerChange={setDrawer} onClose={closeDrawer}>
            {drawer === 'stats' ? (
              <CarnetStatsPane detail={detailView} tab={statTab} onTabChange={changeStatTab} />
            ) : null}
            {drawer === 'share' ? (
              <CarnetSharePane url={shareUrl} title={detail.title} onCopied={copied} />
            ) : null}
          </CarnetDrawer>
        ) : (
          <CarnetCard
            detail={detailView}
            page={page}
            onPageChange={openPage}
            canWrite={canWrite}
            onRequireAuth={requireAuth}
            onOpenCarnet={openCarnetFromCard}
            onOpenStat={openStat}
            onOpenPost={openPost}
            onDownloadGpx={handleDownloadGpx}
            likesPage={
              <CarnetLikesPane
                detail={detailView}
                currentUserId={currentUserId}
                like={likeState}
              />
            }
            commentsPage={
              <CarnetCommentsPane
                comments={comments.comments}
                loading={comments.loading}
                canWrite={canWrite}
                currentUserId={currentUserId}
                onSend={comments.send}
                onRemove={comments.remove}
                onRequireAuth={requireAuth}
              />
            }
            managePage={
              detail.isOwner ? (
                <CarnetManagePane
                  detail={detailView}
                  url={shareUrl}
                  onExport={exportCarnet}
                  onDeleted={goToCarnets}
                />
              ) : null
            }
          />
        )}
        <CarnetMapCard detail={detailView} />
      </main>

      {/* Le post du moment est une feuille superposée à la carte, exactement
          comme le post du Compte : la carte reste montée dessous. */}
      {postIndex !== null ? (
        <CarnetPostSheet
          detail={detailView}
          index={postIndex}
          onIndexChange={openPost}
          onClose={closePost}
          comments={comments}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onRequireAuth={requireAuth}
          onOpenViewer={openViewer}
          onLike={toggleLike}
          shareUrl={shareUrl}
          onCopied={copied}
          saved={engagement.favorited}
          onSave={toggleFavorite}
          onReport={openReport}
        />
      ) : null}

      {viewerIndex !== null ? (
        <CarnetMediaViewer
          items={detail.photoMoments}
          index={viewerIndex}
          onIndexChange={openViewer}
          onClose={closeViewer}
        />
      ) : null}

      <ReportSheet
        isOpen={reportOpen}
        onClose={closeReport}
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
