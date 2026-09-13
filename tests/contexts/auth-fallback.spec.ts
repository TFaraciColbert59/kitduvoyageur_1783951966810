import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuth } from '@/contexts/AuthContext';

function Probe() {
  const { user, loading, isEmailVerified } = useAuth();
  return React.createElement(
    'span',
    null,
    `${String(user)}|${String(loading)}|${String(isEmailVerified())}`
  );
}

describe('useAuth hors AuthProvider — fallback invité (jamais de crash)', () => {
  it('ne lève pas et rend l’état invité', () => {
    const html = renderToStaticMarkup(React.createElement(Probe));
    expect(html).toContain('null|false|false');
  });
});
