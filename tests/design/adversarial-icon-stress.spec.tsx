import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Icon from '@/components/ui/Icon/Icon';

describe('Adversarial Stress Test: Icon.tsx', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('1. Resolves standard semantic icon names to vector SVG', () => {
    const markup = renderToStaticMarkup(<Icon name="home" />);
    expect(markup).toContain('<svg');
  });

  it('2. Resolves kebab-case, snake_case, UPPERCASE, and PascalCase for semantic icons', () => {
    const variants = ['compass', 'Compass', 'COMPASS', 'cOmPaSs', 'compas'];
    for (const v of variants) {
      const html = renderToStaticMarkup(<Icon name={v} />);
      expect(html, `Failed on variant: ${v}`).toContain('<svg');
    }

    const chevronVariants = ['chevron-down', 'chevron_down', 'CHEVRON_DOWN', 'ChevronDown', 'ChevronDownIcon'];
    for (const v of chevronVariants) {
      const html = renderToStaticMarkup(<Icon name={v} />);
      expect(html, `Failed on variant: ${v}`).toContain('<svg');
    }
  });

  it('3. Handles unknown icon names gracefully by returning null without throwing', () => {
    const unknownNames = [
      'non-existent-icon-12345',
      'unknown_custom_glyph',
      'totallyFakeIcon',
      'emoji-🚀',
      '<script>alert("xss")</script>',
    ];

    for (const name of unknownNames) {
      expect(() => {
        const html = renderToStaticMarkup(<Icon name={name} />);
        expect(html).toBe('');
      }).not.toThrow();
    }
  });

  it('4. Handles empty string gracefully by returning null without throwing', () => {
    expect(() => {
      const html = renderToStaticMarkup(<Icon name="" />);
      expect(html).toBe('');
    }).not.toThrow();
  });

  it('5. Handles missing/undefined/null/invalid icon name without unhandled exceptions', () => {
    // Missing icon prop (e.g. dynamic prop evaluated to undefined or null)
    expect(() => {
      // @ts-expect-error testing missing prop
      const html = renderToStaticMarkup(<Icon />);
      expect(html).toBe('');
    }).not.toThrow();

    expect(() => {
      // @ts-expect-error testing undefined
      const html = renderToStaticMarkup(<Icon name={undefined} />);
      expect(html).toBe('');
    }).not.toThrow();

    expect(() => {
      // @ts-expect-error testing null
      const html = renderToStaticMarkup(<Icon name={null} />);
      expect(html).toBe('');
    }).not.toThrow();

    expect(() => {
      // @ts-expect-error testing numeric input
      const html = renderToStaticMarkup(<Icon name={123} />);
      expect(html).toBe('');
    }).not.toThrow();
  });

  it('6. Does not execute or leak Object prototype property names as components', () => {
    const protoProps = ['toString', 'valueOf', 'hasOwnProperty', 'constructor', '__proto__'];
    for (const prop of protoProps) {
      const html = renderToStaticMarkup(<Icon name={prop} />);
      // Should safely return null / empty string and not render "[object Undefined]"
      expect(html, `Prop ${prop} should not render a component`).toBe('');
    }
  });

  it('7. Verifies zero raster PNG mask URLs in rendered output', () => {
    const sampleIcons = ['home', 'compass', 'user', 'bell', 'search', 'settings', 'backpack', 'mountain'];
    for (const name of sampleIcons) {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).not.toContain('.png');
      expect(html).not.toContain('mask-image');
      expect(html).not.toContain('-webkit-mask-image');
    }
  });
});
