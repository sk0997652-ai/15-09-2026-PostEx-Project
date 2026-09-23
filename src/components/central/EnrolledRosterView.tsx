import React from 'react';
import {
  RefreshCw,
  UserCheck,
  FileCheck,
} from 'lucide-react';
import { PageHeader, Button, Card, Badge } from '../ui';

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
  // Deduplicate
  const uniqueEnrolledEmployees = React.useMemo(() => {
    const seen = new Set<string>();
    return enrolledEmployees.filter((emp) => {
      if (!emp?.id || seen.has(emp.id)) return false;
      seen.add(emp.id);
      return true;
    });
  }, [enrolledEmployees]);

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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Joining ID</th>
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4">Masked CNIC</th>
                <th className="py-3 px-4">Branch Hub</th>
                <th className="py-3 px-4">Enrolled Date</th>
                <th className="py-3 px-4 text-right">PDF Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading enrolled employees...</span>
                  </td>
                </tr>
              ) : uniqueEnrolledEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">No enrolled employees yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Approve applications in the review queue to enrol employees.
                    </p>
                  </td>
                </tr>
              ) : (
                uniqueEnrolledEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {emp.employee_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {emp.candidate?.joining_id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {emp.candidate?.full_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {emp.candidate?.masked_cnic}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {emp.candidate?.branch_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(emp.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenPdfDossier(emp)}
                        leftIcon={<FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      >
                        View Dossier Certificate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
