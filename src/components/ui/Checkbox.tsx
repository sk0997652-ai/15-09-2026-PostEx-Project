import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, id, className = '', disabled, ...props }, ref) => {
    const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1">
        <label
          htmlFor={inputId}
          className={`flex items-start gap-3 select-none cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            disabled={disabled}
            className={`w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 transition-colors cursor-pointer disabled:cursor-not-allowed ${className}`}
            {...props}
          />
          {(label || description) && (
            <div className="flex-1 text-xs">
              {label && <span className="font-medium text-slate-800 leading-snug block">{label}</span>}
              {description && <span className="text-slate-500 text-[11px] block mt-0.5">{description}</span>}
            </div>
          )}
        </label>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
