import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      leftIcon,
      rightIcon,
      id,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const resolvedHint = hint ?? helperText;

    const borderFocusClasses = error
      ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-600'
      : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600';

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-body font-medium text-slate-900">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 [&>svg]:w-3.5 [&>svg]:h-3.5">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-7 sm:h-7 min-h-[40px] sm:min-h-0 px-2.5 py-1 text-field text-slate-900 bg-white border ${borderFocusClasses} rounded-[6px] shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-8' : ''
            } ${rightIcon ? 'pr-8' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400 [&>svg]:w-3.5 [&>svg]:h-3.5">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-caption font-medium text-rose-600">{error}</p>
        ) : resolvedHint ? (
          <p className="text-caption text-slate-500">{resolvedHint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
