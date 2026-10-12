import React from 'react';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  id?: string;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-slate-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-indigo-600',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  id,
  className = '',
}) => {
  const isInteractive = Boolean(onClick);
  const valueColor = TONE_CLASSES[tone] || TONE_CLASSES.default;

  const content = (
    <>
      <div className="text-caption font-medium text-slate-500 truncate">
        {label}
      </div>
      <div className={`text-kpi-number font-bold tabular-nums mt-1 ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="text-caption text-slate-400 mt-0.5 truncate">
          {hint}
        </div>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        id={id}
        onClick={onClick}
        className={`w-full text-left bg-white border border-slate-200 rounded-[6px] px-3 py-2.5 shadow-2xs hover:border-slate-300 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      id={id}
      className={`bg-white border border-slate-200 rounded-[6px] px-3 py-2.5 shadow-2xs ${className}`}
    >
      {content}
    </div>
  );
};

export interface KpiGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  columns = 4,
  className = '',
  children,
  ...props
}) => {
  const colsClass =
    columns === 3
      ? 'grid grid-cols-2 md:grid-cols-3 gap-3'
      : columns === 2
      ? 'grid grid-cols-2 gap-3'
      : 'grid grid-cols-2 lg:grid-cols-4 gap-3';

  return (
    <div className={`${colsClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
