type DialProps = {
  size?: number;
  spinning?: boolean;
  className?: string;
};

/**
 * A small instrument-style mark with a resting needle. At rest it idles
 * gently back and forth; while a recommendation is being generated it
 * spins, standing in for a loading state. Kept flat/monochrome to match
 * the editorial concept — no gradients or bevel, just line weight.
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
      <circle cx="50" cy="50" r="47" fill="none" stroke="#171717" strokeWidth="2" />

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
            stroke="#171717"
            strokeWidth={major ? 2 : 1.2}
            strokeLinecap="round"
            transform={`rotate(${angle} 50 50)`}
          />
        );
      })}

      <g
        style={{ transformOrigin: "50px 50px" }}
        className={spinning ? "animate-dial-spin" : "animate-dial-idle"}
      >
        <line x1="50" y1="50" x2="50" y2="22" stroke="#171717" strokeWidth="3" strokeLinecap="round" />
      </g>

      <circle cx="50" cy="50" r="4" fill="#171717" />
    </svg>
  );
}
