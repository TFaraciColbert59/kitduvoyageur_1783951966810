import type { V5Space } from '../types';
import { budgetDrawer } from './budget';
import { dayDrawer } from './day';
import { menuDrawer } from './menu';
import { meteoDrawer } from './meteo';
import { nousDrawer } from './nous';
import { prevoirDrawer } from './prevoir';
import { sacDrawer } from './sac';
import type { V5DrawerDef } from './types';
import { verifsDrawer } from './verifs';

/**
 * Le registre des tiroirs v5. « voyage » n'y figure pas : les réglages du voyage (activité, parcours, dates,
 * préférences) restent portés par les parcours éprouvés de l'écran actuel, ouverts par `LegacyHost`.
 */
export const DRAWERS: Partial<Record<V5Space, V5DrawerDef>> = {
  day: dayDrawer,
  nous: nousDrawer,
  budget: budgetDrawer,
  sac: sacDrawer,
  prevoir: prevoirDrawer,
  verifs: verifsDrawer,
  meteo: meteoDrawer,
  menu: menuDrawer,
};
