'use client';

import { useState } from 'react';
import { coordinateAtKm, sectionNeedsRouting } from '../../../engineTrack';
import { fmtKm } from '../../../fmt';
import { activePoints } from '../../../engine';
import type { CollaborativeRouteSection } from '../../../types';
import { SECTION_MODE_LABELS } from '../labels';
import { useRouteViewMode } from '../expertMode';
import { useTrackTools } from '../useTrackTools';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from './atoms';

/** « À la main : non vérifié », « À recalculer », « Calculé par … » : l'état dit ce que le tronçon est vraiment. */
export function sectionState(sec: CollaborativeRouteSection): { label: string; tone: 'warn' | 'good' | undefined; detail: string } {
  if (sec.mode === 'manual') return { label: 'Non vérifié', tone: 'warn', detail: 'Tracé à la main : pointillé ambre sur la carte, jamais présenté comme calculé.' };
  if (sec.mode === 'imported_preserved') return { label: 'Trace importée', tone: undefined, detail: 'Géométrie de votre fichier, gardée telle quelle.' };
  if (sectionNeedsRouting(sec)) return { label: 'À recalculer', tone: 'warn', detail: 'Le tracé affiché est provisoire : il attend le routeur.' };
  return { label: 'Calculé', tone: 'good', detail: `Calculé par ${sec.provenance.provider ?? 'le routeur'}.` };
}

/** Liste des tronçons (vue experte) : ouvre le tiroir d'un tronçon. */
export function SectionList() {
  const { workspace, setSelectedSectionId, openSubDrawer } = useRouteWorkspace();
  const pts = activePoints(workspace);
  const name = (id: string) => pts.find((p) => p.id === id)?.name || 'point';
  if (workspace.sections.length === 0) return null;
  return (
    <Block title="Tronçons" right={`${workspace.sections.length}`} testId="section-list">
      <RouteRows>
        {workspace.sections.map((s) => {
          const st = sectionState(s);
          return (
            <RouteRow
              key={s.id}
              icon="route"
              testId={`section-row-${s.id}`}
              title={`${name(s.fromPointId)} → ${name(s.toPointId)}`}
              subtitle={`${fmtKm(s.distanceKm)} · ${SECTION_MODE_LABELS[s.mode] ?? s.mode}`}
              onClick={() => {
                setSelectedSectionId(s.id);
                openSubDrawer('section');
              }}
              trailing={<Pill tone={st.tone}>{st.label}</Pill>}
            />
          );
        })}
      </RouteRows>
    </Block>
  );
}

/** Dans le tiroir d'un tronçon : état, retour au calcul, passage à la main, couper, fusionner (5.4, 5.7). */
export function SectionActions({ section }: { section: CollaborativeRouteSection }) {
  const { workspace, handleRealRouteSection } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const tools = useTrackTools();
  const [cutKm, setCutKm] = useState('');
  const disabled = !tools.canEditGeo || tools.busy != null;
  const st = sectionState(section);
  const pts = activePoints(workspace);
  const idx = pts.findIndex((p) => p.id === section.fromPointId);
  const prev = idx > 0 ? workspace.sections.find((s) => s.fromPointId === pts[idx - 1].id && s.toPointId === section.fromPointId) : undefined;
  const next = idx >= 0 ? workspace.sections.find((s) => s.fromPointId === section.toPointId && s.toPointId === pts[idx + 2]?.id) : undefined;
  const separatesDays = (pointId: string) => workspace.stages.some((s) => s.startPointId === pointId || s.endPointId === pointId);
  const km = Number(cutKm.replace(',', '.'));
  const kmValid = Number.isFinite(km) && km > 0.01 && km < section.distanceKm - 0.01;

  const cutAt = (distanceKm: number) => {
    const where = coordinateAtKm([section], distanceKm);
    if (where) void tools.splitSection(section.id, where.lat, where.lon, null);
  };

  return (
    <Block title="État et actions" testId="section-actions">
      <RouteRows>
        <RouteRow icon="route" title={st.label} subtitle={st.detail} trailing={<Pill tone={st.tone}>{SECTION_MODE_LABELS[section.mode] ?? section.mode}</Pill>} />
      </RouteRows>
      {section.mode === 'manual' ? (
        <Note tone="warn">Ce tronçon est tracé à la main : sa longueur, son D+ et sa durée ne sont pas vérifiés.</Note>
      ) : null}
      {tools.canEditGeo ? (
        <div className="rts-actions">
          {section.mode === 'manual' ? (
            <Btn tone="primary" disabled={disabled} onClick={() => void tools.backToCalculation(section.id)} testId="back-to-calc">
              Revenir au calcul
            </Btn>
          ) : (
            <Btn tone={section.mode === 'routed' && !sectionNeedsRouting(section) ? undefined : 'primary'} disabled={disabled || section.mode === 'imported_preserved'} onClick={() => void handleRealRouteSection(section.id)}>
              {sectionNeedsRouting(section) ? 'Calculer ce tronçon' : 'Recalculer ce tronçon'}
            </Btn>
          )}
          {section.mode === 'routed' ? (
            <Btn disabled={disabled} onClick={() => void tools.makeManual(section.id)} testId="make-manual">
              Passer à la main
            </Btn>
          ) : null}
          {section.mode === 'imported_preserved' ? <Note>Une trace importée n’est recalculée que si vous la remplacez.</Note> : null}
        </div>
      ) : null}

      {tools.canEditGeo && expert ? (
        <>
          <div className="rts-actions">
            <Btn disabled={disabled || section.distanceKm < 0.1} onClick={() => cutAt(section.distanceKm / 2)} testId="split-middle">
              Couper au milieu
            </Btn>
          </div>
          <form
            className="rts-row-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (kmValid) cutAt(km);
            }}
          >
            <label className="rts-field">
              Couper à … km du début du tronçon
              <input value={cutKm} inputMode="decimal" onChange={(e) => setCutKm(e.target.value)} placeholder={`entre 0 et ${fmtKm(section.distanceKm)}`} />
            </label>
            <Btn type="submit" disabled={disabled || !kmValid}>
              Couper
            </Btn>
          </form>
          <div className="rts-actions">
            {prev ? (
              <Btn disabled={disabled || separatesDays(section.fromPointId)} onClick={() => void tools.mergeSections(prev.id, section.id)} testId="merge-prev">
                Fusionner avec le précédent
              </Btn>
            ) : null}
            {next ? (
              <Btn disabled={disabled || separatesDays(section.toPointId)} onClick={() => void tools.mergeSections(section.id, next.id)} testId="merge-next">
                Fusionner avec le suivant
              </Btn>
            ) : null}
          </div>
          <Note>Couper isole un passage à comparer ou à garder tel quel : chaque moitié garde sa géométrie, D+ et durée sont répartis au prorata (estimés). Fusionner ne recalcule rien.</Note>
        </>
      ) : null}
    </Block>
  );
}
