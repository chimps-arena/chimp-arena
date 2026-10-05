"use client";

import { useRef } from "react";

/**
 * Foil-trading-card tilt effect: tracks pointer position and tilts the
 * card toward it with a moving glare, like a holographic card catching
 * light. Not a real multi-angle rotation (the art underneath is still one
 * flat image) - the founder picked this over a real turntable/3D model
 * specifically because it's free and ships against the art we already
 * have (2026-10-05).
 */
export function HoloCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width; // 0..1
    const py = (clientY - rect.top) / rect.height;
    const rx = (py - 0.5) * -14; // tilt up/down
    const ry = (px - 0.5) * 14; // tilt left/right
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      className={`holo-card ${className}`}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={reset}
      style={{
        perspective: "700px",
      }}
    >
      <div className="holo-card-inner">
        {children}
        <div className="holo-card-glare" aria-hidden />
      </div>
    </div>
  );
}
