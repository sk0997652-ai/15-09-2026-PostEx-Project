import React from 'react';
import { ZonalApplication } from '../../lib/zonalHrApi';
import { Modal, Button, Select, Textarea } from '../ui';

interface OverrideDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: ZonalApplication | null;
  decision: 'approved' | 'correction_needed' | 'rejected';
  setDecision: (decision: 'approved' | 'correction_needed' | 'rejected') => void;
  reason: string;
  setReason: (reason: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function OverrideDecisionModal({
  isOpen,
  onClose,
  application,
  decision,
  setDecision,
  reason,
  setReason,
  submitting,
  onSubmit,
}: OverrideDecisionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Zonal HR Override Decision"
      description={`Candidate: ${application?.candidate?.full_name}`}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Select
            id="zonal-override-decision"
            label="Override Decision *"
            value={decision}
            onChange={(e) =>
              setDecision(e.target.value as 'approved' | 'correction_needed' | 'rejected')
            }
            options={[
              { value: 'approved', label: 'Approve Application (Final Approval)' },
              { value: 'correction_needed', label: 'Return for Candidate Correction' },
              { value: 'rejected', label: 'Reject Application' },
            ]}
          />
        </div>

        <div>
          <Textarea
            id="zonal-override-reason"
            label="Mandatory Justification / Reason *"
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="State the justification for this Zonal HR override decision (logged into permanent audit trail)..."
          />
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
          This action is recorded in the permanent audit trail and overrides any pending reviewer stages.
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            id="zonal-submit-override-btn"
            type="submit"
            variant="primary"
            disabled={submitting}
            isLoading={submitting}
          >
            Execute Override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
