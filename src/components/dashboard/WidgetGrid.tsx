import { ReactNode } from 'react';

interface WidgetGridProps {
  children: ReactNode;
  widgets: Array<{ id: string; type: string; order: number }>;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, sourceIndex: number, destinationIndex: number) => void;
  onWidgetClick: (widgetId: string) => void;
  onWidgetAgrandir: (widgetId: string) => void;
}

export function WidgetGrid({
  children,
  widgets,
  onDragStart,
  onDragOver,
  onDrop,
  onWidgetClick,
  onWidgetAgrandir
}: WidgetGridProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
      data-testid="widget-grid"
    >
      {children}
    </div>
  );
}