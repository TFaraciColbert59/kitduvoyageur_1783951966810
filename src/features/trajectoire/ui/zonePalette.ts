/**
 * Palette de paysage par zone.
 *
 * Regle de design : aucune couleur libre. Chaque stop est une reference a un
 * token existant de src/styles/tokens.css, resolue par le navigateur. Ainsi le
 * paysage suit le theme (clair / sombre) sans jamais introduire de hex ad-hoc.
 */

import type { TrajectoireZone } from '@/features/trajectoire/domain/scaleAxis';

export interface ZonePalette {
  /** Stop principal, tres sombre, en profondeur. */
  a: string;
  /** Stop median, la teinte de la zone. */
  b: string;
  /** Stop clair, le ciel / la lumiere. */
  c: string;
}

const PALETTES: Readonly<Record<TrajectoireZone, ZonePalette>> = {
  run: {
    a: 'var(--lkv-forest-950)',
    b: 'var(--lkv-forest-700)',
    c: 'var(--sage-300)',
  },
  journee: {
    a: 'var(--lkv-forest-900)',
    b: 'var(--sage-600)',
    c: 'var(--sage-200)',
  },
  raid: {
    a: 'var(--lkv-ink-900)',
    b: 'var(--sky-800)',
    c: 'var(--sky-200)',
  },
  expedition: {
    a: 'var(--sand-900)',
    b: 'var(--sand-600)',
    c: 'var(--sand-200)',
  },
  monde: {
    a: 'var(--sky-900)',
    b: 'var(--lkv-sage-400)',
    c: 'var(--lkv-sand-200)',
  },
};

/** Palette de paysage d'une zone. Jamais undefined : repli sur `run`. */
export function zonePalette(zone: TrajectoireZone): ZonePalette {
  return PALETTES[zone] ?? PALETTES.run;
}

/**
 * Melange un token de couleur avec de la transparence. Reste un token : aucune
 * valeur hexadecimale n'est introduite ici.
 */
function teinte(couleur: string, alpha: number): string {
  return `color-mix(in srgb, ${couleur} ${Math.round(alpha * 100)}%, transparent)`;
}

/**
 * Fond du paysage : un lit SOMBRE sur toute la hauteur, la teinte de zone en
 * LUEUR, jamais en aplat.
 *
 * La version precedente posait `p.c` — le stop clair de la zone, ce que le
 * prototype appelait « le ciel » — en tete du degrade lineaire. Les cartes
 * sont en verre sombre et le texte est blanc : sous un `#sand-200` (#ECE8D9,
 * ~91 % de clarte), le titre, le sous-titre et le grand nombre tombaient a
 * environ 1,2:1 de contraste, donc invisibles. La lumiere de zone reste
 * presente, mais attenuee : elle teinte au lieu d'eclaircir.
 */
export function sceneBackground(zone: TrajectoireZone): string {
  const p = zonePalette(zone);
  return [
    // lueur de zone en haut, attenuee : elle teinte sans eclaircir le texte
    `radial-gradient(120% 80% at 18% -8%, ${teinte(p.b, 0.34)} 0%, transparent 62%)`,
    // rappel de ciel, tres attenue : il donne la direction de la lumiere
    `radial-gradient(90% 60% at 78% 2%, ${teinte(p.c, 0.16)} 0%, transparent 70%)`,
    // profondeur en bas
    `radial-gradient(140% 110% at 85% 110%, ${p.a} 0%, transparent 62%)`,
    // lit sombre : la scene ne blanchit jamais, sur aucune zone
    `linear-gradient(180deg, ${p.a} 0%, var(--lkv-ink-900) 58%, var(--lkv-forest-950) 100%)`,
  ].join(',');
}
