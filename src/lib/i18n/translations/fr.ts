import { coreFr } from './core.fr';
import { compasFr } from './compas.fr';

export const fr = {
  ...coreFr,
  compas: compasFr,
} as const;

type StringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : StringRecord<T[K]>;
};

export type TranslationKeys = StringRecord<typeof fr>;
