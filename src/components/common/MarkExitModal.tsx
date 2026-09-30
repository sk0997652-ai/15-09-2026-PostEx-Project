import React, { useState, useEffect } from 'react';
import { AlertTriangle, LogOut, CheckCircle2 } from 'lucide-react';
import { Modal, Button, Input, Select } from '../ui';
import {
  ExitType,
  PortalEmployee,
  markEmployeeExit,
} from '../../lib/hrPortalStore';

export interface MarkExitModalProps {
  isOpen: boolean;
  employee: PortalEmployee | null;
  actorName: string;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const MarkExitModal: React.FC<MarkExitModalProps> = ({
  isOpen,
  employee,
  actorName,
  onClose,
  onSuccess,
}) => {
  const [exitType, setExitType] = useState<ExitType>('Resignation');
  const [lastWorkingDate, setLastWorkingDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setExitType('Resignation');
      setLastWorkingDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setNotes('');
      setConfirmStep(false);
      setError(null);
    }
  }, [isOpen, employee?.id]);

  if (!employee) return null;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!lastWorkingDate.trim()) {
      setError('Last working date is required.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason for exit is required.');
      return;
    }
    setConfirmStep(true);
  };

  const handleConfirmExit = () => {
    const res = markEmployeeExit({
      employeeId: employee.id,
      exitType,
      lastWorkingDate,
      reason: reason.trim(),
      notes: notes.trim(),
      actorName,
    });

    if (!res.success) {
      setError(res.error || 'Failed to initiate employee exit.');
      setConfirmStep(false);
      return;
    }

    if (onSuccess) {
      onSuccess(
        `Exit initiated for ${employee.fullName} (${employee.employeeCode}). Status is now "Exit In Progress", removed from Active headcount, and added to Workflow Tracker > Exits & ECF.`
      );
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={confirmStep ? 'Confirm Employee Exit' : `Mark Exit — ${employee.fullName}`}
      description={
        confirmStep
          ? 'Please confirm this exit lifecycle transition.'
          : `Employee Code: ${employee.employeeCode} • Branch: ${employee.branch} • Designation: ${employee.designation}`
      }
      size="small"
    >
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {!confirmStep ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4 text-xs" id="mark-exit-form">
          <Select
            id="mark-exit-type-select"
            label="Exit Type *"
            required
            value={exitType}
            onChange={(e) => setExitType(e.target.value as ExitType)}
          >
            <option value="Resignation">Resignation</option>
            <option value="Termination">Termination</option>
            <option value="Absconding">Absconding</option>
          </Select>

          <Input
            id="mark-exit-lwd-input"
            label="Last Working Date *"
            type="date"
            required
            value={lastWorkingDate}
            onChange={(e) => setLastWorkingDate(e.target.value)}
          />

          <Input
            id="mark-exit-reason-input"
            label="Reason *"
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Better opportunity, Relocation, Policy violation..."
          />

          <div className="space-y-1.5">
            <label
              htmlFor="mark-exit-notes-textarea"
              className="block text-xs font-semibold text-slate-700"
            >
              Notes
            </label>
            <textarea
              id="mark-exit-notes-textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional clearance instructions or handover notes..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              id="mark-exit-proceed-btn"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Review &amp; Confirm
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-xs" id="mark-exit-confirm-dialog">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Confirm Exit In Progress for {employee.fullName}?</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              • Status will change from <strong>Active</strong> to{' '}
              <strong>Exit In Progress</strong> (no hard delete).
              <br />• Employee will be immediately removed from <strong>Active headcount</strong>,
              updating fill-rate and open vacancy.
              <br />• A new record will be created in{' '}
              <strong>Workflow Tracker &gt; Exits &amp; ECF</strong> with all ECF checklist items set
              to Pending.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-slate-700">
            <div>
              <strong>Exit Type:</strong> {exitType}
            </div>
            <div>
              <strong>Last Working Date:</strong> {lastWorkingDate}
            </div>
            <div>
              <strong>Reason:</strong> {reason}
            </div>
            {notes && (
              <div>
                <strong>Notes:</strong> {notes}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmStep(false)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              id="mark-exit-confirm-submit-btn"
              onClick={handleConfirmExit}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm Mark Exit
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
