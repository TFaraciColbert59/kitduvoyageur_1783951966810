// Compas — phase 7 : périmètre et classement de l'inventaire des contrôles.
//
// Chaque composant qui porte un contrôle est rangé dans une étape (celle dont
// le lot de scénarios le teste) et un écran. Un composant absent de cette table
// fait ÉCHOUER l'inventaire : un nouveau contrôle ne peut pas passer inaperçu.

/** Dossiers parcourus en entier (fichiers .tsx). */
export const SCANNED_DIRS = ['src/features/compas/components', 'src/app/compas'];

/** Composants partagés rendus DANS le Compas (hors coquille du site). */
export const SCANNED_FILES = [
  // Carte de l'écran du Compas (chargée par CompasMap).
  'src/features/hub/components/mobile/HubGlobeMap.tsx',
  // Profil voyageur demandé une fois, sur le Compas vide.
  'src/components/identity/TravellerCard.tsx',
];

const C = 'src/features/compas/components/';

/** Étape et écran par défaut de chaque fichier. */
const FILE_DEFAULTS = {
  [`${C}AiNotice.tsx`]: { etape: 'commun', ecran: 'avis IA' },
  [`${C}CompasAccessory.tsx`]: { etape: 'commun', ecran: 'carte › profil' },
  [`${C}CompasDecision.tsx`]: { etape: 'commun', ecran: 'carte › prochaine décision' },
  [`${C}CompasDisLe.tsx`]: { etape: 'commun', ecran: 'tiroir › Dis-le' },
  [`${C}CompasItemHistory.tsx`]: { etape: 'kit', ecran: 'fiche objet › historique' },
  [`${C}CompasMap.tsx`]: { etape: 'commun', ecran: 'carte' },
  [`${C}CompasMembers.tsx`]: { etape: 'nous', ecran: 'tiroir nous › équipe' },
  [`${C}CompasOuFlows.tsx`]: { etape: 'ou', ecran: 'tiroir ou' },
  [`${C}CompasPassage.tsx`]: { etape: 'nous', ecran: 'tiroir nous › passage' },
  [`${C}CompasPrep.tsx`]: { etape: 'ou', ecran: 'préparation' },
  [`${C}CompasPrimitives.tsx`]: { etape: 'commun', ecran: 'primitives' },
  [`${C}CompasRisks.tsx`]: { etape: 'verdict', ecran: 'verdict › risques' },
  [`${C}CompasRuler.tsx`]: { etape: 'ou', ecran: 'tiroir ou › durée' },
  [`${C}CompasScreen.tsx`]: { etape: 'commun', ecran: 'écran du Compas' },
  [`${C}CompasSheet.tsx`]: { etape: 'commun', ecran: 'tiroir (poignée, en-tête)' },
  [`${C}CompasStart.tsx`]: { etape: 'depart', ecran: 'Compas vide' },
  [`${C}CompasTripPicker.tsx`]: { etape: 'depart', ecran: 'choix du voyage' },
  [`${C}GeoapifyCredit.tsx`]: { etape: 'commun', ecran: 'crédits' },
  [`${C}MeteoalarmNotice.tsx`]: { etape: 'verdict', ecran: 'verdict › alertes officielles' },
  [`${C}OfficialAlertTexts.tsx`]: { etape: 'verdict', ecran: 'verdict › alertes officielles' },
  [`${C}TrialNote.tsx`]: { etape: 'commun', ecran: 'note d’essai' },
  [`${C}TripInvitations.tsx`]: { etape: 'depart', ecran: 'invitations' },
  [`${C}WorldAlertNotice.tsx`]: { etape: 'verdict', ecran: 'verdict › alertes officielles' },
  'src/app/compas/error.tsx': { etape: 'commun', ecran: 'erreur de page' },
  'src/features/hub/components/mobile/HubGlobeMap.tsx': { etape: 'commun', ecran: 'carte' },
  'src/components/identity/TravellerCard.tsx': { etape: 'depart', ecran: 'Compas vide › profil voyageur' },
};

