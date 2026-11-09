'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/ui/crm.module.css';
import { Banner, Skeleton } from '@/ui/states';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import { Field, TextInput } from '@/ui/field';
import { supabaseBrowser } from '@/lib/supabase/browser';

type TotpFactor = { id: string; friendly_name?: string | null; status: string };

/**
 * Double authentification (EX-AUTH-02) : enrôlement TOTP puis vérification.
 * Le code à 6 chiffres n'est jamais conservé.
 */
export function MfaPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState<TotpFactor | null>(null);
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string | null; secret: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = supabaseBrowser();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError('Impossible de lire vos facteurs d’authentification. Réessayez dans un instant.');
        return;
      }
      const totp = (data?.totp ?? []) as TotpFactor[];
      setVerified(totp.find((factor) => factor.status === 'verified') ?? null);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : '';
      setError(
        /Configuration publique incomplète/i.test(message)
          ? 'La configuration du CRM est incomplète sur cet environnement.'
          : 'Le serveur d’authentification n’a pas répondu.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      // Un facteur non vérifié bloque un nouvel enrôlement : on le retire d'abord.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const factor of (list?.all ?? []) as TotpFactor[]) {
        if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LKDV Control' });
      if (enrollError || !data) {
        setError('L’enrôlement a échoué. Vérifiez que la double authentification est autorisée sur ce projet.');
        return;
      }
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code ?? null, secret: data.totp.secret ?? null });
    } catch {
      setError('L’enrôlement a échoué. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Le code fait exactement 6 chiffres.');
      return;
    }
    const factorId = enrollment?.factorId ?? verified?.id;
    if (!factorId) {
      setError('Aucun facteur à vérifier. Recommencez l’enrôlement.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError('Le défi d’authentification a échoué. Réessayez.');
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim()
      });
      if (verifyError) {
        setError('Code refusé. Vérifiez l’heure de votre téléphone puis saisissez le code courant.');
        return;
      }
      setCode('');
      router.push('/');
      router.refresh();
    } catch {
      setError('La vérification a échoué. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={s.colGap} aria-busy="true">
        <Skeleton height={14} width="40%" />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </div>
    );
  }

  return (
    <div className={s.colGap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {enrollment ? (
        <>
          <Banner tone="info" title="Activez l’application d’authentification">
            Scannez le QR code avec votre application (1Password, Google Authenticator, Authy…), puis saisissez le code
            à 6 chiffres.
          </Banner>

          <div className={s.rowFlex} style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            {enrollment.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enrollment.qr}
                alt="QR code d’enrôlement de la double authentification"
                width={168}
                height={168}
                style={{ borderRadius: 12, border: '1px solid var(--lkv-border)', background: 'var(--lkv-surface-card)' }}
              />
            ) : null}
            <div className={s.colGapSm} style={{ minWidth: 200 }}>
              <span className={s.label}>Clé à recopier</span>
              <span className={s.mono} style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
                {enrollment.secret ?? 'non renseignée'}
              </span>
              <span className={s.muted} style={{ fontSize: 12.5 }}>
                Gardez cette clé : elle permet de réinstaller l’application sans perdre l’accès.
              </span>
            </div>
          </div>
        </>
      ) : verified ? (
        <Banner tone="info" title="Code à 6 chiffres">
          Ouvrez votre application d’authentification et saisissez le code courant.
        </Banner>
      ) : (
        <>
          <Banner tone="warn" title="Double authentification non activée">
            L’accès au CRM est refusé sans second facteur. Activez-le maintenant : c’est une obligation, pas une option.
          </Banner>
          <Button tone="pg" onClick={() => void startEnrollment()} disabled={busy}>
            {busy ? 'Préparation…' : 'Activer la double authentification'}
          </Button>
        </>
      )}

      {enrollment || verified ? (
        <>
          <Field label="Code à 6 chiffres" htmlFor="mfa-code" required error={error && code.length > 0 ? error : null}>
            <TextInput
              id="mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              style={{ minHeight: 48, fontFamily: 'var(--font-mono)', fontSize: 20, letterSpacing: '0.3em', fontWeight: 600 }}
              invalid={Boolean(error)}
            />
          </Field>
          <Button tone="pg" onClick={() => void verify()} disabled={busy}>
            {busy ? 'Vérification…' : 'Vérifier le code'}
          </Button>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            <Chip tone="stone">Session 12 h max</Chip> Le code n’est jamais enregistré.
          </span>
        </>
      ) : null}
    </div>
  );
}
