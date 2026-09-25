import React from 'react';
import {
  ChevronLeft,
  FileCheck,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  CheckCircle2,
  Stamp,
  Send,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { BranchApplicationDetail, BranchDocument, CorrectionFormState, formatDocType } from './types';
import { VerificationStampSeal } from '../common/VerificationStampSeal';
import { Card, Button, StatusBadge } from '../ui';

interface DocumentReviewWorkspaceViewProps {
  appDetail: BranchApplicationDetail | null;
  loading: boolean;
  actionLoading: boolean;
  currentUser: {
    branch_name?: string;
    name?: string;
  };
  onBack: () => void;
  correctionForms: Record<string, CorrectionFormState>;
  onOpenCorrectionForm: (docId: string) => void;
  onCloseCorrectionForm: (docId: string) => void;
  onReasonChange: (docId: string, reason: string) => void;
  onSubmitCorrection: (docId: string) => void;
  onVerifyDoc: (docId: string) => void;
  onSimulateResubmit: (docId: string) => void;
  onPreviewDoc: (doc: BranchDocument) => void;
  signerName: string;
  signatureConfirm: boolean;
  setSignatureConfirm: (val: boolean) => void;
  onApplySignature: () => void;
  onOpenReturnModal: () => void;
  onForwardToCentral: () => void;
}

export function DocumentReviewWorkspaceView({
  appDetail,
  loading,
  actionLoading,
  currentUser,
  onBack,
  correctionForms,
  onOpenCorrectionForm,
  onCloseCorrectionForm,
  onReasonChange,
  onSubmitCorrection,
  onVerifyDoc,
  onSimulateResubmit,
  onPreviewDoc,
  signerName,
  signatureConfirm,
  setSignatureConfirm,
  onApplySignature,
  onOpenReturnModal,
  onForwardToCentral,
}: DocumentReviewWorkspaceViewProps) {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Back to Application Queue
        </Button>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-600 font-medium">
            Retrieving candidate records and uploaded verification documents...
          </p>
        </Card>
      ) : appDetail ? (
        <div className="space-y-6">
          {/* 1. CANDIDATE PROFILE & VERIFICATION PROGRESS */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-xl shrink-0">
                  {appDetail.candidate?.full_name?.charAt(0) || 'C'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{appDetail.candidate?.full_name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {appDetail.candidate?.joining_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mobile: {appDetail.candidate?.mobile}
                  </p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    CNIC: {appDetail.candidate?.masked_cnic || 'N/A'} &bull; Branch:{' '}
                    <span className="font-semibold text-slate-800">{currentUser.branch_name}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto">
                <StatusBadge status={appDetail.status} size="md" />
                <span className="text-[11px] text-slate-500">
                  Application ID: <span className="font-mono text-slate-700">{appDetail.id.slice(0, 8)}...</span>
                </span>
              </div>
            </div>

            {/* Verification Progress Meter */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Verification Clearance Progress
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {appDetail.verifiedDocs} of {appDetail.totalDocs} Documents Cleared (
                  {appDetail.totalDocs > 0 ? Math.round((appDetail.verifiedDocs / appDetail.totalDocs) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    appDetail.verifiedDocs === appDetail.totalDocs && appDetail.totalDocs > 0
                      ? 'bg-emerald-500'
                      : 'bg-indigo-600'
                  }`}
                  style={{
                    width: `${appDetail.totalDocs > 0 ? (appDetail.verifiedDocs / appDetail.totalDocs) * 100 : 0}%`,
                  }}
                />
              </div>
              {appDetail.correctionDocs > 0 && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {appDetail.correctionDocs} document(s) flagged as requiring correction.
                </p>
              )}
            </div>

            {/* Prior Correction Notice (Resubmitted Candidate Journey) */}
            {appDetail.documents.some((d) => d.remark && d.verification_status !== 'correction_required') && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Resubmitted Candidate Application:</span> Candidate has uploaded revised
                  documents following previous correction instructions. Please re-inspect carefully.
                </div>
              </div>
            )}

            {/* Resubmission Alert if previous corrections existed */}
            {appDetail.decision_reason && (
              <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Previous Remarks / Correction Feedback:</span>
                  <p className="mt-0.5 text-slate-700">{appDetail.decision_reason}</p>
                </div>
              </div>
            )}
          </Card>

          {/* 2. DOCUMENT REVIEW LIST */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  Uploaded Credentials &amp; Verification Documents
                </h3>
                <p className="text-xs text-slate-500">
                  Physically and digitally cross-reference each document against original certificates.
                </p>
              </div>
            </div>

            {appDetail.documents.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-semibold">
                  No uploaded documents found for this candidate yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Documents will appear once candidate finishes Step 9 upload journey.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appDetail.documents.map((doc) => {
                  const form = correctionForms[doc.id];
                  const isVerified = doc.verification_status === 'verified';
                  const isCorrection = doc.verification_status === 'correction_required';

                  return (
                    <Card
                      key={doc.id}
                      className={`p-5 flex flex-col justify-between transition-all ${
                        isVerified
                          ? 'border-emerald-200 bg-emerald-50/10'
                          : isCorrection
                          ? 'border-rose-200 bg-rose-50/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-500" />
                            {formatDocType(doc.type)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isVerified
                                ? 'bg-emerald-100 text-emerald-800'
                                : isCorrection
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isVerified ? 'Verified' : isCorrection ? 'Needs Correction' : 'Pending Review'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 font-mono break-all">{doc.storage_path}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()} at{' '}
                          {new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Prior Remark Display */}
                        {doc.remark && (
                          <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                            <span className="font-bold">Correction Flag: </span>
                            {doc.remark}
                          </div>
                        )}

                        {/* Preview trigger */}
                        <div className="mt-3">
                          <Button
                            variant="link"
                            size="small"
                            onClick={() => onPreviewDoc(doc)}
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-0 h-auto"
                          >
                            Preview Document
                          </Button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        {form?.isOpen ? (
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-700">
                              Reason for Correction <span className="text-rose-600">* (Mandatory)</span>
                            </label>
                            <textarea
                              value={form.reason}
                              onChange={(e) => onReasonChange(doc.id, e.target.value)}
                              placeholder="Explain why this document is rejected/requires re-upload (e.g. Blurry scan, CNIC expired, name mismatch)..."
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              rows={2}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onCloseCorrectionForm(doc.id)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => onSubmitCorrection(doc.id)}
                                disabled={actionLoading || !form.reason.trim()}
                                isLoading={actionLoading}
                              >
                                Confirm Flag
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={isVerified ? 'primary' : 'secondary'}
                                onClick={() => onVerifyDoc(doc.id)}
                                disabled={actionLoading || isVerified}
                                leftIcon={<Check className="w-3.5 h-3.5" />}
                              >
                                {isVerified ? 'Verified' : 'Mark Verified'}
                              </Button>

                              <Button
                                size="sm"
                                variant={isCorrection ? 'danger' : 'secondary'}
                                onClick={() => onOpenCorrectionForm(doc.id)}
                                disabled={actionLoading}
                                leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                              >
                                {isCorrection ? 'Flagged' : 'Needs Correction'}
                              </Button>
                            </div>

                            {/* Test simulator button for resubmission */}
                            {isCorrection && (
                              <Button
                                variant="link"
                                size="small"
                                onClick={() => onSimulateResubmit(doc.id)}
                                title="Simulate candidate re-uploading this section"
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 underline p-0 h-auto"
                              >
                                Simulate Resubmit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. DIGITAL SIGNATURE PANEL */}
          <Card
            className={`p-6 transition-all ${
              appDetail.digitalSignature
                ? 'border-emerald-300 bg-emerald-50/20'
                : appDetail.allReviewed
                ? 'border-amber-300 bg-amber-50/20'
                : 'border-slate-200 opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    appDetail.digitalSignature ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                  }`}
                >
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Branch Manager Digital Signature
                    {appDetail.digitalSignature && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Officially Signed
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cryptographic attestation certifying that all presented credentials have been inspected and
                    verified at <span className="font-semibold text-slate-800">{currentUser.branch_name}</span>.
                  </p>
                </div>
              </div>
            </div>

            {appDetail.digitalSignature ? (
              <div className="mt-4 p-5 bg-white rounded-2xl border border-emerald-200 shadow-xs flex flex-col md:flex-row items-center md:items-start gap-5">
                <div className="shrink-0">
                  <VerificationStampSeal
                    stage="branch_signature"
                    signerName={appDetail.digitalSignature.signerName}
                    timestamp={appDetail.digitalSignature.signedAt}
                    code={appDetail.digitalSignature.signatureHash}
                    size="md"
                    showDetails={false}
                  />
                </div>
                <div className="space-y-2 flex-1 w-full text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-100">
                    <div>
                      <span className="font-semibold text-slate-500">Certifying Official: </span>
                      <span className="font-bold text-slate-900">{appDetail.digitalSignature.signerName}</span>
                      <span className="text-slate-500"> (Branch Manager)</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Signed At: </span>
                      <span className="font-mono text-slate-800">
                        {new Date(appDetail.digitalSignature.signedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      SHA-256 Signature Certificate Hash:
                    </span>
                    <code className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg block mt-1 break-all border border-emerald-200">
                      {appDetail.digitalSignature.signatureHash}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Credentials attested and cryptographic seal bound for Central HR formal review.</span>
                  </div>
                </div>
              </div>
            ) : appDetail.allReviewed ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="bm-sign-attest"
                    checked={signatureConfirm}
                    onChange={(e) => setSignatureConfirm(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="bm-sign-attest" className="text-xs text-slate-700 leading-snug cursor-pointer">
                    I, <span className="font-bold text-slate-900">{signerName}</span>, hereby certify under
                    corporate policy that all {appDetail.totalDocs} required documents have been reviewed for candidate{' '}
                    <span className="font-bold text-slate-900">{appDetail.candidate?.full_name}</span>.
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onApplySignature}
                    disabled={actionLoading || !signatureConfirm}
                    isLoading={actionLoading}
                    leftIcon={<Stamp className="w-4 h-4" />}
                  >
                    Apply Digital Signature
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Action Required: </span>
                Please mark all {appDetail.totalDocs} documents as Verified or Needs Correction above to enable the
                digital signature step.
              </div>
            )}
          </Card>

          {/* 4. ACTIONS BAR */}
          <Card className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-900">Application Dispatch</span>
              <p className="text-[11px] text-slate-500">
                {appDetail.digitalSignature
                  ? 'Digital signature applied. Ready to advance to Central HR review.'
                  : 'Complete digital signature above to forward to Central HR.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="md"
                onClick={onOpenReturnModal}
                disabled={actionLoading || appDetail.status === 'approved'}
                leftIcon={<RotateCcw className="w-4 h-4 text-rose-600" />}
                className="flex-1 sm:flex-none text-rose-700 hover:text-rose-800"
              >
                Return to Candidate
              </Button>

              <Button
                id="bm-forward-to-central-btn"
                variant="primary"
                size="md"
                onClick={onForwardToCentral}
                disabled={
                  actionLoading ||
                  !appDetail.digitalSignature ||
                  appDetail.status === 'hr_review' ||
                  appDetail.status === 'approved'
                }
                isLoading={actionLoading}
                leftIcon={<Send className="w-4 h-4" />}
                className="flex-1 sm:flex-none"
              >
                {appDetail.status === 'hr_review' ? 'Already Forwarded to Central HR' : 'Forward to Central HR'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
