import { describe, expect, it } from 'vitest';
import { STAY_TO_BOOK, isStayProposal, notedStay } from '../engine/stayProposal';

/** Constat O-03 : « Hébergement à réserver · lieu » est un à-faire du Compas, jamais un hébergement « Noté ». */
describe('proposition d’hébergement du Compas', () => {
  it('se reconnaît, avec ou sans lieu', () => {
    expect(isStayProposal(`${STAY_TO_BOOK} · Rencurel`)).toBe(true);
    expect(isStayProposal(STAY_TO_BOOK)).toBe(true);
    expect(isStayProposal('Gîte du banc')).toBe(false);
    expect(isStayProposal(null)).toBe(false);
  });

  it('ne se lit jamais comme un hébergement noté', () => {
    expect(notedStay(`${STAY_TO_BOOK} · Rencurel`)).toBeNull();
    expect(notedStay('Refuge de la Combe de Fer')).toBe('Refuge de la Combe de Fer');
    expect(notedStay('')).toBeNull();
  });
});
