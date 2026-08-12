import type { WeatherIconKey } from "@/lib/types";

export default function WeatherIcon({
  icon,
  size = 16,
  className = "",
}: {
  icon: WeatherIconKey;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (icon) {
    case "clear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <line x1="12" y1="2.5" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21.5" y2="12" />
          <line x1="5.3" y1="5.3" x2="7" y2="7" />
          <line x1="17" y1="17" x2="18.7" y2="18.7" />
          <line x1="18.7" y1="5.3" x2="17" y2="7" />
          <line x1="7" y1="17" x2="5.3" y2="18.7" />
        </svg>
      );

    case "partly-cloudy":
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3.2" />
          <line x1="9" y1="2.5" x2="9" y2="4" />
          <line x1="3.8" y1="8.5" x2="5.3" y2="8.5" />
          <line x1="5" y1="4.5" x2="6.1" y2="5.6" />
          <path d="M9.5 20h7.2a3.3 3.3 0 0 0 .5-6.56 4.2 4.2 0 0 0-8.06-1.55A3.6 3.6 0 0 0 6 15.6a3.3 3.3 0 0 0 3.5 4.4Z" />
        </svg>
      );

    case "cloudy":
      return (
        <svg {...common}>
          <path d="M7 18h10a3.6 3.6 0 0 0 .5-7.16 4.6 4.6 0 0 0-8.86-1.4A4 4 0 0 0 4 13.5 3.9 3.9 0 0 0 7 18Z" />
        </svg>
      );

    case "fog":
      return (
        <svg {...common}>
          <path d="M7 13.5h10a3.6 3.6 0 0 0 .3-7.18 4.6 4.6 0 0 0-8.68-1.42A4 4 0 0 0 4 9 3.9 3.9 0 0 0 7 13.5Z" />
          <line x1="4" y1="17.5" x2="20" y2="17.5" />
          <line x1="6.5" y1="20.5" x2="17.5" y2="20.5" />
        </svg>
      );

    case "drizzle":
      return (
        <svg {...common}>
          <path d="M7 12.5h10a3.6 3.6 0 0 0 .3-7.18 4.6 4.6 0 0 0-8.68-1.42A4 4 0 0 0 4 8 3.9 3.9 0 0 0 7 12.5Z" />
          <line x1="8.5" y1="16" x2="7.8" y2="18" />
          <line x1="12.2" y1="16" x2="11.5" y2="18" />
          <line x1="15.9" y1="16" x2="15.2" y2="18" />
        </svg>
      );

    case "rain":
      return (
        <svg {...common}>
          <path d="M7 11.5h10a3.6 3.6 0 0 0 .3-7.18 4.6 4.6 0 0 0-8.68-1.42A4 4 0 0 0 4 7 3.9 3.9 0 0 0 7 11.5Z" />
          <line x1="8" y1="15" x2="6.8" y2="19" />
          <line x1="12" y1="15" x2="10.8" y2="19" />
          <line x1="16" y1="15" x2="14.8" y2="19" />
        </svg>
      );

    case "snow":
      return (
        <svg {...common}>
          <path d="M7 11.5h10a3.6 3.6 0 0 0 .3-7.18 4.6 4.6 0 0 0-8.68-1.42A4 4 0 0 0 4 7 3.9 3.9 0 0 0 7 11.5Z" />
          <line x1="7.5" y1="16" x2="7.5" y2="20" />
          <line x1="5.7" y1="18" x2="9.3" y2="18" />
          <line x1="12" y1="16" x2="12" y2="20" />
          <line x1="10.2" y1="18" x2="13.8" y2="18" />
          <line x1="16.5" y1="16" x2="16.5" y2="20" />
          <line x1="14.7" y1="18" x2="18.3" y2="18" />
        </svg>
      );

    case "thunderstorm":
      return (
        <svg {...common}>
          <path d="M7 11h10a3.6 3.6 0 0 0 .3-7.18A4.6 4.6 0 0 0 8.62 2.4 4 4 0 0 0 4 6.5 3.9 3.9 0 0 0 7 11Z" />
          <path d="M12.5 13.5 9.5 18h3l-1.5 4 4.5-5.5h-3l1.5-3Z" strokeLinejoin="round" />
        </svg>
      );

    default:
      return null;
  }
}
