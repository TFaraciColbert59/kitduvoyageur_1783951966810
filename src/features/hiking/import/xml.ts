import { TraceImportError } from './model';

/**
 * Lecteur XML minimal, strict et sans dépendance, réservé aux documents
 * d'import (TCX aujourd'hui, XML borné demain).
 *
 * Il ne construit pas de DOM et n'interprète aucune déclaration de type de
 * document. `<!DOCTYPE>`, `<!ENTITY>` et toute entité nommée non prédéfinie
 * sont refusés avant lecture : aucune entité externe ne peut être résolue.
 * Seules les cinq entités XML prédéfinies et les références numériques sont
 * décodées.
 */

export interface SafeXmlSink {
  /** `depth` commence à 1 pour l'élément racine. */
  open(
    localName: string,
    attributes: Readonly<Record<string, string>>,
    selfClosing: boolean,
    depth: number,
  ): void;
  close(localName: string, depth: number): void;
  text(value: string): void;
}

export interface SafeXmlScanResult {
  rootName: string | null;
  truncated: boolean;
}

interface ScanOptions {
  maxDepth: number;
}

export function scanSafeXml(
  xml: string,
  sink: SafeXmlSink,
  options: ScanOptions,
): SafeXmlScanResult {
  const stack: string[] = [];
  let position = 0;
  let rootName: string | null = null;
  let rootClosed = false;
  let sawRoot = false;

  while (position < xml.length) {
    const nextOpen = xml.indexOf('<', position);

    if (nextOpen < 0) {
      emitText(xml.slice(position));
      position = xml.length;
      break;
    }

    if (nextOpen > position) emitText(xml.slice(position, nextOpen));

    if (xml.startsWith('<!--', nextOpen)) {
      const end = xml.indexOf('-->', nextOpen + 4);
      if (end < 0) return { rootName, truncated: true };
      position = end + 3;
      continue;
    }

    if (xml.startsWith('<![CDATA[', nextOpen)) {
      const end = xml.indexOf(']]>', nextOpen + 9);
      if (end < 0) return { rootName, truncated: true };
      if (stack.length === 0) {
        throw new TraceImportError('invalid-xml', 'CDATA hors de l’élément racine.');
      }
      sink.text(xml.slice(nextOpen + 9, end));
      position = end + 3;
      continue;
    }

    if (xml.startsWith('<?', nextOpen)) {
      const end = xml.indexOf('?>', nextOpen + 2);
      if (end < 0) return { rootName, truncated: true };
      const instruction = xml.slice(nextOpen + 2, end).trim();
      if (sawRoot || !/^xml(?:\s|$)/i.test(instruction)) {
        throw new TraceImportError('invalid-xml', 'Instruction de traitement XML inattendue.');
      }
      position = end + 2;
      continue;
    }

    if (xml.startsWith('<!', nextOpen)) {
      throw new TraceImportError(
        'external-entity-forbidden',
        'DTD et entités externes interdites dans un fichier d’import.',
      );
    }

    const tagEnd = findTagEnd(xml, nextOpen + 1);
    if (tagEnd < 0) return { rootName, truncated: true };

    const rawTag = xml.slice(nextOpen + 1, tagEnd).trim();
    if (rawTag.length === 0) {
      throw new TraceImportError('invalid-xml', 'Balise XML vide.');
    }

    if (rawTag.startsWith('/')) {
      const rawName = rawTag.slice(1).trim();
      assertElementName(rawName);
      const localName = toLocalName(rawName);
      const expected = stack.pop();

      if (expected == null) {
        throw new TraceImportError('invalid-xml', `Fermeture de <${localName}> sans ouverture.`);
      }
      if (expected !== localName) {
        throw new TraceImportError(
          'invalid-xml',
          `Fermeture de <${localName}> alors que <${expected}> est ouvert.`,
        );
      }

      sink.close(localName, stack.length + 1);
      if (stack.length === 0) rootClosed = true;
    } else {
      const selfClosing = rawTag.endsWith('/');
      const tagContent = selfClosing ? rawTag.slice(0, -1).trim() : rawTag;
      const { name, attributes } = parseStartTag(tagContent);
      const localName = toLocalName(name);

      if (stack.length === 0) {
        if (rootClosed) {
          throw new TraceImportError('invalid-xml', 'Plusieurs éléments racines.');
        }
        if (sawRoot) {
          throw new TraceImportError('invalid-xml', 'Élément racine dupliqué.');
        }
        sawRoot = true;
        rootName = localName;
      }

      if (stack.length + 1 > options.maxDepth) {
        throw new TraceImportError(
          'xml-too-deep',
          `Profondeur XML supérieure à la borne de ${options.maxDepth}.`,
        );
      }

      const depth = stack.length + 1;
      sink.open(localName, attributes, selfClosing, depth);

      if (selfClosing) {
        sink.close(localName, depth);
        if (stack.length === 0) rootClosed = true;
      } else {
        stack.push(localName);
      }
    }

    position = tagEnd + 1;
  }

  if (!sawRoot) {
    throw new TraceImportError('invalid-xml', 'Élément racine absent.');
  }
  if (stack.length > 0) return { rootName, truncated: true };
  if (!rootClosed) {
    throw new TraceImportError('invalid-xml', 'Document XML incomplet.');
  }

  return { rootName, truncated: false };

  function emitText(value: string): void {
    if (value.length === 0) return;
    if (stack.length === 0) {
      if (value.trim().length > 0) {
        throw new TraceImportError('invalid-xml', 'Texte hors de l’élément racine.');
      }
      return;
    }
    sink.text(decodeEntities(value, 'texte XML'));
  }
}

