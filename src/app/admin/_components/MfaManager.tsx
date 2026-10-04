'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';

import { Button, EmptyState } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { useAdminFetch } from './useCsrfToken';
import { AdminField, AdminInput } from './AdminField';

export interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

/** Îlot client : inscription TOTP (QR) + élévation AAL2 + révocation. */
export function MfaManager({ initialFactors }: { initialFactors: TotpFactor[] }) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [factors, setFactors] = useState<TotpFactor[]>(initialFactors);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aal2, setAal2] = useState<boolean | null>(null);

  async function refresh() {
    const supabase = createClient();
    const [{ data: list }, aal] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors(((list?.totp ?? []) as TotpFactor[]).filter((f) => f.status === 'verified'));
    setAal2(aal.data?.currentLevel === 'aal2');
  }

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (err || !data) throw new Error('Inscription impossible');
      setPendingFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setManualSecret(data.totp.secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndRecord() {
    if (!pendingFactorId || code.trim().length < 6) {
      setError('Saisissez le code à 6 chiffres');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: pendingFactorId,
      });
      if (challengeError || !challenge) throw new Error('Défi impossible');
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw new Error('Code invalide');
      const res = await call('/api/admin/mfa', {
        method: 'POST',
        body: JSON.stringify({ action: 'enrolled', factor_id: pendingFactorId }),
      });
      if (!res.ok) throw new Error(`Journalisation impossible (${res.status})`);
      setQrSvg(null);
      setPendingFactorId(null);
      setManualSecret(null);
      setCode('');
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  async function elevate() {
    if (factors.length === 0 || code.trim().length < 6) {
      setError('Saisissez le code de votre application');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factors[0].id,
      });
      if (challengeError || !challenge) throw new Error('Défi impossible');
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factors[0].id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw new Error('Code invalide');
      setCode('');
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  async function unenroll(factorId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await call('/api/admin/mfa', {
        method: 'POST',
        body: JSON.stringify({ action: 'unenroll', factor_id: factorId }),
      });
      if (!res.ok) throw new Error(`Échec (${res.status})`);
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[color:var(--glass-label-secondary)]">
        Session actuelle :{' '}
        <strong>{aal2 === null ? 'inconnue (actualisez)' : aal2 ? 'AAL2 vérifiée' : 'AAL1'}</strong>
        . Les rôles et récompenses exigent AAL2.
      </p>

      {factors.length === 0 && !qrSvg ? (
        <EmptyState
          title="Aucun second facteur"
          description="Inscrivez une application d'authentification (TOTP) pour débloquer les actions sensibles."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--glass-rim)] p-3"
            >
              <span className="text-sm font-semibold text-[color:var(--glass-label)]">
                {f.friendly_name || 'TOTP'} · {f.status}
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={!csrfReady || busy}
                onClick={() => unenroll(f.id)}
              >
                Révoquer
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!qrSvg ? (
        <div>
          <Button variant="secondary" disabled={busy} onClick={enroll}>
            Inscrire une application TOTP
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4">
          <p className="text-sm font-semibold text-[color:var(--glass-label)]">
            Scannez ce QR avec votre application, puis saisissez le code
          </p>
          {/* SVG généré par Supabase, ré-assaini par principe (aucune entrée utilisateur) */}
          <div
            className="max-w-55 self-start bg-white p-2"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qrSvg) }}
          />
          {manualSecret ? (
            <p className="text-xs text-[color:var(--glass-label-secondary)]">
              Saisie manuelle : <code>{manualSecret}</code>
            </p>
          ) : null}
          <AdminField label="Code à 6 chiffres">
            <AdminInput
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              disabled={busy}
            />
          </AdminField>
          <div>
            <Button variant="primary" size="sm" disabled={!csrfReady || busy} onClick={verifyAndRecord}>
              Vérifier et activer
            </Button>
          </div>
        </div>
      )}

      {factors.length > 0 && !qrSvg ? (
        <div className="flex flex-wrap items-end gap-2">
          <AdminField label="Code AAL2 (élever la session)">
            <AdminInput
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              disabled={busy}
            />
          </AdminField>
          <Button variant="secondary" size="sm" disabled={busy} onClick={elevate}>
            Vérifier
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
