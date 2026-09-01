export function ProgressRing({ percent, size = 96, strokeWidth = 10 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle cx={center} cy={center} r={radius} stroke="var(--color-border)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--color-accent)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </g>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-primary font-semibold"
        style={{ fontSize: size * 0.22 }}
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
