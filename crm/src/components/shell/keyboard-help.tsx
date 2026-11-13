'use client';

import { useEffect, useState } from 'react';
import s from '../../ui/crm.module.css';
import { Kbd } from '../../ui/kbd';
import { IconClose } from '../../ui/icons';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['J', 'K'], label: 'Naviguer dans la file' },
  { keys: ['↵'], label: 'Ouvrir le cas sélectionné' },
  { keys: ['M'], label: 'Masquer le contenu' },
  { keys: ['L'], label: 'Laisser visible' },
  { keys: ['S'], label: 'Sanctionner l’auteur' },
  { keys: ['A'], label: 'Approuver la demande affichée' },
  { keys: ['P'], label: 'Prendre un SOS' },
  { keys: ['⌘K'], label: 'Chercher ou agir' },
  { keys: ['?'], label: 'Cette aide' },
  { keys: ['Échap'], label: 'Fermer' }
];

/** Aide clavier (touche `?`). Aucun raccourci ne s'active dans un champ de saisie. */
export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
      if (editable) return;
      if (event.key === '?') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className={s.overlay} role="presentation" onClick={() => setOpen(false)}>
      <div
        className={`${s.palette} ${s.padLg}`}
        role="dialog"
        aria-modal="true"
        aria-label="Aide clavier"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={s.between} style={{ marginBottom: 14 }}>
          <h2 className={s.titleSm} style={{ fontSize: 20 }}>
            Raccourcis clavier
          </h2>
          <button type="button" className={`${s.btn} ${s.btnSoft} ${s.btnIcon}`} aria-label="Fermer l’aide" onClick={() => setOpen(false)}>
            <IconClose />
          </button>
        </div>
        <div className={s.colGapSm}>
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className={s.between} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--lkv-border)' }}>
              <span>{shortcut.label}</span>
              <span className={s.rowFlex}>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className={s.muted} style={{ fontSize: 12.5, marginBottom: 0 }}>
          Les raccourcis ne s’activent jamais dans un champ de saisie. Chaque bouton affiche le sien.
        </p>
      </div>
    </div>
  );
}
