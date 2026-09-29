import React, { useEffect, useRef } from 'react';
import { Search, FilterX, Calendar } from 'lucide-react';
import { BadgeVariant } from './Badge';
import { Button } from './Button';

export interface TableToolbarFilterOption {
  value: string;
  label: string;
}

export interface TableToolbarDropdownFilter {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: TableToolbarFilterOption[];
  className?: string;
}

export interface TableToolbarStatusPill {
  value: string;
  label: string;
  variant?: BadgeVariant;
  count?: number;
}

export interface TableToolbarDateRange {
  from: string;
  to: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  fromId?: string;
  toId?: string;
}

export interface TableToolbarProps {
  /** Search input value */
  searchValue?: string;
  /** Immediate search change callback (keeps controlled inputs in sync) */
  onSearchChange?: (value: string) => void;
  /** Optional debounced search callback (e.g., for server-side queries) */
  onDebouncedSearchChange?: (value: string) => void;
  /** Optional Enter/Form submit callback */
  onSearchSubmit?: () => void;
  /** Debounce delay in ms (default 250ms) */
  debounceMs?: number;
  searchPlaceholder?: string;
  searchInputId?: string;

  /** 1-2 configurable dropdown filters (role, zone, branch, category, etc.) */
  filters?: TableToolbarDropdownFilter[];

  /** Optional date range filter (e.g. for Audit Log) */
  dateRange?: TableToolbarDateRange;

  /** Horizontally scrollable status pill/chip buttons */
  statusPills?: TableToolbarStatusPill[];
  activeStatus?: string;
  onStatusChange?: (status: string) => void;
  /** Optional select ID to keep an accessible select synced for automated tests */
  statusSelectId?: string;

  /** Clear all active filters */
  hasActiveFilters?: boolean;
  onReset?: () => void;
  resetButtonId?: string;

  /** Optional trailing actions (e.g. Search button, count indicator) */
  actions?: React.ReactNode;
  className?: string;
}

const getInactivePillClasses = (variant: BadgeVariant = 'info'): string => {
  switch (variant) {
    case 'success':
      return 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100/80';
    case 'warning':
      return 'bg-amber-50/90 text-amber-700 border border-amber-200/80 hover:bg-amber-100/80';
    case 'error':
      return 'bg-rose-50/90 text-rose-700 border border-rose-200/80 hover:bg-rose-100/80';
    case 'primary':
      return 'bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100/80';
    case 'sky':
      return 'bg-sky-50/90 text-sky-700 border border-sky-200/80 hover:bg-sky-100/80';
    case 'info':
    case 'neutral':
    case 'outline':
    default:
      return 'bg-slate-100/90 text-slate-700 border border-slate-200/80 hover:bg-slate-200/70';
  }
};

const getInactiveDotClasses = (variant: BadgeVariant = 'info'): string => {
  switch (variant) {
    case 'success':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'error':
      return 'bg-rose-500';
    case 'primary':
      return 'bg-indigo-600';
    case 'sky':
      return 'bg-sky-500';
    case 'info':
    default:
      return 'bg-slate-400';
  }
};

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  onDebouncedSearchChange,
  onSearchSubmit,
  debounceMs = 250,
  searchPlaceholder = 'Search...',
  searchInputId,
  filters = [],
  dateRange,
  statusPills = [],
  activeStatus = '',
  onStatusChange,
  statusSelectId,
  hasActiveFilters = false,
  onReset,
  resetButtonId,
  actions,
  className = '',
}) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!onDebouncedSearchChange) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onDebouncedSearchChange(searchValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchValue, debounceMs]);

  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-xs space-y-3 ${className}`}
      data-testid="table-toolbar"
    >
      {/* Top Row: Search Input + Dropdown Filters + Date Range + Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id={searchInputId}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearchSubmit) {
                  e.preventDefault();
                  onSearchSubmit();
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3.5 text-[13px] text-slate-900 bg-slate-50/70 hover:bg-white focus:bg-white rounded-full border border-slate-200/90 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
            />
          </div>
        )}

        {/* Configurable Dropdown Filters */}
        {filters.map((f, idx) => (
          <div key={f.id || idx} className={`w-full sm:w-auto ${f.className || 'sm:min-w-[160px]'}`}>
            <select
              id={f.id}
              aria-label={f.label || 'Filter'}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="w-full h-9 px-3 text-xs font-medium text-slate-700 bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 cursor-pointer transition-colors"
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Optional Date Range Filter */}
        {dateRange && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex items-center flex-1 sm:flex-initial">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                id={dateRange.fromId || 'toolbar-date-from'}
                type="date"
                aria-label="From date"
                value={dateRange.from}
                onChange={(e) => dateRange.onFromChange(e.target.value)}
                className="w-full sm:w-36 h-9 pl-8 pr-2.5 text-xs font-medium text-slate-700 bg-white rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">to</span>
            <div className="relative flex items-center flex-1 sm:flex-initial">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                id={dateRange.toId || 'toolbar-date-to'}
                type="date"
                aria-label="To date"
                value={dateRange.to}
                onChange={(e) => dateRange.onToChange(e.target.value)}
                className="w-full sm:w-36 h-9 pl-8 pr-2.5 text-xs font-medium text-slate-700 bg-white rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
            </div>
          </div>
        )}

        {/* Synced hidden select if statusSelectId is passed for backwards test compatibility */}
        {statusSelectId && onStatusChange && statusPills.length > 0 && (
          <select
            id={statusSelectId}
            value={activeStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="sr-only"
            aria-label="Status Filter"
          >
            {statusPills.map((pill) => (
              <option key={pill.value} value={pill.value}>
                {pill.label}
              </option>
            ))}
          </select>
        )}

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}

        {hasActiveFilters && onReset && (
          <Button
            id={resetButtonId}
            type="button"
            variant="ghost"
            size="small"
            onClick={onReset}
            className="text-slate-500 hover:text-slate-900 shrink-0"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Clear</span>
          </Button>
        )}
      </div>

      {/* Bottom Row: Horizontally-scrollable Status Filter Pills */}
      {statusPills.length > 0 && onStatusChange && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 border-t border-slate-100"
          role="tablist"
          aria-label="Status filters"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1 shrink-0 select-none">
            Status:
          </span>
          {statusPills.map((pill) => {
            const isActive = activeStatus === pill.value;
            const variant = pill.variant || 'info';
            return (
              <button
                key={pill.value || 'all'}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`status-pill-${pill.value || 'all'}`}
                onClick={() => onStatusChange(pill.value)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-tight inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer select-none ${
                  isActive
                    ? 'bg-indigo-600 text-white border border-indigo-600 shadow-xs'
                    : getInactivePillClasses(variant)
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-white' : getInactiveDotClasses(variant)
                  }`}
                />
                <span>{pill.label}</span>
                {typeof pill.count === 'number' && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-black/5 text-current'
                    }`}
                  >
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
