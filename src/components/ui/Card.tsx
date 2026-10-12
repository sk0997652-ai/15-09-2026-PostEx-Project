import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  action,
  footer,
  className = '',
  children,
  ...props
}) => {
  const hasHeader = title || description || action;

  return (
    <div
      className={`rounded-[6px] p-3 bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-150 ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-3 pb-2.5 border-b border-slate-100">
          <div className="min-w-0">
            {title && (
              typeof title === 'string' ? (
                <h3 className="text-card-heading text-slate-900">{title}</h3>
              ) : (
                title
              )
            )}
            {description && (
              typeof description === 'string' ? (
                <p className="text-caption text-slate-500 mt-0.5 max-w-3xl">{description}</p>
              ) : (
                description
              )
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-1.5">{action}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`flex items-start justify-between gap-2.5 mb-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-card-heading text-slate-900 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-caption text-slate-500 mt-0.5 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);
