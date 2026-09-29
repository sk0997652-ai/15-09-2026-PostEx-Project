import React from 'react';

export type BadgeVariant = 'primary' | 'sky' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'info',
  dot = false,
  size: _size,
  icon,
  className = '',
  children,
  ...props
}) => {
  let variantClasses = '';
  let dotClasses = '';

  switch (variant) {
    case 'primary':
      variantClasses = 'bg-indigo-50/90 text-indigo-700 border border-indigo-200/80';
      dotClasses = 'bg-indigo-600';
      break;
    case 'sky':
      variantClasses = 'bg-sky-50/90 text-sky-700 border border-sky-200/80';
      dotClasses = 'bg-sky-500';
      break;
    case 'success':
      variantClasses = 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80';
      dotClasses = 'bg-emerald-500';
      break;
    case 'warning':
      variantClasses = 'bg-amber-50/90 text-amber-700 border border-amber-200/80';
      dotClasses = 'bg-amber-500';
      break;
    case 'error':
      variantClasses = 'bg-rose-50/90 text-rose-700 border border-rose-200/80';
      dotClasses = 'bg-rose-500';
      break;
    case 'outline':
    case 'neutral':
    case 'info':
    default:
      variantClasses = 'bg-slate-100/90 text-slate-700 border border-slate-200/80';
      dotClasses = 'bg-slate-400';
      break;
  }

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight inline-flex items-center gap-1.5 whitespace-nowrap select-none ${variantClasses} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses}`} />}
      {icon && <span className="shrink-0 inline-flex items-center">{icon}</span>}
      {children}
    </span>
  );
};
