/**
 * Visuel produit généré, utilisé UNIQUEMENT quand un kit ou un objet n'a
 * aucune image réelle. Le visuel est déterministe (initiale + dégradé de la
 * palette du verre), local, et ne prétend pas être une photo du produit.
 */

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}

export function generatedProductImage(name: string, size = 96): string {
  const label = name.trim() || 'Kit';
  const initial = escapeXml(label.charAt(0).toUpperCase());
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">`,
    '<defs>',
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#F5F9F2"/>',
    '<stop offset="1" stop-color="#C8DCC2"/>',
    '</linearGradient>',
    '</defs>',
    '<rect width="96" height="96" rx="18" fill="url(#g)"/>',
    '<path d="M14 70c14-13 27-19 40-18 8 1 16 5 28 14" fill="none" stroke="#FFFFFF" stroke-opacity=".65" stroke-width="2"/>',
    '<path d="M38 38V32a10 10 0 0 1 20 0v6M32 44a10 10 0 0 1 10-10h12a10 10 0 0 1 10 10v18a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V44Z" fill="none" stroke="#17402C" stroke-opacity=".5" stroke-width="2.4" stroke-linejoin="round"/>',
    `<text x="48" y="58" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif" font-size="28" font-weight="700" fill="#17402C">${initial}</text>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
