import { CSSProperties, ReactNode } from 'react';

type RingProps = {
  percent: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
};

export default function Ring({
  percent,
  size = 56,
  thickness = 6,
  color = 'var(--ring-info)',
  trackColor = 'var(--surface-muted)',
  children,
}: RingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const diameter = size;
  const inner = diameter - thickness * 2;

  const ringStyle: CSSProperties = {
    width: diameter,
    height: diameter,
    background: `conic-gradient(${color} ${clamped}%, ${trackColor} ${clamped}% 100%)`,
    borderRadius: '9999px',
  };

  const innerStyle: CSSProperties = {
    width: inner,
    height: inner,
    borderRadius: '9999px',
  };

  return (
    <div className="relative inline-grid place-items-center" style={ringStyle}>
      <div
        className="rounded-full bg-white text-xs font-semibold text-slate-700 grid place-items-center"
        style={innerStyle}
      >
        {children ?? `${Math.round(clamped)}%`}
      </div>
    </div>
  );
}

