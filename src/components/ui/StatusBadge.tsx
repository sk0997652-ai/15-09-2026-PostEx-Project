import React from 'react';
import { Badge } from './Badge';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'bm_verification'
  | 'needs_correction'
  | 'hr_review'
  | 'approved'
  | 'rejected';

export type SemanticStatusColor = 'success' | 'warning' | 'error' | 'info';

export interface StatusMeta {
  color: SemanticStatusColor;
  label: string;
}

/**
 * SINGLE SOURCE OF TRUTH:
 * Maps every application status to exactly ONE of the 4 semantic colors (success/warning/error/info).
 */
export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, StatusMeta> = {
  draft: {
    color: 'info',
    label: 'Draft',
  },
  submitted: {
    color: 'info',
    label: 'Submitted',
  },
  bm_verification: {
    color: 'warning',
    label: 'BM Verification',
  },
  needs_correction: {
    color: 'warning',
    label: 'Needs Correction',
  },
  hr_review: {
    color: 'warning',
    label: 'HR Review',
  },
  approved: {
    color: 'success',
    label: 'Approved',
  },
  rejected: {
    color: 'error',
    label: 'Rejected',
  },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ApplicationStatus | string;
  customLabel?: string;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  customLabel,
  dot = true,
  className = '',
  ...props
}) => {
  const normalizedKey = (status || '').toLowerCase() as ApplicationStatus;
  const config = APPLICATION_STATUS_CONFIG[normalizedKey] || {
    color: 'info',
    label: status ? status.replace(/_/g, ' ') : 'Unknown',
  };

  return (
    <Badge
      variant={config.color}
      dot={dot}
      className={className}
      {...props}
    >
      {customLabel || config.label}
    </Badge>
  );
};
