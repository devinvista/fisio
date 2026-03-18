interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 32, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FisioGest Pro logo"
    >
      <rect width="180" height="180" rx="36" fill="currentColor" />
      <circle cx="90" cy="42" r="15" fill="white" />
      <line x1="90" y1="60" x2="90" y2="108" stroke="white" strokeWidth="11" strokeLinecap="round" />
      <line x1="90" y1="76" x2="44" y2="52" stroke="white" strokeWidth="10" strokeLinecap="round" />
      <line x1="90" y1="76" x2="136" y2="52" stroke="white" strokeWidth="10" strokeLinecap="round" />
      <line x1="90" y1="108" x2="66" y2="148" stroke="white" strokeWidth="10" strokeLinecap="round" />
      <line x1="90" y1="108" x2="114" y2="148" stroke="white" strokeWidth="10" strokeLinecap="round" />
      <rect x="128" y="120" width="8" height="28" rx="4" fill="white" opacity="0.5" />
      <rect x="118" y="130" width="28" height="8" rx="4" fill="white" opacity="0.5" />
    </svg>
  );
}
