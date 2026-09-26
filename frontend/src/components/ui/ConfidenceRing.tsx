export function ConfidenceRing({ value, size = 44, label = true }: { value: number; size?: number; label?: boolean }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 0.85 ? "#3ecf5b" : value >= 0.7 ? "#3bd5ff" : "#fab219";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Calibrated confidence ${(value * 100).toFixed(0)} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2533" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      {label && <span className="absolute text-[11.5px] font-semibold text-ink">{Math.round(value * 100)}</span>}
    </span>
  );
}
