import type { NormalizedTraceImport, TraceImportFormat, TraceImportOptions } from './model';
import { TraceImportError } from './model';
import { parseFit } from './fit';
import { parseTcx } from './tcx';

export type TraceFileInput =
  | { bytes: Uint8Array; fileName?: string }
  | { text: string; fileName?: string };

/**
 * Détecte le format sans se fier au seul nom de fichier : l'extension sert
 * d'indice, la signature réelle tranche. Une chaîne XML est un TCX si sa racine
 * est `TrainingCenterDatabase`; un tableau d'octets est un FIT si la signature
 * `.FIT` est présente.
 */
export function detectTraceFormat(input: TraceFileInput): TraceImportFormat | null {
  const fileName = input.fileName?.toLowerCase() ?? '';

  if ('bytes' in input) {
    // La signature réelle passe avant l'extension : un FIT renommé en .tcx
    // reste un FIT, et un TCX renommé en .fit reste un TCX.
    if (hasFitMagic(input.bytes)) return 'fit';
    if (looksLikeTcxBytes(input.bytes)) return 'tcx';
    if (fileName.endsWith('.fit')) return 'fit';
    if (fileName.endsWith('.tcx')) return 'tcx';
    return null;
  }

  if (looksLikeTcxText(input.text)) return 'tcx';
  if (fileName.endsWith('.fit')) return 'fit';
  if (fileName.endsWith('.tcx')) return 'tcx';
  return null;
}

/**
 * Point d'entrée unique pour l'import d'un fichier local. Le format effectif
 * est détecté par signature, puis le parseur correspondant est appliqué.
 */
export function parseTraceFile(
  input: TraceFileInput,
  options: TraceImportOptions = {},
): NormalizedTraceImport {
  const fileName = input.fileName ?? options.fileName;
  const format = detectTraceFormat(
    'bytes' in input
      ? { bytes: input.bytes, fileName }
      : { text: input.text, fileName },
  );

  if (format === 'fit') {
    if (!('bytes' in input)) {
      throw new TraceImportError('not-fit', 'Un fichier FIT doit être fourni en octets.');
    }
    return parseFit(input.bytes, { ...options, fileName });
  }
  if (format === 'tcx') {
    if ('text' in input) return parseTcx(input.text, { ...options, fileName });
    return parseTcx(decodeText(input.bytes), {
      ...options,
      fileName,
      sourceByteLength: input.bytes.length,
    });
  }

  throw new TraceImportError(
    'invalid-input',
    'Format de trace non reconnu : attendu FIT (.fit) ou TCX (.tcx).',
  );
}

/**
 * Clé de déduplication à portée propriétaire. L'empreinte seule ne suffit pas :
 * deux fichiers identiques importés par deux comptes restent deux objets.
 *
 * Le format source n'entre volontairement pas dans la clé : la base déduplique
 * sur `(owner_id, source_fingerprint)`. Deux lectures du même contenu ne
 * doivent pas créer deux objets, même si l'une annonce FIT et l'autre TCX.
 */
export function traceImportDedupeKey(
  trace: NormalizedTraceImport,
  ownerId: string,
): string {
  return `${ownerId}:${trace.provenance.fingerprint}`;
}

function hasFitMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return bytes[8] === 0x2e
    && bytes[9] === 0x46
    && bytes[10] === 0x49
    && bytes[11] === 0x54;
}

function looksLikeTcxText(text: string): boolean {
  return /<(?:\w+:)?TrainingCenterDatabase\b/.test(text);
}

function looksLikeTcxBytes(bytes: Uint8Array): boolean {
  const prefix = decodeText(bytes.subarray(0, Math.min(bytes.length, 4096)));
  return looksLikeTcxText(prefix);
}

function decodeText(bytes: Uint8Array): string {
  // Un TCX peut être encodé en UTF-16 avec BOM (XML valide). Sans cette
  // détection, le texte était décodé en UTF-8 puis refusé comme « invalid-xml »
  // avec un message qui ne disait pas que l'encodage était en cause.
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeWithEncoding('utf-16le', bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeWithEncoding('utf-16be', bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeWithEncoding('utf-8', bytes.subarray(3));
  }
  return decodeWithEncoding('utf-8', bytes);
}

function decodeWithEncoding(encoding: 'utf-8' | 'utf-16le' | 'utf-16be', bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      // Certains moteurs n'exposent pas utf-16be : le repli manuel ci-dessous
      // reste correct pour du XML BMP, cas normal d'un TCX.
    }
  }

  if (encoding === 'utf-16be') {
    let result = '';
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      result += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return result;
  }
  if (encoding === 'utf-16le') {
    let result = '';
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      result += String.fromCharCode(bytes[index] | (bytes[index + 1] << 8));
    }
    return result;
  }

  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return result;
}
