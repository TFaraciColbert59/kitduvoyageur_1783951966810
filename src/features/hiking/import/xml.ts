import { TraceImportError } from './model';

/**
 * Lecteur XML minimal, strict et sans dépendance, réservé aux documents
 * d'import (TCX aujourd'hui, XML borné demain).
 *
 * Il ne construit pas de DOM et n'interprète aucune déclaration de type de
 * document. `<!DOCTYPE>`, `<!ENTITY>` et toute entité nommée non prédéfinie
 * sont refusés avant lecture : aucune entité externe ne peut être résolue.
 * Seules les cinq entités XML prédéfinies et les références numériques vers un
 * caractère XML 1.0 valide sont décodées.
 *
 * Les noms qualifiés (préfixe compris) sont conservés pour vérifier qu'une
 * fermeture correspond exactement à son ouverture. La résolution de l'URI des
 * préfixes reste à la charge du lecteur de format, qui connaît son schéma.
 */

export interface SafeXmlSink {
  /** `depth` commence à 1 pour l'élément racine. */
  open(
    qualifiedName: string,
    localName: string,
    attributes: Readonly<Record<string, string>>,
    selfClosing: boolean,
    depth: number,
  ): void;
  close(qualifiedName: string, localName: string, depth: number): void;
  text(value: string): void;
}

export interface SafeXmlScanResult {
  rootName: string | null;
  truncated: boolean;
}

interface ScanOptions {
  maxDepth: number;
}

interface OpenElement {
  qualifiedName: string;
  localName: string;
}

