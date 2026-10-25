'use client';

import { useEffect, useRef, useState } from 'react';
import { useV5 } from './context';
import { useDisLe } from './useDisLe';
import { V5Icon } from './ui/icons';

/**
 * Barre haute : la pilule du voyage (touchée, elle ouvre « Nous » : seul ou avec les autres), « Dis-le » (une phrase
 * change n'importe quoi, le moteur ne garde que ce qui est valide) et le menu. « Dis-le » se déplie sur la barre.
 */
export function TopBar({ onRoute }: { onRoute: (query: string) => void }) {
  const api = useV5();
  const { data, ctl, t, solo, people, openSpace, canEdit } = api;
  const [say, setSay] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { say: send, busy } = useDisLe(ctl, onRoute);

  useEffect(() => {
    if (say) input.current?.focus();
  }, [say]);

  const names = data.model.crew.loads.map((m) => m.name).filter(Boolean).slice(0, 3);
  const label = solo ? t('compas.v5.top.pillSolo') : t('compas.v5.top.pillGroup', { count: people });

  const submit = async () => {
    const ok = await send(text);
    if (ok) {
      setText('');
      setSay(false);
    }
  };

  return (
    <div className="v5-top" data-say={say ? '' : undefined}>
      <button type="button" className="v5-pill v5-lg" aria-label={`${data.model.title}. ${label}`} onClick={() => openSpace('nous')}>
        <span>{data.model.title}</span>
        <span className="v5-avs" aria-hidden="true">
          {(names.length ? names : ['·']).map((n, i) => (
            <i key={`${n}${i}`}>{(n.trim()[0] ?? '·').toUpperCase()}</i>
          ))}
        </span>
      </button>
      <span className="v5-spacer" />
      {canEdit && (
        <button type="button" className="v5-rbtn v5-lg" aria-label={t('compas.v5.top.sayLabel')} onClick={() => setSay(true)}>
          <V5Icon name="spark" />
        </button>
      )}
      <button type="button" className="v5-rbtn v5-lg" aria-label={t('compas.v5.top.menu')} onClick={() => openSpace('menu')}>
        <V5Icon name="dots" />
      </button>

      <form
        className="v5-intent v5-lg"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setSay(false);
          }
        }}
      >
        <V5Icon name="spark" size="s" />
        <input
          ref={input}
          value={text}
          maxLength={280}
          disabled={busy}
          placeholder={t('compas.v5.top.sayPlaceholder')}
          aria-label={t('compas.v5.top.sayLabel')}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="v5-rbtn" disabled={busy || text.trim().length < 2} aria-label={t('compas.v5.top.say')}>
          <V5Icon name="check" size="s" />
        </button>
        <button type="button" className="v5-rbtn" aria-label={t('compas.v5.top.sayClose')} onClick={() => setSay(false)}>
          <V5Icon name="x" size="s" />
        </button>
      </form>
    </div>
  );
}
