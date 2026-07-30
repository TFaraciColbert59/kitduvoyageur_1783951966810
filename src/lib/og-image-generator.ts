/**
 * OG image generation utility
 * The static OG image is pre-generated at /assets/images/og-image.png
 * 1200x630px with design tokens:
 * - Background: #E7E3D6 (papier carte)
 * - Headline: "Le Kit du Voyageur" in Space Grotesk bold #1C2620 (encre pin)
 * - Accent bar: thin #17402C (orange balise)
 */

export const OG_IMAGE_PATH = '/assets/images/og-image.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_DEFAULTS = {
  image: OG_IMAGE_PATH,
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  alt: 'Le Kit du Voyageur — Équipement outdoor intelligent',
};
