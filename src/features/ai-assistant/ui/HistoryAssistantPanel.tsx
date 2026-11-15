'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import {
  buildHistoryFacts,
  sanitizeHistoryAnswer,
  suggestHistoryQuestions,
  type HistoryActivityRow,
  type HistoryFacts,
} from '../history/historyContract';
import { formatDurationFr, formatNumberFr, hasValue } from '../contracts';

export interface HistoryAssistantPanelProps {
  sessions: readonly ProgressionSession[];
  initialConsentGranted?: boolean;
  onConsentChange?: (granted: boolean) => void;
}

function toHistoryRows(sessions: readonly ProgressionSession[]): HistoryActivityRow[] {
  return sessions
    .filter((s) => s.startedAt)
    .map((s) => ({
      id: s.id,
      started_at: s.startedAt!,
      distance_km: s.km,
      duration_seconds: s.durationS,
      elevation_gain_m: s.dplus,
      route_name: null,
      region: s.massif,
    }));
}

function answerDeterministically(question: string, facts: HistoryFacts): string {
  const q = question.toLowerCase();
  const count = facts.window.activities;
  const dist = hasValue(facts.totals.distanceKm)
    ? `${formatNumberFr(facts.totals.distanceKm.value, 1)} km`
    : 'distance non disponible';
  const dur = hasValue(facts.totals.durationSeconds)
    ? formatDurationFr(facts.totals.durationSeconds.value)
    : 'durée non disponible';
  const dplus = hasValue(facts.totals.elevationGainM)
    ? `${formatNumberFr(facts.totals.elevationGainM.value, 0)} m de D+`
    : 'dénivelé non disponible';

  if (q.includes('longue') || q.includes('record') || q.includes('sortie')) {
    if (facts.longest) {
      const lDist = hasValue(facts.longest.distanceKm)
        ? `${formatNumberFr(facts.longest.distanceKm.value, 1)} km`
        : 'distance non mesurée';
      const lRegion = facts.longest.region ? ` (${facts.longest.region})` : '';
      return `Sur ${count} sortie(s) analysée(s), la plus longue enregistrée atteint ${lDist}${lRegion}. Total cumulé : ${dist} en ${dur}.`;
    }
  }
  if (q.includes('dénivelé') || q.includes('denivele') || q.includes('d+')) {
    const avgDp = hasValue(facts.averages.elevationGainM)
      ? `${formatNumberFr(facts.averages.elevationGainM.value, 0)} m`
      : 'non calculable';
    return `Cumul enregistré sur ${count} sortie(s) : ${dplus} (moyenne par sortie : ${avgDp}).`;
  }
  const avgDist = hasValue(facts.averages.distanceKm)
    ? `${formatNumberFr(facts.averages.distanceKm.value, 1)} km`
    : 'non calculable';
  return `Historique réel (${count} sortie(s)) : ${dist}, ${dur}, ${dplus}. Distance moyenne par sortie : ${avgDist}.`;
}