/** Composant par composant, quand le fichier mêle plusieurs étapes. */
const COMPONENTS = {
  [`${C}CompasCards.tsx`]: {
    KitRow: { etape: 'kit', ecran: 'ligne d’objet' },
    MemberAvatar: { etape: 'nous', ecran: 'carte nous' },
    SummaryRow: { etape: 'commun', ecran: 'carte de l’étape' },
    CardSay: { etape: 'ou', ecran: 'carte où' },
    OuCard: { etape: 'ou', ecran: 'carte où' },
    OriginLine: { etape: 'ou', ecran: 'carte où' },
    AutofillLine: { etape: 'ou', ecran: 'carte où' },
    BudgetAlso: { etape: 'nous', ecran: 'carte nous' },
    NousCard: { etape: 'nous', ecran: 'carte nous' },
    ResaCard: { etape: 'resa', ecran: 'carte résa' },
    VerdictCard: { etape: 'verdict', ecran: 'carte verdict' },
    KitCard: { etape: 'kit', ecran: 'carte kit' },
  },
  [`${C}CompasSheets.tsx`]: {
    SheetContent: { etape: 'commun', ecran: 'tiroir' },
    Missing: { etape: 'commun', ecran: 'tiroir' },
    StepSheet: { etape: 'commun', ecran: 'tiroir › pied (Retour, Suivant)' },
    ItemSheet: { etape: 'kit', ecran: 'fiche objet' },
    ProductRow: { etape: 'kit', ecran: 'fiche objet › produits' },
    SearchField: { etape: 'kit', ecran: 'recherche' },
    AcquireSheet: { etape: 'kit', ecran: 'trouver un objet' },
    AddSheet: { etape: 'kit', ecran: 'ajouter un objet' },
    FreeItemForm: { etape: 'kit', ecran: 'ajouter un objet › libre' },
    BagSheet: { etape: 'kit', ecran: 'sac d’un membre' },
    CarrierSheet: { etape: 'kit', ecran: 'porteur' },
    PartySize: { etape: 'nous', ecran: 'tiroir nous › équipe' },
    EquipeFlow: { etape: 'nous', ecran: 'tiroir nous › équipe' },
    QuiFlow: { etape: 'nous', ecran: 'tiroir nous › qui' },
    SettlementBlock: { etape: 'nous', ecran: 'tiroir nous › budget' },
    BudgetFlow: { etape: 'nous', ecran: 'tiroir nous › budget' },
    FormalitiesLine: { etape: 'nous', ecran: 'tiroir nous › budget' },
    ExpenseForm: { etape: 'nous', ecran: 'tiroir nous › budget › dépense' },
    AnnonceFlow: { etape: 'nous', ecran: 'tiroir nous › annonce' },
    StaySearch: { etape: 'resa', ecran: 'tiroir résa › nuits › recherche' },
    NuitsFlow: { etape: 'resa', ecran: 'tiroir résa › nuits' },
    ReservationsFlow: { etape: 'resa', ecran: 'tiroir résa › réservations' },
    EtatsFlow: { etape: 'resa', ecran: 'tiroir résa › états' },
    OffresFlow: { etape: 'resa', ecran: 'tiroir résa › offres' },
    LiveSearch: { etape: 'resa', ecran: 'tiroir résa › offres › recherche' },
    RaisonsFlow: { etape: 'verdict', ecran: 'tiroir verdict › risques' },
    VerdictExplain: { etape: 'verdict', ecran: 'tiroir verdict › explication' },
    MeteoFlow: { etape: 'verdict', ecran: 'tiroir verdict › météo' },
    VeilleFlow: { etape: 'verdict', ecran: 'tiroir verdict › veille' },
    SourcesFlow: { etape: 'verdict', ecran: 'tiroir verdict › sources' },
    KitListFlow: { etape: 'kit', ecran: 'tiroir kit › liste' },
    TallList: { etape: 'kit', ecran: 'tiroir kit › liste' },
    ConseilsFlow: { etape: 'kit', ecran: 'tiroir kit › conseils' },
    TraceFlow: { etape: 'ou', ecran: 'tiroir où › sur place' },
    MesKitsFlow: { etape: 'kit', ecran: 'tiroir kit › mes kits' },
    EauFlow: { etape: 'kit', ecran: 'tiroir kit › eau' },
    InventaireFlow: { etape: 'kit', ecran: 'tiroir kit › inventaire' },
    SacsFlow: { etape: 'kit', ecran: 'tiroir kit › sacs' },
  },
};

/**
 * Étape et écran d'un composant ; `null` s'il n'est pas classé (l'inventaire
 * échoue alors, avec le nom du composant à ajouter).
 */
export function classifyControl(file, component) {
  const byComp = COMPONENTS[file]?.[component];
  if (byComp) return byComp;
  if (COMPONENTS[file]) return null;
  return FILE_DEFAULTS[file] ?? null;
}
