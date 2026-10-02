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
      : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-600';

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-body font-medium text-slate-900">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-10 px-4 py-2.5 text-body text-slate-900 bg-white border ${borderFocusClasses} rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
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
