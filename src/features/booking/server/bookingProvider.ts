import 'server-only';

import { BookingProviderError, BOOKING_PROVIDER_ERROR_CODES } from './bookingProviderErrors';
import type {
  BookingProvider,
  BookingProviderEnv,
  BookingProviderRouter,
  BookingSearchRequest,
  BookingVertical,
} from './bookingProviderTypes';
import { createRouteStackBookingProvider } from './routeStackBookingProvider';
import { createViatorBookingProvider } from './viatorBookingProvider';

export * from './bookingProviderTypes';
export * from './bookingProviderErrors';
export {
  getActiveProviderMode,
  getProviderCredentialSummary,
  resolveProviderCredentials,
} from './providerCredentials';
export type {
  ProviderCredentialId,
  ProviderCredentialMode,
  ProviderCredentialReason,
  ProviderCredentialSlot,
  ProviderCredentialSource,
  ResolvedProviderCredentials,
} from './providerCredentials';
export { createRouteStackBookingProvider } from './routeStackBookingProvider';
export type { RouteStackToolCaller, RouteStackToolResult } from './routeStackBookingProvider';
export { createViatorBookingProvider } from './viatorBookingProvider';
export {
  applyViatorAttribution,
  buildViatorAttributionUrl,
  resolveViatorAttribution,
} from './viatorAttribution';
export type { ViatorAttribution } from './viatorAttribution';

export interface CreateBookingProviderOptions {
  env?: BookingProviderEnv;
}

const unavailableProvider: BookingProvider = {
  id: 'unavailable',
  mode: 'disabled',
  supportedVerticals: [],
  supports() {
    return false;
  },
  isConfigured() {
    return false;
  },
  async search(_request: BookingSearchRequest) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.unavailable,
      provider: 'unavailable',
      message: 'Aucun fournisseur de réservation n’est activé.',
    });
  },
};

function mergeModes(providers: BookingProvider[]): BookingProviderRouter['mode'] {
  const modes = providers.map((provider) => provider.mode);
  if (modes.includes('live')) return 'live';
  if (modes.includes('sandbox')) return 'sandbox';
  return 'disabled';
}

function dedupeProviders(providers: BookingProvider[]): BookingProvider[] {
  return providers.filter((provider, index, all) => all.findIndex((item) => item.id === provider.id) === index);
}

/**
 * Route chaque verticale vers le bon fournisseur. RouteStack reste le moteur
 * transport ; Viator est le moteur activités. Un fournisseur indisponible ne
 * masque jamais un autre fournisseur valide.
 */
export function createBookingProvider(
  options: CreateBookingProviderOptions = {}
): BookingProviderRouter {
  const env = options.env ?? process.env;
  const requested = (env.BOOKING_PROVIDER || 'auto').trim().toLowerCase();
  const routeStack = createRouteStackBookingProvider({ env });
  const viator = createViatorBookingProvider({ env });

  let selected: BookingProvider[];
  if (requested === 'routestack') {
    selected = [routeStack];
  } else if (requested === 'viator') {
    selected = [viator];
  } else if (requested !== 'disabled') {
    selected = [routeStack, viator].filter((provider) => provider.isConfigured());
  } else {
    selected = [];
  }
  selected = dedupeProviders(selected);

  const byVertical = new Map<BookingVertical, BookingProvider>();
  for (const provider of selected) {
    for (const vertical of provider.supportedVerticals) byVertical.set(vertical, provider);
  }

  const router: BookingProviderRouter = {
    id: 'router',
    mode: mergeModes(selected),
    supportedVerticals: [...byVertical.keys()],
    supports(vertical) {
      return byVertical.has(vertical);
    },
    isConfigured() {
      return selected.some((provider) => provider.isConfigured());
    },
    providerFor(vertical) {
      return byVertical.get(vertical) ?? unavailableProvider;
    },
    async search(request) {
      return router.providerFor(request.vertical).search(request);
    },
  };
  return router;
}
