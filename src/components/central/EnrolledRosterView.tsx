import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  UserCheck,
  FileCheck,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
} from '../ui';

interface EnrolledRosterViewProps {
  enrolledEmployees: any[];
  loading: boolean;
  zoneName: string;
  onRefresh: () => void;
  onOpenPdfDossier: (emp: any) => void;
}

export function EnrolledRosterView({
  enrolledEmployees,
  loading,
  zoneName,
  onRefresh,
  onOpenPdfDossier,
}: EnrolledRosterViewProps) {
  const [rosterSearch, setRosterSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [dossierStatusFilter, setDossierStatusFilter] = useState('');

  // Deduplicate
  const uniqueEnrolledEmployees = useMemo(() => {
    const seen = new Set<string>();
    return enrolledEmployees.filter((emp) => {
      if (!emp?.id || seen.has(emp.id)) return false;
      seen.add(emp.id);
      return true;
    });
  }, [enrolledEmployees]);

  const branchOptions = useMemo(() => {
    return Array.from(
      new Set(
        uniqueEnrolledEmployees
          .map((e) => e.candidate?.branch_name)
          .filter(Boolean) as string[]
      )
    );
  }, [uniqueEnrolledEmployees]);

  const filteredEmployees = useMemo(() => {
    return uniqueEnrolledEmployees.filter((emp) => {
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const matchesName = (emp.candidate?.full_name || '').toLowerCase().includes(q);
        const matchesEmpId = (emp.employee_id || '').toLowerCase().includes(q);
        const matchesJoiningId = (emp.candidate?.joining_id || '').toLowerCase().includes(q);
        const matchesCnic = (emp.candidate?.masked_cnic || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmpId && !matchesJoiningId && !matchesCnic) return false;
      }
      if (branchFilter && emp.candidate?.branch_name !== branchFilter) return false;
      if (dossierStatusFilter === 'enrolled' && !emp.employee_id) return false;
      return true;
    });
  }, [uniqueEnrolledEmployees, rosterSearch, branchFilter, dossierStatusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrolled Employee Directory"
        description={`Approved candidates in ${zoneName} with formal Employee IDs and generated PDF Dossiers.`}
        badge={<Badge variant="success">Corporate Enrolled Roster</Badge>}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Roster
          </Button>
        }
      />

      <TableToolbar
        searchInputId="enrolled-roster-search-input"
        searchValue={rosterSearch}
        onSearchChange={setRosterSearch}
        searchPlaceholder="Search by Employee ID, Joining ID, name, or CNIC..."
        filters={
          branchOptions.length > 0
            ? [
                {
                  id: 'enrolled-roster-branch-filter',
                  label: 'Filter by Branch',
                  value: branchFilter,
                  onChange: setBranchFilter,
                  options: [
                    { value: '', label: 'All Branches' },
                    ...branchOptions.map((b) => ({ value: b, label: b })),
                  ],
                },
              ]
            : []
        }
        statusPills={[
          { value: '', label: 'All Enrolled', variant: 'info', count: uniqueEnrolledEmployees.length },
          {
            value: 'enrolled',
            label: 'Active Employee ID',
            variant: 'success',
            count: uniqueEnrolledEmployees.filter((e) => Boolean(e.employee_id)).length,
          },
        ]}
        activeStatus={dossierStatusFilter}
        onStatusChange={setDossierStatusFilter}
        hasActiveFilters={Boolean(rosterSearch || branchFilter || dossierStatusFilter)}
        onReset={() => {
          setRosterSearch('');
          setBranchFilter('');
          setDossierStatusFilter('');
        }}
      />

      <Card className="overflow-hidden">
        <Table wrapperClassName="md:border-0 md:rounded-none md:shadow-none max-md:p-3">
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead hideOnTablet>Joining ID</TableHead>
              <TableHead>Candidate Name</TableHead>
              <TableHead>Masked CNIC</TableHead>
              <TableHead>Branch Hub</TableHead>
              <TableHead hideOnTablet>Enrolled Date</TableHead>
              <TableHead className="text-right">PDF Dossier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span>Loading enrolled employees...</span>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No enrolled employees found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {rosterSearch || branchFilter
                      ? 'No enrolled employees match the selected filters.'
                      : 'Approve applications in the review queue to enrol employees.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell
                    mobileRole="status"
                    className="font-mono font-bold text-emerald-700"
                  >
                    <StatusBadge status="enrolled" customLabel={emp.employee_id || 'Enrolled'} />
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Joining ID"
                    hideOnTablet
                    className="font-mono text-slate-600"
                  >
                    {emp.candidate?.joining_id}
                  </TableCell>
                  <TableCell mobileRole="primary" className="font-bold text-slate-900">
                    {emp.candidate?.full_name}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Masked CNIC"
                    className="font-mono text-slate-600"
                  >
                    {emp.candidate?.masked_cnic}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Branch Hub"
                    className="text-slate-700"
                  >
                    {emp.candidate?.branch_name}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Enrolled Date"
                    hideOnTablet
                    className="text-slate-500 text-[11px]"
                  >
                    {new Date(emp.enrolled_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell mobileRole="actions" className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenPdfDossier(emp)}
                      leftIcon={<FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    >
                      View Dossier Certificate
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
