import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      id,
      className = '',
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const resolvedHint = hint ?? helperText;

    const borderFocusClasses = error
      ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-600'
      : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-600';

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-body font-medium text-slate-900">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          className={`w-full px-4 py-2.5 text-body text-slate-900 bg-white border ${borderFocusClasses} rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed resize-y ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-caption font-medium text-rose-600">{error}</p>
        ) : resolvedHint ? (
          <p className="text-caption text-slate-500">{resolvedHint}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
