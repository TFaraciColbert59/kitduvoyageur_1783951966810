/** Logique de scan OCR — parsing de la réponse Gemini Vision, testable. */

export interface ScanExtract {
  brand?: string;
  model?: string;
  category?: string;
  weight_g_estimate?: number;
  material?: string;
  confidence?: number;
  barcode?: string;
}

/** Extrait le JSON strict d'une réponse Gemini (nettoie les blocs ```json). */
export function cleanJsonBlock(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

/** Parse la réponse du modèle en ScanExtract, avec fallback heuristique. */
export function parseScanExtract(text: string): ScanExtract {
  let extracted: ScanExtract = {};
  const cleaned = cleanJsonBlock(text);
  try {
    extracted = JSON.parse(cleaned) as ScanExtract;
  } catch {
    const brandMatch = text.match(/marque\s*[: -]?\s*([A-Za-z0-9 ]{2,30})/i);
    const weightMatch = text.match(/(\d{2,5})\s*g/i);
    if (brandMatch) extracted.brand = brandMatch[1].trim();
    if (weightMatch) extracted.weight_g_estimate = Number(weightMatch[1]);
  }
  return extracted;
}
