'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineManager } from '../offline/useOfflineManager';

export default function OfflineIndicatorBanner() {
  const { isOffline, isSyncing, pendingCount } = useOfflineManager();

  if (!isOffline && !isSyncing && pendingCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full bg-[#1F2E25]/90 border-b border-[#2D5A27]/30 px-3 py-1 text-center backdrop-blur-md"
      >
        <p className="text-[11px] font-mono text-[#A3C4A3] flex items-center justify-center gap-2">
          {isSyncing ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Synchronisation en cours ({pendingCount} élément{pendingCount > 1 ? 's' : ''})...</span>
            </>
          ) : isOffline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Mode hors ligne actif · Enregistrement local sécurisé</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#4E9F3D]" />
              <span>{pendingCount} élément{pendingCount > 1 ? 's' : ''} en attente de synchro</span>
            </>
          ) : null}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
