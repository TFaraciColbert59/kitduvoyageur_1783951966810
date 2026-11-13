import type { PoleCode } from '../../lib/catalog';
import { commandByCommand, COMMANDS } from '../../lib/catalog';

/**
 * Contrats des 6 agents (bundle/agents/agents-ia.md, 02_ARCHITECTURE § 8).
 *
 * Un agent sans contrat n'existe pas : rôle, objectif, allowlist d'outils,
 * budget, SLA, escalade, évals, propriétaire. Les outils sont des commandes du
 * registre `admin.commands` ; la base reste l'arbitre (`admin.agent_authorize`).
 */
export type AgentKey =
  | 'trieur_signalements'
  | 'remboursements'
  | 'support'
  | 'resumeur_fiches'
  | 'relecteur_pays'
  | 'surveillant_erreurs';

export type AgentModelTier = 'fast' | 'heavy';

export type AgentContract = {
  key: AgentKey;
  name: string;
  pole: PoleCode;
  objective: string;
  tools: string[];
  model: AgentModelTier;
  temperature: number;
  maxToolCalls: number;
  budgetCentsMonth: number;
  sla: string;
  escalation: string;
  evals: string[];
  owner: string;
  enabled: boolean;
};

/** Plafond dur : jamais plus de 6 appels d'outil par run (EX-AGT-09). */
export const MAX_TOOL_CALLS = 6;

export const AGENT_CONTRACTS: readonly AgentContract[] = [
  {
    key: 'trieur_signalements',
    name: 'Trieur de signalements',
    pole: 'CONF',
    objective:
      'Regrouper les signalements d’un même objet, proposer une décision motivée avec un niveau de confiance. Jamais masquer, jamais sanctionner : la personne décide.',
    tools: [
      'sos_board',
      'carnet_list_reported',
      'post_report_resolve',
      'comment_report_resolve',
      'story_report_resolve',
      'club_report_resolve',
      'group_report_resolve',
      'place_report_resolve',
      'marketplace_report_resolve',
      'terrain_report_decide'
    ],
    model: 'fast',
    temperature: 0.2,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 500,
    sla: 'Première proposition dans les 15 minutes suivant un signalement.',
    escalation: 'Signalement grave (menace, contenu illégal) → alerte immédiate à la permanence CONF, sans attendre le cycle.',
    evals: ['injection-01', 'cible-substituee-01', 'hors-perimetre-01', 'confiance-01'],
    owner: 'Tony',
    enabled: true
  },
  {
    key: 'remboursements',
    name: 'Remboursements',
    pole: 'COMM',
    objective:
      'Préparer la demande de remboursement avec les faits de la commande (montant, motif, litige). Ne valide jamais, n’exécute jamais Stripe.',
    tools: ['order_refund', 'dispute_arbitrate'],
    model: 'heavy',
    temperature: 0.1,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 400,
    sla: 'Demande préparée sous 30 minutes ouvrées.',
    escalation: 'Litige contesté ou montant > 100 € → validation super admin (deux temps hors solo).',
    evals: ['injection-01', 'montant-01', 'jamais-executer-01'],
    owner: 'Tony',
    enabled: true
  },
  {
    key: 'support',
    name: 'Support',
    pole: 'MEMB',
    objective:
      'Proposer une réponse au ticket et le classer. Jamais envoyer sans relecture humaine ; jamais promettre un remboursement.',
    tools: ['member_view_360', 'ticket_reply', 'ticket_set_status'],
    model: 'fast',
    temperature: 0.3,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 600,
    sla: 'Proposition de réponse sous 20 minutes ouvrées.',
    escalation: 'Ton menaçant, données personnelles ou remboursement → passage immédiat à un humain.',
    evals: ['injection-01', 'pii-01', 'promesse-01'],
    owner: 'Tony',
    enabled: true
  },
  {
    key: 'resumeur_fiches',
    name: 'Résumeur de fiches',
    pole: 'MEMB',
    objective:
      'Résumer l’historique publique d’un membre en masquant les données personnelles. Interdiction absolue : documents d’identité, orientation, messages privés, coordonnées.',
    tools: ['member_view_360'],
    model: 'fast',
    temperature: 0.2,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 300,
    sla: 'Résumé en moins de 2 minutes à la demande.',
    escalation: 'Toute demande de données privées → refus et journal, aucune sortie.',
    evals: ['injection-01', 'documents-01', 'orientation-01', 'pii-01'],
    owner: 'Tony',
    enabled: true
  },
  {
    key: 'relecteur_pays',
    name: 'Relecteur de fiches pays',
    pole: 'CONT',
    objective:
      'Signaler les incohérences d’une fiche pays et les sources manquantes. Jamais publier, jamais régénérer sans proposition validée par un humain.',
    tools: ['country_content_review', 'country_guide_regenerate', 'place_update'],
    model: 'heavy',
    temperature: 0.2,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 500,
    sla: 'Relecture d’une fiche sous 24 h ouvrées.',
    escalation: 'Source officielle contradictoire → fiche signalée à un responsable CONT, publication suspendue.',
    evals: ['injection-01', 'source-manquante-01', 'jamais-publier-01'],
    owner: 'Tony',
    enabled: true
  },
  {
    key: 'surveillant_erreurs',
    name: 'Surveillant d’erreurs',
    pole: 'TECH',
    objective:
      'Regrouper les erreurs applicatives et ouvrir une alerte motivée. Jamais déployer, jamais modifier la base, jamais relancer une migration.',
    tools: ['errors_view', 'daily_report_view', 'alert_resolve'],
    model: 'fast',
    temperature: 0.1,
    maxToolCalls: MAX_TOOL_CALLS,
    budgetCentsMonth: 300,
    sla: 'Alerte dans les 10 minutes suivant une erreur répétée.',
    escalation: 'Erreur touchant les paiements ou l’authentification → alerte haute immédiate (SOS/astreinte).',
    evals: ['injection-01', 'jamais-deployer-01', 'regroupement-01'],
    owner: 'Tony',
    enabled: true
  }
] as const;

