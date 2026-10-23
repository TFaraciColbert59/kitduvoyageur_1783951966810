import { createElement, type ReactNode } from 'react';

export interface MentionInput {
  id: string;
  name: string;
}

export interface MentionTextSegment {
  type: 'text';
  text: string;
}

export interface MentionSegment {
  type: 'mention';
  id: string;
  name: string;
}

export type ParsedMention = MentionTextSegment | MentionSegment;

const MENTION_OPEN = '@[';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMentionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Encodes a profile reference as the canonical `@[Name](uuid)` token.
 * `]` and `\` are escaped so any display name survives a round-trip.
 */
export function encodeMention({ id, name }: MentionInput): string {
  const escapedName = name.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
  return `${MENTION_OPEN}${escapedName}](${id})`;
}

/**
 * Reads a display name starting right after `@[`.
 * Returns null when no unescaped closing bracket exists.
 */
function readMentionName(text: string, start: number): { name: string; end: number } | null {
  let index = start;
  let name = '';

  while (index < text.length) {
    const char = text[index];

    if (char === '\\') {
      const next = text[index + 1];
      if (next === '\\' || next === ']' || next === '[') {
        name += next;
        index += 2;
        continue;
      }
      // Unknown escape: keep the backslash literally.
      name += char;
      index += 1;
      continue;
    }

    if (char === ']') {
      return { name, end: index + 1 };
    }

    name += char;
    index += 1;
  }

  return null;
}

/**
 * Splits a text into plain-text and mention segments.
 * Malformed tokens (bad or missing UUID, unclosed brackets, empty name) stay
 * inside the surrounding text so no content is ever lost on render.
 */
export function parseMentions(text: string): ParsedMention[] {
  if (!text) return [];

  const segments: ParsedMention[] = [];
  let cursor = 0;
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const start = text.indexOf(MENTION_OPEN, searchFrom);
    if (start === -1) break;

    const parsedName = readMentionName(text, start + MENTION_OPEN.length);
    if (!parsedName) break;

    const { name, end } = parsedName;

    if (text[end] !== '(') {
      searchFrom = end;
      continue;
    }

    const closingParen = text.indexOf(')', end + 1);
    if (closingParen === -1) {
      searchFrom = end;
      continue;
    }

    const id = text.slice(end + 1, closingParen);
    if (!name || !isMentionId(id)) {
      searchFrom = closingParen + 1;
      continue;
    }

    if (start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, start) });
    }
    segments.push({ type: 'mention', id, name });
    cursor = closingParen + 1;
    searchFrom = cursor;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return segments;
}

/**
 * Renders `parseMentions` output as React nodes. Mentions are plain anchors
 * (not `next/link`) so the helper stays testable and reusable outside the app
 * router; the consuming component can still style `.lkdv-mention`.
 */
export function renderMentions(text: string): ReactNode[] {
  return parseMentions(text).map((segment, index) => {
    if (segment.type === 'text') return segment.text;

    return createElement(
      'a',
      {
        key: `mention-${index}-${segment.id}`,
        href: `/profil/${encodeURIComponent(segment.id)}`,
        className: 'lkdv-mention',
        'data-mention-id': segment.id,
      },
      `@${segment.name}`
    );
  });
}
