import React, { useState } from 'react';
import { KeyRound, Check, Copy, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../ui';

interface PasswordRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
  email: string;
  password: string;
}

export function PasswordRevealModal({
  isOpen,
  onClose,
  staffName,
  email,
  password,
}: PasswordRevealModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="One-Time Credentials Generated"
      size="md"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-600">
          Provide these temporary credentials to <strong>{staffName}</strong>.
        </p>
      </div>

      <div className="mt-5 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Email Address</span>
          <div className="text-xs font-mono font-bold text-slate-800">{email}</div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Temporary Password</span>
          <div className="flex items-center justify-between mt-1 p-2.5 rounded-lg bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900">
            <span className="select-all tracking-wider">{password}</span>
            <Button
              id="zonal-copy-pwd-btn"
              variant="ghost"
              size="small"
              onClick={handleCopy}
              className="h-auto px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Mandatory Password Change:</strong> This password is valid only for the initial sign-in. The user will be prompted to choose a new password immediately upon login.
        </span>
      </div>

      <Button
        id="zonal-close-pwd-modal-btn"
        variant="primary"
        className="mt-5 w-full"
        onClick={onClose}
      >
        Done &amp; Dismiss
      </Button>
    </Modal>
  );
}
