import React from 'react';

/** Rend un markdown minimal LKDV : paragraphes + gras `**…**`. */
export function BlockMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = text.split('\n\n').filter((paragraph) => paragraph.trim().length > 0);

  return (
    <div className={`space-y-2 text-xs text-[#2D4536] leading-relaxed ${className}`}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.split(/(\*\*.*?\*\*)/g).map((part, partIndex) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={partIndex} className="font-bold text-[#17402C]">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <React.Fragment key={partIndex}>{part}</React.Fragment>
            )
          )}
        </p>
      ))}
    </div>
  );
}
