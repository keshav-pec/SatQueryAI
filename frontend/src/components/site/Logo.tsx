export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="9.2" fill="#0d131d" stroke="#3bd5ff" strokeWidth="1.6" />
      <path d="M8.2 18.6c3.8 2.6 11.8 2.6 15.6 0" stroke="#3bd5ff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 12.8c3.4-1.8 8.6-1.8 12 0" stroke="#3bd5ff" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="16" cy="16" rx="14.2" ry="5.6" transform="rotate(-28 16 16)" stroke="#ff9933" strokeWidth="1.4" />
      <circle cx="27.1" cy="9.4" r="2.3" fill="#ff9933" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="display text-[17px] font-semibold tracking-tight text-ink">
          SatQuery<span className="text-saffron"> AI</span>
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">Remote-sensing agent</span>
      </span>
    </span>
  );
}
