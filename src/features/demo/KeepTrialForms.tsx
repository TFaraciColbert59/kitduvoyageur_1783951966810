'use client';

import { useId, useState, useTransition, type CSSProperties, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { keepTrialEmailAction, keepTrialPasswordAction } from './keepTrialActions';
import { KEEP_TRIAL_TEXT } from './keepTrial';

/**
 * Garder son essai (plan 2.3) : deux petits formulaires, un par temps du parcours
 * (voir `keepTrial.ts`). Styles en ligne sur les jetons `--lkv-*`, comme `TravellerCard`.
 * Tout échec est dit en clair sous le champ ; rien n'est jamais perdu côté essai.
 */

const FIELD: CSSProperties = {
  width: '100%',
  minHeight: 'var(--lkv-touch-min)',
  borderRadius: 'var(--lkv-radius-control)',
  border: '1px solid var(--lkv-field-border)',
  background: 'var(--lkv-field-bg)',
  color: 'var(--lkv-text-primary)',
  padding: '10px var(--space-3)',
  fontSize: 16,
};
const LABEL: CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontSize: 'var(--lkv-text-caption)',
  fontWeight: 600,
  color: 'var(--lkv-text-primary)',
};
const NOTE: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-muted)' };
const STATUS: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-body-sm)', color: 'var(--lkv-text-primary)' };
const ERROR: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-danger-dark)' };

export function KeepTrialEmailForm() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await keepTrialEmailAction({ email });
        if (res.success) setSent(true);
        else setError(res.error);
      } catch {
        setError(KEEP_TRIAL_TEXT.unavailable);
      }
    });
  };

  if (sent) {
    return (
      <p role="status" aria-live="polite" style={STATUS}>
        {KEEP_TRIAL_TEXT.sent}
      </p>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-3)' }} noValidate>
      <div>
        <label htmlFor={`${id}-email`} style={LABEL}>
          Ton adresse e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          style={FIELD}
          value={email}
          disabled={pending}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? `${id}-err` : `${id}-help`}
        />
        <p id={`${id}-help`} style={{ ...NOTE, marginTop: 'var(--space-1)' }}>
          Un e-mail de confirmation part à cette adresse. Rien n’est publié.
        </p>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Garder mon voyage
        </Button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" style={ERROR}>
          {error}
        </p>
      )}
    </form>
  );
}

export function KeepTrialPasswordForm({ email }: { email: string | null }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await keepTrialPasswordAction({ password });
        if (res.success) {
          setPassword('');
          setDone(true);
        } else setError(res.error);
      } catch {
        setError(KEEP_TRIAL_TEXT.unavailable);
      }
    });
  };

  if (done) {
    return (
      <p role="status" aria-live="polite" style={STATUS}>
        {KEEP_TRIAL_TEXT.passwordDone}
      </p>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-3)' }} noValidate>
      <div>
        <label htmlFor={`${id}-pw`} style={LABEL}>
          Mot de passe (8 caractères au moins)
        </label>
        <input
          id={`${id}-pw`}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          style={FIELD}
          value={password}
          disabled={pending}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? `${id}-err` : `${id}-help`}
        />
        <p id={`${id}-help`} style={{ ...NOTE, marginTop: 'var(--space-1)' }}>
          {email ? `Pour te reconnecter avec ${email}. ` : ''}
          Sans mot de passe, tu restes connecté·e sur cet appareil seulement.
        </p>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Enregistrer le mot de passe
        </Button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" style={ERROR}>
          {error}
        </p>
      )}
    </form>
  );
}
