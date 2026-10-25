'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/compte/compte-v8.css';
import '@/components/compte/compte-apple-hig.css';
import '@/design/account/account-grammar-pins.css';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import { CarnetTraceMap } from './CarnetTraceMap';
import ReportSheet from '@/components/social/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CARNET_SECTIONS } from './CarnetSectionTabs';
import { CarnetMediaBlock, downloadGpx, type CarnetMediaMode } from './CarnetMediaBlock';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { CarnetStorySection } from './CarnetStorySection';
import { CarnetKitSection } from './CarnetKitSection';
import { CarnetNatureSection } from './CarnetNatureSection';
import { CarnetCommentsSheet } from './CarnetCommentsSheet';
import { CarnetShareSheet } from './CarnetShareSheet';
import { CarnetManageSheet } from './CarnetManageSheet';
import { CarnetMapSheet } from './CarnetMapSheet';

const SEC_ICONS: Record<string, string> = {
  recit: 'M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2V5Zm12-2h2a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2h-2V3Z',
  parcours: 'M6 3v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  moments: 'M4 5h16v14H4V5Zm0 10 4-4 4 4 3-3 5 5',
  materiel: 'M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 0 1 6 0',
  nature: 'M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Zm0 18v-4',
};

export interface CarnetProfileViewProps {
  detail: CarnetDetail;
}

/**
 * Fiche carnet — grammaire Compte (verre Liquid Glass v8) : écran verrouillé
 * 430 × 932, barre haute 36 (pilule + 3 ronds), carte 406 × 541 à scroll
 * interne (identité, bio, 5 anneaux, grille 3 colonnes), zone carte 334,9
 * (trace GPS réelle), barre basse 48, drawers. Aucune donnée inventée.
 */
