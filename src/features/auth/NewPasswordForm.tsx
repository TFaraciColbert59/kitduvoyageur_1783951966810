'use client';

import { useId, useState, useTransition, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { newPasswordAction } from './passwordResetActions';
import {
  newPasswordSchema,
  PASSWORD_RESET_DONE_PATH,
  PASSWORD_RESET_TEXT,
} from './passwordReset';

/**
 * Nouveau mot de passe, après le lien du courriel (voir `passwordReset.ts`). Deux saisies, la même
 * règle que le serveur (zod), l'échec dit en clair sous le champ. Une fois changé : retour au compte
 * par `useRouter()` (la session du lien est déjà ouverte).
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
const ERROR: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-danger-dark)' };

export function NewPasswordForm({ email }: { email: string | null }) {
  const id = useId();
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const mismatch = parsed.error.issues.some((i) => i.message === 'differ');
      setError(mismatch ? PASSWORD_RESET_TEXT.mismatch : PASSWORD_RESET_TEXT.invalid);
      return;
    }
    start(async () => {
      try {
        const res = await newPasswordAction({ password, confirm });
        if (!res.success) {
          setError(res.error);
          return;
        }
        setPassword('');
        setConfirm('');
        toast(PASSWORD_RESET_TEXT.done, 'success');
        router.push(PASSWORD_RESET_DONE_PATH);
        router.refresh();
      } catch {
        setError(PASSWORD_RESET_TEXT.unavailable);
      }
    });
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-3)' }} noValidate>
      <div>
        <label htmlFor={`${id}-pw`} style={LABEL}>
          Nouveau mot de passe (8 caractères au moins)
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
          {email ? `Pour te connecter avec ${email}.` : 'Pour te reconnecter avec ton adresse e-mail.'}
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-confirm`} style={LABEL}>
          Le même mot de passe, une seconde fois
        </label>
        <input
          id={`${id}-confirm`}
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          style={FIELD}
          value={confirm}
          disabled={pending}
          onChange={(e) => setConfirm(e.target.value)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Changer mon mot de passe
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
