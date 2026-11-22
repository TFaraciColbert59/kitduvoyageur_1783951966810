import type { OvernightPlace } from '../../types';

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Responsable',
  co_organizer: 'Coorganisateur',
  editor: 'Éditeur',
  contributor: 'Contributeur',
  participant: 'Participant',
  external_viewer: 'Lecteur externe',
};

export type OvernightChipValue = 'none' | OvernightPlace['type'];

export const OVERNIGHT_LABELS: Record<OvernightChipValue, string> = {
  none: 'Journée',
  refuge: 'Refuge',
  hut: 'Cabane',
  bivouac: 'Bivouac',
  camp: 'Camping',
  gite: 'Gîte',
  hotel: 'Hôtel',
};

export const SECTION_MODE_LABELS: Record<string, string> = {
  routed: 'Routé',
  manual: 'Manuel',
  imported_preserved: 'Trace importée',
};
