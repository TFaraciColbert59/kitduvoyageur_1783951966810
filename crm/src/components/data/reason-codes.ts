export type ReasonCode = {
  code: string;
  label: string;
  member_text: string;
  severity: number;
  zero_tolerance: boolean;
};

/**
 * Liste amorcée par la migration M01 (`sql/001_socle_admin.sql`).
 * Sert uniquement de repli quand la base n'est pas joignable : ce ne sont pas des
 * motifs inventés, ce sont ceux du bundle.
 */
export const BUNDLED_REASON_CODES: ReasonCode[] = [
  { code: 'spam', label: 'Spam ou publicité', member_text: 'Ce contenu a été retiré car il s’agit de spam ou de publicité non autorisée (règles de la communauté, article « Spam »).', severity: 1, zero_tolerance: false },
  { code: 'hors_sujet', label: 'Hors sujet', member_text: 'Ce contenu a été masqué car il ne correspond pas à l’objet de l’espace où il a été publié.', severity: 1, zero_tolerance: false },
  { code: 'harcelement', label: 'Harcèlement ou insulte', member_text: 'Ce contenu a été retiré car il vise une personne de façon insultante ou répétée (règles de la communauté, article « Respect »).', severity: 2, zero_tolerance: false },
  { code: 'haine', label: 'Discours haineux', member_text: 'Ce contenu a été retiré car il attaque des personnes en raison de leur origine, religion, genre, orientation ou handicap.', severity: 3, zero_tolerance: false },
  { code: 'donnees_perso', label: 'Données personnelles d’autrui', member_text: 'Ce contenu a été retiré car il expose des informations personnelles d’une autre personne sans son accord.', severity: 2, zero_tolerance: false },
  { code: 'lieu_sensible', label: 'Lieu sensible ou fragile', member_text: 'Ce contenu a été masqué car il révèle un lieu naturel fragile ou privé.', severity: 1, zero_tolerance: false },
  { code: 'arnaque', label: 'Arnaque ou fraude', member_text: 'Ce contenu a été retiré car il présente un risque d’arnaque pour les membres.', severity: 3, zero_tolerance: false },
  { code: 'contenu_sexuel', label: 'Contenu sexuel', member_text: 'Ce contenu a été retiré car il contient du contenu sexuel, interdit sur Le Kit du Voyageur.', severity: 3, zero_tolerance: false },
  { code: 'violence', label: 'Violence ou danger', member_text: 'Ce contenu a été retiré car il montre ou encourage une violence ou une pratique dangereuse.', severity: 3, zero_tolerance: false },
  { code: 'mineurs', label: 'Mise en danger de mineurs', member_text: 'Ce contenu a été retiré et le compte fermé pour mise en danger de mineurs. Les autorités compétentes peuvent être informées.', severity: 3, zero_tolerance: true },
  { code: 'illegal', label: 'Contenu illégal', member_text: 'Ce contenu a été retiré car il est manifestement illicite.', severity: 3, zero_tolerance: false },
  { code: 'autre', label: 'Autre (préciser)', member_text: 'Ce contenu a été modéré par l’équipe. Le motif précis vous est indiqué ci-dessous.', severity: 1, zero_tolerance: false }
];
