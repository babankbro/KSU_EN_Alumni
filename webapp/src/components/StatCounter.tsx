"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

/**
 * Counts up when the statistics band scrolls into view.
 *
 * The initial state is the real figure, not zero, so the server-rendered HTML
 * already carries the number — it stays correct without JavaScript and for
 * crawlers. The count-up is applied afterwards as an enhancement, and is
 * skipped entirely when motion is reduced (§8).
 */
export default function StatCounter({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !el || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    // Start from zero only once we know the animation can actually run.
    setDisplay(0);

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || done.current) return;
          done.current = true;
          obs.disconnect();

          const duration = 1200;
          let start: number | null = null;
          const step = (ts: number) => {
            if (start === null) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref}>
      <div className="stat-num">{formatNumber(display)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
