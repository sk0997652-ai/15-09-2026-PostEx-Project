import React from 'react';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'info',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  let variantClasses = '';
  let dotClasses = '';

  switch (variant) {
    case 'primary':
      variantClasses = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      dotClasses = 'bg-indigo-600';
      break;
    case 'success':
      variantClasses = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      dotClasses = 'bg-emerald-600';
      break;
    case 'warning':
      variantClasses = 'bg-amber-50 text-amber-700 border border-amber-200';
      dotClasses = 'bg-amber-600';
      break;
    case 'error':
      variantClasses = 'bg-rose-50 text-rose-700 border border-rose-200';
      dotClasses = 'bg-rose-600';
      break;
    case 'info':
    default:
      variantClasses = 'bg-slate-100 text-slate-700 border border-slate-200';
      dotClasses = 'bg-slate-400';
      break;
  }

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap select-none ${variantClasses} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses}`} />}
      {children}
    </span>
  );
};
