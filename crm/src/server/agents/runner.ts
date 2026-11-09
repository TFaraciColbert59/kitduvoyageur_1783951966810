import 'server-only';
import { apiError, isApiError, logServer, translateDbError } from '@/lib/errors';
import { commandInputJsonSchema, parseCommandParams } from '@/lib/cmd';
import { authorizeAgent, runCommandAs } from '@/server/cmd';
import { serviceDb, type ServiceDb } from '@/server/db';
import { finishJob, monthSpendCents, startJob } from '@/server/jobs';
import { listActiveAgents, type AgentRecord } from '@/server/agents/store';
import { MAX_TOOL_CALLS, agentContractByName, toolsForContract, type AgentContract } from '@/server/agents/registry';
import { nimChat, nimConfigured, nimModelFor, type NimMessage, type NimTool } from '@/server/agents/nim';
import { systemPromptFor, userPromptFor, wrapUntrusted } from '@/server/agents/prompts';
import { redactForModel } from '@/server/agents/redact';
import { sendTeamAlert } from '@/server/resend';

/**
 * Exécution d’un agent : tâche → plan → outils → vérification → résultat →
 * audit → coût (boucle de 02_ARCHITECTURE § 8).
 *
 * Garanties :
 *  - outils = allowlist du contrat, intersectée avec `admin.agents.tools` en base ;
 *  - `admin.agent_authorize` avant CHAQUE appel : statut, allowlist et plafond
 *    horaire (`admin.agent_rate`) sont vérifiés en base, arrêt immédiat ;
 *  - 6 appels d’outil au maximum, jamais de boucle ouverte ;
 *  - tout résultat d’outil repart vers le modèle encadré `<donnee_non_fiable>` ;
 *  - chaque run est journalisé dans `ops.job_runs` avec une clé d’idempotence.
 */
export type AgentRunTrigger = 'cron' | 'event' | 'manual';

export type AgentRunSummary = {
  key: string;
  name: string;
  agent_id: string;
  status: 'ok' | 'error' | 'skipped' | 'paused' | 'disabled';
  proposals: number;
  tool_calls: number;
  total_tokens: number;
  cost_cents: number;
  message: string;
  duration_ms: number;
};

export type AgentsRunReport = {
  ok: boolean;
  disabled: boolean;
  agents: AgentRunSummary[];
};

function costCentsFor(totalTokens: number): number {
  const raw = Number(process.env.NIM_COST_CENTS_PER_1K_TOKENS ?? '0.1');
  const rate = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  return Math.ceil((totalTokens / 1000) * rate);
}

function toolMessage(callId: string, body: string): NimMessage {
  return { role: 'tool', tool_call_id: callId, content: body };
}

function nimToolsFor(contract: AgentContract, agent: AgentRecord): NimTool[] {
  const allowedByDb = new Set(agent.tools);
  return toolsForContract(contract)
    .filter((tool) => allowedByDb.has(tool.name))
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: commandInputJsonSchema(tool.name)
      }
    }));
}

async function escalateOnce(db: ServiceDb, key: string, subject: string, text: string): Promise<void> {
  const handle = await startJob(db, 'alert:agent', key, {});
  if (handle.alreadyDone) return;
  const email = await sendTeamAlert({ subject, text, idempotencyKey: key });
  await finishJob(db, handle, 'ok', { emailed: email.sent });
}

/**
 * Un run d’agent. Ne lève pas : toute erreur devient un statut `error` journalisé.
 */
