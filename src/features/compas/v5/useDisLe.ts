'use client';

import { useCallback, useState } from 'react';
import { planApplication } from '../engine/intent';
import { browserTimeZone } from '../engine/zone';
import { compasInterpretAction } from '../server/compasActions';
import { applyCurrent, inverseOps, runOps } from '../components/compasApply';
import { countText, type CompasCtl } from '../components/compasTypes';

/**
 * « Dis-le » de la barre haute : une phrase devient des changements, appliqués tout de suite et annulables.
 * Le moteur lit la phrase (règles, puis l'IA si elle est allumée) et ne garde que ce qui est valide ; ce qu'il
 * n'a pas compris est dit, jamais deviné. Le parcours du catalogue est ouvert dans « Voyage » plutôt qu'écrit.
 */
export function useDisLe(ctl: CompasCtl, onRoute: (query: string) => void) {
  const [busy, setBusy] = useState(false);
  const { t, locale } = ctl;

  const say = useCallback(
    async (raw: string): Promise<boolean> => {
      const phrase = raw.trim();
      if (phrase.length < 2 || !t || !locale) return false;
      setBusy(true);
      try {
        const res = await compasInterpretAction({
          tripId: ctl.data.model.tripId,
          text: phrase,
          timeZone: browserTimeZone() ?? undefined,
        });
        if (!res.success) {
          ctl.notify(res.error, 'bad');
          return false;
        }
        const valid = res.proposals.filter((p) => p.ok);
        if (!valid.length) {
          ctl.notify(t('compas.disle.nothing'));
          return false;
        }
        const ops = planApplication(
          valid.map((p) => p.action),
          applyCurrent(ctl)
        );
        const route = ops.find((o) => o.op === 'route');
        const writes = ops.filter((o) => o.op !== 'route');
        let ok = true;
        if (writes.length) {
          const n = valid.filter((p) => p.action.type !== 'search_route').length;
          const undo = inverseOps(ctl, writes);
          ok = await ctl.run(
            countText(t, locale, n, 'compas.disle.changesOne', 'compas.disle.changesOther'),
            () => runOps(ctl, writes),
            undo ? () => runOps(ctl, undo) : undefined
          );
        }
        if (ok && route && route.op === 'route') onRoute(route.query);
        return ok;
      } catch {
        ctl.notify(t('compas.screen.connectionLost'), 'bad');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ctl, locale, onRoute, t]
  );

  return { say, busy };
}
