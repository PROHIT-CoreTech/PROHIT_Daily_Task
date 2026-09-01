function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function TimerRing({
  secondsRemaining,
  totalSeconds,
  size = 220,
  strokeWidth = 14,
}: {
  secondsRemaining: number;
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const elapsedFraction = totalSeconds > 0 ? 1 - secondsRemaining / totalSeconds : 0;
  const offset = circumference * elapsedFraction;
  const center = size / 2;

  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle cx={center} cy={center} r={radius} stroke="var(--color-border)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--color-primary)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </g>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-primary font-semibold" style={{ fontSize: size * 0.17 }}>
        {formatTime(secondsRemaining)}
      </text>
    </svg>
  );
}
