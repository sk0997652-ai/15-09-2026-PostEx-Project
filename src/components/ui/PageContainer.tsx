// ==============================================================================
// PostEx HR Onboarding Portal — PageContainer (Step 14E)
// Standard page padding wrapper (16px / p-4 on all viewport sizes)
// ==============================================================================
import React from 'react';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Layout width constraint:
   * - "full" (default): 100% width, no max-width cap
   * - "form": centered with max-w-3xl for form-heavy screens
   */
  width?: 'full' | 'form';
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  width = 'full',
  className = '',
  ...rest
}) => {
  const widthClass = width === 'form' ? 'max-w-3xl mx-auto' : 'w-full';

  return (
    <div
      className={`p-4 ${widthClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};
