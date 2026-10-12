import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'small' | 'sm' | 'md' | 'medium' | 'lg' | 'large';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'default',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isSmall = size === 'small' || size === 'sm';
    const isLarge = size === 'large' || size === 'lg';
    // Sizing tokens per Design Spec v1:
    // Default: 28px high (desktop), sm: 24px high, lg: 32px high; mobile min-height 40px (min-h-[40px] sm:min-h-0)
    // text = body token (text-body), semi-bold (font-semibold), radius 6px (rounded-[6px])
    const sizeClasses =
      variant === 'link'
        ? 'text-caption font-semibold p-0 h-auto'
        : isSmall
        ? 'h-6 sm:h-6 min-h-[40px] sm:min-h-0 px-2.5 py-0.5 text-body font-semibold rounded-[6px]'
        : isLarge
        ? 'h-8 sm:h-8 min-h-[40px] sm:min-h-0 px-4 py-1.5 text-body font-semibold rounded-[6px]'
        : 'h-7 sm:h-7 min-h-[40px] sm:min-h-0 px-3 py-1 text-body font-semibold rounded-[6px]';

    // Color tokens
    let variantClasses = '';
    switch (variant) {
      case 'primary':
        variantClasses =
          'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 shadow-xs';
        break;
      case 'outline':
      case 'secondary':
        variantClasses =
          'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 shadow-xs';
        break;
      case 'success':
        variantClasses =
          'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 shadow-xs';
        break;
      case 'danger':
        variantClasses =
          'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 shadow-xs';
        break;
      case 'ghost':
        variantClasses =
          'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-600';
        break;
      case 'link':
        variantClasses =
          'bg-transparent text-indigo-600 hover:text-indigo-700 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-600';
        break;
    }

    const baseClasses =
      'inline-flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer select-none outline-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
