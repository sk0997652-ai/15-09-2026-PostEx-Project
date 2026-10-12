import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
  /** When scroll="x", turns off mobile card stacking and uses native horizontal scrolling */
  scroll?: 'x' | 'auto' | 'none';
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', wrapperClassName = '', scroll, children, ...props }, ref) => {
    const isScrollX = scroll === 'x';

    return (
      <div
        className={`w-full overflow-x-auto border border-slate-200 rounded-[6px] bg-white shadow-xs ${wrapperClassName}`}
      >
        <table
          ref={ref}
          className={`w-full text-left border-collapse tabular-nums ${
            isScrollX ? '' : 'max-md:block'
          } ${className}`}
          data-scroll={scroll}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);
Table.displayName = 'Table';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  scroll?: 'x' | 'auto' | 'none';
}

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className = '', scroll, children, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`bg-slate-50 border-b border-slate-200 ${
          scroll === 'x' ? 'table-header-group' : 'hidden md:table-header-group'
        } ${className}`}
        {...props}
      >
        {children}
      </thead>
    );
  }
);
TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  scroll?: 'x' | 'auto' | 'none';
}

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className = '', scroll, children, ...props }, ref) => (
    <tbody
      ref={ref}
      className={`bg-white divide-y divide-slate-100 ${
        scroll === 'x'
          ? 'table-row-group'
          : 'max-md:block max-md:space-y-3 max-md:bg-transparent md:divide-y md:divide-slate-100'
      } ${className}`}
      {...props}
    >
      {children}
    </tbody>
  )
);
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  scroll?: 'x' | 'auto' | 'none';
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className = '', scroll, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={`hover:bg-slate-50/80 transition-colors duration-150 group ${
        scroll === 'x'
          ? 'table-row'
          : 'max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-2.5 max-md:p-3 max-md:rounded-[6px] max-md:border max-md:border-slate-200 max-md:bg-white max-md:shadow-xs'
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  )
);
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Hide this column on tablet (<1024px) to prevent cramped rows */
  hideOnTablet?: boolean;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className = '', hideOnTablet = false, children, ...props }, ref) => (
    <th
      ref={ref}
      className={`px-3 py-2 text-table-header font-semibold text-slate-500 whitespace-nowrap select-none bg-slate-50 ${
        hideOnTablet ? 'hidden lg:table-cell' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </th>
  )
);
TableHead.displayName = 'TableHead';

export type MobileCellRole = 'primary' | 'primaryFull' | 'status' | 'field' | 'actions' | 'hidden';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Key label shown above the value in the 2-column mobile card grid (<768px) */
  mobileLabel?: string;
  /** Controls placement in the mobile stacked card (<768px) */
  mobileRole?: MobileCellRole;
  /** Hide this column on tablet (<1024px) and mobile unless mobileRole is explicitly set */
  hideOnTablet?: boolean;
  /** Hide this cell on mobile stacked cards (<768px) */
  hideOnMobile?: boolean;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  (
    {
      className = '',
      mobileLabel,
      mobileRole,
      hideOnTablet = false,
      hideOnMobile = false,
      colSpan,
      children,
      ...props
    },
    ref
  ) => {
    let responsiveClasses = '';

    if (colSpan && colSpan > 1) {
      responsiveClasses = 'max-md:col-span-2 max-md:block';
    } else if (hideOnMobile || mobileRole === 'hidden') {
      responsiveClasses = hideOnTablet ? 'hidden lg:table-cell' : 'hidden md:table-cell';
    } else if (hideOnTablet && !mobileRole && !mobileLabel) {
      responsiveClasses = 'hidden lg:table-cell';
    } else {
      const tabletVisibility = hideOnTablet ? 'md:hidden lg:table-cell' : '';
      switch (mobileRole) {
        case 'primary':
          responsiveClasses = `max-md:col-span-1 max-md:order-1 max-md:p-0 max-md:text-left ${tabletVisibility}`;
          break;
        case 'primaryFull':
          responsiveClasses = `max-md:col-span-2 max-md:order-1 max-md:p-0 max-md:pb-1.5 max-md:border-b max-md:border-slate-100 max-md:text-left ${tabletVisibility}`;
          break;
        case 'status':
          responsiveClasses = `max-md:col-span-1 max-md:order-2 max-md:flex max-md:justify-end max-md:items-start max-md:p-0 ${tabletVisibility}`;
          break;
        case 'actions':
          responsiveClasses = `max-md:col-span-2 max-md:order-4 max-md:pt-2 max-md:mt-0.5 max-md:border-t max-md:border-slate-100 max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-end max-md:gap-2 max-md:p-0 ${tabletVisibility}`;
          break;
        case 'field':
        default:
          responsiveClasses = `max-md:col-span-1 max-md:order-3 max-md:p-0 max-md:text-left ${tabletVisibility}`;
          break;
      }
    }

    return (
      <td
        ref={ref}
        colSpan={colSpan}
        className={`px-3 py-1.5 text-body text-slate-800 align-middle ${responsiveClasses} ${className}`}
        {...props}
      >
        {mobileLabel ? (
          <div className="max-md:space-y-0.5">
            <span className="block md:hidden text-table-header text-slate-400">
              {mobileLabel}
            </span>
            <div>{children}</div>
          </div>
        ) : (
          children
        )}
      </td>
    );
  }
);
TableCell.displayName = 'TableCell';

export interface TablePaginationProps {
  page?: number;
  currentPage?: number;
  totalPages: number;
  total?: number;
  totalItems?: number;
  onPageChange: (newPage: number) => void;
  className?: string;
  pageSize?: number;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  currentPage,
  totalPages,
  total,
  totalItems,
  onPageChange,
  className = '',
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) => {
  const effectivePage = page ?? currentPage ?? 1;
  const effectiveTotal = total ?? totalItems;
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, effectivePage), safeTotalPages);

  return (
    <div
      className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-[6px] flex flex-col sm:flex-row items-center justify-between gap-3 text-caption text-slate-500 select-none ${className}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span>
          Showing page <strong className="text-slate-900 font-semibold">{safePage}</strong> of{' '}
          <strong className="text-slate-900 font-semibold">{safeTotalPages}</strong>
          {typeof effectiveTotal === 'number' && (
            <>
              {' '}
              (<span className="font-semibold text-slate-900">{effectiveTotal}</span> total)
            </>
          )}
        </span>

        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-2 text-caption">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-0.5 bg-white border border-slate-200 rounded-[6px] text-slate-900 text-caption focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          Previous
        </Button>
        <span className="text-caption font-medium text-slate-600 px-2">
          {safePage} / {safeTotalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
