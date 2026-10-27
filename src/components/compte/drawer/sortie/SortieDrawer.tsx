'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Backpack,
  Camera,
  Check,
  MessageCircle,
  Mountain,
  Route,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { OutingDetail } from '@/features/compte/server/sorties';
import { DrawerError, DrawerShell, DrawerSkeleton, type DrawerTab } from '../shell/DrawerShell';
import { DrawerAuthRequired } from '../shell/DrawerAuthRequired';
import { OutingSummary } from './OutingSummary';
import { OutingTrace } from './OutingTrace';
import { OutingPhotos } from './OutingPhotos';
import { OutingGear } from './OutingGear';
import { OutingParticipants } from './OutingParticipants';
import { OutingComments } from './OutingComments';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `http_${response.status}`);
  }
  return (await response.json()) as T;
}

const TABS = [
  { id: 'resume', label: 'Résumé', icon: <Route size={18} aria-hidden="true" /> },
  { id: 'trace', label: 'Trace & relief', icon: <Mountain size={18} aria-hidden="true" /> },
  { id: 'photos', label: 'Photos', icon: <Camera size={18} aria-hidden="true" /> },
  { id: 'materiel', label: 'Matériel', icon: <Backpack size={18} aria-hidden="true" /> },
  { id: 'compagnons', label: 'Compagnons', icon: <Users size={18} aria-hidden="true" /> },
  { id: 'echanges', label: 'Échanges', icon: <MessageCircle size={18} aria-hidden="true" /> },
] as const;

type Toast = { text: string; tone: 'ok' | 'error' } | null;