async function runOne(
  db: ServiceDb,
  agent: AgentRecord,
  contract: AgentContract,
  trigger: AgentRunTrigger,
  bucket: string
): Promise<AgentRunSummary> {
  const started = Date.now();
  const base = { key: contract.key, name: contract.name, agent_id: agent.id, proposals: 0, tool_calls: 0, total_tokens: 0, cost_cents: 0 };

  if (agent.status !== 'active') {
    return {
      ...base,
      status: agent.status === 'stopped' ? 'skipped' : 'paused',
      message: agent.status === 'stopped' ? 'Agent arrêté.' : 'Agent en pause.',
      duration_ms: 0
    };
  }

  // Budget mensuel déclaratif (estimation de coût) : dépassé → arrêt + alerte.
  const spend = await monthSpendCents(db, agent.id);
  if (spend.known && spend.cents >= contract.budgetCentsMonth) {
    await escalateOnce(
      db,
      `agent-budget:${contract.key}:${new Date().toISOString().slice(0, 7)}`,
      `[LKDV Control] Budget mensuel atteint — ${contract.name}`,
      `L’agent ${contract.name} a atteint son budget déclaré (${contract.budgetCentsMonth} centimes). Il s’arrête et attend une décision humaine.`
    );
    return {
      ...base,
      status: 'paused',
      cost_cents: spend.cents,
      message: 'Budget mensuel atteint : arrêt et escalade.',
      duration_ms: Date.now() - started
    };
  }

  const handle = await startJob(db, `agent:${contract.key}`, bucket, {
    agent_id: agent.id,
    trigger,
    contract: contract.key
  });
  if (handle.alreadyDone) {
    return { ...base, status: 'skipped', message: 'Run déjà exécuté pour cette clé.', duration_ms: 0 };
  }

  const tools = nimToolsFor(contract, agent);
  if (tools.length === 0) {
    await finishJob(db, handle, 'skipped', { reason: 'aucun outil autorisé' });
    return { ...base, status: 'skipped', message: 'Aucun outil autorisé pour cet agent.', duration_ms: Date.now() - started };
  }

  const messages: NimMessage[] = [
    { role: 'system', content: systemPromptFor(contract) },
    { role: 'user', content: userPromptFor(contract) }
  ];
  const model = nimModelFor(contract.model);

  let proposals = 0;
  let toolCalls = 0;
  let totalTokens = 0;
  let finalText = '';
  let failure: string | null = null;

  try {
    for (let step = 0; step < MAX_TOOL_CALLS; step += 1) {
      const response = await nimChat({ model, messages, tools, temperature: contract.temperature });
      totalTokens += response.usage.total_tokens;

      if (response.toolCalls.length === 0) {
        finalText = response.content;
        break;
      }

      messages.push({ role: 'assistant', content: response.content, tool_calls: response.toolCalls });

      for (const call of response.toolCalls) {
        if (toolCalls >= MAX_TOOL_CALLS) {
          messages.push(toolMessage(call.id, 'Plafond de 6 appels d’outil atteint : arrêt demandé.'));
          failure = 'plafond d’appels atteint';
          break;
        }
        if (!contract.tools.includes(call.function.name)) {
          messages.push(toolMessage(call.id, 'Outil hors de ta liste autorisée : appel refusé.'));
          continue;
        }

        toolCalls += 1;
        try {
          // Statut, allowlist et plafond horaire vérifiés en base AVANT l’appel.
          const authorized = await authorizeAgent(db, agent.auth_user_id, call.function.name);
          if (!authorized.ok) throw apiError('agent_not_allowed');

          let args: unknown;
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch {
            throw apiError('tool_argument_invalid');
          }
          const parsed = parseCommandParams(call.function.name, args);
          const result = await runCommandAs(db, agent.auth_user_id, call.function.name, parsed);
          if (result.request_id) proposals += 1;
          messages.push(
            toolMessage(
              call.id,
              wrapUntrusted(`outil:${call.function.name}`, JSON.stringify(redactForModel(result)))
            )
          );
        } catch (error) {
          const apiErr = isApiError(error) ? error : translateDbError(error);
          messages.push(toolMessage(call.id, `Refus traduit : ${apiErr.message}`));
          if (apiErr.code === 'rate_limited' || apiErr.code === 'agent_stopped' || apiErr.code === 'agent_paused') {
            failure = apiErr.code;
            break;
          }
        }
      }

      if (failure) break;
    }
  } catch (error) {
    const apiErr = isApiError(error) ? error : translateDbError(error);
    failure = apiErr.code;
    logServer({ level: 'error', scope: 'crm', event: 'agent_run_failed', message: apiErr.message, code: apiErr.code });
  }

  const costCents = costCentsFor(totalTokens);
  const durationMs = Date.now() - started;
  const status: AgentRunSummary['status'] = failure ? 'error' : 'ok';
  const message = failure
    ? `Arrêt : ${failure}. ${finalText ? 'Note de l’agent conservée.' : ''}`.trim()
    : finalText
      ? finalText.slice(0, 600)
      : 'Run terminé sans réponse finale.';

  await finishJob(db, handle, status === 'ok' ? 'ok' : 'error', {
    agent_id: agent.id,
    contract: contract.key,
    proposals,
    tool_calls: toolCalls,
    total_tokens: totalTokens,
    cost_cents: costCents,
    model,
    message: message.slice(0, 500)
  }, failure ?? undefined);

  if (failure) {
    await escalateOnce(
      db,
      `agent-fail:${contract.key}:${new Date().toISOString().slice(0, 13)}`,
      `[LKDV Control] Agent en échec — ${contract.name}`,
      `L’agent ${contract.name} s’est arrêté (${failure}). Vérifiez la file et l’écran Technique.`
    );
  }

  logServer({
    level: failure ? 'warn' : 'info',
    scope: 'crm',
    event: 'agent_run',
    message: `${contract.key} status=${status} tools=${toolCalls} proposals=${proposals} tokens=${totalTokens}`,
    duration_ms: durationMs
  });

  return {
    ...base,
    status,
    proposals,
    tool_calls: toolCalls,
    total_tokens: totalTokens,
    cost_cents: costCents,
    message,
    duration_ms: durationMs
  };
}

/**
 * Cycle complet : tous les agents actifs du CRM pour une même clé de passage.
 * `bucket` doit être stable pour une exécution (ex. `cron:2026-11-09T05:20`).
 */
export async function runAgents(params: {
  trigger: AgentRunTrigger;
  bucket: string;
}): Promise<AgentsRunReport> {
  if (!nimConfigured()) {
    return { ok: true, disabled: true, agents: [] };
  }

  const db = serviceDb();
  const agents = await listActiveAgents(db);
  const summaries: AgentRunSummary[] = [];

  for (const agent of agents) {
    const contract = agentContractByName(agent.name);
    if (!contract || !contract.enabled) {
      summaries.push({
        key: contract?.key ?? agent.name,
        name: agent.name,
        agent_id: agent.id,
        status: 'skipped',
        proposals: 0,
        tool_calls: 0,
        total_tokens: 0,
        cost_cents: 0,
        message: 'Aucun contrat local pour cet agent : il ne s’exécute pas.',
        duration_ms: 0
      });
      continue;
    }
    const summary = await runOne(db, agent, contract, params.trigger, params.bucket);
    summaries.push(summary);
  }

  return { ok: summaries.every((summary) => summary.status !== 'error'), disabled: false, agents: summaries };
}
