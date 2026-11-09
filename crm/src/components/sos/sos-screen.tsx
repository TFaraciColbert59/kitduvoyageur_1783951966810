'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Label } from '../../ui/card';
import { Button } from '../../ui/button';
import { Field, TextArea } from '../../ui/field';
import { Banner } from '../../ui/states';
import { IconChevronLeft, IconPhone } from '../../ui/icons';
import { useToast } from '../../ui/toast';
import { relativeFr } from '../../lib/format';
import { errorMessage, runCommand } from '../data/cmd';

export type SosAlert = {
  id: string;
  member: string;
  member_id: string | null;
  group_size: number | null;
  trip: string | null;
  created_at: string;
  taken_by: string | null;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  position_at: string | null;
  status: 'open' | 'taken' | 'closed';
  contacts: { label: string; phone: string | null }[];
};

const PREVIEW = process.env.NEXT_PUBLIC_CRM_DESIGN_PREVIEW === '1';

/** Coordonnées en français, séparées par des points médians (maquette SOS). */
function positionLine(alert: SosAlert): string {
  if (alert.lat === null || alert.lng === null) return 'Position non renseignée';
  const lat = `${alert.lat.toFixed(4).replace('.', ',')} ${alert.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${alert.lng.toFixed(4).replace('.', ',')} ${alert.lng >= 0 ? 'E' : 'O'}`;
  return `${lat} · ${lng}${alert.accuracy_m !== null ? ` · ± ${Math.round(alert.accuracy_m)} m` : ''}`;
}

/** Durée courte pour la pastille : « 2 min », « 3 h », « hier ». */
function shortAge(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return 'à l’instant';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `${days} j`;
}

