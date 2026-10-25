'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReportSheet from '@/components/social/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetTopBar } from './CarnetTopBar';
import { CarnetIdentityCard, type CarnetMediaMode } from './CarnetIdentityCard';
import { CarnetCardDrawer, type CarnetPaneId } from './CarnetCardDrawer';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import { CarnetSharePane } from './panes/CarnetSharePane';
import { CarnetManagePane } from './panes/CarnetManagePane';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { CarnetStorySection } from './CarnetStorySection';
import { CarnetKitSection } from './CarnetKitSection';
import { CarnetNatureSection } from './CarnetNatureSection';
import { CarnetCommentsPreview } from './CarnetCommentsPreview';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { downloadGpx } from './downloadGpx';

export interface CarnetProfileViewProps {
  detail: CarnetDetail;
}

/**
 * Fiche carnet — grammaire du Compte : colonne 406, carte 24 qui devient le
 * drawer (poignée + capsule de volets), sections empilées, barre basse 48.
 * Aucune donnée inventée : tout vient de `CarnetDetail`.
 */
export function CarnetProfileView({ detail }: CarnetProfileViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [scrolled, setScrolled] = useState(false);
  const [pane, setPane] = useState<CarnetPaneId | null>(null);
  const [mediaMode, setMediaMode] = useState<CarnetMediaMode>('grid');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const requireAuth = useCallback(() => {
    toast(
      user?.id
        ? 'Créez un compte pour enregistrer, commenter ou publier.'
        : 'Connectez-vous pour continuer.',
      'info',
    );
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

  const handleBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/communaute');
  }, [router]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/carnets/${detail.id}`;
  }, [detail.id]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}/carnets/${detail.id}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: detail.title, url });
        return;
      } catch {
        /* annulé : on ouvre le volet */
      }
    }
    setMenuOpen(false);
    setPane('share');
  }, [detail.id, detail.title]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/carnets/${detail.id}`);
      toast('Lien copié.', 'success');
    } catch {
      toast('Copie impossible : sélectionnez l’adresse du navigateur.', 'info');
    }
  }, [detail.id, toast]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${detail.title.replace(/[^a-zA-Z0-9]/g, '_')}-carnet.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Carnet exporté.', 'success');
  }, [detail, toast]);

  const report = useCallback(
    async (reason: string, details?: string) => {
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
      toast(
        error ? 'Le signalement n’a pas pu être envoyé.' : 'Signalement envoyé. Merci.',
        error ? 'error' : 'success',
      );
      setReportOpen(false);
    },
    [currentUserId, detail.id, requireAuth, toast],
  );

  return (
    <div className="ckp-shell lkdv-account-glass">
      <h1 className="sr-only">{detail.title}</h1>

      <div className="ckp-column">
        <header className="ckp-header">
          <CarnetTopBar
            title={detail.title}
            saved={engagement.favorited}
            scrolled={scrolled}
            onBack={handleBack}
            onShare={() => void share()}
            onSave={() => void engagement.toggleFavorite()}
            onMenu={() => setMenuOpen((value) => !value)}
            onTitleClick={scrollToTop}
            menu={
              <CarnetMoreMenu
                open={menuOpen}
                saved={engagement.favorited}
                isOwner={detail.isOwner}
                onSave={() => void engagement.toggleFavorite()}
                onShare={() => void share()}
                onCopy={() => void copyLink()}
                onReport={() => setReportOpen(true)}
                onManage={() => setPane('manage')}
                onClose={() => setMenuOpen(false)}
              />
            }
          />
        </header>

        <main className="ckp-main">
          {pane ? (
            <CarnetCardDrawer
              detail={detailView}
              pane={pane}
              onPaneChange={setPane}
              onClose={() => setPane(null)}
            >
              {pane === 'comments' ? (
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
              {pane === 'share' ? (
                <CarnetSharePane
                  url={shareUrl}
                  title={detail.title}
                  onCopied={() => toast('Lien copié.', 'success')}
                />
              ) : null}
              {pane === 'manage' ? (
                <CarnetManagePane
                  detail={detailView}
                  url={shareUrl}
                  onExport={exportJson}
                  onDeleted={() => router.push('/carnets')}
                />
              ) : null}
            </CarnetCardDrawer>
          ) : (
            <CarnetIdentityCard
              detail={detailView}
              mediaMode={mediaMode}
              onMediaModeChange={setMediaMode}
              onOpenViewer={(index) => setViewerIndex(index)}
              onOpenAuthor={() => {
                if (detail.author) router.push(`/profil/${detail.author.id}`);
              }}
              onLike={() => void engagement.toggleLike()}
              onOpenComments={() => setPane('comments')}
              onOpenParcours={() => setMediaMode('map')}
              onOpenManage={() => setPane('manage')}
              onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
              onExpandDescription={() =>
                document.getElementById('ckp-recit')?.scrollIntoView({ behavior: 'smooth' })
              }
            />
          )}

          <CarnetStorySection detail={detailView} />
          <CarnetKitSection detail={detailView} />
          <CarnetNatureSection canWrite={canWrite} onRequireAuth={requireAuth} />
          <CarnetCommentsPreview
            comments={comments.comments}
            loading={comments.loading}
            canWrite={canWrite}
            total={Math.max(detail.engagement.comments, comments.comments.length)}
            onSend={comments.send}
            onOpenAll={() => setPane('comments')}
            onRequireAuth={requireAuth}
          />
        </main>
      </div>

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
        onSubmitReport={report}
      />
    </div>
  );
}

export default CarnetProfileView;