export function scanSafeXml(
  xml: string,
  sink: SafeXmlSink,
  options: ScanOptions,
): SafeXmlScanResult {
  const stack: OpenElement[] = [];
  let position = 0;
  let rootName: string | null = null;
  let rootClosed = false;
  let sawRoot = false;
  let sawXmlDeclaration = false;

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
      if (end < 0) return incomplete();
      position = end + 3;
      continue;
    }

    if (xml.startsWith('<![CDATA[', nextOpen)) {
      const end = xml.indexOf(']]>', nextOpen + 9);
      if (end < 0) return incomplete();
      if (stack.length === 0) {
        throw new TraceImportError('invalid-xml', 'CDATA hors de l’élément racine.');
      }
      const cdata = xml.slice(nextOpen + 9, end);
      assertValidXmlCharacters(cdata, 'CDATA');
      sink.text(cdata);
      position = end + 3;
      continue;
    }

    if (xml.startsWith('<?', nextOpen)) {
      const end = xml.indexOf('?>', nextOpen + 2);
      if (end < 0) return incomplete();
      const instruction = xml.slice(nextOpen + 2, end).trim();
      if (sawRoot || sawXmlDeclaration) {
        throw new TraceImportError(
          'invalid-xml',
          'Déclaration ou instruction de traitement XML inattendue.',
        );
      }
      if (!/^xml(?:\s|$)/i.test(instruction)) {
        throw new TraceImportError('invalid-xml', 'Instruction de traitement XML inattendue.');
      }
      const afterBom = nextOpen === 1 && xml.charCodeAt(0) === 0xfeff;
      if (nextOpen !== 0 && !afterBom) {
        throw new TraceImportError(
          'invalid-xml',
          'La déclaration XML doit être le premier contenu du document.',
        );
      }
      sawXmlDeclaration = true;
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
    if (tagEnd < 0) return incomplete();

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
        throw new TraceImportError(
          'invalid-xml',
          `Fermeture de <${excerpt(localName)}> sans ouverture.`,
        );
      }
      if (expected.qualifiedName !== rawName) {
        throw new TraceImportError(
          'invalid-xml',
          `Fermeture de <${excerpt(rawName)}> alors que <${excerpt(expected.qualifiedName)}> est ouvert.`,
        );
      }

      sink.close(rawName, localName, stack.length + 1);
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
      sink.open(name, localName, attributes, selfClosing, depth);

      if (selfClosing) {
        sink.close(name, localName, depth);
        if (stack.length === 0) rootClosed = true;
      } else {
        stack.push({ qualifiedName: name, localName });
      }
    }

    position = tagEnd + 1;
  }

  if (!sawRoot) {
    throw new TraceImportError('invalid-xml', 'Élément racine absent.');
  }
  if (stack.length > 0) return incomplete();
  if (!rootClosed) {
    throw new TraceImportError('invalid-xml', 'Document XML incomplet.');
  }

  return { rootName, truncated: false };

  /**
   * Une fin de fichier n'est une troncature que si la racine est encore
   * ouverte. Après sa fermeture, un commentaire ou une balise inachevée est
   * un document mal formé, pas un fichier coupé.
   */
  function incomplete(): SafeXmlScanResult {
    if (rootClosed) {
      throw new TraceImportError(
        'invalid-xml',
        'Contenu XML incomplet après la fermeture de l’élément racine.',
      );
    }
    return { rootName, truncated: true };
  }

  function emitText(value: string): void {
    if (value.length === 0) return;
    if (stack.length === 0) {
      if (value.trim().length > 0) {
        throw new TraceImportError('invalid-xml', 'Texte hors de l’élément racine.');
      }
      return;
    }
    assertValidXmlCharacters(value, 'texte XML');
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
    // Un attribut doit être séparé du nom ou de l'attribut précédent par au
    // moins un espace : `<a x="1"y="2">` est du XML mal formé.
    if (!isWhitespace(content[index])) {
      throw new TraceImportError(
        'invalid-xml',
        `Attribut non séparé par un espace dans <${excerpt(name)}>.`,
      );
    }
    while (index < content.length && isWhitespace(content[index])) index += 1;
    if (index >= content.length) break;

    const attributeMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(content.slice(index));
    if (attributeMatch == null) {
      throw new TraceImportError('invalid-xml', `Attribut invalide dans <${excerpt(name)}>.`);
    }

    const attributeName = attributeMatch[0];
    index += attributeName.length;
    while (index < content.length && isWhitespace(content[index])) index += 1;

    if (content[index] !== '=') {
      throw new TraceImportError(
        'invalid-xml',
        `Attribut ${excerpt(attributeName)} sans valeur.`,
      );
    }

    index += 1;
    while (index < content.length && isWhitespace(content[index])) index += 1;

    const quote = content[index];
    if (quote !== '"' && quote !== "'") {
      throw new TraceImportError(
        'invalid-xml',
        `Valeur de ${excerpt(attributeName)} non citée.`,
      );
    }

    const end = content.indexOf(quote, index + 1);
    if (end < 0) {
      throw new TraceImportError(
        'invalid-xml',
        `Valeur de ${excerpt(attributeName)} non terminée.`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(attributes, attributeName)) {
      throw new TraceImportError(
        'invalid-xml',
        `Attribut ${excerpt(attributeName)} dupliqué.`,
      );
    }

    const rawValue = content.slice(index + 1, end);
    assertValidXmlCharacters(rawValue, `attribut ${attributeName}`);
    attributes[attributeName] = decodeEntities(rawValue, `attribut ${attributeName}`);
    index = end + 1;
  }

  return { name, attributes };
}

function assertElementName(rawName: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(rawName)) {
    throw new TraceImportError('invalid-xml', `Nom de balise invalide : ${excerpt(rawName)}.`);
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
        `Entité nommée « ${excerpt(entity)} » interdite dans ${where} : aucune entité externe n’est traitée.`,
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
  if (!Number.isInteger(codePoint) || !isXmlCodePoint(codePoint)) {
    throw new TraceImportError(
      'invalid-xml',
      `Point de code U+${excerpt(raw)} interdit par XML 1.0 dans ${where}.`,
    );
  }

  return String.fromCodePoint(codePoint);
}

/** Production `Char` de XML 1.0 (les contrôles C0 et les non-caractères sont exclus). */
function isXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x09
    || codePoint === 0x0a
    || codePoint === 0x0d
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function assertValidXmlCharacters(value: string, where: string): void {
  let index = 0;

  while (index < value.length) {
    const codePoint = value.codePointAt(index);
    if (codePoint == null) return;
    if (!isXmlCodePoint(codePoint)) {
      throw new TraceImportError(
        'invalid-xml',
        `Caractère U+${codePoint.toString(16).toUpperCase()} interdit par XML 1.0 dans ${where}.`,
      );
    }
    index += codePoint > 0xffff ? 2 : 1;
  }
}

function isWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

function excerpt(value: string, maxLength = 40): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}… (${value.length} caractères)`;
}
