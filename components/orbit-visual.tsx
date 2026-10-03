/**
 * Decorative hero backdrop: concentric orbit rings around a single bright
 * glowing orb - one dramatic light source instead of our usual scattered
 * neon chips, per the calmer "premium cosmic" reference the founder asked
 * to match (a Dribbble web3 landing page: Empyreal Exchange).
 */
export function OrbitVisual() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <svg
        viewBox="0 0 600 600"
        className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 opacity-40"
        fill="none"
      >
        <circle cx="300" cy="300" r="120" stroke="var(--border)" strokeWidth="1" />
        <circle cx="300" cy="300" r="190" stroke="var(--border)" strokeWidth="1" />
        <circle cx="300" cy="300" r="260" stroke="var(--border)" strokeWidth="1" />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, #fffef4 0%, #ffe9a8 45%, transparent 75%)",
          boxShadow: "0 0 120px 40px rgba(255, 228, 160, 0.35)",
        }}
      />
    </div>
  );
}
