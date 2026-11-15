/**
 * Clean SVG avatar generator with initials and Liquid Glass palette.
 * Replaces hardcoded mock avatars and no_image.png with dynamic, honest visuals.
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function generateInitialAvatarSvg(name?: string | null, size = 128): string {
  const initials = getInitials(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size / 2}" fill="#F0F5EE"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="#D8E5D5" stroke-width="2"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#17402C" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="${Math.round(size * 0.4)}">${initials}</text>
</svg>`;
}

export function generateInitialAvatarDataUrl(name?: string | null, size = 128): string {
  const svg = generateInitialAvatarSvg(name, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
