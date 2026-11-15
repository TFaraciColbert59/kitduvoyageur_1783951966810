'use client';

import React, { useMemo, useState } from 'react';
import {
  buildActivityFacts,
  type ActivityTelemetryFactsInput,
  type HikeSessionRecord,
} from '../activity/activityFacts';
import {
  buildActivityInsight,
  buildPostActivityPrompt,
  sanitizeActivityNarrative,
} from '../activity/postActivityInsight';
import { unavailable, type AiGeneration } from '../contracts';
import { PostActivityInsightView } from './PostActivityInsightView';

export interface OutingInsightBridgeProps {
  session: HikeSessionRecord;
  telemetry?: ActivityTelemetryFactsInput;
}

export function OutingInsightBridge({ session, telemetry }: OutingInsightBridgeProps) {
  const [ai, setAi] = useState<AiGeneration>(() =>
    unavailable('not_requested', 'Interprétation IA non demandée.')
  );
  const [aiLoading, setAiLoading] = useState(false);

  const facts = useMemo(() => buildActivityFacts(session, telemetry), [session, telemetry]);
  const insight = useMemo(() => buildActivityInsight(facts, ai), [facts, ai]);

  const handleRequestAi = async () => {
    setAiLoading(true);
    try {
      const { system, prompt } = buildPostActivityPrompt(facts);
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        setAi(
          unavailable(
            'provider_unconfigured',
            'Interprétation IA indisponible : aucun fournisseur configuré. Le bilan chiffré reste disponible.'
          )
        );
        return;
      }
      const data = (await res.json()) as { text?: unknown; provider?: string; model?: string };
      const clean = sanitizeActivityNarrative(data?.text);
      if (!clean) {
        setAi(
          unavailable(
            'invalid_response',
            'Interprétation IA écartée : la réponse ne respecte pas le contrat (chiffre ou format inattendu).'
          )
        );
        return;
      }
      setAi({
        status: 'available',
        provider: data.provider ?? 'lkdv',
        model: data.model ?? 'assistant',
        text: clean,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      setAi(
        unavailable(
          'provider_unavailable',
          'Interprétation IA momentanément indisponible. Le bilan chiffré reste disponible.'
        )
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div data-testid="outing-post-activity-insight">
      <PostActivityInsightView
        insight={insight}
        aiLoading={aiLoading}
        onRequestAi={() => void handleRequestAi()}
      />
    </div>
  );
}
