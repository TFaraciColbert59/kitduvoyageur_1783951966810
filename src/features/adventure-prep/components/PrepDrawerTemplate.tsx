/**
 * LE GABARIT DES TIROIRS.
 *
 * Le tiroir Lieu est le premier qui a ete dessine : une section, une liste de
 * lignes, deux lignes de texte par ligne (le nom, puis le detail), et rien
 * d'autre. Les tiroirs qui ont suivi ont chacun redessine leur version — avec
 * des styles inline, des titres ad hoc, des listes qui ne se ressemblaient pas.
 * C'est le reproche M1.1 : un tiroir qui ne recopie pas le gabarit se lit
 * comme une autre application, et l'utilisateur doit reapprendre l'ecran a
 * chaque fois.
 *
 * Ce module EST le gabarit. Il ne dessine pas un tiroir : il fournit les six
 * primitives dont le tiroir Lieu est fait, et tout tiroir de l'etape 1 les
 * compose. Le test `drawers-m11-gabarit` verifie que chaque tiroir monte
 * rend ces landmarks — pas qu'il « ressemble » au gabarit, qu'il en PROVIENT.
 *
 * Les classes (`.list`, `.li`, `.rt`, `.t1`, `.t2`, `.prep-section-title`)
 * sont celles du tiroir Lieu, deja definies dans `adventure-prep.css`. Ce
 * module n'ajoute aucun style : il rend le meme balisage, ce qui garantit que
 * les deux ne peuvent pas diverger.
 */

import React from 'react';
import { Button } from '@/components/ui';

/** Une section de tiroir : le titre et son contenu. Gabarit du tiroir Lieu. */
export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="prep-drawer__section" style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      {/* Aucune taille en dur : `.prep-section-title` porte deja la typo du
          gabarit. Un style inline ici le re-ecraserait et le gabarit
          divergerait de lui-meme. */}
      <h3 className="prep-section-title">{title}</h3>
      {children}
    </section>
  );
}

/** La liste de lignes. Gabarit du tiroir Lieu. */
export function DrawerList({ children }: { children: React.ReactNode }) {
  return <ul className="list">{children}</ul>;
}

export interface DrawerRowProps {
  /** Nom du lieu, de l objet, de la personne. La ligne forte. */
  title: string;
  /** Le detail : distance, etat, quantite, source. La ligne secondaire. */
  detail?: React.ReactNode;
  /** Rend la ligne cliquable : le tiroir Lieu rend ses resultats en `<button>`. */
  onSelect?: () => void;
  /** `true` quand cette ligne est celle qui est retenue. */
  selected?: boolean;
  /** Affiche a droite : badge d etat, icone de selection, controle. */
  trailing?: React.ReactNode;
  /** `aria-label` de la ligne cliquable. */
  ariaLabel?: string;
  /** Marque le diviseur de liste entre deux groupes (categorie, journee). */
  'data-prep-row'?: string;
  /**
   * Controles places SOUS la ligne. Le gabarit les prevoit parce que certains
   * tiroirs ont une seule ligne a dire mais deux decisions a prendre — un
   * poids, un porteur. Ils restent dans la ligne : la reflexe « je lis, je
   * touche » ne se casse pas.
   */
  children?: React.ReactNode;
}

/**
 * UNE ligne de liste.
 *
 * Le tiroir Lieu rend `<button class="li"><div class="rt"><div class="t1">…`.
 * Toute ligne de tout tiroir passe par ici : c'est ce qui fait qu'un reflexe
 *pris sur Lieu — survol, focus, selection — reste valable partout ailleurs.
 */
export function DrawerRow({
  title,
  detail,
  onSelect,
  selected = false,
  trailing,
  ariaLabel,
  'data-prep-row': dataRow,
  children,
}: DrawerRowProps) {
  const body = (
    <>
      <div className="rt">
        <div className="t1">{title}</div>
        {detail === undefined ? null : <div className="t2">{detail}</div>}
      </div>
      {trailing}
    </>
  );

  // Les controles passent hors du `<button>` : un `<input>` ou un
  // `<select>` dans un `<button>` est invalide, et le clic part dans le vide
  // sur Safari. La ligne reste la meme carte, les champs restent dessous.
  if (onSelect) {
    return (
      <li className="prep-drawer__row-wrap" data-prep-row={dataRow}>
        <button
          type="button"
          className={`li ${selected ? 'sel' : ''}`}
          onClick={onSelect}
          aria-label={ariaLabel}
          aria-pressed={selected}
        >
          {body}
        </button>
        {children ? <div className="prep-drawer__row-controls">{children}</div> : null}
      </li>
    );
  }

  return (
    <li className="li prep-drawer__row" data-prep-row={dataRow}>
      {body}
      {children ? <div className="prep-drawer__row-controls">{children}</div> : null}
    </li>
  );
}

/**
 * L'etat honnete d une liste vide.
 *
 * Un tiroir sans donnee ne montre pas un espace : il dit CE QUI MANQUE et ce
 * que l'app ne peut pas inventer. C'est la seule ligne autorisee quand la
 * base n'a rien renvoye.
 */
export function DrawerEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="prep-drawer__empty"
      role="status"
      style={{ fontSize: 'var(--prep-type-label)', color: 'var(--lkv-text-secondary)' }}
    >
      {children}
    </p>
  );
}

/** La bande d action en bas de tiroir : meme paire de boutons partout. */
export function DrawerActions({
  onClose,
  onApply,
  label = 'Appliquer',
}: {
  onClose: () => void;
  onApply: () => void;
  label?: string;
}) {
  return (
    <div
      className="prep-actionrow prep-actionrow--sticky"
      style={{ marginTop: 16, justifyContent: 'flex-end', display: 'flex', gap: '8px' }}
    >
      <Button variant="ghost" size="md" onClick={onClose}>
        Annuler
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={() => {
          onApply();
          onClose();
        }}
      >
        {label}
      </Button>
    </div>
  );
}

/**
 * Les reperes du gabarit, declares en un seul endroit.
 *
 * Le test M1.1 ne recompose pas la liste a la main : il la lit ici. Ajouter une
 * primitive au gabarit est donc un changement unique, et les tiroirs qui ne la
 * recopient pas echouent aussitot.
 */
export const GABARIT = {
  section: 'prep-drawer__section',
  empty: 'prep-drawer__empty',
  list: 'list',
  row: 'li',
  title: 't1',
  detail: 't2',
  sectionTitle: 'prep-section-title',
} as const;