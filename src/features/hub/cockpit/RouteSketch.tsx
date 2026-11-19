'use client';

import { useEffect, useRef } from 'react';
import { maplibreTokens } from '@/design/tokens.generated';
import type { Coordinate } from './model';

export function RouteSketch({ lines, pins }: { lines: Coordinate[][]; pins: Coordinate[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    const all = [...lines.flat(), ...pins];
    if (!canvas || !ctx || !all.length) return;

    function paint() {
      if (!canvas || !ctx) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      const base = all[0][0];
      const unwrap = (lng: number) => ((lng - base + 540) % 360) - 180;
      const latitude = all.map(([, lat]) => lat);
      const longitude = all.map(([lng]) => unwrap(lng));
      const x0 = Math.min(...longitude);
      const y0 = Math.min(...latitude);
      const latitudeSpan = Math.max(...latitude) - y0;
      const ratio = Math.max(0.01, Math.cos((y0 + latitudeSpan / 2) * Math.PI / 180));
      const longitudeSpan = (Math.max(...longitude) - x0) * ratio;
      const pad = 20;
      const zoom = Math.min(
        Math.max(1, width - pad * 2) / Math.max(longitudeSpan, 0.000001),
        Math.max(1, height - pad * 2) / Math.max(latitudeSpan, 0.000001),
      );
      const position = ([lng, lat]: Coordinate) => ({
        x: (width - longitudeSpan * zoom) / 2 + (unwrap(lng) - x0) * ratio * zoom,
        y: (height + latitudeSpan * zoom) / 2 - (lat - y0) * zoom,
      });

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const line of lines) {
        ctx.beginPath();
        line.forEach((point, index) => {
          const { x, y } = position(point);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.lineWidth = 7;
        ctx.strokeStyle = maplibreTokens.haloColor;
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = maplibreTokens.routeTrackPrimary;
        ctx.stroke();
      }

      pins.forEach((point) => {
        const { x, y } = position(point);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = maplibreTokens.routeTrackActive;
        ctx.fill();
        ctx.strokeStyle = maplibreTokens.haloColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [lines, pins]);

  return <canvas ref={ref} aria-hidden="true" />;
}
