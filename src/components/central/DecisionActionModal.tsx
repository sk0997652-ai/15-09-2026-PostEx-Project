import React from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Button, Textarea, Input } from '../ui';

interface DecisionActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  decisionModal: {
    open: boolean;
    applicationId: string | null;
    candidateName: string;
    joiningId: string;
    action: 'approve_enrol' | 'return_correction' | 'reject' | null;
    reason: string;
    unlockedSections: string[];
  };
  setDecisionModal: React.Dispatch<
    React.SetStateAction<{
      open: boolean;
      applicationId: string | null;
      candidateName: string;
      joiningId: string;
      action: 'approve_enrol' | 'return_correction' | 'reject' | null;
      reason: string;
      unlockedSections: string[];
    }>
  >;
  toggleSection: (secId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function DecisionActionModal({
  isOpen,
  onClose,
  decisionModal,
  setDecisionModal,
  toggleSection,
  onSubmit,
  submitting,
}: DecisionActionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            {decisionModal.action === 'approve_enrol' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Approve &amp; Formally Enrol Candidate</span>
              </>
            )}
            {decisionModal.action === 'return_correction' && (
              <>
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <span>Return Application for Correction</span>
              </>
            )}
            {decisionModal.action === 'reject' && (
              <>
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Candidate Application</span>
              </>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onClose}
            className="p-1 h-auto text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-xs text-slate-600 space-y-3">
          <p>
            Candidate: <strong className="text-slate-900">{decisionModal.candidateName}</strong> (Joining ID:{' '}
            <span className="font-mono text-indigo-600">{decisionModal.joiningId}</span>)
          </p>

          {decisionModal.action === 'approve_enrol' && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 space-y-1">
              <p className="font-bold">On Confirmation:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Auto-generates Employee ID: <code className="font-mono">EMP-[BRANCH]-XXXXX</code></li>
                <li>Generates official PDF dossier record in storage</li>
                <li>Locks application against edits</li>
                <li>Dispatches enrollment SMS to candidate</li>
              </ul>
            </div>
          )}

          {decisionModal.action === 'return_correction' && (
            <div className="space-y-3">
              <div>
                <label className="block text-slate-900 font-bold mb-1.5">
                  Select Section(s) to Unlock for Candidate: <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { id: 'documents', label: 'Uploaded Documents' },
                    { id: 'personal_info', label: 'Personal Information' },
                    { id: 'education', label: 'Education History' },
                    { id: 'employment', label: 'Employment History' },
                    { id: 'emergency_contacts', label: 'Emergency Contacts' },
                  ].map((sec) => (
                    <label
                      key={sec.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                        decisionModal.unlockedSections.includes(sec.id)
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={decisionModal.unlockedSections.includes(sec.id)}
                        onChange={() => toggleSection(sec.id)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{sec.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Textarea
                  label="Correction Reason & Instructions *"
                  rows={3}
                  required
                  placeholder="e.g. Please re-upload clearer photograph of original CNIC Back side."
                  value={decisionModal.reason}
                  onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          )}

          {decisionModal.action === 'reject' && (
            <div>
              <Textarea
                label="Rejection Justification *"
                rows={3}
                required
                placeholder="e.g. Failed background verification check / unverified educational credentials."
                value={decisionModal.reason}
                onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                helperText="This candidate application will be locked and archived under the corporate Data Retention Policy."
              />
            </div>
          )}

          {decisionModal.action === 'approve_enrol' && (
            <div>
              <Input
                label="Approval Remarks (Optional)"
                type="text"
                placeholder="e.g. All documents verified in order. Enrolling for Hub operations."
                value={decisionModal.reason}
                onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            id="confirm-decision-submit-btn"
            variant={
              decisionModal.action === 'approve_enrol'
                ? 'primary'
                : decisionModal.action === 'return_correction'
                ? 'secondary'
                : 'danger'
            }
            size="sm"
            disabled={submitting}
            isLoading={submitting}
            onClick={onSubmit}
          >
            {submitting ? 'Recording Decision...' : 'Confirm Decision'}
          </Button>
        </div>
      </div>
    </div>
  );
}
