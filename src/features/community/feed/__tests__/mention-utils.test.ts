import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { encodeMention, parseMentions, renderMentions } from '../mention-utils';

const MARIE = '11111111-1111-4111-8111-111111111111';
const SAM = '22222222-2222-4222-8222-222222222222';

describe('encodeMention', () => {
  it('produces the @[name](uuid) token', () => {
    expect(encodeMention({ id: MARIE, name: 'Marie Dupont' })).toBe(`@[Marie Dupont](${MARIE})`);
  });

  it('escapes closing brackets and backslashes in the name', () => {
    expect(encodeMention({ id: MARIE, name: 'Jean [Le Voyageur]' })).toBe(
      `@[Jean [Le Voyageur\\]](${MARIE})`
    );
    expect(encodeMention({ id: MARIE, name: 'C:\\Voyage' })).toBe(`@[C:\\\\Voyage](${MARIE})`);
  });
});

describe('parseMentions', () => {
  it('returns an empty list for an empty text', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns a single text segment when there is no mention', () => {
    expect(parseMentions('Bonjour à tous')).toEqual([{ type: 'text', text: 'Bonjour à tous' }]);
  });

  it('splits text around a mention', () => {
    expect(parseMentions(`Salut @[Marie Dupont](${MARIE}) !`)).toEqual([
      { type: 'text', text: 'Salut ' },
      { type: 'mention', id: MARIE, name: 'Marie Dupont' },
      { type: 'text', text: ' !' },
    ]);
  });

  it('parses several mentions without empty text segments', () => {
    expect(parseMentions(`@[Marie](${MARIE}) et @[Sam](${SAM})`)).toEqual([
      { type: 'mention', id: MARIE, name: 'Marie' },
      { type: 'text', text: ' et ' },
      { type: 'mention', id: SAM, name: 'Sam' },
    ]);
  });

  it('supports spaces, parentheses and escaped brackets in names', () => {
    expect(parseMentions(`@[Jean (Le Voyageur) [Alpin\\]](${MARIE})`)).toEqual([
      { type: 'mention', id: MARIE, name: 'Jean (Le Voyageur) [Alpin]' },
    ]);
  });

  it('keeps malformed tokens as text', () => {
    const malformed = [
      `@[Marie](not-a-uuid)`,
      `@[Marie](${MARIE}`,
      `@[Marie] ${MARIE}`,
      `@[](${MARIE})`,
      `@[Marie(${MARIE})`,
    ];

    for (const text of malformed) {
      expect(parseMentions(text)).toEqual([{ type: 'text', text }]);
    }
  });

  it('keeps a malformed token followed by a valid mention', () => {
    expect(parseMentions(`@[Inconnu](pas-un-uuid) puis @[Marie](${MARIE})`)).toEqual([
      { type: 'text', text: '@[Inconnu](pas-un-uuid) puis ' },
      { type: 'mention', id: MARIE, name: 'Marie' },
    ]);
  });

  it('round-trips encodeMention for hostile names', () => {
    const name = 'Jean [Le Voyageur] \\ (Alpin)';
    const parsed = parseMentions(`Avant ${encodeMention({ id: MARIE, name })} après`);
    expect(parsed).toEqual([
      { type: 'text', text: 'Avant ' },
      { type: 'mention', id: MARIE, name },
      { type: 'text', text: ' après' },
    ]);
  });
});

describe('renderMentions', () => {
  it('renders a mention as an internal profile link', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, ...renderMentions(`Salut @[Marie & Co](${MARIE}) !`))
    );

    expect(html).toMatch(new RegExp(`<a [^>]*href="/profil/${MARIE}"[^>]*>@Marie &amp; Co</a>`));
    expect(html).toContain('Salut ');
    expect(html).toContain(' !');
    expect(html).not.toContain('@[');
  });

  it('renders plain text without wrapping it', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, ...renderMentions('Rien à mentionner'))
    );
    expect(html).toBe('<div>Rien à mentionner</div>');
  });

  it('returns no nodes for an empty text', () => {
    expect(renderMentions('')).toEqual([]);
  });
});
