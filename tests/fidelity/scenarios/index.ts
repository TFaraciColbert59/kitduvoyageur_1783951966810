import type { Scenario } from '../lib/types';
import { CARNET_SCENARIOS } from './carnet';
import { COMMUNAUTE_CREATION_SCENARIOS, COMMUNAUTE_SCENARIOS } from './communaute';

export const SCENARIOS: Scenario[] = [...COMMUNAUTE_SCENARIOS, ...COMMUNAUTE_CREATION_SCENARIOS, ...CARNET_SCENARIOS];
