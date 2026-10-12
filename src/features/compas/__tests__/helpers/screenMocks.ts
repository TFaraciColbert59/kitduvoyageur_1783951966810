/**
 * Frontières réseau et navigateur de l'écran du Compas, pour les tests jsdom.
 *
 * Chaque test déclare ses `vi.mock(...)` (vitest les hisse) en renvoyant l'objet
 * correspondant d'ici : `vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas)`.
 * Le test lit ensuite les mêmes `vi.fn` pour vérifier ce qui a été appelé. L'écran, les
 * cartes, les tiroirs et le moteur restent les vrais.
 */
import { vi } from 'vitest';

type Res = { success: boolean; error?: string };
const ok = async (..._args: unknown[]): Promise<Res> => ({ success: true });

export const refresh = vi.fn();
export const router = { refresh, push: vi.fn() };

export const compas = {
  compasSetCarrierAction: vi.fn(ok),
  compasPickShopProductAction: vi.fn(ok),
  compasAddShopProductToTripAction: vi.fn(ok),
  compasAddInventoryItemAction: vi.fn(ok),
  compasMarkReturnedAction: vi.fn(ok),
  compasSetBudgetAction: vi.fn(ok),
  compasSetDatesAction: vi.fn(ok),
  compasSetActivityAction: vi.fn(ok),
  compasSetPreferencesAction: vi.fn(ok),
  compasSetPartySizeAction: vi.fn(ok),
  compasSetStayAction: vi.fn(ok),
  compasSearchStaysAction: vi.fn(async () => ({ success: true, mode: 'sandbox', fetchedAt: '2026-10-01T10:00:00Z', offers: [] })),
  compasListMyKitsAction: vi.fn(async () => ({ success: true, kits: [] })),
  compasApplyKitAction: vi.fn(ok),
  compasSearchPeopleAction: vi.fn(async () => ({ success: true, people: [] })),
  compasInviteMemberAction: vi.fn(ok),
  compasCancelInvitationAction: vi.fn(ok),
  compasInviteLinkAction: vi.fn(ok),
  compasRestoreMemberAction: vi.fn(ok),
  compasSetMemberRoleAction: vi.fn(ok),
  compasRemoveMemberAction: vi.fn(ok),
  compasCreateKitFromTripAction: vi.fn(ok),
  compasApplyRouteAction: vi.fn(ok),
  compasMyRoutesAction: vi.fn(async () => ({ success: true, routes: [] })),
  compasSearchRoutesAction: vi.fn(async () => ({ success: true, routes: [] })),
  compasInterpretAction: vi.fn(async () => ({ success: true, proposals: [], usedAi: false, note: null })),
  compasClearStartSayAction: vi.fn(ok),
  compasSetOriginAction: vi.fn(ok),
  compasExplainVerdictAction: vi.fn(ok),
};

export const kit = {
  togglePackedAction: vi.fn(ok),
  deleteTripItemAction: vi.fn(ok),
  addInventoryItemToTripAction: vi.fn(ok),
  addCustomTripItemAction: vi.fn(ok),
};
export const budget = { addExpenseAction: vi.fn(ok) };
export const poi = { compasStagePoisAction: vi.fn(async () => ({ success: true, pois: [] })) };
export const bottle = {
  compasBottleStateAction: vi.fn(async () => ({ success: false, error: 'indisponible dans ce test' })),
  compasLaunchBottleAction: vi.fn(ok),
  compasAnswerApplicantAction: vi.fn(ok),
  compasCloseBottleAction: vi.fn(ok),
};
export const resa = {
  compasNearbyActivitiesAction: vi.fn(async () => ({ success: true, unavailable: false, offers: [] })),
  compasSearchOffersAction: vi.fn(async () => ({ success: true, mode: 'sandbox', fetchedAt: '2026-10-02T08:00:00Z', offers: [] })),
};
export const autofill = {
  compasAutofillStartAction: vi.fn(ok),
  compasAutofillOutcomeAction: vi.fn(async () => ({ outcome: null, stamp: 'fin' })),
  compasAutofillStopAction: vi.fn(ok),
  compasUndoAutofillAction: vi.fn(ok),
  compasRefreshAutofillAction: vi.fn(async () => ({ success: true, parts: [], label: '', kept: 0 })),
};
export const cart = { addToCart: vi.fn() };

/** Remet tous les compteurs d'appels à zéro entre deux tests. */
export function resetScreenMocks(): void {
  for (const group of [compas, kit, budget, poi, bottle, resa, autofill, cart]) {
    for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockClear();
  }
  refresh.mockClear();
  router.push.mockClear();
}
