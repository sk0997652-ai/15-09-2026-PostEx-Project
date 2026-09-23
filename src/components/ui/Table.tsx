import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', wrapperClassName = '', children, ...props }, ref) => (
    <div className={`w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs ${wrapperClassName}`}>
      <table ref={ref} className={`w-full text-left border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => (
  <thead ref={ref} className={`bg-slate-50 border-b border-slate-200 ${className}`} {...props}>
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => (
  <tbody ref={ref} className={`divide-y divide-slate-100 bg-white ${className}`} {...props}>
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className = '', children, ...props }, ref) => (
  <tr
    ref={ref}
    className={`hover:bg-slate-50/70 transition-colors ${className}`}
    {...props}
  >
    {children}
  </tr>
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className = '', children, ...props }, ref) => (
  <th
    ref={ref}
    className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${className}`}
    {...props}
  >
    {children}
  </th>
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className = '', children, ...props }, ref) => (
  <td
    ref={ref}
    className={`px-4 py-3.5 text-sm font-normal text-slate-900 ${className}`}
    {...props}
  >
    {children}
  </td>
));
TableCell.displayName = 'TableCell';

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (newPage: number) => void;
  className?: string;
  pageSize?: number;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
  className = '',
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) => {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <div
      className={`px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500 select-none ${className}`}
    >
      <div className="flex items-center gap-4">
        <span>
          Showing page <strong className="text-slate-900 font-semibold">{safePage}</strong> of{' '}
          <strong className="text-slate-900 font-semibold">{safeTotalPages}</strong>
          {typeof total === 'number' && (
            <> (<span className="font-semibold text-slate-900">{total}</span> total)</>
          )}
        </span>

        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-2 text-xs">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
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
          size="small"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          Previous
        </Button>
        <span className="text-xs font-medium text-slate-600 px-2">
          {safePage} / {safeTotalPages}
        </span>
        <Button
          variant="secondary"
          size="small"
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
