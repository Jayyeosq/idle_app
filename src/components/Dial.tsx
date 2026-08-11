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

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={spinning ? "Finding recommendations" : "IDLE"}
    >
      <circle cx="50" cy="50" r="47" fill="#1D212C" stroke="#3A4152" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#3A4152" strokeWidth="1" />

      {ticks.map((i) => {
        const angle = (i / 12) * 360;
        const major = i % 3 === 0;
        return (
          <line
            key={i}
            x1="50"
            y1={major ? "10" : "13"}
            x2="50"
            y2="16"
            stroke={major ? "#C89B3C" : "#9AA5B1"}
            strokeWidth={major ? 1.6 : 1}
            transform={`rotate(${angle} 50 50)`}
          />
        );
      })}

      <g
        style={{ transformOrigin: "50px 50px" }}
        className={spinning ? "animate-dial-spin" : "animate-dial-idle"}
      >
        <line x1="50" y1="50" x2="50" y2="20" stroke="#C89B3C" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="60" stroke="#C89B3C" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <circle cx="50" cy="50" r="4.5" fill="#C89B3C" />
      <circle cx="50" cy="50" r="1.6" fill="#14171F" />
    </svg>
  );
}
