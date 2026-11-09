'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/ui/crm.module.css';
import { Chip } from '@/ui/chip';
import { Label } from '@/ui/card';
import { Button } from '@/ui/button';
import { Banner } from '@/ui/states';
import { IconChevronLeft, IconPhone } from '@/ui/icons';
import { useToast } from '@/ui/toast';
import { relativeFr } from '@/lib/format';
import { errorMessage, runCommand } from '@/components/data/cmd';

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

function positionLine(alert: SosAlert): string {
  if (alert.lat === null || alert.lng === null) return 'Position : non renseignée';
  const lat = `${alert.lat.toFixed(4)} ${alert.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${alert.lng.toFixed(4)} ${alert.lng >= 0 ? 'E' : 'O'}`;
  return `${lat} · ${lng}${alert.accuracy_m !== null ? ` · ± ${Math.round(alert.accuracy_m)} m` : ''}`;
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

  const act = async (action: 'ack' | 'close') => {
    setBusy(true);
    setError(null);
    const result = await runCommand('sos_ack_close', {
      target: `sos:${alert.id}`,
      action,
      reason: action === 'ack' ? 'je_prends' : 'cloture_manuel'
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

  return (
    <div className={s.sosPage}>
      <div className={s.between}>
        <Link href="/sos" aria-label="Retour à la liste des SOS" className={s.btn} style={{ width: 44, height: 44, minHeight: 44, padding: 0, background: 'var(--lkv-surface-card)', boxShadow: 'inset 0 0 0 1px var(--lkv-border)' }}>
          <IconChevronLeft />
        </Link>
        <Chip tone="danger">
          {alert.status === 'open' ? 'Urgence haute' : alert.status === 'taken' ? 'Pris en charge' : 'Clos'} · {relativeFr(alert.created_at)}
        </Chip>
      </div>

      <div className={s.col} style={{ gap: 4 }}>
        <h1 className={s.sosTitle}>SOS en cours</h1>
        <span>
          <strong>{alert.member}</strong>{' '}
          <span className={s.muted}>
            {alert.group_size !== null ? `· groupe de ${alert.group_size}` : '· groupe non renseigné'}
            {alert.trip ? ` · sortie « ${alert.trip} »` : ''}
          </span>
        </span>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {alert.taken_by ? (
        <Banner tone="info" title="Déjà pris">
          Pris par {alert.taken_by} {alert.taken_at ? relativeFr(alert.taken_at) : ''}. Un seul preneur à la fois.
        </Banner>
      ) : (
        <Banner tone="danger" title="Personne n’a pris">
          Sans « Je prends », un rappel et un e-mail partent après 5 minutes.
        </Banner>
      )}

      <div className={s.card} style={{ overflow: 'hidden' }}>
        <div
          className={s.sosMap}
          role="img"
          aria-label={alert.lat !== null ? 'Carte : dernière position partagée' : 'Carte : position non renseignée'}
        >
          {alert.lat !== null && alert.lng !== null ? <span className={s.sosPin} /> : null}
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={s.mono} style={{ fontSize: 13.5 }}>{positionLine(alert)}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            {alert.position_at ? `Position partagée ${relativeFr(alert.position_at)}` : 'Aucune position partagée'} · visible pendant
            l’alerte seulement
          </span>
        </div>
      </div>

      <a href="tel:112" className={`${s.btn} ${s.sosBtn} ${s.sosCall}`}>
        Appeler le 112
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Button
          tone="pg"
          className={s.sosBtn}
          shortcut="P"
          disabled={busy || alert.status !== 'open'}
          onClick={() => void act('ack')}
        >
          {alert.status === 'open' ? (busy ? 'Envoi…' : 'Je prends') : 'Déjà pris'}
        </Button>
        <Button
          tone="soft"
          className={s.sosBtn}
          icon={<IconPhone size={16} />}
          disabled={!alert.contacts[0]?.phone}
          onClick={() => {
            const phone = alert.contacts[0]?.phone;
            if (phone) window.location.href = `tel:${phone}`;
          }}
        >
          Appeler {alert.member.split(' ')[0]}
        </Button>
      </div>

      {alert.status !== 'closed' ? (
        <Button tone="soft" className={s.sosBtn} disabled={busy} onClick={() => void act('close')}>
          Clore le SOS (après appel)
        </Button>
      ) : null}

      <div className={s.card} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>Contacts d’urgence déclarés</Label>
        {alert.contacts.length === 0 ? (
          <span className={s.muted} style={{ fontSize: 13 }}>Aucun contact déclaré.</span>
        ) : (
          alert.contacts.map((contact) => (
            <span key={contact.label} className={s.between}>
              <span>{contact.label}</span>
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} style={{ fontWeight: 600 }}>
                  Appeler
                </a>
              ) : (
                <span className={s.muted}>numéro non renseigné</span>
              )}
            </span>
          ))
        )}
      </div>

      <div className={s.card} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>Déroulé</Label>
        <span className={s.timeline}>
          <span className={`${s.mono} ${s.muted}`}>{new Date(alert.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>SOS déclenché depuis l’application</span>
        </span>
        <span className={s.timeline}>
          <span className={`${s.mono} ${s.muted}`}>{new Date(alert.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>Vous êtes prévenu (notification)</span>
        </span>
        {alert.taken_at ? (
          <span className={s.timeline}>
            <span className={`${s.mono} ${s.muted}`}>{new Date(alert.taken_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>Pris par {alert.taken_by}</span>
          </span>
        ) : null}
      </div>

      <p className={s.muted} style={{ margin: 0, fontSize: 12 }}>
        Le CRM ne remplace pas les secours. Chaque consultation de cette position est inscrite au journal.
      </p>
    </div>
  );
}
