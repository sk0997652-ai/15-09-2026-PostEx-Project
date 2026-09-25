import React from 'react';
import { Modal, Button, Input, Select } from '../ui';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffData: {
    staffId: string;
    name: string;
    email: string;
    roleName: 'central_hr' | 'branch_manager';
    branchId: string;
    submitting: boolean;
  };
  setStaffData: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      staffId: string;
      name: string;
      email: string;
      roleName: 'central_hr' | 'branch_manager';
      branchId: string;
      submitting: boolean;
    }>
  >;
  zoneBranches: Array<{ id: string; name: string }>;
  onSubmit: (e: React.FormEvent) => void;
}

export function EditStaffModal({
  isOpen,
  onClose,
  staffData,
  setStaffData,
  zoneBranches,
  onSubmit,
}: EditStaffModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Zone Staff Member"
      description={staffData.email}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Input
            id="zonal-edit-staff-name"
            label="Full Name *"
            type="text"
            required
            value={staffData.name}
            onChange={(e) => setStaffData((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <Select
            id="zonal-edit-staff-role"
            label="Role Track *"
            value={staffData.roleName}
            onChange={(e) =>
              setStaffData((prev) => ({
                ...prev,
                roleName: e.target.value as 'central_hr' | 'branch_manager',
              }))
            }
            options={[
              { value: 'central_hr', label: 'Central HR (Reviewer)' },
              { value: 'branch_manager', label: 'Branch Manager (Verification)' },
            ]}
          />
        </div>

        <div>
          <Select
            id="zonal-edit-staff-branch"
            label={staffData.roleName === 'branch_manager' ? 'Branch Hub Assignment *' : 'Branch Hub Assignment (Optional)'}
            value={staffData.branchId}
            onChange={(e) => setStaffData((prev) => ({ ...prev, branchId: e.target.value }))}
            options={[
              ...(staffData.roleName === 'central_hr'
                ? [{ value: '', label: 'Zone-Wide HQ (No specific branch)' }]
                : []),
              ...zoneBranches.map((br) => ({ value: br.id, label: br.name })),
            ]}
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
            id="zonal-save-edit-staff-btn"
            type="submit"
            variant="primary"
            disabled={staffData.submitting}
            isLoading={staffData.submitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
