'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compasUndoAutofillAction } from '../../server/autofillActions';
import { useV5 } from '../context';
import { Cap, Chip, Grp, Li, Switch } from '../ui/primitives';
import { V5Icon } from '../ui/icons';
import type { V5DrawerDef } from './types';

const UNDO_CHOICES = [8, 15, 30] as const;

/** « Plus » : réglages du voyage, affichage, hors ligne, refaire / annuler la préparation, nouvelle aventure, groupe. */
function MenuBody() {
  const { t, data, ctl, canEdit, prefs, openSpace, closeSpace } = useV5();
  const router = useRouter();
  const { tripId, slug } = data.model;

  const undoPrep = () =>
    ctl.run(t('compas.v5.menu.undoPrep'), () => compasUndoAutofillAction({ tripId, tripSlug: slug }));

  return (
    <>
      <Grp>
        <Li icon='modifier' title={t('compas.v5.menu.settings')} detail={t('compas.v5.menu.settingsHint')} onClick={() => openSpace('voyage', { tab: 0 })} right={<V5Icon name='suivant' size="s" />} />
      </Grp>

      <Cap>{t('compas.screen.display')}</Cap>
      <Grp>
        <Li icon='soleil' title={t('compas.v5.menu.sun')} detail={t('compas.v5.menu.sunHint')} right={<Switch checked={prefs.outdoor} onChange={prefs.setOutdoor} label={t('compas.v5.menu.sun')} />} />
        <Li
          icon='duree'
          title={t('compas.v5.menu.toastLength')}
          right={
            <span className="v5-chips">
              {UNDO_CHOICES.map((s) => (
                <Chip key={s} pressed={prefs.undoS === s} onClick={() => prefs.setUndoS(s)}>
                  {t('compas.v5.menu.seconds', { count: s })}
                </Chip>
              ))}
            </span>
          }
        />
        <Li
          icon='telecharger'
          title={t('compas.v5.menu.offline')}
          detail={
            prefs.offlineSavedAt ? (
              <Link href="/hors-ligne">{t('compas.v5.menu.offlineReady')}</Link>
            ) : (
              t('compas.v5.menu.offlinePreparing')
            )
          }
        />
      </Grp>

      {canEdit && (
        <>
          <Grp>
            {prefs.redo && <Li icon='actualiser' title={t('compas.v5.menu.redo')} detail={t('compas.v5.menu.redoHint')} onClick={() => { closeSpace(); prefs.redo?.(); }} />}
            <Li icon='itineraire' title={t('compas.v5.menu.undoPrep')} detail={t('compas.v5.menu.undoPrepHint')} onClick={() => void undoPrep().then(() => router.refresh())} />
          </Grp>
        </>
      )}

      <Grp>
        <Li icon="plus" title={t('compas.v5.menu.newTrip')} detail={t('compas.v5.menu.newTripHint')} onClick={() => router.push('/compas?nouvelle=1')} right={<V5Icon name='suivant' size="s" />} />
        <Li icon='communaute' title={t('compas.v5.menu.hub')} onClick={() => router.push('/hub/groupe')} right={<V5Icon name='lien' size="s" />} />
      </Grp>
    </>
  );
}

export const menuDrawer: V5DrawerDef = {
  space: 'menu',
  tabs: () => [],
  title: (api) => api.t('compas.v5.menu.title'),
  subtitle: () => null,
  Body: MenuBody,
};