export function SortieDrawer({ outingId = '' }: { outingId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const query = useQuery({
    queryKey: ['sortie', outingId],
    queryFn: () => requestJson<OutingDetail>(`/api/compte/sorties/${outingId}`),
    enabled: Boolean(outingId && user),
    staleTime: 20_000,
  });

  const detail = query.data;

  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['sortie', outingId] });
  }, [outingId, queryClient]);

  const run = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await action();
        invalidate();
        notify(success);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Action impossible', 'error');
      } finally {
        setBusy(false);
      }
    },
    [invalidate, notify]
  );

  const share = useCallback(async () => {
    if (!detail) return;
    const url = window.location.href.split('?')[0];
    const payload = {
      title: detail.title,
      text: `${detail.title} · ${detail.km} km · +${detail.dplus} m`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        notify('Partage ouvert');
      } else {
        await navigator.clipboard.writeText(url);
        notify('Lien copié');
      }
    } catch {
      // Annulation du partage natif : pas d'erreur visible.
    }
  }, [detail, notify]);

  const exportGpx = useCallback(() => {
    if (!outingId) return;
    const link = document.createElement('a');
    link.href = `/api/compte/sorties/${outingId}/gpx`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify('GPX en préparation');
  }, [notify, outingId]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!user?.id || !outingId) {
        notify('Session requise', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        notify('Photo trop lourde (10 Mo maximum)', 'error');
        return;
      }
      setUploading(true);
      try {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${outingId}/${crypto.randomUUID()}.${extension}`;
        const supabase = createClient();
        const { error } = await supabase.storage.from('outing-media').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error('Envoi de la photo impossible');
        await requestJson(`/api/compte/sorties/${outingId}/photos`, {
          method: 'POST',
          body: JSON.stringify({ storagePath: path }),
        });
        invalidate();
        notify('Photo ajoutée');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Photo impossible', 'error');
      } finally {
        setUploading(false);
      }
    },
    [invalidate, notify, outingId, user?.id]
  );

  const deleteOuting = useCallback(async () => {
    setBusy(true);
    try {
      await requestJson(`/api/compte/sorties/${outingId}`, { method: 'DELETE' });
      notify('Sortie supprimée');
      const runtime = window as unknown as { __lkdvCompteAct?: (action: string, value?: unknown) => void };
      runtime.__lkdvCompteAct?.('close');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Suppression impossible', 'error');
    } finally {
      setBusy(false);
    }
  }, [notify, outingId]);

  const tabs: DrawerTab[] = useMemo(
    () =>
      TABS.map((item) => ({
        ...item,
        render: () => {
          if (!detail) return null;
          if (item.id === 'resume') {
            return (
              <OutingSummary
                detail={detail}
                saving={busy}
                onSave={(patch) =>
                  run(
                    () =>
                      requestJson(`/api/compte/sorties/${outingId}`, {
                        method: 'PATCH',
                        body: JSON.stringify(patch),
                      }),
                    'Sortie mise à jour'
                  )
                }
                onShare={share}
                onExport={exportGpx}
                onDelete={deleteOuting}
              />
            );
          }
          if (item.id === 'trace') return <OutingTrace detail={detail} onExport={exportGpx} />;
          if (item.id === 'photos') {
            return (
              <OutingPhotos
                photos={detail.photos}
                canEdit={detail.canEdit}
                uploading={uploading}
                onUpload={uploadPhoto}
                onDelete={(photoId) =>
                  run(
                    () =>
                      requestJson(`/api/compte/sorties/${outingId}/photos`, {
                        method: 'DELETE',
                        body: JSON.stringify({ photoId }),
                      }),
                    'Photo supprimée'
                  )
                }
              />
            );
          }
          if (item.id === 'materiel') {
            return (
              <OutingGear
                gear={detail.gear}
                kit={detail.kit}
                missingGear={detail.missingGear}
                canEdit={detail.canEdit}
                busy={busy}
                onAttach={() =>
                  run(
                    () => requestJson(`/api/compte/sorties/${outingId}/gear`, { method: 'POST' }),
                    'Kit rattaché à la sortie'
                  )
                }
                onRemove={(gearId) =>
                  run(
                    () =>
                      requestJson(`/api/compte/sorties/${outingId}/gear`, {
                        method: 'DELETE',
                        body: JSON.stringify({ gearId }),
                      }),
                    'Objet retiré'
                  )
                }
              />
            );
          }
          if (item.id === 'compagnons') {
            return (
              <OutingParticipants
                participants={detail.participants}
                canEdit={detail.canEdit}
                busy={busy}
                onAdd={(handle) =>
                  run(
                    () =>
                      requestJson(`/api/compte/sorties/${outingId}/participants`, {
                        method: 'POST',
                        body: JSON.stringify({ handle }),
                      }),
                    'Compagnon ajouté'
                  )
                }
                onRemove={(participantId) =>
                  run(
                    () =>
                      requestJson(`/api/compte/sorties/${outingId}/participants`, {
                        method: 'DELETE',
                        body: JSON.stringify({ participantId }),
                      }),
                    'Compagnon retiré'
                  )
                }
              />
            );
          }
          return (
            <OutingComments
              kudos={detail.kudos}
              comments={detail.comments}
              busy={busy}
              onKudos={() =>
                run(
                  () => requestJson(`/api/compte/sorties/${outingId}/kudos`, { method: 'POST' }),
                  detail.kudos.mine ? 'Kudos retiré' : 'Kudos envoyé'
                )
              }
              onComment={(body) =>
                run(
                  () =>
                    requestJson(`/api/compte/sorties/${outingId}/comments`, {
                      method: 'POST',
                      body: JSON.stringify({ body }),
                    }),
                  'Commentaire envoyé'
                )
              }
              onDelete={(commentId) =>
                run(
                  () =>
                    requestJson(`/api/compte/sorties/${outingId}/comments`, {
                      method: 'DELETE',
                      body: JSON.stringify({ commentId }),
                    }),
                  'Commentaire supprimé'
                )
              }
            />
          );
        },
      })),
    [busy, deleteOuting, detail, exportGpx, outingId, run, share, uploadPhoto, uploading]
  );

  if (authLoading) {
    return (
      <div className="lkdv-sortie-root">
        <DrawerSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="lkdv-sortie-root">
        <DrawerAuthRequired
          title="Connecte-toi pour voir cette sortie"
          hint="Les traces, photos, compagnons et échanges d’une sortie sont privés."
        />
      </div>
    );
  }

  if (!outingId) {
    return (
      <div className="lkdv-sortie-root">
        <DrawerError />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="lkdv-sortie-root">
        <DrawerSkeleton />
      </div>
    );
  }

  if (query.isError || !detail) {
    return (
      <div className="lkdv-sortie-root">
        <DrawerError onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <div className="lkdv-sortie-root">
      <DrawerShell tabs={tabs} activeIndex={tab} onIndexChange={setTab} />
      {toast ? (
        <div className={`lkdv-sortie-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.tone === 'ok' ? <Check size={14} aria-hidden="true" /> : null}
          {toast.text}
        </div>
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: SORTIE_CSS }} />
    </div>
  );
}