/** Données et commandes qu’aucun agent ne touche (EX-SEC-07, agents-ia.md). */
export const FORBIDDEN_AGENT_COMMANDS: readonly string[] = [
  'member_export_gdpr',
  'member_delete_gdpr',
  'member_revoke_sessions',
  'member_ban',
  'member_set_staff_role',
  'staff_manage',
  'reveal_pii',
  'order_cancel'
];

export function agentContractByKey(key: string): AgentContract | undefined {
  return AGENT_CONTRACTS.find((contract) => contract.key === key);
}

/** Rapproche le nom publié en base du contrat local (casse et accents ignorés). */
export function agentContractByName(name: string): AgentContract | undefined {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const wanted = normalize(name);
  return AGENT_CONTRACTS.find((contract) => normalize(contract.name) === wanted);
}

/** Vérifie que chaque outil existe au catalogue, n’est pas interdit et n’est pas `never`. */
export function assertContractsValid(): { ok: true } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  for (const contract of AGENT_CONTRACTS) {
    if (contract.tools.length === 0) problems.push(`${contract.key}: aucun outil`);
    if (contract.maxToolCalls > MAX_TOOL_CALLS) problems.push(`${contract.key}: maxToolCalls > ${MAX_TOOL_CALLS}`);
    for (const tool of contract.tools) {
      if (FORBIDDEN_AGENT_COMMANDS.includes(tool)) problems.push(`${contract.key}: outil interdit ${tool}`);
      const def = commandByCommand(tool);
      if (!def) problems.push(`${contract.key}: outil inconnu ${tool}`);
      else if (def.agent === 'never') problems.push(`${contract.key}: commande non agent ${tool}`);
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true };
}

/** Outils exposables à un agent donné, présents au catalogue et autorisés aux agents. */
export function toolsForContract(contract: AgentContract): { name: string; description: string }[] {
  return contract.tools
    .map((tool) => commandByCommand(tool))
    .filter((def): def is NonNullable<typeof def> => Boolean(def && def.agent !== 'never'))
    .map((def) => ({ name: def.command, description: def.label }));
}

/** Nombre de commandes du registre (sanity check du catalogue généré). */
export const CATALOG_SIZE = COMMANDS.length;
