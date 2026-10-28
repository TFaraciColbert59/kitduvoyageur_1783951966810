'use client';

import { useMemo } from 'react';
import { compasExplainVerdictAction } from '../../server/compasActions';
import { countText } from '../../components/compasTypes';
import { useV5 } from '../context';
import { readiness, selectPoints } from '../model/trip';
import { Cap, Grp, Li, MBtn } from '../ui/primitives';
import { V5Icon, type V5IconName } from '../ui/icons';
import type { V5Point } from '../types';
import type { V5DrawerDef } from './types';

const FAMILIES: Array<{ kind: V5Point['kind']; icon: V5IconName; title: 'toi' | 'terrain' | 'conditions'; hint: 'toiHint' | 'terrainHint' | 'conditionsHint'; axis: 'physique' | 'technique' | 'conjoncturel' }> = [
  { kind: 'toi', icon: 'profil', title: 'toi', hint: 'toiHint', axis: 'physique' },
  { kind: 'terrain', icon: 'sommet', title: 'terrain', hint: 'terrainHint', axis: 'technique' },
  { kind: 'conditions', icon: 'meteo', title: 'conditions', hint: 'conditionsHint', axis: 'conjoncturel' },
];

/**
 * « Prêt à partir ? » : des FAITS à régler, regroupés en trois familles (toi, le terrain, les conditions),
 * chacun avec sa source et son geste. Pas de note globale : un axe sans donnée est « non évalué », jamais « sans danger ».
 */
function VerifsBody() {
  const { data, t, locale, openSpace, announce } = useV5();
  const points = useMemo(() => selectPoints(data, t, locale), [data, t, locale]);

  const level = (axis: 'physique' | 'technique' | 'conjoncturel', mine: V5Point[]) => {
    const res = data.danger.axes[axis];
    if (res.level === 'non_evalue') return t('compas.v5.verifs.levelUnknown');
    if (mine.some((p) => p.severity === 'block') || res.level === 'bloque') return t('compas.v5.verifs.levelBlocked');
    if (mine.length || res.level === 'vigilance') return t('compas.v5.verifs.levelWatch');
    return t('compas.v5.verifs.levelOk');
  };

  const explain = async () => {
    const res = await compasExplainVerdictAction({ tripId: data.model.tripId });
    if (!res.success) return announce(res.error, undefined, 'bad');
    const said = res.text ?? res.refused ?? res.note;
    if (said) announce(said.slice(0, 220));
  };

  return (
    <>
      {FAMILIES.map((f) => {
        const mine = points.filter((p) => p.kind === f.kind);
        const res = data.danger.axes[f.axis];
        return (
          <section key={f.kind} aria-label={t(`compas.v5.verifs.${f.title}`)}>
            <Cap right={level(f.axis, mine)}>{t(`compas.v5.verifs.${f.title}`)}</Cap>
            <Grp>
              {mine.length === 0 && <Li icon={f.icon} title={res.note || t(`compas.v5.verifs.${f.hint}`)} detail={res.partial ? t('compas.v5.verifs.partial', { what: res.partial }) : undefined} />}
              {mine.map((p) => (
                <Li
                  key={p.id}
                  icon={p.severity === 'block' ? 'signalement' : p.severity === 'warn' ? 'informations' : 'valider'}
                  title={p.text}
                  detail={p.source}
                  right={
                    p.action ? (
                      <MBtn onClick={() => openSpace(p.action!.space, { tab: p.action!.tab, day: p.action!.day })} aria-label={`${t('compas.v5.verifs.act')} : ${p.text}`}>
                        {t('compas.v5.verifs.act')}
                      </MBtn>
                    ) : undefined
                  }
                />
              ))}
            </Grp>
          </section>
        );
      })}
      <p className="v5-src">{t('compas.v5.verifs.sources')}</p>
      {data.aiOn === true && data.canEdit && (
        <MBtn onClick={() => void explain()}>
          <V5Icon name='ia' size="s" /> {t('compas.v5.verifs.explain')}
        </MBtn>
      )}
    </>
  );
}

export const verifsDrawer: V5DrawerDef = {
  space: 'verifs',
  tabs: () => [],
  title: (api) => api.t('compas.v5.verifs.title'),
  subtitle: (api) => {
    const open = readiness(selectPoints(api.data, api.t, api.locale)).count;
    return open === 0 ? api.t('compas.v5.verifs.subNone') : countText(api.t, api.locale, open, 'compas.v5.verifs.subOne', 'compas.v5.verifs.subOther');
  },
  Body: VerifsBody,
};
