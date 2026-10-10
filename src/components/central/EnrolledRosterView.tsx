import React from 'react';
import { UserCheck } from 'lucide-react';
import { PageHeader, Badge } from '../ui';
import { EmployeesTableView } from '../common/EmployeesTableView';

export interface EnrolledRosterViewProps {
  enrolledEmployees?: any[];
  loading?: boolean;
  zoneName?: string;
  onRefresh?: () => void;
  onOpenPdfDossier?: (emp: any) => void;
  role?: 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';
  actorName?: string;
}

export function EnrolledRosterView({
  zoneName = 'Assigned Zone',
  role = 'central_hr',
  actorName = 'Central HR',
}: EnrolledRosterViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrolled Employees Roster"
        description={`Official personnel directory and active headcount registry for ${zoneName}.`}
        meta={
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              <UserCheck className="w-3 h-3 mr-1" />
              <span>Corporate Roster</span>
            </Badge>
            <Badge variant="neutral" size="sm">
              <span>{zoneName}</span>
            </Badge>
          </div>
        }
      />

      <EmployeesTableView
        role={role}
        actorName={actorName}
      />
    </div>
  );
}
