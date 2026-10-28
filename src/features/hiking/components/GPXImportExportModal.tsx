'use client';

import React, { useEffect, useRef, useState } from 'react';
import { hasNativeGPXFiles, importNativeGPX, exportNativeGPX } from '@/lib/native/ui';
import Sheet from '@/components/ui/Sheet';
import { GPXEngine, ParsedGPXData } from '../gpx/GPXEngine';
import { GPSPosition, Waypoint } from '../types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface GPXImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: GPSPosition[];
  waypoints?: Waypoint[];
  onImportParsedGPX?: (data: ParsedGPXData) => void;
}

export default function GPXImportExportModal({
  isOpen,
  onClose,
  positions = [],
  waypoints = [],
  onImportParsedGPX,
}: GPXImportExportModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nativeReady, setNativeReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    void hasNativeGPXFiles().then((available) => {
      if (mounted) setNativeReady(available);
    });
    return () => { mounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const parseAndImport = (content: string) => {
    try {
      const parsed = GPXEngine.parseGPX(content);
      onImportParsedGPX?.(parsed);
      if (onImportParsedGPX) onClose();
      setErrorMsg(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier GPX.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      setErrorMsg('Fichier GPX trop volumineux (2 Mo maximum).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') parseAndImport(reader.result);
      else setErrorMsg('Impossible de lire le fichier GPX.');
    };
    reader.onerror = () => setErrorMsg('Impossible de lire le fichier GPX.');
    reader.readAsText(file);
  };

  const handleImportGPX = () => {
    if (!nativeReady) { fileInput.current?.click(); return; }
    void importNativeGPX().then((xml) => {
      if (xml === undefined) {
        setNativeReady(false);
        fileInput.current?.click();
      } else if (xml !== null) {
        parseAndImport(xml);
      }
    });
  };

  const handleExportGPX = () => {
    const xml = GPXEngine.exportGPX(positions, waypoints, 'Session Randonnee LKDV');
    const fileName = `randonnee-lkdv-${Date.now()}.gpx`;
    const download = () => {
      const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    };
    if (!nativeReady) { download(); return; }
    void exportNativeGPX(xml, fileName).then((saved) => {
      if (saved === undefined) {
        setNativeReady(false);
        download();
      }
      // false = explicit cancellation, true = saved; neither starts a second download.
    });
  };
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      title="Fichiers GPX & Tracés"
      description="IMPORT / EXPORT TRACEUR GPX 1.1"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-800 rounded-2xl text-xs border border-red-200">
            <LKDVIcon name="alerte" size="1em" className="lkdv-icon-inline" /> {errorMsg}
          </div>
        )}

        {/* Upload GPX Button Box */}
        <div className="p-5 border-2 border-dashed border-[color:var(--lkv-primary)]/30 bg-[color:var(--lkv-surface-muted)] rounded-[var(--lkv-radius-sm)] text-center space-y-2">
          <span className="text-3xl block"><LKDVIcon name="telecharger" size="1em" className="lkdv-icon-inline" /></span>
          <div className="text-xs font-bold text-[color:var(--lkv-text-primary)]">Importer un fichier GPX</div>
          <p className="text-[10px] font-mono text-[color:var(--lkv-text-muted)]">
            Compatible Visorando, AllTrails, Komoot & Garmin
          </p>
          <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml" onChange={handleFileUpload} className="hidden" aria-label="Fichier GPX" />
          <button type="button" onClick={handleImportGPX}
            className="inline-flex items-center justify-center min-h-[44px] mt-2 px-5 py-2.5 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)] text-xs font-bold rounded-full cursor-pointer active:scale-95 transition-transform">
            {nativeReady ? 'Importer depuis Fichiers' : 'Choisir un fichier .gpx'}
          </button>
        </div>

        {/* Export GPX Button */}
        {positions.length > 0 && (
          <button
            onClick={handleExportGPX}
            className="w-full min-h-[44px] py-3 bg-[color:var(--lkv-forest-50)] border border-[color:var(--lkv-forest-200)] text-[color:var(--lkv-text-primary)] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <span><LKDVIcon name="exporter" size="1em" className="lkdv-icon-inline" /></span>
            Exporter la trace actuelle ({positions.length} points GPS)
          </button>
        )}
      </div>
    </Sheet>
  );
}
