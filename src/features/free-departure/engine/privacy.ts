/**
 * « Partir librement » — vie privee de la trace (ecran 62).
 *
 * Regle unique et non negociable : **rien ne sort de l'appareil sans un
 * accord explicite, ecrit, et revocable.** Ce module ne connait ni reseau ni
 * partage : il produit les DEUX lignes que l'ecran affiche et, surtout, la
 * raison pour laquelle une bascule est indisponible.
 *
 * Une ligne grisee sans explication est exactement ce que cette experience
 * interdit : l'utilisateur ne doit pas avoir a deviner pourquoi il ne peut
 * pas partager. Si l'on ne sait pas dire pourquoi, ce n'est pas une
 * indisponibilite, c'est une panne d'affichage.
 */

export type FreePrivacyId = 'trace' | 'partage';

export interface FreePrivacyInput {
  /** L'utilisateur conserve-t-il la trace apres la session ? */
  keepTrace: boolean;
  /** A-t-il demande le partage ? */
  shareWithGroup: boolean;
  /** Combien de participants peuvent la rejoindre. `0` = sortie individuelle. */
  groupSize: number;
}

export interface FreePrivacyRow {
  id: FreePrivacyId;
  label: string;
  /** Ce que la ligne fait, dans la position courante. */
  hint: string;
  checked: boolean;
  disabled: boolean;
  /** Pourquoi la bascule est indisponible. `null` quand elle est possible. */
  blockedReason: string | null;
}

/** Une taille de groupe n'existe que si elle vaut au moins une personne entiere. */
function hasGroup(groupSize: number): boolean {
  return Number.isFinite(groupSize) && groupSize >= 1;
}

/**
 * Pourquoi le partage est-il bloque ?
 *
 * Deux causes, deux textes : « pas de groupe » ne se resout pas en attendant,
 * alors que « pas de trace » se resout en un geste. Les confondre obligerait
 * l'utilisateur a deviner laquelle des deux est la sienne.
 */
export function sharingBlockedReason(input: FreePrivacyInput): string | null {
  if (!hasGroup(input.groupSize)) {
    return 'Partir librement est une sortie individuelle : il n’y a personne à prévenir. Rejoins une aventure préparée pour partager en cours de route.';
  }
  if (!input.keepTrace) {
    return 'Conserve d’abord la trace : une trace non conservée ne peut pas être partagée.';
  }
  return null;
}

/** Les deux lignes de l'ecran 62, dans l'ordre, deja decidees. */
export function privacyRows(input: FreePrivacyInput): FreePrivacyRow[] {
  const blocked = sharingBlockedReason(input);

  return [
    {
      id: 'trace',
      label: 'Garder la trace',
      hint: input.keepTrace
        ? 'Visible par toi seul'
        : 'Effacée à la fermeture de la session',
      checked: input.keepTrace,
      disabled: false,
      blockedReason: null,
    },
    {
      id: 'partage',
      label: 'Partager avec le groupe',
      // Un partage bloque reste toujours « desactive » a l'ecran : une demande
      // laissee active alors qu'elle ne peut pas aboutir afficherait un
      // « partage actif » qui n'en est pas un.
      hint:
        blocked !== null
          ? 'Désactivé : rien n’est envoyé sans ton accord.'
          : input.shareWithGroup
            ? `Partagé avec ${input.groupSize} participant${input.groupSize > 1 ? 's' : ''} — tu peux le couper à tout moment.`
            : 'Désactivé : rien n’est envoyé sans ton accord.',
      checked: blocked === null && input.shareWithGroup,
      disabled: blocked !== null,
      blockedReason: blocked,
    },
  ];
}
