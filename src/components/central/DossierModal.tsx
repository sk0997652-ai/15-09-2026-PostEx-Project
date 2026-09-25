import React from 'react';
import {
  FileText,
  Printer,
  X,
  RefreshCw,
  Shield,
  RotateCcw,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button, StatusBadge } from '../ui';
import { VerificationStampSeal } from '../common/VerificationStampSeal';

interface DossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossierLoading: boolean;
  dossierData: any;
  currentUserName: string;
  onOpenDecisionDialog: (action: 'approve_enrol' | 'return_correction' | 'reject') => void;
  onOpenPdfDossier: (data: any) => void;
}

export function DossierModal({
  isOpen,
  onClose,
  dossierLoading,
  dossierData,
  currentUserName,
  onOpenDecisionDialog,
  onOpenPdfDossier,
}: DossierModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Candidate Onboarding Dossier</span>
                {dossierData?.candidate?.joining_id && (
                  <span className="font-mono text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded border border-slate-700">
                    {dossierData.candidate.joining_id}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {dossierData?.candidate?.full_name} &bull; {dossierData?.candidate?.zone_name} &bull; {dossierData?.candidate?.branch_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dossierData?.application?.status === 'approved' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenPdfDossier(dossierData)}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print PDF Dossier
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={onClose}
              className="p-1.5 h-auto text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {dossierLoading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
              <p className="font-bold text-slate-700">Compiling candidate dossier...</p>
            </div>
          ) : !dossierData ? (
            <div className="py-12 text-center text-slate-500">Dossier not found.</div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  dossierData.application.status === 'approved'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : dossierData.application.status === 'rejected'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : dossierData.application.status === 'needs_correction'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                      Application Status:
                      <StatusBadge status={dossierData.application.status} />
                    </span>
                    {dossierData.application.decision_reason && (
                      <p className="text-xs mt-0.5">{dossierData.application.decision_reason}</p>
                    )}
                  </div>
                </div>
                {dossierData.application.employee?.employee_id && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-700">Employee ID</span>
                    <div className="text-sm font-mono font-bold text-emerald-900">
                      {dossierData.application.employee.employee_id}
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Stamp Seal for Approved Candidates */}
              {dossierData.application.status === 'approved' && (
                <div className="p-5 bg-gradient-to-r from-emerald-50/60 via-white to-indigo-50/40 rounded-2xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <div className="shrink-0">
                      <VerificationStampSeal
                        stage="central_approval"
                        signerName={currentUserName || 'Central HR Executive'}
                        code={dossierData.application.employee?.employee_id || `AUTH-${dossierData.application.id.slice(0, 8)}`}
                        timestamp={dossierData.application.updated_at || new Date().toISOString()}
                        size="md"
                        showDetails={false}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Corporate Certified
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        Formal Employment Enrolment Approved
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md">
                        Official Central HR digital seal attached. Candidate dossier locked and enrolled in central HR database.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenPdfDossier(dossierData)}
                    leftIcon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Print Official PDF Dossier
                  </Button>
                </div>
              )}

              {/* 1. Candidate Personal & Organizational Summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  1. Candidate Profile &amp; Contact Info
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Full Name</span>
                    <p className="font-bold text-slate-900">{dossierData.candidate.full_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">CNIC</span>
                    <p className="font-mono font-bold text-slate-900">{dossierData.candidate.masked_cnic}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Mobile</span>
                    <p className="font-mono text-slate-800">{dossierData.candidate.mobile}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Email</span>
                    <p className="text-slate-800 truncate">{dossierData.candidate.email || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Joining ID</span>
                    <p className="font-mono font-bold text-indigo-700">{dossierData.candidate.joining_id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Zone</span>
                    <p className="font-medium text-slate-800">{dossierData.candidate.zone_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Branch</span>
                    <p className="font-medium text-slate-800">{dossierData.candidate.branch_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">Registered At</span>
                    <p className="text-slate-600">{new Date(dossierData.candidate.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* 2. Uploaded Documents & Branch Manager Verification Remarks */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">
                    2. Uploaded Documents &amp; Verification Checks
                  </h4>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {dossierData.documents?.length || 0} Documents Uploaded
                  </span>
                </div>

                {dossierData.documents && dossierData.documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dossierData.documents.map((doc: any) => (
                      <div key={doc.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {doc.type.replace(/_/g, ' ')}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                            {doc.storage_path}
                          </p>
                          {doc.remark && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-1 rounded mt-1 italic">
                              "{doc.remark}"
                            </p>
                          )}
                        </div>
                        <StatusBadge status={doc.verification_status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                    No digital documents uploaded yet.
                  </div>
                )}
              </div>

              {/* 3. Branch Manager Remarks */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-700">
                  3. Branch Verification History
                </h4>
                {dossierData.verification_remarks && dossierData.verification_remarks.length > 0 ? (
                  <div className="space-y-2">
                    {dossierData.verification_remarks.map((r: any) => (
                      <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-semibold text-slate-800">
                            {r.staff_profiles?.name || 'Reviewer'} ({r.staff_profiles?.roles?.name || 'Staff'})
                          </span>
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 font-medium">{r.remark}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No in-person verification remarks recorded.</p>
                )}
              </div>

              {/* 4. HR Decision History */}
              {dossierData.decisions && dossierData.decisions.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">
                    4. Central HR Historical Decisions
                  </h4>
                  <div className="space-y-2">
                    {dossierData.decisions.map((dec: any) => (
                      <div key={dec.id} className="bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span
                            className={`font-bold uppercase ${
                              dec.decision === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {dec.decision}
                          </span>
                          <span className="text-slate-400">{new Date(dec.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700">{dec.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Decision Action Bar (Only if not decided yet or needs_correction) */}
        {dossierData && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-slate-500 text-xs">
              <span>Take formal action for </span>
              <strong className="text-slate-900">{dossierData.candidate.full_name}</strong>:
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                id="decision-return-correction-btn"
                variant="secondary"
                size="sm"
                onClick={() => onOpenDecisionDialog('return_correction')}
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
              >
                Return for Correction
              </Button>

              <Button
                id="decision-reject-btn"
                variant="danger"
                size="sm"
                onClick={() => onOpenDecisionDialog('reject')}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject
              </Button>

              <Button
                id="decision-approve-enrol-btn"
                variant="primary"
                size="sm"
                onClick={() => onOpenDecisionDialog('approve_enrol')}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Approve &amp; Enrol Employee
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
