"use client";

import React from 'react';

interface TypingIndicatorProps {
  userNames: string[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userNames }) => {
  if (userNames.length === 0) return null;

  const namesDisplay =
    userNames.length === 1
      ? userNames[0]
      : `${userNames.slice(0, 2).join(', ')}${userNames.length > 2 ? ' et d\'autres' : ''}`;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#5A7064] font-medium bg-white/40 backdrop-blur-md border border-white/40 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] w-fit ml-2 mb-1">
      <div className="flex items-center gap-1" aria-hidden="true">
        <span className="w-1.5 h-1.5 bg-[#5B7F55] rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-[#5B7F55] rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-[#5B7F55] rounded-full animate-bounce" />
      </div>
      <span>{namesDisplay} est en train d&apos;écrire...</span>
    </div>
  );
};
