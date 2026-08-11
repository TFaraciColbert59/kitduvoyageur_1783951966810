// EarthLayout.tsx - Redesign premium
// Layout radial pour l'expérience Earth - Design Apple × Garmin × AllTrails

import React from 'react';
import type { ReactNode } from 'react';

interface EarthLayoutProps {
  topContent?: ReactNode;
  leftContent?: ReactNode;
  centerContent: ReactNode;
  rightContent?: ReactNode;
  bottomContent?: ReactNode;
  className?: string;
  isCountryPage?: boolean;
}

export default function EarthLayout({
  topContent,
  leftContent,
  centerContent,
  rightContent,
  bottomContent,
  className = '',
  isCountryPage = false
}: EarthLayoutProps) {
  return (
    <div className={`relative min-h-screen bg-slate-950 overflow-hidden ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/30 via-slate-950/80 to-slate-950"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl mix-blend-screen"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl mix-blend-screen"></div>
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-purple-500/3 rounded-full blur-2xl mix-blend-multiply opacity-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.4)_100%)]"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {topContent && (
          <div className="absolute top-0 left-0 right-0 px-6 md:px-10 lg:px-16 pt-6 md:pt-10 lg:pt-14 z-30">
            <div className="flex justify-center max-w-7xl mx-auto"><div className="w-full">{topContent}</div></div>
          </div>
        )}

        {leftContent && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30 pl-4 md:pl-8 lg:pl-12">
            <div className="w-64 md:w-72 lg:w-80 max-h-[85vh] overflow-y-auto custom-scrollbar pr-3 md:pr-4 lg:pr-6">
              <div className="space-y-6 pb-6">{leftContent}</div>
            </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center relative z-20 px-4 md:px-8 lg:px-12">
          <div className="w-full max-w-7xl max-h-[85vh] flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-[70vh] md:max-w-[75vh] lg:max-w-[85vh] xl:max-w-[90vh]">
              <div className="absolute -inset-8 bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-purple-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
              <div className="absolute -inset-4 border border-white/10 rounded-full backdrop-blur-sm"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 rounded-full mix-blend-overlay"></div>
              <div className="relative w-full h-full">{centerContent}</div>
              <div className="absolute -inset-12 border border-white/5 rounded-full pointer-events-none"></div>
              <div className="absolute -inset-16 border border-white/10 rounded-full pointer-events-none opacity-30"></div>
            </div>
          </div>
        </div>

        {rightContent && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 pr-4 md:pr-8 lg:pr-12">
            <div className="w-64 md:w-72 lg:w-80 max-h-[85vh] overflow-y-auto custom-scrollbar pl-3 md:pl-4 lg:pl-6">
              <div className="space-y-6 pb-6">{rightContent}</div>
            </div>
          </div>
        )}

        {bottomContent && (
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-10 lg:px-16 pb-6 md:pb-10 lg:pb-14 z-30">
            <div className="flex justify-center max-w-7xl mx-auto"><div className="w-full">{bottomContent}</div></div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/60"></div>
      </div>
    </div>
  );
}

export const earthGlobalStyles = `
  @keyframes pulse-slow {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 10px;
    transition: background 0.3s ease;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.3);
  }
`;