export const SORTIE_CSS = `
.lkdv-sortie-root{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;position:relative!important;}
.lkdv-sortie-pane,.lkdv-sortie-summary{display:flex!important;flex-direction:column!important;gap:12px!important;padding:4px 0 18px!important;}
.lkdv-sortie-hero{position:relative!important;min-height:210px!important;border-radius:22px!important;overflow:hidden!important;background:linear-gradient(160deg,#DCEBD9,#F5F8F1 60%,#E7EFE1)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(23,43,36,.12)!important;display:flex!important;align-items:flex-end!important;}
.lkdv-sortie-hero-img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-sortie-hero-map{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;padding:22px!important;box-sizing:border-box!important;opacity:.9!important;}
.lkdv-sortie-hero-scrim{position:absolute!important;inset:0!important;background:linear-gradient(180deg,rgba(12,28,20,0) 20%,rgba(12,28,20,.62) 100%)!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-hero-scrim{background:linear-gradient(180deg,rgba(12,28,20,0) 30%,rgba(12,28,20,.32) 100%)!important;}
.lkdv-sortie-hero-body{position:relative!important;z-index:1!important;padding:14px!important;display:flex!important;flex-direction:column!important;gap:4px!important;color:#fff!important;width:100%!important;box-sizing:border-box!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-hero-body{color:#17402C!important;}
.lkdv-sortie-hero-badges{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-bottom:4px!important;}
.lkdv-sortie-badge{display:inline-flex!important;align-items:center!important;gap:4px!important;height:22px!important;padding:0 9px!important;border-radius:999px!important;font:600 10.5px var(--sf)!important;background:rgba(255,255,255,.24)!important;color:inherit!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge{background:rgba(255,255,255,.65)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge.proof{background:rgba(23,64,44,.88)!important;color:#fff!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge.state.planned{background:rgba(185,138,46,.92)!important;color:#fff!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge.state.ongoing{background:rgba(61,122,82,.92)!important;color:#fff!important;}
.lkdv-sortie-badge.state.done{background:rgba(23,64,44,.62)!important;color:#fff!important;box-shadow:inset 0 0 0 .5px rgba(47,107,69,.24)!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge.state.done{background:rgba(23,64,44,.72)!important;color:#fff!important;}
.lkdv-sortie-badge.proof{background:rgba(23,64,44,.82)!important;color:#fff!important;}
.lkdv-sortie-badge.state.planned{background:rgba(185,138,46,.9)!important;color:#fff!important;}
.lkdv-sortie-badge.state.ongoing{background:rgba(61,122,82,.92)!important;color:#fff!important;}
.lkdv-sortie-badge.state.done{background:rgba(23,64,44,.62)!important;color:#fff!important;box-shadow:inset 0 0 0 .5px rgba(47,107,69,.24)!important;}
.lkdv-sortie-hero:not(.has-photo) .lkdv-sortie-badge.state.done{background:rgba(23,64,44,.72)!important;color:#fff!important;}
.lkdv-sortie-hero h2{margin:0!important;font:650 21px/1.15 var(--sf)!important;letter-spacing:-.02em!important;color:inherit!important;}
.lkdv-sortie-hero p{margin:0!important;font:500 12px/1.35 var(--sf)!important;opacity:.9!important;}
.lkdv-sortie-hero-with{opacity:.78!important;}
.lkdv-sortie-tiles{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important;}
.lkdv-sortie-tiles>div{display:flex!important;flex-direction:column!important;gap:2px!important;padding:9px 8px!important;border-radius:14px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;min-width:0!important;}
.lkdv-sortie-tiles small{font:500 9.5px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-sortie-tiles b{font:650 14px var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-sortie-notes{margin:0!important;font:400 13px/1.5 var(--sf)!important;color:var(--label2)!important;padding:0 2px!important;white-space:pre-wrap!important;}
.lkdv-sortie-actions{display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
.lkdv-sortie-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;height:36px!important;padding:0 14px!important;border:0!important;border-radius:999px!important;font:600 12.5px var(--sf)!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .18s ease,opacity .18s ease!important;}
.lkdv-sortie-btn:active{transform:scale(.97)!important;}
.lkdv-sortie-btn:disabled{opacity:.45!important;cursor:default!important;}
.lkdv-sortie-btn.primary{background:#17402C!important;color:#fff!important;box-shadow:0 4px 14px rgba(23,64,44,.22)!important;}
.lkdv-sortie-btn.ghost{background:rgba(255,255,255,.6)!important;color:var(--label)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-sortie-btn.danger{background:rgba(179,58,44,.12)!important;color:#9C2F22!important;box-shadow:inset 0 0 0 .5px rgba(179,58,44,.25)!important;}
.lkdv-sortie-btn.wide{width:100%!important;margin-top:2px!important;}
.lkdv-sortie-section{display:flex!important;flex-direction:column!important;gap:8px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-section header{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:8px!important;}
.lkdv-sortie-section header b{font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-section header span{font:500 10.5px var(--sf)!important;color:var(--label3)!important;text-align:right!important;}
.lkdv-sortie-proof{margin:0!important;font:400 12px/1.5 var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-edit{display:flex!important;flex-direction:column!important;gap:10px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.6)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-edit label{display:flex!important;flex-direction:column!important;gap:5px!important;}
.lkdv-sortie-edit label>span{font:600 10.5px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-sortie-edit input,.lkdv-sortie-edit textarea,.lkdv-sortie-edit select{width:100%!important;box-sizing:border-box!important;border:0!important;border-radius:12px!important;background:rgba(255,255,255,.72)!important;padding:10px 12px!important;font:500 13px/1.4 var(--sf)!important;color:var(--label)!important;outline:none!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.12)!important;resize:vertical!important;}
.lkdv-sortie-edit-actions{display:flex!important;justify-content:flex-end!important;gap:6px!important;}
.lkdv-sortie-danger{display:flex!important;flex-direction:column!important;gap:8px!important;padding:10px 12px!important;border-radius:16px!important;background:rgba(179,58,44,.06)!important;box-shadow:inset 0 0 0 .5px rgba(179,58,44,.16)!important;}
.lkdv-sortie-danger p{margin:0!important;font:400 12px/1.45 var(--sf)!important;color:#7d2a20!important;}
.lkdv-sortie-danger-link{display:inline-flex!important;align-items:center!important;gap:6px!important;align-self:flex-start!important;border:0!important;background:none!important;padding:0!important;font:600 12px var(--sf)!important;color:#9C2F22!important;cursor:pointer!important;}
.lkdv-sortie-trace-empty{display:grid!important;place-items:center!important;min-height:90px!important;font:500 11.5px var(--sf)!important;color:var(--label3)!important;background:rgba(255,255,255,.4)!important;border-radius:14px!important;}
.lkdv-sortie-elevation{display:flex!important;flex-direction:column!important;gap:2px!important;}
.lkdv-sortie-elevation svg{width:100%!important;height:82px!important;display:block!important;}
.lkdv-sortie-elevation-labels{display:flex!important;justify-content:space-between!important;font:500 10px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-map-wrap{position:relative!important;border-radius:16px!important;overflow:hidden!important;background:linear-gradient(160deg,rgba(220,235,217,.7),rgba(245,248,241,.8))!important;}
.lkdv-sortie-map{width:100%!important;height:190px!important;display:block!important;padding:14px!important;box-sizing:border-box!important;}
.lkdv-sortie-map-legend{position:absolute!important;left:10px!important;bottom:8px!important;display:flex!important;gap:10px!important;font:500 10px var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-map-legend span{display:inline-flex!important;align-items:center!important;gap:4px!important;}
.lkdv-sortie-map-legend i{width:7px!important;height:7px!important;border-radius:50%!important;display:inline-block!important;}
.lkdv-sortie-map-legend i.start{background:#17402C!important;}
.lkdv-sortie-map-legend i.end{background:#fff!important;box-shadow:0 0 0 1.5px #17402C!important;}
.lkdv-sortie-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;}
.lkdv-sortie-grid>div{display:flex!important;flex-direction:column!important;gap:2px!important;padding:9px!important;border-radius:14px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-sortie-grid small{font:500 9.5px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-sortie-grid b{font:650 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-weather{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;}
.lkdv-sortie-weather-day{display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important;padding:8px 4px!important;border-radius:14px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07)!important;text-align:center!important;}
.lkdv-sortie-weather-date{font:600 9.5px var(--sf)!important;color:var(--label3)!important;text-transform:capitalize!important;}
.lkdv-sortie-weather-ico{color:#3D7A52!important;display:grid!important;place-items:center!important;}
.lkdv-sortie-weather-day b{font:650 13px var(--sf)!important;color:var(--label)!important;display:flex!important;gap:3px!important;align-items:baseline!important;}
.lkdv-sortie-weather-day b small{font:500 10px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-weather-label{font:500 9.5px/1.2 var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-weather-meta{font:500 9px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-alerts{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-sortie-alerts li{display:flex!important;align-items:center!important;gap:5px!important;font:500 11px var(--sf)!important;color:#8a6418!important;}
.lkdv-sortie-photos-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;}
.lkdv-sortie-photos-head>div{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important;}
.lkdv-sortie-photos-head b{font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-photos-head span{font:400 11px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-file{display:none!important;}
.lkdv-sortie-photo-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;}
.lkdv-sortie-photo{position:relative!important;border:0!important;padding:0!important;aspect-ratio:1!important;border-radius:12px!important;overflow:hidden!important;background:rgba(255,255,255,.5)!important;cursor:pointer!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-photo img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;}
.lkdv-sortie-cover{position:absolute!important;left:4px!important;bottom:4px!important;padding:2px 6px!important;border-radius:999px!important;background:rgba(12,28,20,.72)!important;color:#fff!important;font:600 8.5px var(--sf)!important;backdrop-filter:blur(8px)!important;}
.lkdv-sortie-lightbox{position:fixed!important;inset:0!important;z-index:80!important;background:rgba(8,16,12,.92)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:18px!important;}
.lkdv-sortie-lightbox>img{max-width:100%!important;max-height:72vh!important;border-radius:16px!important;object-fit:contain!important;}
.lkdv-sortie-lightbox-close{position:absolute!important;top:18px!important;right:18px!important;width:38px!important;height:38px!important;border-radius:50%!important;border:0!important;background:rgba(255,255,255,.16)!important;color:#fff!important;display:grid!important;place-items:center!important;cursor:pointer!important;backdrop-filter:blur(10px)!important;}
.lkdv-sortie-lightbox-bar{display:flex!important;align-items:center!important;gap:12px!important;margin-top:14px!important;color:#fff!important;font:500 12px var(--sf)!important;}
.lkdv-sortie-lightbox-delete{display:inline-flex!important;align-items:center!important;gap:5px!important;border:0!important;border-radius:999px!important;padding:7px 12px!important;background:rgba(179,58,44,.9)!important;color:#fff!important;font:600 11px var(--sf)!important;cursor:pointer!important;}
.lkdv-sortie-kit{display:grid!important;grid-template-columns:38px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;}
.lkdv-sortie-kit-ico{width:38px!important;height:38px!important;border-radius:12px!important;display:grid!important;place-items:center!important;background:rgba(23,64,44,.08)!important;color:#17402C!important;}
.lkdv-sortie-kit b{display:block!important;font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-kit small{font:500 10.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-gear-total{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 3px!important;font:500 11.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-gear-total b{font:650 14px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-missing{margin:0!important;padding:8px 10px!important;border-radius:12px!important;background:rgba(232,192,104,.18)!important;font:500 11.5px/1.4 var(--sf)!important;color:#7d5c14!important;}
.lkdv-sortie-gear{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-sortie-gear li{display:grid!important;grid-template-columns:28px minmax(0,1fr) auto auto!important;align-items:center!important;gap:8px!important;padding:8px 9px!important;border-radius:13px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.06)!important;}
.lkdv-sortie-gear-ico{width:28px!important;height:28px!important;border-radius:9px!important;display:grid!important;place-items:center!important;background:rgba(23,64,44,.07)!important;color:#17402C!important;}
.lkdv-sortie-gear-name{font:500 12.5px var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-sortie-gear-weight{font:600 11.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-gear-remove{width:26px!important;height:26px!important;border:0!important;border-radius:50%!important;background:none!important;color:var(--label3)!important;cursor:pointer!important;display:grid!important;place-items:center!important;}
.lkdv-sortie-invite{display:flex!important;align-items:flex-end!important;gap:8px!important;padding:10px 12px!important;border-radius:16px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-invite label{flex:1!important;display:flex!important;flex-direction:column!important;gap:4px!important;min-width:0!important;}
.lkdv-sortie-invite label>span{font:600 10px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-sortie-invite label>div{display:flex!important;align-items:center!important;gap:2px!important;border-radius:10px!important;background:rgba(255,255,255,.7)!important;padding:0 8px!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-sortie-invite label>div span{font:600 12px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-invite input{flex:1!important;min-width:0!important;border:0!important;background:none!important;outline:none!important;height:34px!important;font:500 12.5px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-people{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-sortie-people li{display:grid!important;grid-template-columns:38px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;padding:8px 9px!important;border-radius:14px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-sortie-avatar{width:38px!important;height:38px!important;border-radius:50%!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 12px var(--sf)!important;}
.lkdv-sortie-avatar.small{width:30px!important;height:30px!important;font-size:10px!important;}
.lkdv-sortie-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-sortie-people b{display:block!important;font:600 12.5px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-people small{font:500 10.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-people-remove{width:28px!important;height:28px!important;border:0!important;border-radius:50%!important;background:rgba(255,255,255,.6)!important;color:var(--label2)!important;display:grid!important;place-items:center!important;cursor:pointer!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-kudos{display:flex!important;align-items:center!important;gap:10px!important;padding:11px 12px!important;border-radius:16px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-kudos.mine{background:rgba(61,122,82,.1)!important;}
.lkdv-sortie-kudos-btn{display:inline-flex!important;align-items:center!important;gap:5px!important;height:34px!important;padding:0 12px!important;border:0!important;border-radius:999px!important;background:rgba(255,255,255,.75)!important;color:#3D7A52!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;font:650 12px var(--sf)!important;cursor:pointer!important;}
.lkdv-sortie-kudos.mine .lkdv-sortie-kudos-btn{background:#3D7A52!important;color:#fff!important;}
.lkdv-sortie-kudos b{display:block!important;font:600 12.5px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-kudos small{display:block!important;font:500 10.5px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-sortie-comments-head{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:8px!important;padding:0 2px!important;}
.lkdv-sortie-comments-head b{font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-comments-head span{font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-comments{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:8px!important;}
.lkdv-sortie-comments li{display:grid!important;grid-template-columns:30px minmax(0,1fr) auto!important;align-items:start!important;gap:8px!important;}
.lkdv-sortie-comment-head{display:flex!important;align-items:baseline!important;gap:5px!important;flex-wrap:wrap!important;}
.lkdv-sortie-comment-head b{font:600 12px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-comment-head small{font:500 10px var(--sf)!important;color:var(--label3)!important;}
.lkdv-sortie-comment-head span{font:500 9.5px var(--sf)!important;color:var(--label3)!important;margin-left:auto!important;}
.lkdv-sortie-comments p{margin:2px 0 0!important;font:400 12px/1.45 var(--sf)!important;color:var(--label2)!important;white-space:pre-wrap!important;}
.lkdv-sortie-comment-delete{width:24px!important;height:24px!important;border:0!important;border-radius:50%!important;background:none!important;color:var(--label3)!important;display:grid!important;place-items:center!important;cursor:pointer!important;}
.lkdv-sortie-composer{display:flex!important;align-items:flex-end!important;gap:6px!important;padding:7px 7px 7px 11px!important;border-radius:18px!important;background:rgba(255,255,255,.65)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;position:sticky!important;bottom:0!important;z-index:3!important;}
.lkdv-sortie-composer textarea{flex:1!important;min-width:0!important;border:0!important;background:none!important;outline:none!important;resize:none!important;font:500 12.5px/1.4 var(--sf)!important;color:var(--label)!important;padding:5px 0!important;max-height:96px!important;}
.lkdv-sortie-send{width:34px!important;height:34px!important;border:0!important;border-radius:50%!important;background:#17402C!important;color:#fff!important;display:grid!important;place-items:center!important;cursor:pointer!important;flex:none!important;}
.lkdv-sortie-send:disabled{opacity:.4!important;}
.lkdv-sortie-empty-line{margin:0!important;font:400 12px/1.45 var(--sf)!important;color:var(--label3)!important;padding:2px 2px 6px!important;}
.lkdv-sortie-state{display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:8px!important;padding:28px 18px!important;}
.lkdv-sortie-state>span{width:48px!important;height:48px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:rgba(255,255,255,.65)!important;color:#17402C!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-sortie-state b{font:600 14px var(--sf)!important;color:var(--label)!important;}
.lkdv-sortie-state p{margin:0!important;font:400 12px/1.45 var(--sf)!important;color:var(--label2)!important;max-width:260px!important;}
.lkdv-sortie-hint-ico{color:var(--label3)!important;}
.lkdv-sortie-toast{position:fixed!important;left:50%!important;bottom:84px!important;transform:translateX(-50%)!important;z-index:90!important;display:inline-flex!important;align-items:center!important;gap:6px!important;padding:9px 14px!important;border-radius:999px!important;background:rgba(16,32,24,.92)!important;color:#fff!important;font:600 11.5px var(--sf)!important;box-shadow:0 8px 24px rgba(0,0,0,.25)!important;backdrop-filter:blur(12px)!important;max-width:calc(100vw - 32px)!important;}
.lkdv-sortie-toast.error{background:rgba(120,32,24,.94)!important;}
@media (max-width:370px){.lkdv-sortie-tiles{grid-template-columns:repeat(2,minmax(0,1fr))!important;}.lkdv-sortie-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}
@media (prefers-reduced-motion:reduce){.lkdv-sortie-btn{transition:none!important;}}
/* — Passe de finition du drawer Sortie (20 améliorations) — */
/* 1. Hauteur de héros adaptative, jamais écrasée par le drawer court. */
.lkdv-sortie-hero{min-height:clamp(170px,28dvh,210px)!important;}
/* 2. Bord de verre cohérent avec les autres surfaces. */
.lkdv-sortie-hero{box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.12),0 10px 28px rgba(23,43,36,.12)!important;}
/* 3. Titre limité à deux lignes sur mobile. */
.lkdv-sortie-hero-body h2{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;font-size:19px!important;line-height:1.12!important;letter-spacing:-.02em!important;}
/* 4. Scrim plus lisible sur photo claire. */
.lkdv-sortie-hero.has-photo .lkdv-sortie-hero-scrim{background:linear-gradient(180deg,rgba(8,20,14,.02) 18%,rgba(8,20,14,.78) 100%)!important;}
/* 5. Badges compacts et alignés. */
.lkdv-sortie-hero-badges{gap:5px!important;margin-bottom:6px!important;}
.lkdv-sortie-badge{height:21px!important;padding:0 8px!important;font-size:10px!important;}
/* 6. Quatre tuiles toujours sur une ligne, sans écrasement. */
.lkdv-sortie-tiles{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;}
.lkdv-sortie-tiles>div{min-width:0!important;padding:7px 8px!important;border-radius:14px!important;}
.lkdv-sortie-tiles b{font-size:12.5px!important;}
.lkdv-sortie-tiles small{font-size:8.5px!important;letter-spacing:.04em!important;}
/* 7. Barre d’actions collante au-dessus de la navigation. */
.lkdv-sortie-actions{position:sticky!important;bottom:0!important;z-index:6!important;margin:2px -2px 0!important;padding:8px 2px calc(2px + env(safe-area-inset-bottom,0px))!important;background:linear-gradient(180deg,rgba(246,250,243,0),rgba(246,250,243,.94) 42%)!important;}
/* 8. Boutons d’action homogènes et tactiles. */
.lkdv-sortie-actions .lkdv-sortie-btn{min-height:38px!important;flex:1 1 0!important;justify-content:center!important;padding:0 10px!important;}
/* 9. Récit replié proprement. */
.lkdv-sortie-notes{display:-webkit-box!important;-webkit-line-clamp:5!important;-webkit-box-orient:vertical!important;overflow:hidden!important;font-size:12px!important;line-height:1.5!important;}
/* 10. Sections aérées et lisibles. */
.lkdv-sortie-section{padding:10px!important;border-radius:16px!important;background:rgba(255,255,255,.44)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)!important;}
.lkdv-sortie-section>header{gap:8px!important;align-items:baseline!important;}
/* 11. En-têtes de section plus compacts. */
.lkdv-sortie-section>header b{font-size:11.5px!important;}
.lkdv-sortie-section>header span{font-size:9.5px!important;}
/* 12. Photos en grille régulière avec ratio stable. */
.lkdv-sortie-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}
/* 13. Tuile photo nette et légère. */
.lkdv-sortie-photo{aspect-ratio:1/1!important;border-radius:15px!important;overflow:hidden!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1),0 4px 12px rgba(23,43,36,.08)!important;}
.lkdv-sortie-photo img{width:100%!important;height:100%!important;object-fit:cover!important;transition:transform .35s cubic-bezier(.22,1,.36,1)!important;}
.lkdv-sortie-photo:active img{transform:scale(1.03)!important;}
/* 14. États vides plus doux. */
.lkdv-sortie-pane .lkdv-sortie-empty-line{padding:20px 12px!important;border-radius:16px!important;background:rgba(255,255,255,.36)!important;}
/* 15. Focus visible cohérent. */
.lkdv-sortie-btn:focus-visible,.lkdv-sortie-photo:focus-visible,.lkdv-sortie-kudos-btn:focus-visible{outline:2px solid #17402c!important;outline-offset:2px!important;}
/* 16. Lightbox plus immersive. */
.lkdv-sortie-lightbox{background:rgba(5,12,8,.94)!important;backdrop-filter:blur(18px)!important;}
/* 17. Commentaires respirants. */
.lkdv-sortie-comments{gap:8px!important;}
.lkdv-sortie-comment-head b{font-size:12px!important;}
/* 18. Matériel lisible. */
.lkdv-sortie-gear{gap:6px!important;}
.lkdv-sortie-gear-name{font-size:12px!important;}
.lkdv-sortie-gear-weight{font-variant-numeric:tabular-nums!important;}
/* 19. Toast au-dessus de la barre basse. */
.lkdv-sortie-toast{bottom:calc(76px + env(safe-area-inset-bottom,0px))!important;box-shadow:0 10px 28px rgba(0,0,0,.28)!important;}
/* 20. Mouvement réduit. */
@media (prefers-reduced-motion:reduce){.lkdv-sortie-photo img,.lkdv-sortie-btn,.lkdv-sortie-hero{transition:none!important;animation:none!important;}}

`;

export default SortieDrawer;
