/**
 * Plan 100, 2.12 : aucun test unitaire n'appelle un serveur public.
 *
 * Chargé avant chaque fichier de test (`setupFiles` de `vitest.config.ts`) :
 * installe le garde réseau (`networkGuard.ts`) et fait échouer le test qui a
 * tenté un appel refusé, même rattrapé par le code testé ; le fichier aussi
 * pour un appel parti après ses tests.
 */
import { afterAll, afterEach } from 'vitest';
import { failOnBlocked, installNetworkGuard } from './networkGuard';

installNetworkGuard();

afterEach(() => failOnBlocked('pendant ce test'));
afterAll(() => failOnBlocked('après les tests du fichier'));