function timeFr(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « Contact d’urgence 1 — Camille (sœur) » → « Camille (sœur) ». */
function contactLabel(label: string): string {
  return label.replace(/^contact\s+d[’']urgence\s*\d*\s*[—–-]\s*/i, '').trim() || label;
}

/**
 * SOS en cours (maquette `SOS.dc.html`) — mobile d'abord, 390 px.
 * Le CRM ne remplace pas les secours : le 112 est toujours à un geste.
 */
export function SosScreen({ alert }: { alert: SosAlert }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [note, setNote] = useState('');
  const [takeover, setTakeover] = useState(true);

  // Mobile : l'alerte prend l'écran (la coque du CRM reste hors du chemin).
  useEffect(() => {
    const query = window.matchMedia('(min-width: 900px)');
    const apply = () => setTakeover(!query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // Prendre l'écran, c'est aussi empêcher la page de défiler derrière.
  useEffect(() => {
    if (!takeover) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
    };
  }, [takeover]);

  const status = taken && alert.status === 'open' ? 'taken' : alert.status;
  const takenBy = taken && alert.status === 'open' ? 'Vous' : alert.taken_by;
  const takenAt = taken && alert.status === 'open' ? new Date().toISOString() : alert.taken_at;

  const act = async (action: 'ack' | 'close') => {
    setError(null);
    if (PREVIEW) {
      if (action === 'ack') setTaken(true);
      else setConfirmClose(false);
      push({ message: 'Aperçu : rien n’a été envoyé.', ttlMs: 6000 });
      return;
    }
    setBusy(true);
    const result = await runCommand('sos_ack_close', {
      sos_id: alert.id,
      action,
      ...(note.trim() ? { note: note.trim() } : {})
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    push({
      message: action === 'ack' ? 'Vous avez pris cet SOS. La personne est prévenue.' : 'SOS clos. Le déroulé est au journal.',
      ttlMs: 8000
    });
    router.refresh();
  };

  const statusChip = (
    <span
      className={`${s.chip} ${status === 'open' ? s.chipDanger : status === 'taken' ? s.chipWarn : s.chipStone}`}
      style={{ minHeight: 26, padding: '0 12px', fontSize: 12.5 }}
    >
      {status === 'open' ? 'Urgence haute' : status === 'taken' ? 'Pris en charge' : 'Clos'} ·{' '}
      {shortAge(alert.created_at)}
    </span>
  );

  const phone = alert.contacts.find((contact) => contact.phone)?.phone ?? null;

  return (
    <div
      className={s.sosPage}
      data-testid="sos-screen"
      style={
        takeover
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 'calc(var(--z-emergency) + var(--z-sticky))',
              maxWidth: 'none',
              width: '100%',
              margin: 0,
              padding: '28px 16px 16px',
              overflowY: 'auto',
              overflowX: 'hidden',
              background: 'var(--lkv-surface)'
            }
          : { maxWidth: 980, width: '100%', margin: '0 auto', padding: '8px 0 16px' }
      }
    >
      <div style={{ maxWidth: 980, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className={s.between} style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
          <Link
            href="/sos"
            aria-label="Retour à la liste des SOS"
            className={s.btn}
            style={{
              width: 44,
              height: 44,
              minHeight: 44,
              padding: 0,
              background: 'var(--lkv-surface-card)',
              boxShadow: 'inset 0 0 0 1px var(--lkv-border)'
            }}
          >
            <IconChevronLeft />
          </Link>
          {statusChip}
        </div>

        <div className={s.col} style={{ gap: 6 }}>
          <h1 className={s.sosTitle} style={{ fontSize: 26, lineHeight: 1.15 }}>
            SOS en cours
          </h1>
          <span style={{ fontSize: 15, lineHeight: 1.45 }}>
            <strong>{alert.member}</strong>{' '}
            <span className={s.muted}>
              {alert.group_size !== null ? `· groupe de ${alert.group_size}` : '· groupe non renseigné'}
              {alert.trip ? ` · sortie « ${alert.trip} »` : ''}
            </span>
          </span>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={s.card} style={{ overflow: 'hidden', borderRadius: 'var(--lkv-radius-sm)' }}>
              <div
                className={s.sosMap}
                style={{ height: 173 }}
                role="img"
                aria-label={alert.lat !== null ? 'Carte : dernière position partagée' : 'Carte : position non renseignée'}
              >
                {alert.lat !== null && alert.lng !== null ? <span className={s.sosPin} /> : null}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <span className={s.mono} style={{ fontSize: 14, fontWeight: 600 }} data-testid="sos-position">
                  {positionLine(alert)}
                </span>
              </div>
            </div>
            <span className={s.muted} style={{ fontSize: 12.5, marginTop: -2 }}>
              {alert.position_at ? `Position partagée ${relativeFr(alert.position_at)}` : 'Aucune position partagée'} ·
              visible pendant l’alerte
            </span>

            <a
              href="tel:112"
              className={`${s.btn} ${s.sosBtn} ${s.sosCall}`}
              data-testid="sos-call-112"
              style={{ width: '100%', minHeight: 52, textDecoration: 'none', fontSize: 17, fontWeight: 700 }}
            >
              Appeler le 112
            </a>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <Button
                tone="pg"
                className={s.sosBtn}
                data-testid="sos-take"
                disabled={busy || status !== 'open'}
                onClick={() => void act('ack')}
              >
                {status === 'open' ? (busy ? 'Envoi…' : 'Je prends') : 'Déjà pris'}
              </Button>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className={`${s.btn} ${s.btnSoft} ${s.sosBtn}`}
                  style={{ textDecoration: 'none' }}
                >
                  <IconPhone size={16} />
                  Appeler {alert.member.split(' ')[0]}
                </a>
              ) : (
                <Button tone="soft" className={s.sosBtn} disabled>
                  Numéro non renseigné
                </Button>
              )}
            </div>
          </div>

          <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={s.card} style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Label>Contacts d’urgence déclarés</Label>
              {alert.contacts.length === 0 ? (
                <span className={s.muted} style={{ fontSize: 13 }}>
                  Aucun contact déclaré.
                </span>
              ) : (
                alert.contacts.map((contact) => (
                  <span
                    key={contact.label}
                    className={s.between}
                    style={{ minHeight: 44, flexWrap: 'nowrap', gap: 10, fontSize: 14.5 }}
                  >
                    <span style={{ minWidth: 0 }}>{contactLabel(contact.label)}</span>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className={s.linkAction}
                        style={{ color: 'var(--lkv-primary)', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                      >
                        Appeler
                      </a>
                    ) : (
                      <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>
                        numéro non renseigné
                      </span>
                    )}
                  </span>
                ))
              )}
            </div>

            <div className={s.card} style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="sos-timeline">
              <Label>Déroulé</Label>
              <span className={s.timeline}>
                <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
                  {timeFr(alert.created_at)}
                </span>
                <span style={{ fontSize: 14 }}>SOS déclenché depuis l’application</span>
              </span>
              <span className={s.timeline}>
                <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
                  {timeFr(alert.created_at)}
                </span>
                <span style={{ fontSize: 14 }}>Vous êtes prévenu (notification)</span>
              </span>
              {status === 'open' ? (
                <span className={s.timeline}>
                  <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
                    {timeFr(new Date(Date.parse(alert.created_at) + 5 * 60_000).toISOString())}
                  </span>
                  <span style={{ fontSize: 14 }}>Sans « Je prends », rappel et e-mail</span>
                </span>
              ) : null}
              {takenAt ? (
                <span className={s.timeline}>
                  <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
                    {timeFr(takenAt)}
                  </span>
                  <span style={{ fontSize: 14 }}>Pris par {takenBy}</span>
                </span>
              ) : null}

              {status === 'taken' ? (
                <div style={{ borderTop: '1px solid var(--lkv-border-subtle)', marginTop: 4, paddingTop: 2 }}>
                  {confirmClose ? (
                    <div className={s.colGap} style={{ gap: 8, paddingTop: 6 }}>
                      <Field
                        label="Note de clôture"
                        htmlFor="sos-close-note"
                        hint="Ce qui a été fait : appel passé, personne en sécurité."
                      >
                        <TextArea
                          id="sos-close-note"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          style={{ minHeight: 72 }}
                        />
                      </Field>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <Button tone="bad" disabled={busy} onClick={() => void act('close')}>
                          Clore le SOS
                        </Button>
                        <Button tone="soft" onClick={() => setConfirmClose(false)}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="sos-close"
                      disabled={busy}
                      onClick={() => setConfirmClose(true)}
                      className={s.linkAction}
                      style={{
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        color: 'var(--lkv-text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer'
                      }}
                    >
                      Clore le SOS après appel
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <p className={s.muted} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
          Le CRM ne remplace pas les secours. Chaque consultation de cette position est inscrite au journal.
        </p>
      </div>
    </div>
  );
}
