import React from 'react';
import {
  Download,
  Printer,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui';

interface PdfDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDossierData: any;
}

export function PdfDossierModal({
  isOpen,
  onClose,
  pdfDossierData,
}: PdfDossierModalProps) {
  if (!isOpen || !pdfDossierData) return null;

  const employeeId =
    pdfDossierData.employee_id ||
    pdfDossierData.application?.employee?.employee_id ||
    'EMP-01';

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 text-slate-900 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              PX
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">PostEx Logistics (Pvt) Ltd.</h2>
              <p className="text-[11px] text-slate-500 font-semibold">
                Official Employee Onboarding Dossier Certificate
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/central/dossiers/${employeeId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
              download
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .PDF File</span>
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print View
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 bg-slate-50/70 rounded-xl border border-slate-200 space-y-5 text-xs">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400">Assigned Corporate ID</span>
              <div className="text-xl font-black font-mono text-emerald-700">
                {pdfDossierData.employee_id ||
                  pdfDossierData.application?.employee?.employee_id ||
                  'EMP-ENROLLED'}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400">Joining Reference</span>
              <div className="text-sm font-bold font-mono text-indigo-700">
                {pdfDossierData.candidate?.joining_id || 'N/A'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold">Employee Full Name</span>
              <p className="text-sm font-bold text-slate-900">{pdfDossierData.candidate?.full_name}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold">Pakistani CNIC</span>
              <p className="font-mono text-sm font-bold text-slate-900">
                {pdfDossierData.candidate?.masked_cnic || pdfDossierData.candidate?.cnic}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold">Assigned Branch / Hub</span>
              <p className="font-semibold text-slate-800">{pdfDossierData.candidate?.branch_name || 'Zone Hub'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold">Verification Status</span>
              <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified &amp; Approved</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Dossier Generation Timestamp: {new Date().toLocaleString()}</span>
            <span>Authorized Signatory: Central HR Department</span>
          </div>
        </div>
      </div>
    </div>
  );
}
