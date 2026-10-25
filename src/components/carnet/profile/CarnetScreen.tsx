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
import { CarnetCard, type CarnetMediaMode, type CarnetPlaceFocus, type CarnetStatDrawer } from './CarnetCard';
import { CarnetDrawer, type CarnetDrawerId } from './CarnetDrawer';
import { CarnetPostDrawer } from './CarnetPostDrawer';
import { CarnetMapCard } from './CarnetMapCard';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { CarnetRecitPane } from './panes/CarnetRecitPane';
import { CarnetEtapesPane } from './panes/CarnetEtapesPane';
import { CarnetKitPane } from './panes/CarnetKitPane';
import { CarnetNaturePane } from './panes/CarnetNaturePane';
import { CarnetParcoursPane } from './panes/CarnetParcoursPane';
import { CarnetLikesPane } from './panes/CarnetLikesPane';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import { CarnetSharePane } from './panes/CarnetSharePane';
import { CarnetManagePane } from './panes/CarnetManagePane';
import { downloadGpx } from './downloadGpx';

export interface CarnetScreenProps {
  detail: CarnetDetail;
}

type CarnetSubPane = 'recit' | 'etapes' | 'materiel' | 'nature';

/** Fiche carnet : écran verrouillé, la carte est la seule surface. */
export function CarnetScreen({ detail }: CarnetScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [drawer, setDrawer] = useState<CarnetDrawerId | null>(null);
  const [subPane, setSubPane] = useState<CarnetSubPane>('recit');
  const [postIndex, setPostIndex] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [mediaMode, setMediaMode] = useState<CarnetMediaMode>('grid');
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

  const openStat = (target: CarnetStatDrawer) => setDrawer(target);

  /* La couverture du carnet devient le fond de page, derrière un voile sombre
     léger qui garde le texte lisible. Sans couverture, le fond du Compte reste. */
  const screenBackground = useMemo(() => {
    if (!detail.coverImage) return undefined;
    const url = detail.coverImage.replace(/["\\]/g, '');
    return `linear-gradient(180deg, rgba(10, 20, 14, .3), rgba(10, 20, 14, .46)), url("${url}")`;
  }, [detail.coverImage]);

  return (
    <div
      className="ckp-screen lkdv-account-glass"
      data-type-scale="compte"
      style={screenBackground ? { backgroundImage: screenBackground } : undefined}
    >
      <header className="ckp-screen-header">
        <CarnetTopBar
          title={detail.title}
          onOpenCarnet={() => setDrawer('carnet')}
          onCreate={() => router.push('/carnets/nouveau')}
          onSearch={() => router.push('/communaute')}
        />
      </header>

      <main className="ckp-screen-body">
        {drawer ? (
          <CarnetDrawer detail={detailView} drawer={drawer} onDrawerChange={setDrawer} onClose={() => setDrawer(null)}>
            {drawer === 'carnet' ? (
              <>
                <div className="ckp-sub" role="group" aria-label="Sections du carnet" style={{ position: 'static', marginBottom: 8 }}>
                  {([
                    ['recit', 'Récit'],
                    ['etapes', 'Étapes'],
                    ['materiel', 'Matériel'],
                    ['nature', 'Nature'],
                  ] as const).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={subPane === id} onClick={() => setSubPane(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                {subPane === 'recit' ? <CarnetRecitPane detail={detailView} /> : null}
                {subPane === 'etapes' ? <CarnetEtapesPane detail={detailView} /> : null}
                {subPane === 'materiel' ? <CarnetKitPane detail={detailView} /> : null}
                {subPane === 'nature' ? <CarnetNaturePane canWrite={canWrite} onRequireAuth={requireAuth} /> : null}
              </>
            ) : null}

            {drawer === 'etapes' ? <CarnetEtapesPane detail={detailView} /> : null}
            {drawer === 'parcours' ? (
              <CarnetParcoursPane detail={detailView} onDownloadGpx={() => downloadGpx(detail.title, detail.trace)} />
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
            mediaMode={mediaMode}
            onMediaModeChange={setMediaMode}
            onOpenCarnet={() => setDrawer('carnet')}
            onOpenStat={openStat}
            onOpenComments={() => setDrawer('comments')}
            onOpenLikes={() => setDrawer('likes')}
            onOpenParcours={() => setDrawer('parcours')}
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