function findTagEnd(xml: string, start: number): number {
  let quote: '"' | "'" | null = null;

  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];
    if (quote != null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index;
    if (character === '<') {
      throw new TraceImportError('invalid-xml', 'Caractère < dans une balise.');
    }
  }

  return -1;
}

function parseStartTag(content: string): {
  name: string;
  attributes: Record<string, string>;
} {
  const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(content);
  if (nameMatch == null) {
    throw new TraceImportError('invalid-xml', 'Nom de balise XML invalide.');
  }

  const name = nameMatch[0];
  const attributes: Record<string, string> = {};
  let index = name.length;

  while (index < content.length) {
    while (index < content.length && /\s/.test(content[index])) index += 1;
    if (index >= content.length) break;

    const attributeMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(content.slice(index));
    if (attributeMatch == null) {
      throw new TraceImportError('invalid-xml', `Attribut invalide dans <${name}>.`);
    }

    const attributeName = attributeMatch[0];
    index += attributeName.length;
    while (index < content.length && /\s/.test(content[index])) index += 1;

    if (content[index] !== '=') {
      throw new TraceImportError('invalid-xml', `Attribut ${attributeName} sans valeur.`);
    }

    index += 1;
    while (index < content.length && /\s/.test(content[index])) index += 1;

    const quote = content[index];
    if (quote !== '"' && quote !== "'") {
      throw new TraceImportError('invalid-xml', `Valeur de ${attributeName} non citée.`);
    }

    const end = content.indexOf(quote, index + 1);
    if (end < 0) {
      throw new TraceImportError('invalid-xml', `Valeur de ${attributeName} non terminée.`);
    }
    if (Object.prototype.hasOwnProperty.call(attributes, attributeName)) {
      throw new TraceImportError('invalid-xml', `Attribut ${attributeName} dupliqué.`);
    }

    attributes[attributeName] = decodeEntities(
      content.slice(index + 1, end),
      `attribut ${attributeName}`,
    );
    index = end + 1;
  }

  return { name, attributes };
}

function assertElementName(rawName: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(rawName)) {
    throw new TraceImportError('invalid-xml', `Nom de balise invalide : ${rawName}.`);
  }
}

function toLocalName(name: string): string {
  const separator = name.lastIndexOf(':');
  return separator >= 0 ? name.slice(separator + 1) : name;
}

function decodeEntities(raw: string, where: string): string {
  let result = '';

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character !== '&') {
      result += character;
      continue;
    }

    const end = raw.indexOf(';', index + 1);
    if (end < 0) {
      throw new TraceImportError('invalid-xml', `Entité non terminée dans ${where}.`);
    }

    const entity = raw.slice(index + 1, end);
    if (entity === 'lt') result += '<';
    else if (entity === 'gt') result += '>';
    else if (entity === 'amp') result += '&';
    else if (entity === 'quot') result += '"';
    else if (entity === 'apos') result += "'";
    else if (entity.startsWith('#x') || entity.startsWith('#X')) {
      result += decodeCodePoint(entity.slice(2), 16, where);
    } else if (entity.startsWith('#')) {
      result += decodeCodePoint(entity.slice(1), 10, where);
    } else {
      throw new TraceImportError(
        'external-entity-forbidden',
        `Entité nommée « ${entity} » interdite dans ${where} : aucune entité externe n’est traitée.`,
      );
    }

    index = end;
  }

  return result;
}

function decodeCodePoint(raw: string, radix: 10 | 16, where: string): string {
  if (raw.length === 0 || !/^[0-9A-Fa-f]+$/.test(raw)) {
    throw new TraceImportError('invalid-xml', `Référence numérique invalide dans ${where}.`);
  }

  const codePoint = Number.parseInt(raw, radix);
  if (
    !Number.isInteger(codePoint)
    || codePoint < 0
    || codePoint > 0x10ffff
    || (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    throw new TraceImportError('invalid-xml', `Point de code invalide dans ${where}.`);
  }

  return String.fromCodePoint(codePoint);
}
