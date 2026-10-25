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
import { CARNET_SECTIONS } from './CarnetSectionTabs';
import { CarnetTopBar } from './CarnetTopBar';
import { CarnetIdentityCard } from './CarnetIdentityCard';
import { CarnetMediaBlock, downloadGpx, type CarnetMediaMode } from './CarnetMediaBlock';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { CarnetStorySection } from './CarnetStorySection';
import { CarnetKitSection } from './CarnetKitSection';
import { CarnetNatureSection } from './CarnetNatureSection';
import { CarnetCommentsPreview } from './CarnetCommentsPreview';
import { CarnetCommentsSheet } from './CarnetCommentsSheet';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { CarnetShareSheet } from './CarnetShareSheet';
import { CarnetManageSheet } from './CarnetManageSheet';
import { CarnetMapSheet } from './CarnetMapSheet';

export interface CarnetProfileViewProps {
  detail: CarnetDetail;
}

/**
 * Fiche carnet — disposition du Compte : une colonne 520, top bar 52,
 * carte d'identité 28, grille 3 colonnes, sections, bottom bar 48 sans onglet
 * actif. Aucune donnée inventée : tout vient de `CarnetDetail`.
 */
export function CarnetProfileView({ detail }: CarnetProfileViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState(0);
  const [mediaMode, setMediaMode] = useState<CarnetMediaMode>('grid');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
    else router.push('/carnets');
  }, [router]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToSection = useCallback((index: number) => {
    setSection(index);
    const id = CARNET_SECTIONS[index]?.id;
    if (id === 'parcours') setMediaMode('map');
    if (id === 'moments') setMediaMode('grid');
    if (!id) return;
    document.getElementById(`ckp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        /* annulé : on retombe sur la feuille */
      }
    }
    setShareOpen(true);
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
    <div className="lkdv-feed-shell lkdv-account-glass">
      <h1 className="sr-only">{detail.title}</h1>

      <div className="lkdv-feed-column">
        <header className="lkdv-feed-header">
          <CarnetTopBar
            title={detail.title}
            coverImage={detail.coverImage}
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
                onManage={() => setManageOpen(true)}
                onClose={() => setMenuOpen(false)}
              />
            }
          />
        </header>

        <main className="ckp-main">
          <CarnetIdentityCard
            detail={detailView}
            activeSection={section}
            onSectionChange={scrollToSection}
            onOpenViewer={() => setViewerIndex(0)}
            onOpenAuthor={() => {
              if (detail.author) router.push(`/profil/${detail.author.id}`);
            }}
            onOpenComments={() => setCommentsOpen(true)}
            onLike={() => void engagement.toggleLike()}
            onOpenManage={() => setManageOpen(true)}
            onExpandDescription={() => scrollToSection(0)}
          />

          <CarnetMediaBlock
            detail={detailView}
            mode={mediaMode}
            onModeChange={setMediaMode}
            onOpenViewer={(index) => setViewerIndex(index)}
            onOpenMap={() => setMapOpen(true)}
            onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
          />

          <CarnetStorySection detail={detailView} />
          <CarnetKitSection detail={detailView} />
          <CarnetNatureSection canWrite={canWrite} onRequireAuth={requireAuth} />
          <CarnetCommentsPreview
            comments={comments.comments}
            loading={comments.loading}
            canWrite={canWrite}
            total={Math.max(detail.engagement.comments, comments.comments.length)}
            onSend={comments.send}
            onOpenAll={() => setCommentsOpen(true)}
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

      <CarnetCommentsSheet
        open={commentsOpen}
        comments={comments.comments}
        loading={comments.loading}
        canWrite={canWrite}
        currentUserId={currentUserId}
        onSend={comments.send}
        onRemove={comments.remove}
        onClose={() => setCommentsOpen(false)}
        onRequireAuth={requireAuth}
      />

      <CarnetShareSheet
        open={shareOpen}
        url={shareUrl}
        title={detail.title}
        onClose={() => setShareOpen(false)}
        onCopied={() => toast('Lien copié.', 'success')}
      />

      <CarnetManageSheet
        open={manageOpen}
        detail={detail}
        url={shareUrl}
        onClose={() => setManageOpen(false)}
        onExport={exportJson}
        onCopied={() => toast('Lien copié.', 'success')}
      />

      <CarnetMapSheet
        open={mapOpen}
        detail={detail}
        onClose={() => setMapOpen(false)}
        onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
      />

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
