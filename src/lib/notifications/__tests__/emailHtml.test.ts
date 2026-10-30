import { describe, expect, it } from 'vitest';
import { renderNotificationEmail } from '../emailHtml';

describe('notification email HTML boundary', () => {
  it('escapes title and message as text and the final href as an attribute', () => {
    const html = renderNotificationEmail(
      {
        title: '<img src=x onerror="alert(1)">',
        message: '<a href="https://evil.test">Click & go</a>\' ',
        link: '/compte?x=1&next="quoted"',
      },
      'https://lkdv.test'
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain(
      '&lt;a href=&quot;https://evil.test&quot;&gt;Click &amp; go&lt;/a&gt;&#39;'
    );
    expect(html).toContain('href="https://lkdv.test/compte?x=1&amp;next=%22quoted%22"');
  });
  it.each([
    '//evil.test/path',
    'https://evil.test',
    'javascript:alert(1)',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/path\nfoo',
    ' /compte',
  ])('omits the CTA for invalid links %s', (link) => {
    expect(
      renderNotificationEmail({ title: 'Title', message: 'Message', link }, 'https://lkdv.test')
    ).not.toContain('<a ');
  });
  it('keeps plain text content and a same-origin relative activity link', () => {
    expect(
      renderNotificationEmail(
        { title: 'Été', message: 'Bonjour', link: '/communaute#activity' },
        'https://lkdv.test/base'
      )
    ).toContain('href="https://lkdv.test/communaute#activity"');
  });
});
