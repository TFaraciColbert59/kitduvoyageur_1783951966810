'use client';

import { ebikeSupportedForSport } from '@/features/adventure-prep/routeProfiles';
import { Chip, Switch } from '@/features/compas/v5/ui/primitives';
import { describeRouting, ROUTE_PROFILE_CHOICES, SURFACE_CHOICES, surfaceChoiceOf } from '../../../routingProfiles';
import { useRouteViewMode } from '../expertMode';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Note } from './atoms';

/**
 * 5.1 : cinq profils pour tous ; en vue experte, « éviter les routes », « préférer les sentiers » et les
 * réglages de marches, bacs et assistance. Chaque choix passe par `set_sport_profile` : l'empreinte de chaque
 * tronçon change, les calculs en vol sont rejetés, les tronçons routés se recalculent avec ces options.
 */
export function ProfilePicker() {
  const { workspace } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const tools = useTrackTools();
  const disabled = !tools.canEditGeo || tools.busy != null;
  const active = ROUTE_PROFILE_CHOICES.find((c) => c.id === tools.profileId);
  const options = workspace.routingOptions;
  const surface = surfaceChoiceOf(options);
  return (
    <Block title="Profil de routage" right={active?.hint} testId="profile-picker">
      <div className="rts-chips" role="group" aria-label="Profil de routage">
        {ROUTE_PROFILE_CHOICES.map((c) => (
          <Chip key={c.id} pressed={tools.profileId === c.id} disabled={disabled} onClick={() => void tools.chooseProfile(c.id)} title={c.hint} data-testid={`profile-${c.id}`}>
            {c.label}
          </Chip>
        ))}
      </div>
      {tools.profileId == null ? <Note tone="warn">Ce sport n’est pas l’un des cinq profils : choisissez-en un pour le remplacer.</Note> : null}
      {expert ? (
        <>
          <div className="rts-chips" role="group" aria-label="Préférence de surface">
            {SURFACE_CHOICES.map((c) => (
              <Chip key={c.id} pressed={surface === c.id} disabled={disabled} onClick={() => void tools.patchOptions({ surface: c.id })} data-testid={`surface-${c.id}`}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="rts-chips">
            <label className="rts-toggle">
              <Switch checked={Boolean(options.avoidSteps)} disabled={disabled} label="Éviter les marches" onChange={(v) => void tools.patchOptions({ avoidSteps: v })} />
              Éviter les marches
            </label>
            <label className="rts-toggle">
              <Switch checked={Boolean(options.avoidFerries)} disabled={disabled} label="Éviter les bacs" onChange={(v) => void tools.patchOptions({ avoidFerries: v })} />
              Éviter les bacs
            </label>
            {ebikeSupportedForSport(workspace.sport) ? (
              <label className="rts-toggle">
                <Switch checked={Boolean(options.ebike)} disabled={disabled} label="Assistance électrique" onChange={(v) => void tools.patchOptions({ ebike: v })} />
                Assistance électrique
              </label>
            ) : null}
          </div>
          <Note>
            Transmis au routeur : {describeRouting(workspace.sport, options)}. « Éviter les routes » et « Préférer les sentiers » sont des préférences souples : un tronçon peut
            emprunter une route quand aucun sentier n’existe.
          </Note>
        </>
      ) : null}
    </Block>
  );
}