export function CarnetProfileView({ detail }: CarnetProfileViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [detailOpen, setDetailOpen] = useState<number | null>(null);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const phoneRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => initLiquidLenses(phoneRef.current), []);
  useEffect(() => {
    refreshLiquidLenses(phoneRef.current);
  }, [detailOpen, view, section]);

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

  const statItems = useMemo(() => {
    const base: { key: string; label: string; value: string }[] = detail.stats
      .filter((s) => s.value)
      .map((s) => ({ key: s.key as string, label: s.label, value: s.value }));
    const pad = [
      { key: 'likes', label: 'j’aime', value: String(engagement.likes) },
      { key: 'comments', label: 'commentaires', value: String(detail.engagement.comments) },
      { key: 'days', label: 'jours', value: String(detail.days.length) },
    ];
    for (const p of pad) {
      if (base.length >= 3) break;
      if (!base.some((b) => b.key === p.key)) base.push(p);
    }
    return base.slice(0, 3);
  }, [detail.days.length, detail.engagement.comments, detail.stats, engagement.likes]);

  const gridMoments = detail.photoMoments;

  // Anneaux avec couverture (référence 25/10) : uniquement quand la section a
  // une vraie image. Aucune couverture inventée.
  const ringCovers: Record<string, string | null> = {
    recit: detail.coverImage,
    moments: detail.photoMoments[0]?.imageUrl ?? null,
  };

  const sectionContent = (index: number): React.ReactNode => {
    const id = CARNET_SECTIONS[index]?.id;
    if (id === 'recit') return <CarnetStorySection detail={detailView} />;
    if (id === 'materiel') return <CarnetKitSection detail={detailView} />;
    if (id === 'nature') return <CarnetNatureSection canWrite={canWrite} onRequireAuth={requireAuth} />;
    if (id === 'moments')
      return (
        <CarnetMediaBlock
          detail={detailView}
          mode="grid"
          onModeChange={() => {}}
          onOpenViewer={(i) => setViewerIndex(i)}
          onOpenMap={() => setMapOpen(true)}
          onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
        />
      );
    if (id === 'parcours')
      return (
        <div className="space-y-3">
          <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} className="h-56 w-full rounded-2xl overflow-hidden" />
          <button type="button" className="mbtn p" onClick={() => downloadGpx(detail.title, detail.trace)}>
            Télécharger le GPX
          </button>
          {detail.days.map((d) => (
            <div className="li" key={d.id}>
              <div>
                <div className="ttl">Jour {d.dayNumber}</div>
                <div className="s2">{[d.label, [d.from, d.to].filter(Boolean).join(' → '), d.distanceKm ? `${d.distanceKm} km` : null].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      );
    return null;
  };

  return (
    <div className="lkdv-compte-v8 lkdv-pays lkdv-carnet">
      <h1 className="sr-only">{detail.title}</h1>
      <div className="stage">
        <div className="pwrap">
          <div className={`phone hasnext${detailOpen !== null || manageMenuOpen ? ' sheet-open' : ''}`} id="phone" ref={phoneRef}>
            {detail.coverImage ? (
              <div className="bg" style={{ backgroundImage: `url("${detail.coverImage}")` }} aria-hidden="true" />
            ) : (
              <div className="bg" style={{ background: 'linear-gradient(180deg, var(--mint), var(--page))' }} aria-hidden="true" />
            )}

            <section className="top" id="top">
              <div className="ig-top">
                <button type="button" className="lg ig-handle" onClick={handleBack} aria-label="Retour aux carnets">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{detail.title}</span>
                </button>
                <div className="ig-top-r">
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Partager le carnet" onClick={() => void share()}>
                    <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
                    </svg>
                  </button>
                  <button type="button" className="lg gbtn ig-top-btn" aria-label={engagement.favorited ? 'Retirer des favoris' : 'Enregistrer le carnet'} aria-pressed={engagement.favorited} onClick={() => void engagement.toggleFavorite()}>
                    <svg className="ic s" viewBox="0 0 24 24" fill={engagement.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
                    </svg>
                  </button>
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Commentaires" onClick={() => setCommentsOpen(true)}>
                    <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 1 1 21 12Z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="card cs" id="card">
                <div className="card-scroll">
                  <div className="ig-header">
                    <div className="ig-left">
                      <button type="button" className="ig-avi-wrap" onClick={() => (detail.coverImage ? setViewerIndex(0) : undefined)} aria-label="Photo de couverture">
                        <span className="ig-avi-in">
                          {detail.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element -- couverture distante
                            <img src={detail.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ font: '700 20px var(--sf)', color: 'var(--tint)' }}>{(detail.destination || detail.title).slice(0, 2).toUpperCase()}</span>
                          )}
                        </span>
                      </button>
                    </div>
                    <div className="ig-right">
                      <div className="ig-stats" role="group" aria-label="Chiffres du carnet">
                        {statItems.map((s) => (
                          <button type="button" className="ig-stat" key={s.key} aria-label={`${s.label} ${s.value}`} onClick={() => setDetailOpen(0)}>
                            <b className="num">{s.value}</b>
                            <span>{s.label.toLowerCase()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ig-bio">
                    <div className="ig-bio-top">
                      <b className="ig-bio-cc">{detail.destination || 'Carnet'}</b>
                      <span className="ig-bio-dot" aria-hidden="true">·</span>
                      <span className="ig-bio-stats">{[detail.dateRange, detail.author?.name].filter(Boolean).join(' · ')}</span>
                    </div>
                    {detail.description ? <p className="ig-bio-text">{detail.description}</p> : null}
                  </div>

                  <div className="ig-hl-row" role="region" aria-label="Sections du carnet">
                    {CARNET_SECTIONS.map((sec, i) => (
                      <button
                        key={sec.id}
                        type="button"
                        className="ig-hl"
                        aria-current={detailOpen === i ? 'true' : undefined}
                        onClick={() => setDetailOpen(i)}
                      >
                        <span className="ig-hl-ring">
                          <span className="ig-hl-in">
                            {ringCovers[sec.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element -- couverture réelle du carnet
                              <img src={ringCovers[sec.id] || undefined} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tint)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d={SEC_ICONS[sec.id] || SEC_ICONS.recit} />
                              </svg>
                            )}
                          </span>
                        </span>
                        <span>{sec.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="ig-grid-wrap">
                    {view === 'grid' && gridMoments.length > 0 ? (
                      <div className="ig-grid" role="region" aria-label="Moments photo">
                        {gridMoments.map((m, i) => (
                          <button key={m.id} type="button" className="ig-tile" aria-label={m.caption || `Moment ${i + 1}`} onClick={() => setViewerIndex(i)}>
                            {m.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- photo distante
                              <img src={m.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div role="region" aria-label="Moments en liste">
                        {gridMoments.length === 0 ? (
                          <div className="li" role="status">
                            <div>
                              <div className="ttl">Aucun moment photo</div>
                              <div className="s2">L’auteur n’a pas encore ajouté de photo à ce carnet.</div>
                            </div>
                            <button type="button" className="mbtn p" onClick={() => setDetailOpen(0)}>Lire le récit</button>
                          </div>
                        ) : (
                          gridMoments.map((m, i) => (
                            <div className="li" key={m.id}>
                              <div>
                                <div className="ttl">{m.caption || `Moment ${i + 1}`}</div>
                                <div className="s2">{[m.place, m.time].filter(Boolean).join(' · ')}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      className="li"
                      style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setManageMenuOpen(true)}
                    >
                      <div>
                        <div className="ttl">Gérer et partager</div>
                        <div className="s2">Enregistrer, copier le lien, exporter, signaler</div>
                      </div>
                      <span className="tg">Ouvrir</span>
                    </button>
                  </div>
                </div>

                <div className="ig-tabs-float">
                  <div className="ig-tabs" role="tablist" aria-label="Affichage des moments">
                    <span className="ig-th" style={{ transform: view === 'grid' ? 'translateX(0%)' : 'translateX(100%)' }} aria-hidden="true" />
                    <button type="button" role="tab" aria-selected={view === 'grid'} aria-label="Grille" onClick={() => setView('grid')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </button>
                    <button type="button" role="tab" aria-selected={view === 'list'} aria-label="Liste" onClick={() => setView('list')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mapzone" aria-label="Trace du parcours">
              {detail.trace ? (
                <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} className="absolute inset-0" />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, var(--mint), var(--page))' }}>
                  <p style={{ font: '600 11px/1.3 var(--sf)', color: 'var(--label2)', textAlign: 'center', padding: 24 }}>
                    Aucune trace GPS enregistrée pour ce carnet.
                  </p>
                </div>
              )}
            </section>

            <nav className="lkdv-account-bar" aria-label="Navigation principale">
              <AccountBottomBar renderAs="button" />
            </nav>

            <AccountDrawerHost
              open={detailOpen !== null}
              title={detailOpen !== null ? CARNET_SECTIONS[detailOpen]?.label ?? '' : ''}
              subtitle={detail.title}
              onClose={() => setDetailOpen(null)}
            >
              {detailOpen !== null ? <div>{sectionContent(detailOpen)}</div> : null}
            </AccountDrawerHost>

            <AccountDrawerHost
              open={manageMenuOpen}
              title="Gérer le carnet"
              subtitle={detail.title}
              onClose={() => setManageMenuOpen(false)}
            >
              <div>
                <div className="li"><div><div className="ttl">Enregistrer</div><div className="s2">{engagement.favorited ? 'Déjà dans vos favoris' : 'Ajouter à vos favoris'}</div></div><button type="button" className="mbtn p" onClick={() => void engagement.toggleFavorite()}>{engagement.favorited ? 'Retirer' : 'Enregistrer'}</button></div>
                <div className="li"><div><div className="ttl">Partager</div><div className="s2">Lien, applications, copie</div></div><button type="button" className="mbtn p" onClick={() => void share()}>Partager</button></div>
                <div className="li"><div><div className="ttl">Copier le lien</div></div><button type="button" className="mbtn p" onClick={() => void copyLink()}>Copier</button></div>
                <div className="li"><div><div className="ttl">Exporter</div><div className="s2">JSON complet du carnet</div></div><button type="button" className="mbtn p" onClick={() => exportJson()}>Exporter</button></div>
                {detail.trace ? <div className="li"><div><div className="ttl">Trace GPX</div></div><button type="button" className="mbtn p" onClick={() => downloadGpx(detail.title, detail.trace)}>Télécharger</button></div> : null}
                {detail.isOwner ? <div className="li"><div><div className="ttl">Modifier</div><div className="s2">Titre, confidentialité, couverture</div></div><button type="button" className="mbtn p" onClick={() => setManageOpen(true)}>Gérer</button></div> : null}
                <div className="li"><div><div className="ttl">Signaler</div><div className="s2">Contenu inapproprié</div></div><button type="button" className="mbtn p" onClick={() => setReportOpen(true)}>Signaler</button></div>
              </div>
            </AccountDrawerHost>

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
        </div>
      </div>
    </div>
  );
}

export default CarnetProfileView;
