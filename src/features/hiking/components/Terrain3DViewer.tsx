'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Terrain3DViewerProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation?: [number, number] | null;
  elevationGainM?: number | null;
}

export default function Terrain3DViewer({
  isOpen,
  onClose,
  userLocation,
  elevationGainM = 420,
}: Terrain3DViewerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#06120C] text-white flex flex-col justify-between select-none">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between bg-[#0B1F17]/80 backdrop-blur-xl border-b border-white/10 z-10">
        <div>
          <div className="text-xs font-mono tracking-widest text-[#A8C8A0] uppercase">
            VUE 3D RELIEF · DIGITAL TWIN
          </div>
          <h2 className="text-lg font-bold">Relief Topographique 3D</h2>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-base hover:bg-white/20"
        >
          ✕
        </button>
      </div>

      {/* 3D Simulated Mesh Canvas Box */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#0B1F17] via-[#06120C] to-[#0d1a12]">
        {/* Animated Grid & Terrain Contours */}
        <motion.div
          animate={{ rotateX: [60, 65, 60], rotateZ: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[600px] h-[600px] rounded-full border border-[#A8C8A0]/20 flex items-center justify-center relative shadow-2xl"
          style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
        >
          {/* Concentric Wireframe Terrain Rings */}
          <div className="absolute inset-10 rounded-full border border-[#A8C8A0]/30 border-dashed animate-spin" style={{ animationDuration: '40s' }} />
          <div className="absolute inset-24 rounded-full border border-[#C6DCBE]/40" />
          <div className="absolute inset-40 rounded-full border-2 border-[#E8B87A]" />

          {/* User Location Pulse Marker */}
          <div className="w-8 h-8 rounded-full bg-[#E8B87A] border-4 border-white shadow-2xl flex items-center justify-center animate-bounce z-20">
            <span className="text-xs">🥾</span>
          </div>
        </motion.div>

        {/* Floating Info Overlay */}
        <div className="absolute bottom-6 left-6 right-6 p-4 bg-[#0B1F17]/90 backdrop-blur-2xl border border-white/15 rounded-3xl space-y-1.5 shadow-2xl">
          <div className="flex justify-between items-center text-xs font-mono text-[#A8C8A0]">
            <span>ALTITUDE MAX: 1 842 m</span>
            <span>DÉNIVELÉ +: +{elevationGainM ?? 420} m</span>
          </div>
          <div className="text-sm font-medium">
            Rendu 3D temps réel du massif de la Chartreuse
          </div>
        </div>
      </div>
    </div>
  );
}
