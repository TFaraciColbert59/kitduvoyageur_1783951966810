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
 * fermeture correspond exactement à son ouverture. Les namespaces sont résolus
 * ici, avec héritage des déclarations `xmlns` / `xmlns:préfixe` et gestion de
 * `xmlns=""` : un préfixe non lié est refusé, et le lecteur de format reçoit
 * l'URI effective de chaque élément, jamais un simple nom local.
 */

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

export interface SafeXmlElement {
  qualifiedName: string;
  localName: string;
  prefix: string | null;
  /** URI résolue, `null` si l'élément n'est dans aucun namespace. */
  namespaceURI: string | null;
}

export interface SafeXmlSink {
  /** `depth` commence à 1 pour l'élément racine. */
  open(
    element: SafeXmlElement,
    attributes: Readonly<Record<string, string>>,
    selfClosing: boolean,
    depth: number,
  ): void;
  close(element: SafeXmlElement, depth: number): void;
  text(value: string): void;
}

export interface SafeXmlScanResult {
  rootName: string | null;
  truncated: boolean;
}

interface ScanOptions {
  maxDepth: number;
}

interface NamespaceContext {
  defaultNamespace: string | null;
  prefixes: Readonly<Record<string, string>>;
}

const EMPTY_NAMESPACE_CONTEXT: NamespaceContext = Object.freeze({
  defaultNamespace: null,
  prefixes: Object.freeze(Object.create(null) as Record<string, string>),
});

export function scanSafeXml(
  xml: string,
  sink: SafeXmlSink,
  options: ScanOptions,
): SafeXmlScanResult {
  const stack: SafeXmlElement[] = [];
  const namespaceStack: NamespaceContext[] = [];
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
      const { localName } = parseQualifiedName(rawName);
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

      namespaceStack.pop();
      sink.close(expected, stack.length + 1);
      if (stack.length === 0) rootClosed = true;
    } else {
      const selfClosing = rawTag.endsWith('/');
      const tagContent = selfClosing ? rawTag.slice(0, -1).trim() : rawTag;
      const { name, attributes } = parseStartTag(tagContent);
      const { prefix, localName } = parseQualifiedName(name);
      const parentNamespaces = namespaceStack[namespaceStack.length - 1] ?? EMPTY_NAMESPACE_CONTEXT;
      const namespaces = buildNamespaceContext(attributes, parentNamespaces);
      const element: SafeXmlElement = {
        qualifiedName: name,
        localName,
        prefix,
        namespaceURI: resolveElementNamespace(prefix, namespaces, name),
      };
      assertAttributeNamespaces(attributes, namespaces);

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
      sink.open(element, attributes, selfClosing, depth);

      if (selfClosing) {
        sink.close(element, depth);
        if (stack.length === 0) rootClosed = true;
      } else {
        stack.push(element);
        namespaceStack.push(namespaces);
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
  // Objet sans prototype : un attribut nommé `__proto__` reste une donnée.
  const attributes: Record<string, string> = Object.create(null);
  let index = name.length;
  parseQualifiedName(name);

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
    parseQualifiedName(attributeName);
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

/** Un QName XML a au plus un `:` et deux parties NCName valides. */
function parseQualifiedName(rawName: string): { prefix: string | null; localName: string } {
  const parts = rawName.split(':');
  if (parts.length > 2 || parts.some((part) => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(part))) {
    throw new TraceImportError('invalid-xml', `Nom qualifié invalide : ${excerpt(rawName)}.`);
  }
  return parts.length === 1
    ? { prefix: null, localName: parts[0] }
    : { prefix: parts[0], localName: parts[1] };
}

function buildNamespaceContext(
  attributes: Readonly<Record<string, string>>,
  parent: NamespaceContext,
): NamespaceContext {
  let defaultNamespace = parent.defaultNamespace;
  const prefixes: Record<string, string> = Object.create(null);
  for (const [prefix, uri] of Object.entries(parent.prefixes)) prefixes[prefix] = uri;

  for (const [name, rawValue] of Object.entries(attributes)) {
    if (name === 'xmlns') {
      defaultNamespace = rawValue.length > 0 ? rawValue : null;
      continue;
    }
    if (!name.startsWith('xmlns:')) continue;

    const prefix = name.slice('xmlns:'.length);
    if (prefix === 'xmlns' || prefix.length === 0) {
      throw new TraceImportError(
        'invalid-xml',
        `Déclaration de namespace interdite : ${excerpt(name)}.`,
      );
    }
    if (rawValue.length === 0) {
      throw new TraceImportError(
        'invalid-xml',
        `Le préfixe « ${excerpt(prefix)} » ne peut pas être lié à un namespace vide.`,
      );
    }
    if (prefix === 'xml') {
      if (rawValue !== XML_NAMESPACE) {
        throw new TraceImportError(
          'invalid-xml',
          'Le préfixe réservé « xml » doit rester lié à son namespace standard.',
        );
      }
      continue;
    }
    if (rawValue === XMLNS_NAMESPACE || rawValue === XML_NAMESPACE) {
      throw new TraceImportError(
        'invalid-xml',
        `Le namespace réservé « ${excerpt(rawValue)} » ne peut pas être lié au préfixe « ${excerpt(prefix)} ».`,
      );
    }
    prefixes[prefix] = rawValue;
  }

  return { defaultNamespace, prefixes };
}

function resolveElementNamespace(
  prefix: string | null,
  namespaces: NamespaceContext,
  qualifiedName: string,
): string | null {
  if (prefix == null) return namespaces.defaultNamespace;
  if (prefix === 'xml') return XML_NAMESPACE;
  if (prefix === 'xmlns') {
    throw new TraceImportError(
      'invalid-xml',
      `Le préfixe « xmlns » ne peut pas nommer un élément : ${excerpt(qualifiedName)}.`,
    );
  }
  const namespace = namespaces.prefixes[prefix];
  if (namespace == null) {
    throw new TraceImportError(
      'invalid-xml',
      `Préfixe « ${excerpt(prefix)} » non lié pour <${excerpt(qualifiedName)}>.`,
    );
  }
  return namespace;
}

function assertAttributeNamespaces(
  attributes: Readonly<Record<string, string>>,
  namespaces: NamespaceContext,
): void {
  for (const name of Object.keys(attributes)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    const separator = name.indexOf(':');
    if (separator < 0) continue;
    const prefix = name.slice(0, separator);
    if (prefix === 'xml') continue;
    if (prefix === 'xmlns') {
      throw new TraceImportError(
        'invalid-xml',
        `Le préfixe « xmlns » ne peut pas nommer un attribut : ${excerpt(name)}.`,
      );
    }
    if (namespaces.prefixes[prefix] == null) {
      throw new TraceImportError(
        'invalid-xml',
        `Préfixe « ${excerpt(prefix)} » non lié pour l’attribut ${excerpt(name)}.`,
      );
    }
  }
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
