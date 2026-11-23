import { expect, it } from 'vitest';
import { indexClubRouteSources } from '../cockpit/clubRouteSources';

it('indexe la version d’espace par événement et révision, ignore les lignes sans origine', () => {
  const map = indexClubRouteSources([
    { event_id: 'e1', revision: 2, source_revision_no: 3 },
    { event_id: 'e1', revision: 1, source_revision_no: null },
    { event_id: 'e2', revision: '4', source_revision_no: '7' },
    { event_id: 'e3', revision: 1, source_revision_no: 0 },
    { revision: 1, source_revision_no: 2 },
  ]);
  expect([...map.entries()]).toEqual([['e1:2', 3], ['e2:4', 7]]);
});

it('une réponse absente ou en erreur donne un index vide (mention seulement omise)', () => {
  expect(indexClubRouteSources(null).size).toBe(0);
  expect(indexClubRouteSources({ message: 'column does not exist' }).size).toBe(0);
});
