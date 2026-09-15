"use client";

import { useEffect, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";

/**
 * P5 — RUM Web Vitals (Loi 9 : ce qui n'est pas mesuré régresse).
 * Envoie LCP/CLS/FCP/INP/TTFB vers /api/telemetry/hub (batch ≤20, route edge
 * authentifiée). Aucune donnée personnelle : nom de métrique, valeur, route,
 * breakpoints. Échecs silencieux (jamais bloquant pour l'utilisateur).
 */

interface VitalEvent {
  event: string;
  payload: Record<string, unknown>;
}

export default function WebVitalsReporter() {
  const buffer = useRef<VitalEvent[]>([]);

  useEffect(() => {
    const flush = () => {
      if (buffer.current.length === 0) return;
      const batch = buffer.current.splice(0, 20);
      fetch("/api/telemetry/hub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).catch(() => {
        /* télémétrie : jamais bloquante */
      });
    };

    const interval = window.setInterval(flush, 10_000);
    window.addEventListener("pagehide", flush, { once: true });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useReportWebVitals((metric) => {
    // Rapport RUM par route : /hub → hub, /hub/itineraire → hub/[section]…
    const route =
      typeof window === "undefined" ? "" : window.location.pathname;
    buffer.current.push({
      event: "web_vitals",
      payload: {
        name: metric.name,
        value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        rating: metric.rating,
        route,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });
    if (buffer.current.length >= 20) {
      const batch = buffer.current.splice(0, 20);
      fetch("/api/telemetry/hub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).catch(() => {});
    }
  });

  return null;
}
