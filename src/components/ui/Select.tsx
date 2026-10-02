import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { formatCodeName } from '../../lib/formatText';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  options?: SelectOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      options,
      searchable = false,
      searchPlaceholder = 'Search by code or name...',
      id,
      className = '',
      disabled,
      children,
      value,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const resolvedHint = hint ?? helperText;
    const [searchQuery, setSearchQuery] = useState('');

    const borderFocusClasses = error
      ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-600'
      : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-600';

    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredOptions = useMemo(() => {
      if (!options) return undefined;
      if (!searchable || !normalizedSearch) return options;
      return options.filter((opt) => {
        if (String(opt.value) === '' || String(opt.value) === String(value ?? '')) return true;
        return opt.label.toLowerCase().includes(normalizedSearch) || String(opt.value).toLowerCase().includes(normalizedSearch);
      });
    }, [options, searchable, normalizedSearch, value]);

    const filteredChildren = useMemo(() => {
      if (options || !searchable || !normalizedSearch) return children;
      return React.Children.toArray(children).filter((child) => {
        if (!React.isValidElement(child)) return true;
        const childProps = child.props as { value?: string | number; children?: React.ReactNode };
        const childVal = String(childProps.value ?? '');
        if (childVal === '' || childVal === String(value ?? '')) return true;
        const textContent =
          typeof childProps.children === 'string'
            ? childProps.children
            : Array.isArray(childProps.children)
            ? childProps.children.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('')
            : '';
        return textContent.toLowerCase().includes(normalizedSearch);
      });
    }, [children, options, searchable, normalizedSearch, value]);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-body font-medium text-slate-900">
            {label}
          </label>
        )}
        {searchable && !disabled && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full h-8 pl-8 pr-7 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            value={value}
            className={`w-full h-10 pl-4 pr-10 py-2.5 text-body text-slate-900 bg-white border ${borderFocusClasses} rounded-lg shadow-xs focus:outline-none focus:ring-2 transition-colors appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
            {...props}
          >
            {filteredOptions
              ? filteredOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : filteredChildren}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = 'Select';

export interface MasterDataSelectItem {
  id: string;
  name: string;
  code?: string | null;
  disabled?: boolean;
}

export interface MasterDataSelectProps extends Omit<SelectProps, 'options'> {
  items: MasterDataSelectItem[];
  placeholder?: string;
}

/**
 * Shared Master Data Dropdown component:
 * Always formats options as "CODE | NAME" (or "NAME" if legacy record has no code),
 * includes a "- Select -" default option, stores the UUID as the value,
 * and provides built-in search by code or name.
 */
export const MasterDataSelect = React.forwardRef<HTMLSelectElement, MasterDataSelectProps>(
  ({ items, placeholder = '- Select -', searchable = true, ...props }, ref) => {
    const options = useMemo<SelectOption[]>(() => {
      return [
        { value: '', label: placeholder },
        ...items.map((item) => ({
          value: item.id,
          label: formatCodeName(item.code, item.name),
          disabled: item.disabled,
        })),
      ];
    }, [items, placeholder]);

    return <Select ref={ref} searchable={searchable} options={options} {...props} />;
  }
);

MasterDataSelect.displayName = 'MasterDataSelect';