export function HistoryAssistantPanel({
  sessions,
  initialConsentGranted,
  onConsentChange,
}: HistoryAssistantPanelProps) {
  const [consentGranted, setConsentGranted] = useState<boolean>(initialConsentGranted ?? false);
  const [consentBusy, setConsentBusy] = useState<boolean>(false);
  const [provider, setProvider] = useState<'claude' | 'gemini'>('claude');
  const [question, setQuestion] = useState<string>('');
  const [answerText, setAnswerText] = useState<string | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (initialConsentGranted !== undefined) return;
    let active = true;
    fetch('/api/compte/consents')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { purposes?: Array<{ id: string; granted: boolean }> } | null) => {
        if (!active || !data?.purposes) return;
        const found = data.purposes.find((p) => p.id === 'personal_performance');
        if (found) setConsentGranted(Boolean(found.granted));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialConsentGranted]);

  const rows = useMemo(() => toHistoryRows(sessions), [sessions]);
  const facts = useMemo(() => (consentGranted ? buildHistoryFacts(rows) : null), [consentGranted, rows]);
  const questions = useMemo(() => (facts ? suggestHistoryQuestions(facts) : []), [facts]);

  const toggleConsent = async () => {
    const next = !consentGranted;
    setConsentBusy(true);
    setAiStatusNote(null);
    try {
      const res = await fetch('/api/compte/consents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'personal_performance', granted: next }),
      });
      if (res.ok || initialConsentGranted !== undefined) {
        setConsentGranted(next);
        onConsentChange?.(next);
        if (!next) {
          setAnswerText(null);
          setAiStatusNote('Consentement révoqué : lecture de l’historique bloquée.');
        }
      } else {
        setConsentGranted(next);
        onConsentChange?.(next);
      }
    } catch {
      setConsentGranted(next);
      onConsentChange?.(next);
    } finally {
      setConsentBusy(false);
    }
  };

  const ask = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || !consentGranted || !facts || facts.window.activities === 0) return;
    setQuestion(trimmed);
    setLoading(true);
    setAiStatusNote(null);

    const deterministicReply = answerDeterministically(trimmed, facts);
    setAnswerText(deterministicReply);

    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          messages: [
            {
              role: 'system',
              content:
                'Réponds en français uniquement sur les agrégats fournis, sans coordonnées GPS ni notes privées.',
            },
            {
              role: 'user',
              content: `Question: ${trimmed}\nAgrégats: ${JSON.stringify({
                activities: facts.window.activities,
                totals: facts.citations,
              })}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { text?: unknown };
        const clean = sanitizeHistoryAnswer(json?.text);
        if (clean) {
          setAnswerText(clean);
          setAiStatusNote(`Réponse générée via ${provider === 'claude' ? 'Claude' : 'Gemini'}.`);
        } else {
          setAiStatusNote(
            'Synthèse déterministe affichée (le fournisseur externe n’a pas respecté le contrat ou n’est pas configuré).'
          );
        }
      } else {
        setAiStatusNote(
          `Synthèse locale affichée : fournisseur ${provider === 'claude' ? 'Claude' : 'Gemini'} non configuré sur cet environnement.`
        );
      }
    } catch {
      setAiStatusNote(
        `Synthèse locale affichée : fournisseur ${provider === 'claude' ? 'Claude' : 'Gemini'} indisponible.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="lkdv-prog-card lkdv-history-assistant"
      data-testid="history-assistant-panel"
      aria-label="Assistant historique Claude et Gemini"
      style={{ display: 'grid', gap: 10 }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bot size={16} aria-hidden="true" />
          <strong>Assistant historique (S2.38 · Claude / Gemini)</strong>
        </div>
        <button
          type="button"
          className="lkdv-prog-period"
          aria-pressed={consentGranted}
          disabled={consentBusy}
          onClick={() => void toggleConsent()}
          data-testid="history-assistant-consent-toggle"
        >
          {consentGranted ? 'Révoquer l’accès historique' : 'Autoriser l’accès historique'}
        </button>
      </header>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11.5 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            background: consentGranted ? 'rgba(61,122,82,0.12)' : 'rgba(185,138,46,0.15)',
          }}
        >
          {consentGranted ? <ShieldCheck size={13} aria-hidden="true" /> : <ShieldAlert size={13} aria-hidden="true" />}
          {consentGranted ? 'Consentement personal_performance actif (révocable)' : 'Accès à l’historique bloqué sans consentement'}
        </span>
      </div>

      {!consentGranted ? (
        <p style={{ margin: 0, fontSize: 12.5, opacity: 0.8 }}>
          Aucune donnée n’est lue tant que le consentement <code>personal_performance</code> n’est pas accordé. Seuls les agrégats (distance, durée, D+, massif) sont exposés, jamais tes traces GPS ni notes privées.
        </p>
      ) : !facts || facts.window.activities === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, opacity: 0.8 }}>
          Aucune sortie enregistrée : il n’y a pas encore d’historique à interroger.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12 }}>Connecteur cible :</span>
            {(['claude', 'gemini'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className="lkdv-prog-period"
                aria-pressed={provider === item}
                onClick={() => setProvider(item)}
              >
                {item === 'claude' ? 'Claude' : 'Gemini'}
              </button>
            ))}
          </div>

          {questions.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="lkdv-prog-period"
                  onClick={() => void ask(q)}
                  disabled={loading}
                >
                  <Sparkles size={12} aria-hidden="true" /> {q}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pose une question sur ton historique…"
              aria-label="Question sur ton historique sportif"
              style={{ flex: '1 1 200px', minHeight: 34, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.18)' }}
            />
            <button type="submit" className="lkdv-prog-period" disabled={loading || !question.trim()}>
              {loading ? 'Analyse…' : 'Interroger'}
            </button>
          </form>

          {answerText ? (
            <div
              data-testid="history-assistant-answer"
              style={{
                padding: 10,
                borderRadius: 12,
                background: 'rgba(23,64,44,0.06)',
                display: 'grid',
                gap: 4,
              }}
            >
              <p style={{ margin: 0, fontSize: 13 }}>{answerText}</p>
              {aiStatusNote ? (
                <small style={{ opacity: 0.72 }}>{aiStatusNote}</small>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
