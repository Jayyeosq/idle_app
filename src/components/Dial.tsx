type DialProps = {
  size?: number;
  spinning?: boolean;
  className?: string;
};

/**
 * A brass instrument-panel dial with a resting needle. At rest it idles
 * gently back and forth (like an engine at idle RPM); while a recommendation
 * is being generated it spins, standing in for a loading state without
 * resorting to a generic spinner.
 */
export default function Dial({ size = 96, spinning = false, className = "" }: DialProps) {
  const ticks = Array.from({ length: 12 }, (_, i) => i);

  const uid = "dial"; // ok to be static: only one Dial is ever on screen at a time

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={spinning ? "Finding recommendations" : "IDLE"}
      style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))" }}
    >
      <defs>
        <radialGradient id={`${uid}-face`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#242938" />
          <stop offset="100%" stopColor="#171A24" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A5266" />
          <stop offset="50%" stopColor="#262B38" />
          <stop offset="100%" stopColor="#4A5266" />
        </linearGradient>
        <linearGradient id={`${uid}-needle`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E4C778" />
          <stop offset="100%" stopColor="#C89B3C" />
        </linearGradient>
      </defs>

      {/* outer bezel */}
      <circle cx="50" cy="50" r="48" fill={`url(#${uid}-rim)`} />
      <circle cx="50" cy="50" r="45.5" fill={`url(#${uid}-face)`} stroke="#0C0E13" strokeWidth="1" />
      <circle cx="50" cy="50" r="37" fill="none" stroke="#3A4152" strokeWidth="1" />

      {ticks.map((i) => {
        const angle = (i / 12) * 360;
        const major = i % 3 === 0;
        return (
          <line
            key={i}
            x1="50"
            y1={major ? "9" : "12.5"}
            x2="50"
            y2="16"
            stroke={major ? "#C89B3C" : "#6B7484"}
            strokeWidth={major ? 1.8 : 1}
            strokeLinecap="round"
            transform={`rotate(${angle} 50 50)`}
          />
        );
      })}

      <g
        style={{ transformOrigin: "50px 50px" }}
        className={spinning ? "animate-dial-spin" : "animate-dial-idle"}
      >
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="19"
          stroke={`url(#${uid}-needle)`}
          strokeWidth="2.75"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="61"
          stroke={`url(#${uid}-needle)`}
          strokeWidth="2.75"
          strokeLinecap="round"
        />
      </g>

      <circle cx="50" cy="50" r="5.5" fill="#0C0E13" />
      <circle cx="50" cy="50" r="4.5" fill={`url(#${uid}-needle)`} />
      <circle cx="48.3" cy="48.3" r="1.3" fill="#F3E3B8" opacity="0.9" />
    </svg>
  );
}
