import type { BrowserContextOptions } from '@playwright/test';
import { BASE_URL } from './env';

/** Le cadre de référence du projet (captures, maquette v8) : téléphone 393 × 852. */
export const PHONE: BrowserContextOptions = {
  baseURL: BASE_URL,
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  geolocation: { latitude: 45.8992, longitude: 6.1294 },
  permissions: ['geolocation'],
};
