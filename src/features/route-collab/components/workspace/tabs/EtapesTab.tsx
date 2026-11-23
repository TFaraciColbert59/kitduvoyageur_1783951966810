import { Banners } from '../Banners';
import { useRouteViewMode } from '../expertMode';
import { DayCard } from '../stages/DayCard';
import { PaceSetting } from '../stages/PaceSetting';
import { ProfileCuts } from '../stages/ProfileCuts';
import { SplitAssistant } from '../stages/SplitAssistant';
import { loadPlaces } from '../stages/useStagePlaces';
import { useDayReadings } from '../stages/useDayReadings';
import { stagePlacePoints } from '../../../placesClient';
import { Block, Btn, Note } from '../track/atoms';
import { V5Scope } from '../ui/V5Scope';
import { useRouteWorkspace } from '../WorkspaceContext';

/**
 * Étapes : découpage proposé et expliqué (6.1), coupures glissables sur le profil (6.2), nuits réelles (6.3),
 * allure du plus lent (6.4), arrivée vs coucher (6.5), eau (6.6), repos et étapes courtes (6.7), dates locales
 * (6.8), même lecture du jour que le Compas v5 (6.9), repli (6.10). Jamais « 0 » pour un inconnu (4.5).
 */
export function EtapesTab() {
  const { workspace, canEditStages } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const { days } = useDayReadings();
  const stagesById = new Map(workspace.stages.map((s) => [s.id, s]));
  const unloaded = days.filter((d) => d.kind !== 'rest' && d.night.status === 'unknown' && d.night.reason === 'not_loaded');
  return (
    <div className="rcw-stack" data-testid="tab-panel-etapes">
      <Banners />
      {canEditStages ? <SplitAssistant /> : null}
      <PaceSetting />

      {workspace.stages.length === 0 ? (
        <V5Scope>
          <Note>Aucune journée : posez deux points, puis proposez un découpage.</Note>
        </V5Scope>
      ) : (
        <>
          <Block title={`${workspace.stages.length} jour${workspace.stages.length > 1 ? 's' : ''}`} testId="day-splitter-bar">
            {expert && unloaded.length > 1 ? (
              <Btn
                onClick={() => {
                  for (const d of unloaded) {
                    const st = stagesById.get(d.stageId);
                    if (st) void loadPlaces(stagePlacePoints(workspace, st));
                  }
                }}
                testId="load-all-places"
              >
                Relever les lieux de tous les jours
              </Btn>
            ) : null}
          </Block>
          {days.map((reading) => {
            const stage = stagesById.get(reading.stageId);
            return stage ? <DayCard key={stage.id} stage={stage} reading={reading} /> : null;
          })}
          {workspace.stages.length > 1 ? <ProfileCuts /> : null}
        </>
      )}
    </div>
  );
}
