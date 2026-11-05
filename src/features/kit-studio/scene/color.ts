// Pose d'une couleur de la palette sur un objet three.
// La maquette (three r149) travaillait sans gestion de couleur : les valeurs hexadécimales étaient lues comme
// linéaires, puis encodées en sRGB à l'affichage. three 0.186 convertit les chaînes depuis sRGB ; pour retrouver
// l'aspect de la maquette, on lit donc la valeur comme linéaire (LEGACY_COLOR_LOOK). Passer à false donne les
// teintes exactes du catalogue (plus sombres) : à trancher sur capture (E2E).
import { Color, LinearSRGBColorSpace } from 'three';

export const LEGACY_COLOR_LOOK = true;

export function paint(target: Color, hex: string): Color {
  return LEGACY_COLOR_LOOK ? target.setStyle(hex, LinearSRGBColorSpace) : target.setStyle(hex);
}

export function makeColor(hex: string): Color {
  return paint(new Color(), hex);
}
