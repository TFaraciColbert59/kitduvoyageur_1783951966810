"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { createNavigationTracker } from "@/lib/perf/experienceMetrics";

interface VitalEvent {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Reports Web Vitals and LKDV experience timings through the existing
 * authenticated telemetry endpoint. Reporting never blocks rendering.
 */
export default function WebVitalsReporter() {
  const buffer = useRef<VitalEvent[]>([]);
  const tracker = useRef(createNavigationTracker());
  const bootRecorded = useRef(false);
  const pathname = usePathname();

  const flush = useCallback(() => {
    if (buffer.current.length === 0) return;
    const batch = buffer.current.slice(0, 20);
    buffer.current = buffer.current.slice(20);
    fetch("/api/telemetry/hub", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => {
      // Telemetry must never block the UI.
    });
  }, []);

  const enqueue = useCallback((event: VitalEvent) => {
    buffer.current = [...buffer.current, event];
    if (buffer.current.length >= 20) flush();
  }, [flush]);

  const recordExperience = useCallback((name: string, value: number, route: string) => {
    if (!Number.isFinite(value) || value < 0) return;
    enqueue({
      event: "experience_metric",
      payload: {
        name,
        value: Math.round(value),
        route,
        viewport: String(window.innerWidth) + "x" + String(window.innerHeight),
      },
    });
  }, [enqueue]);

  useEffect(() => {
    const interval = window.setInterval(flush, 10_000);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    const navTarget = (event: PointerEvent | MouseEvent): string | null => {
      if (event.button !== 0) return null;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
      const element = event.target instanceof Element ? event.target : null;
      const link = element?.closest<HTMLAnchorElement>('nav[aria-label="Navigation principale"] a[href]');
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return null;
      const target = new URL(link.href, window.location.href);
      return target.origin === window.location.origin ? target.pathname : null;
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = navTarget(event);
      if (target) tracker.current.start(target, window.location.pathname, performance.now());
    };
    const onClick = (event: MouseEvent) => {
      const target = navTarget(event);
      if (!target) return;
      if (event.detail === 0) {
        tracker.current.start(target, window.location.pathname, performance.now());
      }
      tracker.current.commit(target);
    };
    const onCanceled = () => tracker.current.cancel();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("lkdv:navigation-cancel", onCanceled);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("lkdv:navigation-cancel", onCanceled);
    };
  }, []);

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const navigation = tracker.current.finish(pathname, performance.now());
        if (navigation) recordExperience(navigation.name, navigation.value, navigation.route);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, recordExperience]);

  useEffect(() => {
    if (bootRecorded.current) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (bootRecorded.current) return;
        bootRecorded.current = true;
        const now = performance.now();
        // Browser time origin begins at document navigation, after native process startup.
        recordExperience("LKDV_WEB_SHELL", now, window.location.pathname);
        const jsStart = performance.getEntriesByName("lkdv:js-start", "mark").at(-1);
        if (jsStart) {
          recordExperience("LKDV_JS_SHELL", now - jsStart.startTime, window.location.pathname);
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [recordExperience]);

  const reportVital = useCallback<Parameters<typeof useReportWebVitals>[0]>((metric) => {
    enqueue({
      event: "web_vitals",
      payload: {
        name: metric.name,
        value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        rating: metric.rating,
        route: window.location.pathname,
        viewport: String(window.innerWidth) + "x" + String(window.innerHeight),
      },
    });
  }, [enqueue]);

  useReportWebVitals(reportVital);
  return null;
}
