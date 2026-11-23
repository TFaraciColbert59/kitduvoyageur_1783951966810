'use client';

import { useMemo, useRef, useState } from 'react';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { fmtKm } from '../../../fmt';
import { buildValidatedGpx, TRACK_FILE_ACCEPT } from '../../../trackIo';
import { useRouteViewMode } from '../expertMode';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from './atoms';

/** Nom de fichier plausible pour un texte collé : le format se lit au contenu, l'extension ne sert qu'à nommer. */
function nameForPasted(text: string): string {
  const t = text.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return 'collage.geojson';
  if (/<kml[\s>]/i.test(t.slice(0, 600))) return 'collage.kml';
  if (/<TrainingCenterDatabase/i.test(t.slice(0, 600))) return 'collage.tcx';
  return 'collage.gpx';
}

/** Bouton d'import de fichier (GPX, KML, TCX, GeoJSON ; FIT refusé avec son message). */
export function ImportButton({ label = 'Importer un fichier' }: { label?: string }) {
  const tools = useTrackTools();
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Btn tone="primary" disabled={!tools.canEditGeo || tools.busy != null} onClick={() => input.current?.click()} testId="import-file">
        {tools.busy === 'import' ? 'Lecture…' : label}
      </Btn>
      <input
        ref={input}
        type="file"
        accept={TRACK_FILE_ACCEPT}
        className="xp-visually-hidden"
        aria-label="Importer un fichier GPX, KML, TCX ou GeoJSON"
        data-testid="import-input"
        onChange={(e) => {
          void tools.importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** 5.9 : import (GPX, KML, TCX, GeoJSON) et export complet ou par étape, validé GPX 1.1 avant de partir. */
export function FileTools() {
  const { workspace } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const tools = useTrackTools();
  const [pasted, setPasted] = useState('');
  const full = useMemo(() => buildValidatedGpx(workspace), [workspace]);
  const perStage = useMemo(
    () =>
      workspace.stages
        .slice()
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map((st) => ({ st, out: buildValidatedGpx(workspace, st.id) })),
    [workspace]
  );
  return (
    <>
      <Block title="Importer une trace" testId="file-import">
        <ImportButton />
        <Note>
          GPX, KML, TCX ou GeoJSON. La trace garde sa géométrie : rien n’est recollé aux routes sans votre demande. FIT (binaire) n’est pas pris en charge : exportez la sortie en GPX, TCX ou GeoJSON.
        </Note>
        {expert ? (
          <>
            <label className="rts-field">
              Ou collez le contenu du fichier
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="<gpx>…</gpx>, <kml>…</kml> ou GeoJSON" aria-label="Contenu de trace à importer" />
            </label>
            <Btn
              disabled={!tools.canEditGeo || tools.busy != null || !pasted.trim()}
              onClick={() => {
                void tools.importFile(new File([pasted], nameForPasted(pasted), { type: 'text/plain' }));
                setPasted('');
              }}
            >
              Importer le texte collé
            </Btn>
          </>
        ) : null}
        {workspace.sourceOrigin.kind === 'gpx_import' ? <Note>Provenance : {workspace.sourceOrigin.sourceTitle ?? 'fichier importé'} · {workspace.sourceOrigin.attribution ?? 'import'}.</Note> : null}
      </Block>

      <Block title="Exporter" right={full.ok ? 'GPX 1.1 validé' : undefined} testId="file-export">
        <Btn tone="primary" disabled={!full.ok} onClick={() => tools.exportGpx()} testId="export-full">
          Exporter le GPX complet
        </Btn>
        {!full.ok ? <Note tone="warn">{full.reason}</Note> : expert ? <Note>{full.trackpoints.toLocaleString('fr-FR')} points de trace · contrôle de structure GPX 1.1 réussi avant téléchargement.</Note> : null}
        {perStage.length > 1 ? (
          <RouteRows testId="export-stage-rows">
            {perStage.map(({ st, out }) => (
              <RouteRow
                key={st.id}
                icon="download"
                title={`Jour ${st.dayNumber} · ${st.title}`}
                subtitle={out.ok ? `${out.trackpoints.toLocaleString('fr-FR')} points` : out.reason}
                onClick={out.ok ? () => tools.exportGpx(st.id) : undefined}
                trailing={out.ok ? <Pill tone="good">GPX 1.1</Pill> : <Pill tone="warn">Indisponible</Pill>}
                testId={`export-stage-${st.id}`}
              />
            ))}
          </RouteRows>
        ) : null}
        {workspace.sections.length > 0 ? <Note>Distance totale exportée : {fmtKm(workspace.sections.reduce((a, s) => a + s.distanceKm, 0))}.</Note> : <Note>Distance inconnue : aucun tracé.</Note>}
      </Block>
    </>
  );
}
