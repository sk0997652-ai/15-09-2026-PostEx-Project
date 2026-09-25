import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, Button, Textarea } from '../ui';

interface ReturnToCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnReason: string;
  setReturnReason: (reason: string) => void;
  onConfirm: () => void;
  actionLoading: boolean;
}

export function ReturnToCandidateModal({
  isOpen,
  onClose,
  returnReason,
  setReturnReason,
  onConfirm,
  actionLoading,
}: ReturnToCandidateModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Return Application to Candidate"
      description="Unlocks candidate portal to allow re-upload of flagged credentials."
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <RotateCcw className="w-5 h-5 text-rose-600 shrink-0" />
          <span>
            Candidate will be notified to review the flagged items and re-upload correct credentials.
          </span>
        </div>

        <div>
          <Textarea
            id="bm-return-reason"
            label="Correction Instructions *"
            required
            rows={4}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Clearly explain which document(s) need correction and how the candidate should fix them..."
            helperText="Provide specific and unambiguous guidance to prevent repeated rejections."
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
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={actionLoading || !returnReason.trim()}
            isLoading={actionLoading}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Confirm &amp; Return
          </Button>
        </div>
      </div>
    </Modal>
  );
}
