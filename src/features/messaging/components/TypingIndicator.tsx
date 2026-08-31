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
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-500 font-medium">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
      </div>
      <span>{namesDisplay} est en train d&apos;écrire...</span>
    </div>
  );
};
