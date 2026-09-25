import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  Eye,
  X,
  FileCheck,
  ShieldCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { uploadCandidateDocument, deleteCandidateDocument } from '../../lib/candidateApi';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Modal, PageHeader } from '../ui';

export interface DocumentRecord {
  id: string;
  type: string;
  storage_path: string;
  file_name?: string;
  file_size?: number;
  uploaded_at: string;
  verification_status?: string;
  preview_url?: string;
}

interface DocumentUploadStepProps {
  applicationId: string;
  existingDocuments: DocumentRecord[];
  onDocumentsUpdated: (updatedDocs: DocumentRecord[]) => void;
  isReadOnly?: boolean;
}

const DOCUMENT_SLOTS = [
  {
    type: 'cnic_front',
    title: 'CNIC (Front Side)',
    urduTitle: 'قومی شناختی کارڈ (سامنے کا رخ)',
    description: 'Clear photograph or scanned copy of the front side of your CNIC.',
    required: true,
    isMultiple: false,
    icon: 'id',
    acceptCamera: true,
  },
  {
    type: 'cnic_back',
    title: 'CNIC (Back Side)',
    urduTitle: 'قومی شناختی کارڈ (پیچھے کا رخ)',
    description: 'Clear photograph or scanned copy of the back side of your CNIC.',
    required: true,
    isMultiple: false,
    icon: 'id',
    acceptCamera: true,
  },
  {
    type: 'photograph',
    title: 'Recent Passport-Size Photograph',
    urduTitle: 'حالیہ پاسپورٹ سائز تصویر',
    description: 'Formal portrait photo with white or light blue background (mobile camera supported).',
    required: true,
    isMultiple: false,
    icon: 'camera',
    acceptCamera: true,
  },
  {
    type: 'education_certificate',
    title: 'Educational Certificate(s)',
    urduTitle: 'تعلیمی اسناد / ڈگری',
    description: 'Degree, intermediate, or matric certificate (you can upload multiple certificates).',
    required: true,
    isMultiple: true,
    icon: 'edu',
    acceptCamera: true,
  },
  {
    type: 'experience_letter',
    title: 'Experience Letter / Resume',
    urduTitle: 'تجربہ کا سرٹیفکیٹ یا سی وی',
    description: 'Prior employment service letter, clearance certificate, or updated CV.',
    required: false,
    isMultiple: false,
    icon: 'work',
    acceptCamera: false,
  },
  {
    type: 'other',
    title: 'Additional Supporting Documents',
    urduTitle: 'دیگر معاون دستاویزات',
    description: 'Any additional professional certificates, driver license, or utility bill.',
    required: false,
    isMultiple: true,
    icon: 'doc',
    acceptCamera: true,
  },
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

export const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  applicationId,
  existingDocuments,
  onDocumentsUpdated,
  isReadOnly = false,
}) => {
  const { t, isRTL } = useI18n();

  const [documents, setDocuments] = useState<DocumentRecord[]>(existingDocuments || []);
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, number>>({}); // slot -> progress %
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [previewModalDoc, setPreviewModalDoc] = useState<DocumentRecord | null>(null);

  // Hidden inputs for file selection vs camera capture
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `File exceeds maximum allowed size of 5MB (Selected file: ${sizeMB}MB).`;
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Invalid file format "${file.type || ext}". Only JPG, PNG, and PDF files are accepted.`;
    }
    return null;
  };

  const handleUpload = async (docType: string, file: File) => {
    // Clear slot error
    setErrorMessages((prev) => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });

    // Client-side pre-validation
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessages((prev) => ({ ...prev, [docType]: validationError }));
      return;
    }

    try {
      // Simulate progress indicator
      setUploadingSlots((prev) => ({ ...prev, [docType]: 25 }));
      const timer = setInterval(() => {
        setUploadingSlots((prev) => {
          const curr = prev[docType] || 25;
          if (curr < 85) return { ...prev, [docType]: curr + 20 };
          return prev;
        });
      }, 150);

      const res = await uploadCandidateDocument(file, docType);
      clearInterval(timer);

      if (!res.success || !res.document) {
        setUploadingSlots((prev) => {
          const next = { ...prev };
          delete next[docType];
          return next;
        });
        setErrorMessages((prev) => ({
          ...prev,
          [docType]: res.error || 'Server rejected the file. Please ensure it is a valid JPG, PNG, or PDF under 5MB.',
        }));
        return;
      }

      setUploadingSlots((prev) => ({ ...prev, [docType]: 100 }));

      setTimeout(() => {
        setUploadingSlots((prev) => {
          const next = { ...prev };
          delete next[docType];
          return next;
        });

        // Add newly uploaded document to state
        setDocuments((prev) => {
          const isMultiple = DOCUMENT_SLOTS.find((s) => s.type === docType)?.isMultiple;
          let updated: DocumentRecord[];
          if (isMultiple) {
            updated = [...prev, res.document];
          } else {
            // Replace existing single document of this type
            updated = [...prev.filter((d) => d.type !== docType), res.document];
          }
          onDocumentsUpdated(updated);
          return updated;
        });
      }, 400);
    } catch (err: unknown) {
      setUploadingSlots((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessages((prev) => ({ ...prev, [docType]: msg }));
    }
  };

  const handleDelete = async (docId: string, docType: string) => {
    if (isReadOnly) return;
    try {
      const res = await deleteCandidateDocument(docId);
      if (res.success) {
        setDocuments((prev) => {
          const updated = prev.filter((d) => d.id !== docId);
          onDocumentsUpdated(updated);
          return updated;
        });
      } else {
        setErrorMessages((prev) => ({ ...prev, [docType]: res.error || 'Failed to remove document.' }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessages((prev) => ({ ...prev, [docType]: msg }));
    }
  };

  // Calculate mandatory completion
  const mandatorySlots = DOCUMENT_SLOTS.filter((s) => s.required);
  const completedMandatoryCount = mandatorySlots.filter((slot) =>
    documents.some((d) => d.type === slot.type)
  ).length;
  const isAllMandatoryUploaded = completedMandatoryCount === mandatorySlots.length;

  return (
    <div id="candidate-document-upload-step" className="space-y-6">
      {/* Header & Status Summary */}
      <Card className="p-6">
        <PageHeader
          title="Upload Required Documents"
          description="Please upload clear photos or scanned copies. Max 5MB per document. Accepted formats: JPG, PNG, PDF."
          roleContext="Documentation Stage"
          actions={
            <div
              id="doc-upload-progress-card"
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 shrink-0 ${
                isAllMandatoryUploaded
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {isAllMandatoryUploaded ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div className="text-left">
                <span className="text-xs font-bold block">
                  {completedMandatoryCount} of {mandatorySlots.length} Mandatory Uploaded
                </span>
                <span className="text-[11px] opacity-80">
                  {isAllMandatoryUploaded ? 'Ready for Signature & Review' : 'Mandatory documents required to submit'}
                </span>
              </div>
            </div>
          }
        />
      </Card>

      {/* Slots List */}
      <div className="space-y-4">
        {DOCUMENT_SLOTS.map((slot) => {
          const slotDocs = documents.filter((d) => d.type === slot.type);
          const hasDoc = slotDocs.length > 0;
          const isUploading = uploadingSlots[slot.type] !== undefined;
          const uploadProgress = uploadingSlots[slot.type] || 0;
          const errorMessage = errorMessages[slot.type];

          return (
            <Card
              key={slot.type}
              id={`doc-slot-${slot.type}`}
              className={`transition-all p-5 ${
                hasDoc
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : slot.required
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left Slot Details */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      hasDoc
                        ? 'bg-emerald-100 text-emerald-700'
                        : slot.required
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {hasDoc ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{slot.title}</h3>
                      {slot.required ? (
                        <Badge variant="danger" size="sm" className="font-bold">
                          Mandatory
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm" className="font-medium text-slate-600">
                          Optional
                        </Badge>
                      )}
                      {slot.urduTitle && (
                        <span className="text-xs text-slate-500 font-urdu" dir="rtl">
                          ({slot.urduTitle})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{slot.description}</p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                {!isReadOnly && (
                  <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
                    {/* Hidden Standard File Input */}
                    <input
                      type="file"
                      ref={(el) => (fileInputRefs.current[slot.type] = el)}
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(slot.type, file);
                        e.target.value = '';
                      }}
                    />

                    {/* Hidden Camera Input */}
                    {slot.acceptCamera && (
                      <input
                        type="file"
                        ref={(el) => (cameraInputRefs.current[slot.type] = el)}
                        accept="image/jpeg,image/png"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(slot.type, file);
                          e.target.value = '';
                        }}
                      />
                    )}

                    {/* Choose File Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      id={`btn-upload-${slot.type}`}
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[slot.type]?.click()}
                      leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
                      className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                    >
                      {hasDoc && !slot.isMultiple ? 'Re-upload' : 'Select File'}
                    </Button>

                    {/* Camera Capture Button */}
                    {slot.acceptCamera && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        id={`btn-camera-${slot.type}`}
                        disabled={isUploading}
                        onClick={() => cameraInputRefs.current[slot.type]?.click()}
                        leftIcon={<Camera className="w-3.5 h-3.5 text-slate-600" />}
                        title="Capture using mobile camera"
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200"
                      >
                        <span className="hidden sm:inline">Camera</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              {isUploading && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Uploading &amp; Verifying Storage Constraints...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* List of Uploaded Documents in this slot */}
              {slotDocs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {slotDocs.map((doc, idx) => {
                    const isPdf = doc.storage_path?.toLowerCase().endsWith('.pdf');
                    const fileName = doc.file_name || doc.storage_path?.split('/').pop() || `${slot.title} (Uploaded)`;

                    return (
                      <div
                        key={doc.id || idx}
                        id={`uploaded-doc-${doc.id}`}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs group hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {doc.preview_url && !isPdf ? (
                              <img
                                src={doc.preview_url}
                                alt={slot.title}
                                className="w-full h-full object-cover"
                              />
                            ) : isPdf ? (
                              <FileText className="w-5 h-5 text-rose-500" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-indigo-500" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate" title={fileName}>
                              {fileName}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <Badge variant="outline" size="sm" className="font-mono text-[9px] py-0 px-1.5 uppercase">
                                {isPdf ? 'PDF' : 'IMAGE'}
                              </Badge>
                              <span>&bull;</span>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                                <ShieldCheck className="w-3 h-3" />
                                Verified
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Preview Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            onClick={() => setPreviewModalDoc(doc)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg h-auto"
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Delete Button */}
                          {!isReadOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="small"
                              onClick={() => handleDelete(doc.id, slot.type)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-auto"
                              title="Delete & Re-upload"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Document Preview Modal */}
      {previewModalDoc && (
        <Modal
          isOpen={!!previewModalDoc}
          onClose={() => setPreviewModalDoc(null)}
          title={DOCUMENT_SLOTS.find((s) => s.type === previewModalDoc.type)?.title || 'Document Preview'}
          description={previewModalDoc.storage_path}
          size="xl"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalDoc(null)}
            >
              Close Preview
            </Button>
          }
        >
          <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-center max-h-[70vh] overflow-auto">
            {previewModalDoc.preview_url ? (
              previewModalDoc.storage_path?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewModalDoc.preview_url}
                  className="w-full h-[450px] rounded-xl border border-slate-200"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={previewModalDoc.preview_url}
                  alt="Preview"
                  className="max-h-[450px] max-w-full rounded-xl object-contain shadow-xs border border-slate-200"
                />
              )
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Secure Document Artifact</p>
                <p className="text-[11px] text-slate-500 font-mono mt-1">{previewModalDoc.storage_path}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
