import type {
  BranchDocument,
  BranchApplicationSummary,
  BranchApplicationDetail,
  BranchMetrics,
  BranchCandidate,
} from '../../lib/branchManagerApi';

export type {
  BranchDocument,
  BranchApplicationSummary,
  BranchApplicationDetail,
  BranchMetrics,
  BranchCandidate,
};

export interface CorrectionFormState {
  isOpen: boolean;
  reason: string;
}

export function formatDocType(type: string): string {
  const map: Record<string, string> = {
    cnic_front: 'CNIC Front Copy',
    cnic_back: 'CNIC Back Copy',
    education: 'Highest Degree / Diploma',
    experience: 'Experience Letter',
    driving_license: 'Valid Driving License',
    utility_bill: 'Utility Bill (Address Proof)',
  };
  return map[type] || type.replace(/_/g, ' ').toUpperCase();
}
