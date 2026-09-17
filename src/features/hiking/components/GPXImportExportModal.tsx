'use client';

import React, { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import { GPXEngine, ParsedGPXData } from '../gpx/GPXEngine';
import { GPSPosition, Waypoint } from '../types';

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

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = GPXEngine.parseGPX(text);
        if (onImportParsedGPX) {
          onImportParsedGPX(parsed);
          onClose();
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erreur lors de la lecture du fichier GPX.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportGPX = () => {
    const xml = GPXEngine.exportGPX(positions, waypoints, 'Session Randonnee LKDV');
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `randonnee-lkdv-${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Fichiers GPX & Tracés"
      description="IMPORT / EXPORT TRACEUR GPX 1.1"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-800 rounded-2xl text-xs border border-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Upload GPX Button Box */}
        <div className="p-5 border-2 border-dashed border-[#17402C]/30 bg-[#F4F1EA] rounded-[0.75rem] text-center space-y-2">
          <span className="text-3xl block">📥</span>
          <div className="text-xs font-bold text-[#17402C]">Importer un fichier GPX</div>
          <p className="text-[10px] font-mono text-[#6B7A72]">
            Compatible Visorando, AllTrails, Komoot & Garmin
          </p>
          <label className="inline-flex items-center justify-center min-h-[44px] mt-2 px-5 py-2.5 bg-[#17402C] text-white text-xs font-bold rounded-full cursor-pointer active:scale-95 transition-transform">
            Choisir un fichier .gpx
            <input type="file" accept=".gpx" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Export GPX Button */}
        {positions.length > 0 && (
          <button
            onClick={handleExportGPX}
            className="w-full min-h-[44px] py-3 bg-[#EAF1E5] border border-[#A8C8A0] text-[#17402C] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <span>📤</span>
            Exporter la trace actuelle ({positions.length} points GPS)
          </button>
        )}
      </div>
    </Sheet>
  );
}
