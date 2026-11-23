'use client';

import { useFocusReturn } from '../components/focusTrap';
import { DRAWERS } from './drawers';
import { useV5 } from './context';
import { Flow } from './ui/primitives';
import { SheetShell } from './ui/SheetShell';

/**
 * Le tiroir : posé dans les bornes de la card (translucide, matière `.v5-sheet`), piloté par une capsule d'icônes
 * (jamais de texte), un titre et une ligne de contexte. Échap le ferme, Tab reste à l'intérieur, le focus revient
 * à ce qui l'a ouvert (WCAG 2.1.2 / 2.4.3). Le corps vient du registre `DRAWERS`. La coquille (poignée, verre,
 * en-tête, corps) est `SheetShell`, partagée avec le tiroir de l'itinéraire (4.2).
 */
export function V5Sheet() {
  const api = useV5();
  const { space, tab, setTab, closeSpace, t } = api;
  const def = space ? DRAWERS[space] : undefined;

  useFocusReturn();

  if (!def) return <SheetShell open={false} title="" closeLabel="" onClose={closeSpace}>{null}</SheetShell>;
  const tabs = def.tabs(api);
  const subtitle = def.subtitle(api);
  const Body = def.Body;
  const title = def.title(api);

  return (
    <SheetShell
      open
      label={title}
      title={title}
      subtitle={subtitle}
      closeLabel={t('compas.v5.core.close')}
      onClose={closeSpace}
      onEscape={closeSpace}
      head={tabs.length > 0 ? <Flow tabs={tabs} selected={Math.min(tab, tabs.length - 1)} onSelect={setTab} label={title} /> : null}
    >
      <Body />
    </SheetShell>
  );
}
