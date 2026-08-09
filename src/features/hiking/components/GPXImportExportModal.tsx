'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#FBFAF6] text-[#0B1F17] rounded-t-[34px] pt-3 pb-10 px-4 shadow-2xl space-y-4"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[#0B1F17]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Fichiers <em className="font-serif italic text-[#17402C]">GPX & Tracés</em>
            </h2>
            <p className="text-[11px] font-mono text-[#6B7A72] tracking-wider mt-0.5">
              IMPORT / EXPORT TRACEUR GPX 1.1
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E9E4D9] flex items-center justify-center text-[#6B7A72] hover:text-[#0B1F17]"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-800 rounded-2xl text-xs border border-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Upload GPX Button Box */}
        <div className="p-5 border-2 border-dashed border-[#17402C]/30 bg-[#F4F1EA] rounded-3xl text-center space-y-2">
          <span className="text-3xl block">📥</span>
          <div className="text-xs font-bold text-[#0B1F17]">Importer un fichier GPX</div>
          <p className="text-[10px] font-mono text-[#6B7A72]">
            Compatible Visorando, AllTrails, Komoot & Garmin
          </p>
          <label className="inline-block mt-2 px-4 py-2 bg-[#17402C] text-white text-xs font-bold rounded-full cursor-pointer shadow-md active:scale-95 transition-transform">
            Choisir un fichier .gpx
            <input type="file" accept=".gpx" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Export GPX Button */}
        {positions.length > 0 && (
          <button
            onClick={handleExportGPX}
            className="w-full py-3.5 bg-[#EAF1E5] border border-[#A8C8A0] text-[#17402C] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
          >
            <span>📤</span>
            Exporter la trace actuelle ({positions.length} points GPS)
          </button>
        )}
      </motion.div>
    </div>
  );
}
