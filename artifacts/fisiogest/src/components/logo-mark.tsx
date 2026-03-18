interface LogoMarkProps {
  size?: number;
  className?: string;
  withBackground?: boolean;
}

export function LogoMark({ size = 32, className = "", withBackground = true }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FisioGest Pro"
    >
      {withBackground && (
        <>
          <defs>
            <linearGradient id="bg-grad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#008080" />
              <stop offset="100%" stopColor="#005f5f" />
            </linearGradient>
          </defs>
          <rect width="200" height="200" rx="44" fill="url(#bg-grad)" />
        </>
      )}

      {/* Head */}
      <circle cx="100" cy="40" r="17" fill="white" />

      {/* Spine / torso */}
      <path d="M100 59 L100 118" stroke="white" strokeWidth="13" strokeLinecap="round" />

      {/* Left arm — raised diagonally, slightly curved for fluidity */}
      <path d="M100 80 Q80 67 48 54" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Right arm — raised diagonally */}
      <path d="M100 80 Q120 67 152 54" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Left leg */}
      <path d="M100 118 Q84 133 68 158" stroke="white" strokeWidth="12" strokeLinecap="round" fill="none" />

      {/* Right leg */}
      <path d="M100 118 Q116 133 132 158" stroke="white" strokeWidth="12" strokeLinecap="round" fill="none" />

      {/* Healing cross — top-right corner, subtle but intentional */}
      <rect x="156" y="24" width="8" height="30" rx="4" fill="white" opacity="0.55" />
      <rect x="143" y="35" width="30" height="8" rx="4" fill="white" opacity="0.55" />

      {/* Movement dot at right hand — "therapeutic touch" */}
      <circle cx="156" cy="52" r="6" fill="white" opacity="0.75" />
    </svg>
  );
}
