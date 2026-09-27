import React from 'react';
import { Badge } from './Badge';

export interface PageHeaderProps {
  title: string;
  description?: string;
  roleContext?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string; onClick?: () => void }>;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  roleContext,
  badge,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`mb-7 pb-5 border-b border-slate-200/90 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2.5">
          <ol className="flex items-center gap-1.5 text-xs text-slate-500">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-slate-300">/</span>}
                {crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={idx === breadcrumbs.length - 1 ? 'font-medium text-slate-900' : ''}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-[21px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
              {title}
            </h1>
            {roleContext && (
              <Badge variant="primary" dot>
                {roleContext}
              </Badge>
            )}
            {badge}
          </div>
          {description && (
            <p className="text-xs sm:text-[13px] font-normal text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
