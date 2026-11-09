import type { Scenario } from '../lib/types';
import { CARNET_SCENARIOS } from './carnet';
import { COMMUNAUTE_SCENARIOS } from './communaute';

export const SCENARIOS: Scenario[] = [...COMMUNAUTE_SCENARIOS, ...CARNET_SCENARIOS];
