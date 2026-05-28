import * as React from "react";

import { cn } from "@/lib/utils";

type CircularProgressProps = {
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function CircularProgress({ value, label, size = 72, strokeWidth = 8, className }: CircularProgressProps) {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const [animated, setAnimated] = React.useState(0);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(normalized));
    return () => cancelAnimationFrame(id);
  }, [normalized]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animated / 100);

  return (
    <div className={cn("flex w-[92px] flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-slate-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="fill-none stroke-primary"
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-base font-semibold text-slate-900">{normalized}%</div>
        </div>
      </div>
      <div className="text-center text-xs font-semibold text-slate-600">{label}</div>
    </div>
  );
}

