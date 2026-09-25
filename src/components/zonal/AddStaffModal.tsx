import React from 'react';
import { Lock } from 'lucide-react';
import { Modal, Button, Input, Select } from '../ui';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneDisplayName: string;
  zoneBranches: Array<{ id: string; name: string }>;
  newStaffRole: 'central_hr' | 'branch_manager';
  setNewStaffRole: (role: 'central_hr' | 'branch_manager') => void;
  newStaffBranchId: string;
  setNewStaffBranchId: (id: string) => void;
  newStaffName: string;
  setNewStaffName: (name: string) => void;
  newStaffEmail: string;
  setNewStaffEmail: (email: string) => void;
  newStaffPhone: string;
  setNewStaffPhone: (phone: string) => void;
  creatingStaff: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddStaffModal({
  isOpen,
  onClose,
  zoneDisplayName,
  zoneBranches,
  newStaffRole,
  setNewStaffRole,
  newStaffBranchId,
  setNewStaffBranchId,
  newStaffName,
  setNewStaffName,
  newStaffEmail,
  setNewStaffEmail,
  newStaffPhone,
  setNewStaffPhone,
  creatingStaff,
  onSubmit,
}: AddStaffModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Zone Staff Account"
      description={`Scoped to ${zoneDisplayName}`}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Select
            id="zonal-new-staff-role"
            label="Role in Zone *"
            value={newStaffRole}
            onChange={(e) => setNewStaffRole(e.target.value as 'central_hr' | 'branch_manager')}
            options={[
              { value: 'central_hr', label: 'Central HR (Review & Dossier Approval)' },
              { value: 'branch_manager', label: 'Branch Manager (In-Person Verification)' },
            ]}
            helperText="* Zonal HR is authorized to provision Central HR and Branch Managers only."
          />
        </div>

        {newStaffRole === 'branch_manager' && (
          <div>
            <Select
              id="zonal-new-staff-branch"
              label={`Branch in ${zoneDisplayName} *`}
              value={newStaffBranchId}
              onChange={(e) => setNewStaffBranchId(e.target.value)}
              required
              options={zoneBranches.map((br) => ({ value: br.id, label: br.name }))}
            />
          </div>
        )}

        <div>
          <Input
            id="zonal-new-staff-name"
            label="Full Name *"
            type="text"
            required
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            placeholder="e.g. Usman Tariq"
          />
        </div>

        <div>
          <Input
            id="zonal-new-staff-email"
            label="Email Address *"
            type="email"
            required
            value={newStaffEmail}
            onChange={(e) => setNewStaffEmail(e.target.value)}
            placeholder="e.g. usman.tariq@postex.pk"
          />
        </div>

        <div>
          <Input
            id="zonal-new-staff-phone"
            label="Phone Number (Optional)"
            type="text"
            value={newStaffPhone}
            onChange={(e) => setNewStaffPhone(e.target.value)}
            placeholder="e.g. 03001234567"
          />
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
          <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <span>
            A random 14-character password meeting company policy will be generated. The user will be required to change it on their first login.
          </span>
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
            id="zonal-submit-create-staff-btn"
            type="submit"
            variant="primary"
            disabled={creatingStaff}
            isLoading={creatingStaff}
          >
            Generate Credentials
          </Button>
        </div>
      </form>
    </Modal>
  );
}
