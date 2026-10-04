import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '@/features/pays/chat/paysChatChunking';

describe('chunkMarkdown', () => {
  it('retourne un tableau vide pour un texte vide', () => {
    expect(chunkMarkdown('')).toEqual([]);
    expect(chunkMarkdown('   \n\n  ')).toEqual([]);
  });

  it('fusionne les petits paragraphes jusqu au maximum', () => {
    const chunks = chunkMarkdown('a\n\nb\n\nc', 6);
    expect(chunks).toEqual(['a\n\nb', 'c']);
  });

  it('decoupe un long paragraphe au mot sans depasser le maximum', () => {
    const para = 'mot '.repeat(50).trim();
    const chunks = chunkMarkdown(para, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    expect(chunks.join(' ')).toBe(para);
  });

  it('coupe un mot unique trop long en dernier recours', () => {
    const chunks = chunkMarkdown('a'.repeat(250), 100);
    expect(chunks).toEqual(['a'.repeat(100), 'a'.repeat(100), 'a'.repeat(50)]);
  });
});
