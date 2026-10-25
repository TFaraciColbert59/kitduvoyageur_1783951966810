/**
 * Façade unique du domaine Trajectoire Vivante.
 *
 * Tout ce qui est ici est du domaine pur : aucun React, aucune I/O, aucun
 * reseau, aucun LLM. C'est ce qui rend le chantier testable sans navigateur
 * et reproductible sur n'importe quelle machine.
 */

export * from './scaleAxis';
export * from './types';
export * from './intention';
export * from './traces';
export * from './derive';
export * from './versioning';
export * from './seeds';
export * from './provenance';
