'use client';

import { useState } from 'react';
import { useRouteViewMode } from '../expertMode';
import { Block, Btn, Note } from '../track/atoms';
import { useGroupPace } from './usePace';

/**
 * 6.4 : les durées se calculent sur le plus lent. La ligne dit sur qui (ou « allure standard » quand aucune allure
 * n'est renseignée) ; en vue experte, on peut renseigner la vitesse du plus lent du groupe.
 */
export function PaceSetting() {
  const { expert } = useRouteViewMode();
  const group = useGroupPace();
  const [value, setValue] = useState(group.manualKmh != null ? String(group.manualKmh) : '');
  const n = Number(value.replace(',', '.'));
  const valid = Number.isFinite(n) && n >= 1 && n <= 8;
  return (
    <Block title="Allure du groupe" testId="pace-setting">
      <Note>{group.description}</Note>
      {expert ? (
        <form
          className="rts-row-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) group.setManual(n);
          }}
        >
          <label className="rts-field">
            Vitesse à plat du plus lent (km/h)
            <input value={value} inputMode="decimal" onChange={(e) => setValue(e.target.value)} placeholder="ex. 3,5" aria-invalid={Boolean(value) && !valid} />
          </label>
          <Btn type="submit" disabled={!valid}>
            Enregistrer
          </Btn>
          {group.manualKmh != null ? (
            <Btn
              onClick={() => {
                group.setManual(null);
                setValue('');
              }}
            >
              Effacer
            </Btn>
          ) : null}
        </form>
      ) : null}
    </Block>
  );
}
