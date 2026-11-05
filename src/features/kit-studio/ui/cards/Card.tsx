'use client';
import { Glyph } from '../Glyph';
import { Thumb } from '../Thumb';
import type { CardModel } from './cardsData';
import './cards.css';

interface CardProps {
  card: CardModel;
  /** Clignote (zone pleine / option refusée) : classe d'animation, aucune bordure. */
  blink?: boolean;
  /** Essai en cours (appui long, mode Apparence). */
  trying?: boolean;
  /** Soulevée (glisser vers le sac). */
  lifting?: boolean;
  /** Carte d'option : état exposé par aria-pressed. */
  pressable?: boolean;
  onActivate: (card: CardModel) => void;
}

/** Carte carrée : modèle 3D au centre, nom en petit en bas à droite, pastille ✓ encre si sélectionnée. */
export function Card({ card, blink, trying, lifting, pressable, onActivate }: CardProps) {
  const cls = ['ks-card', blink && 'ks-card--blink', trying && 'ks-card--try', lifting && 'ks-card--lift', card.selected && 'ks-card--on', card.kind === 'add' && 'ks-card--add']
    .filter(Boolean)
    .join(' ');
  const fallback = (
    <span className="ks-card__gl">
      <Glyph name={card.glyph} size={44} />
    </span>
  );
  return (
    <button
      type="button"
      className={cls}
      data-card={card.kind}
      data-card-id={card.id}
      aria-label={card.label}
      aria-disabled={card.disabled || undefined}
      aria-pressed={pressable ? card.selected : undefined}
      onClick={() => onActivate(card)}
    >
      <span className="ks-card__obj">
        {card.thumb ? <Thumb thumbKey={card.thumb.key} spec={card.thumb.spec} fallback={fallback} /> : fallback}
      </span>
      <span className="ks-card__cap">
        <b className="ks-clamp">{card.name}</b>
        {card.sub ? <small>{card.sub}</small> : null}
      </span>
      {card.selected ? (
        <i className="ks-card__ck" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            <path d="M4.2 8.4l2.6 2.6 5-5.4" />
          </svg>
        </i>
      ) : null}
    </button>
  );
}
