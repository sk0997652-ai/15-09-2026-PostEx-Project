import React from 'react';
import { ZonalApplication, CentralHrStaffMember } from '../../lib/zonalHrApi';
import { Modal, Button, Select, Textarea } from '../ui';

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneDisplayName: string;
  application: ZonalApplication | null;
  targetHrId: string;
  setTargetHrId: (id: string) => void;
  reason: string;
  setReason: (reason: string) => void;
  centralHrList: CentralHrStaffMember[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ReassignModal({
  isOpen,
  onClose,
  zoneDisplayName,
  application,
  targetHrId,
  setTargetHrId,
  reason,
  setReason,
  centralHrList,
  submitting,
  onSubmit,
}: ReassignModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reassign Candidate Application"
      description={`Zone: ${zoneDisplayName}`}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs font-bold text-slate-900">
            {application?.candidate?.full_name}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            ID: {application?.candidate?.joining_id} &bull; Current:{' '}
            {application?.assigned_central_hr_name}
          </div>
        </div>

        <div>
          <Select
            id="zonal-reassign-target"
            label="Target Central HR Staff *"
            value={targetHrId}
            onChange={(e) => setTargetHrId(e.target.value)}
            required
            options={centralHrList.map((hr) => ({
              value: hr.id,
              label: `${hr.name} (${hr.email})`,
            }))}
          />
        </div>

        <div>
          <Textarea
            id="zonal-reassign-reason"
            label="Reassignment Reason / Note"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Workload balancing across Central HR team..."
          />
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
            id="zonal-submit-reassign-btn"
            type="submit"
            variant="primary"
            disabled={submitting}
            isLoading={submitting}
          >
            Confirm Reassignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
