import { useState } from 'react';
import { MotionDiv } from '@/src/components/ui/motion';
import { useDragDrop } from '@/src/hooks/useDragDrop';

interface WidgetProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, sourceIndex: number, destinationIndex: number) => void;
  onClick: () => void;
  isActive: boolean;
  className?: string;
  onAgrandir: () => void;
}

export function Widget({
  id,
  title,
  children,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  isActive,
  className = '',
  onAgrandir
}: WidgetProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, 0); // Index will be handled by parent
    e.dataTransfer.setText/plain(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e, 0); // Index will be handled by parent
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const sourceId = e.dataTransfer.getData('text/plain');
    // Actual reordering logic is handled by parent
  };

  return (
    <MotionDiv
      as="div"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`relative group ${isActive ? 'hidden' : ''} ${className}
        ${isDraggingOver ? 'border-2 border-[#A3C4A3]/50' : 'border border-white/8'}
        rounded-2xl bg-black/50 backdrop-blur-sm p-4
        hover:border-white/10 transition-all cursor-default`}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      data-testid={`widget-${id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 bg-white/20 rounded-full cursor-move"
            onDragStart={handleDragStart}
            title="Déplacer le widget"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAgrandir();
            }}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
            title="Agrandir le widget"
          >
            <span className="text-[10px]">⤢</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {children}
      </div>
    </MotionDiv>
  );
}