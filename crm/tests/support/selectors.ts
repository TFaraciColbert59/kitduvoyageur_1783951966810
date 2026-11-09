/**
 * Contrat de sélecteurs entre le frontend et les tests.
 *
 * Pourquoi : les textes changent, les libellés se traduisent, les classes CSS sont
 * hachées. On s'appuie donc sur les rôles et libellés accessibles partout où c'est
 * possible, et sur un petit nombre de `data-testid` là où l'état est dynamique
 * (lignes de file, compte à rebours, toast). Ces identifiants sont documentés dans
 * `crm/tests/README.md` § « Contrat de sélecteurs » et doivent être posés par le
 * frontend ; un `data-testid` absent est un écart de test, pas un test affaibli.
 */
export const sel = {
  shell: {
    root: '[data-testid="app-shell"]',
    nav: 'nav[aria-label="Navigation principale"]',
    commandBarTrigger: '[data-testid="command-bar-trigger"]',
    commandInput: '[data-testid="command-input"]',
    commandResults: '[data-testid="command-results"]',
    commandGroup: '[data-testid="command-group"]',
    soloBadge: '[data-testid="solo-badge"]',
    realtimeChip: '[data-testid="realtime-chip"]',
    sessionCard: '[data-testid="session-card"]',
    notifications: '[data-testid="notifications-button"]'
  },
  connexion: {
    form: '[data-testid="login-form"]',
    email: 'input[name="email"]',
    password: 'input[name="password"]',
    submit: 'button[type="submit"]',
    error: '[data-testid="login-error"]'
  },
  totp: {
    form: '[data-testid="totp-form"]',
    code: 'input[name="code"]',
    submit: 'button[type="submit"]',
    error: '[data-testid="totp-error"]'
  },
  inbox: {
    root: '[data-testid="inbox"]',
    group: '[data-testid="inbox-group"]',
    row: '[data-testid="queue-row"]',
    rowTitle: '[data-testid="queue-row-title"]',
    countdown: '[data-testid="queue-countdown"]',
    counts: '[data-testid="inbox-counts"]',
    empty: '[data-testid="inbox-empty"]',
    error: '[data-testid="inbox-error"]',
    skeleton: '[data-testid="inbox-skeleton"]',
    soloHint: '[data-testid="inbox-solo-hint"]'
  },
  cas: {
    root: '[data-testid="case"]',
    title: 'h1',
    facts: '[data-testid="case-facts"]',
    content: '[data-testid="case-content"]',
    decision: '[data-testid="decision-card"]',
    reason: '[data-testid="reason-select"]',
    decisionPrimary: '[data-testid="decision-primary"]',
    decisionSave: '[data-testid="decision-save"]',
    memberNotice: '[data-testid="member-notice-preview"]',
    aiSuggestion: '[data-testid="ai-suggestion"]',
    alreadyDecided: '[data-testid="case-already-decided"]'
  },
  toast: {
    root: '[data-testid="toast"]',
    action: '[data-testid="toast-action"]',
    countdown: '[data-testid="toast-countdown"]'
  },
  valider: {
    root: '[data-testid="approval-panel"]',
    steps: '[data-testid="approval-steps"]',
    fingerprint: '[data-testid="approval-fingerprint"]',
    confirmation: '[data-testid="confirmation-input"]',
    approve: '[data-testid="approve-button"]',
    reject: '[data-testid="reject-button"]',
    soloNotice: '[data-testid="solo-notice"]'
  },
  journal: {
    table: '[data-testid="audit-table"]',
    row: '[data-testid="audit-row"]',
    filter: '[data-testid="audit-filter"]',
    soloBadge: '[data-testid="audit-solo"]',
    piiBadge: '[data-testid="audit-pii"]',
    empty: '[data-testid="audit-empty"]'
  },
  equipe: {
    root: '[data-testid="agents-overview"]',
    agentCard: '[data-testid="agent-card"]',
    agentStop: '[data-testid="agent-stop"]',
    agentBudget: '[data-testid="agent-budget"]'
  },
  sos: {
    root: '[data-testid="sos-screen"]',
    call112: '[data-testid="sos-call-112"]',
    take: '[data-testid="sos-take"]',
    close: '[data-testid="sos-close"]',
    position: '[data-testid="sos-position"]',
    timeline: '[data-testid="sos-timeline"]'
  },
  catalogue: {
    root: '[data-testid="catalogue-list"]',
    row: '[data-testid="catalogue-row"]',
    search: '[data-testid="catalogue-search"]',
    count: '[data-testid="catalogue-count"]'
  },
  membres: {
    root: '[data-testid="member-record"]',
    email: '[data-testid="member-email"]',
    reveal: '[data-testid="reveal-pii"]',
    notes: '[data-testid="member-notes"]'
  },
  commandes: {
    root: '[data-testid="order-detail"]',
    total: '[data-testid="order-total"]',
    refund: '[data-testid="order-refund"]'
  }
} as const;

/** Groupes de la file, dans l'ordre de lecture attendu (CONTRACT.md). */
export const INBOX_GROUPS = ['urgence_haute', 'delai_bientot', 'a_valider', 'signalements', 'contributions'] as const;

/** Libellés exacts attendus venant de 05_UI_UX_DESIGN § 7 (verbes d'action). */
export const LABELS = {
  hide: /^Masquer/,
  leave: /^Laisser/,
  sanction: /^Sanctionner/,
  approve: /^Valider/,
  take: /^Je prends/,
  undo: /^Annuler/,
  retry: /^Réessayer/
} as const;
