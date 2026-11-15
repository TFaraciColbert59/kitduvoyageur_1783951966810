'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Trash2, Webhook } from 'lucide-react';
import { LiveRegion } from '@/components/accessibility';

interface SanitizedKey {
  id: string;
  clientName: string;
  prefix: string;
  scopes: string[];
  rateLimitPerMin: number;
  createdAtIso: string;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
}

interface SanitizedWebhook {
  id: string;
  callbackUrl: string;
  events: string[];
  active: boolean;
  createdAtIso: string;
  revokedAtIso: string | null;
}

export function DeveloperConsole() {
  const [keys, setKeys] = useState<SanitizedKey[]>([]);
  const [webhooks, setWebhooks] = useState<SanitizedWebhook[]>([]);
  const [clientName, setClientName] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, hooksRes] = await Promise.all([
        fetch('/api/developer/keys', { credentials: 'same-origin' }),
        fetch('/api/developer/webhooks', { credentials: 'same-origin' }),
      ]);
      if (!keysRes.ok || !hooksRes.ok) {
        throw new Error('Authentification requise pour accéder à la console développeur.');
      }
      const keysJson = (await keysRes.json()) as { keys: SanitizedKey[] };
      const hooksJson = (await hooksRes.json()) as { webhooks: SanitizedWebhook[] };
      setKeys(keysJson.keys ?? []);
      setWebhooks(hooksJson.webhooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur console développeur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientName.trim()) return;
    setError(null);
    const res = await fetch('/api/developer/keys', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: clientName.trim(),
        scopes: ['read:activities', 'read:routes'],
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { key?: SanitizedKey; plaintextSecret?: string; error?: string }
      | null;
    if (!res.ok || !json?.key) {
      setError(json?.error || 'Création de clé impossible.');
      return;
    }
    setKeys((prev) => [...prev, json.key!]);
    setRevealedSecret(json.plaintextSecret ?? null);
    setClientName('');
    setStatus(`Client API ${json.key.clientName} créé.`);
  };

  const revokeKey = async (id: string) => {
    setError(null);
    const res = await fetch('/api/developer/keys', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setError('Révocation de clé impossible.');
      return;
    }
    const json = (await res.json()) as { key: SanitizedKey };
    setKeys((prev) => prev.map((k) => (k.id === id ? json.key : k)));
    setStatus(`Clé ${json.key.prefix} révoquée.`);
  };

  const createWebhook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!callbackUrl.trim()) return;
    setError(null);
    const res = await fetch('/api/developer/webhooks', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callbackUrl: callbackUrl.trim(),
        events: ['activity.created', 'consent.revoked'],
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { subscription?: SanitizedWebhook; signingSecret?: string; error?: string }
      | null;
    if (!res.ok || !json?.subscription) {
      setError(json?.error || 'Création de webhook impossible.');
      return;
    }
    setWebhooks((prev) => [...prev, json.subscription!]);
    setRevealedSecret(json.signingSecret ?? null);
    setCallbackUrl('');
    setStatus('Abonnement webhook enregistré.');
  };

  const revokeWebhook = async (id: string) => {
    const res = await fetch('/api/developer/webhooks', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setError('Révocation webhook impossible.');
      return;
    }
    const json = (await res.json()) as { subscription: SanitizedWebhook };
    setWebhooks((prev) => prev.map((w) => (w.id === id ? json.subscription : w)));
    setStatus('Abonnement webhook révoqué.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <LiveRegion message={status} politeness="polite" />
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Surface technique hors navigation grand public · S6.24
        </p>
        <h1 className="text-2xl font-semibold">API développeurs &amp; Webhooks signés</h1>
        <p className="text-sm text-slate-600">
          Les clés sont limitées par scopes, soumises à quota et révocables instantanément.
          Les webhooks sont signés HMAC-SHA256 avec fenêtre anti-rejeu (±300 s).
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <ShieldAlert size={16} aria-hidden="true" /> {error}
        </div>
      ) : null}

      {revealedSecret ? (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <b>Secret affiché une seule fois :</b> <code>{revealedSecret}</code>
        </div>
      ) : null}

      {loading ? <p role="status">Chargement de la console développeur…</p> : null}

      <section className="space-y-3 rounded-2xl border p-4" aria-labelledby="dev-keys-h">
        <h2 id="dev-keys-h" className="flex items-center gap-2 text-lg font-medium">
          <KeyRound size={18} aria-hidden="true" /> Clients API scopés
        </h2>
        <form onSubmit={createKey} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="dev-client-name">
            Nom du client API
          </label>
          <input
            id="dev-client-name"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom de votre intégration"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white">
            Créer une clé
          </button>
        </form>
        <ul className="space-y-2">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <b>{key.clientName}</b> · <code>{key.prefix}…</code>
                <p className="text-xs text-slate-600">
                  Scopes : {key.scopes.join(', ')} · {key.rateLimitPerMin}/min ·{' '}
                  {key.revokedAtIso ? 'Révoquée' : 'Active'}
                </p>
              </div>
              {!key.revokedAtIso ? (
                <button
                  type="button"
                  onClick={() => void revokeKey(key.id)}
                  aria-label={`Révoquer la clé ${key.clientName}`}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-red-700"
                >
                  <Trash2 size={13} aria-hidden="true" /> Révoquer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border p-4" aria-labelledby="dev-hooks-h">
        <h2 id="dev-hooks-h" className="flex items-center gap-2 text-lg font-medium">
          <Webhook size={18} aria-hidden="true" /> Abonnements Webhook
        </h2>
        <form onSubmit={createWebhook} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="dev-webhook-url">
            URL callback HTTPS
          </label>
          <input
            id="dev-webhook-url"
            type="url"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            placeholder="https://partenaire.exemple.fr/webhooks/lkdv"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white">
            Ajouter webhook
          </button>
        </form>
        <ul className="space-y-2">
          {webhooks.map((hook) => (
            <li key={hook.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <b>{hook.callbackUrl}</b>
                <p className="text-xs text-slate-600">
                  Événements : {hook.events.join(', ')} · {hook.active ? 'Actif' : 'Révoqué'}
                </p>
              </div>
              {hook.active ? (
                <button
                  type="button"
                  onClick={() => void revokeWebhook(hook.id)}
                  aria-label={`Révoquer webhook ${hook.callbackUrl}`}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-red-700"
                >
                  <Trash2 size={13} aria-hidden="true" /> Révoquer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default DeveloperConsole;
