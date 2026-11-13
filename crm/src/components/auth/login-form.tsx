'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { Field, TextInput } from '../../ui/field';
import { supabaseBrowser } from '../../lib/supabase/browser';

function frenchAuthError(message: string): string {
  const value = message.toLowerCase();
  if (value.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (value.includes('email not confirmed')) return 'Cet e-mail n’est pas encore confirmé.';
  if (value.includes('too many requests') || value.includes('rate limit'))
    return 'Trop de tentatives. Attendez une minute puis réessayez.';
  if (value.includes('mfa')) return 'La double authentification doit être vérifiée.';
  return 'La connexion a échoué. Vérifiez vos identifiants puis réessayez.';
}

/** Formulaire de connexion : aucune donnée n'est conservée après l'envoi. */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes('@')) {
      setError('Entrez votre adresse e-mail professionnelle.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe fait au moins 8 caractères.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(frenchAuthError(authError.message));
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') router.push('/');
      else router.push('/double-authentification');
      router.refresh();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : '';
      setError(
        /Configuration publique incomplète/i.test(message)
          ? 'La configuration du CRM est incomplète sur cet environnement (URL et clé publiques Supabase).'
          : 'Le serveur d’authentification n’a pas répondu. Réessayez dans un instant.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={s.colGap}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Field label="Adresse e-mail" htmlFor="login-email" required hint="Votre adresse d’équipe, pas votre compte membre.">
        <TextInput
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="prenom@lekitduvoyageur.fr"
          invalid={Boolean(error)}
        />
      </Field>

      <Field label="Mot de passe" htmlFor="login-password" required hint="12 caractères minimum côté équipe.">
        <TextInput
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Button type="submit" tone="pg" disabled={busy}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </Button>

      <span className={s.muted} style={{ fontSize: 12.5 }}>
        Session de 12 h maximum, verrou après 30 minutes d’inactivité. La double authentification est obligatoire :
        elle vous sera demandée juste après.
      </span>
    </form>
  );
}
