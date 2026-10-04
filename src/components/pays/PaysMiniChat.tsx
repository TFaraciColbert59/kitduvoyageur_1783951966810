'use client';

import React, { useState, useCallback } from 'react';
import { useCountryPracticalGuide } from '@/hooks/useCountryPracticalGuide';
import { extractKitItems } from '@/features/pays/chat/paysChatPrompt';
import { sendPaysChatMessage, type PaysChatImage } from '@/features/pays/chat/paysChatClient';
import SmartImage from '@/components/ui/SmartImage';

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  degraded?: boolean;
  ragUsed?: boolean;
  images?: PaysChatImage[];
}

interface PaysMiniChatProps {
  countryCode: string;
  countryName: string;
}

const SUGGESTIONS = ['Crée mon kit de voyage', 'Quand partir ?'];

/**
 * POC mini-chat ancré de la page Pays (§2/§6/§9 du rapport).
 * Bottom-bar fixe au-dessus de la navigation basse via --bottom-nav-height.
 * Aucune PII envoyée : seuls code pays + question + extraits publics du guide.
 * « Ajouter au kit » = copie presse-papiers (stub explicite, pas d'écriture inventaire).
 */
export function PaysMiniChat({ countryCode, countryName }: PaysMiniChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: guide } = useCountryPracticalGuide(countryCode);
  const guideSources = guide?.sections?.meilleure_saison?.sources ?? [];

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      setError(null);
      setCopied(false);
      setMessages((prev) => [...prev, { role: 'user', text: q }]);
      setInput('');
      setLoading(true);
      try {
        const reply = await sendPaysChatMessage(countryCode, q, { countryName });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: reply.text,
            degraded: reply.degraded,
            ragUsed: reply.ragUsed,
            images: reply.images,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Échec de la réponse. Réessaie.');
      } finally {
        setLoading(false);
      }
    },
    [countryCode, countryName, loading]
  );

  const copyKit = useCallback(async (text: string) => {
    const items = extractKitItems(text);
    if (items.length === 0) return;
    const list = items.join('\n');
    try {
      await navigator.clipboard.writeText(list);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = list;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
  }, []);

  return (
    <div
      className="fixed left-3 right-3 z-30 md:left-auto md:right-6 md:w-[380px]"
      style={{ bottom: 'var(--bottom-nav-height, 12px)' }}
    >
      {open && (
        <div className="glass mb-2 flex max-h-[50vh] flex-col overflow-hidden rounded-2xl">
          <div role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="text-sm opacity-70">
                Pose ta question sur {countryName} : kit de voyage, meilleure période, activités.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <p className={m.role === 'user' ? 'text-sm font-semibold' : 'text-sm'}>{m.text}</p>
                {m.role === 'assistant' && m.degraded && (
                  <p className="text-xs opacity-70">Réponse dégradée (IA hors-ligne).</p>
                )}
                {m.role === 'assistant' && m.ragUsed && (
                  <p className="text-xs opacity-70">Réponse ancrée au guide pays.</p>
                )}
                {m.role === 'assistant' && m.images && m.images.length > 0 && (
                  <div>
                    <div className="mt-1 flex gap-2 overflow-x-auto">
                      {m.images.map((img) => (
                        <SmartImage
                          key={img.url}
                          src={img.thumbUrl}
                          alt={img.alt}
                          className="h-20 w-28 shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                    <p className="text-xs opacity-70">
                      Photos :{' '}
                      {m.images.map((img, j) => (
                        <span key={img.url}>
                          {j > 0 && ', '}
                          <a href={img.authorUrl} target="_blank" rel="noreferrer">
                            {img.authorName}
                          </a>{' '}
                          via Unsplash
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {m.role === 'assistant' && extractKitItems(m.text).length > 0 && (
                  <button
                    type="button"
                    onClick={() => copyKit(m.text)}
                    className="glass-capsule-btn mt-1 min-h-[44px] text-xs"
                  >
                    {copied ? 'Liste copiée ✓' : 'Copier la liste (Ajouter au kit)'}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="animate-pulse space-y-2" aria-hidden="true">
                <div className="h-4 w-3/4 rounded" />
                <div className="h-4 w-1/2 rounded" />
              </div>
            )}
            {error && (
              <div>
                <p className="text-sm font-semibold">Oups : {error}</p>
                <button
                  type="button"
                  onClick={() => messages.length > 0 && send(messages.filter((m) => m.role === 'user').slice(-1)[0]?.text ?? '')}
                  className="glass-capsule-btn mt-1 min-h-[44px] text-xs"
                >
                  Réessayer
                </button>
              </div>
            )}
            {guideSources.length > 0 && (
              <p className="text-xs opacity-70">
                Sources du guide :{' '}
                {guideSources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ))}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t p-2"
          >
            <label htmlFor="pays-minichat-input" className="sr-only">
              Que voulez-vous savoir ?
            </label>
            <input
              id="pays-minichat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que voulez-vous savoir ?"
              className="glass-input min-h-[44px] flex-1 text-[16px]"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              aria-label="Envoyer la question"
              className="glass-capsule-btn min-h-[44px] min-w-[44px]"
            >
              ↑
            </button>
          </form>
        </div>
      )}
      <div className="flex gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setOpen(true);
              send(s);
            }}
            className="glass-capsule-btn min-h-[44px] flex-1 text-xs"
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Fermer le mini-chat' : 'Ouvrir le mini-chat'}
          className="glass-capsule-btn min-h-[44px] min-w-[44px]"
        >
          {open ? '✕' : '💬'}
        </button>
      </div>
    </div>
  );
}
