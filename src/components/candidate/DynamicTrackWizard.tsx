import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  Clock,
  Plus,
  Trash2,
  HelpCircle,
  PenTool,
  UploadCloud,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { useI18n, LanguageSelector } from '../../lib/i18n';
import { useBranding } from '../../lib/branding';
import { formBuilderApi } from '../../lib/formBuilderApi';
import {
  CandidateTrack,
  FormFieldItem,
  FormSectionItem,
  FormTemplateItem,
} from '../../types/formTemplates';
import { autosaveStepData, submitCandidateApplication } from '../../lib/candidateApi';
import { DocumentUploadStep, DocumentRecord } from './DocumentUploadStep';
import { SignatureStep } from './SignatureStep';
import { SignaturePadInput } from './SignaturePadInput';
import { SubmissionConfirmationModal } from './SubmissionConfirmationModal';
import { Button, Card, Badge, Input, Textarea, Select, PageHeader } from '../ui';

interface DynamicTrackWizardProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
    mobile: string;
    track?: CandidateTrack | string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  initialApplication: any;
  onSubmitted: () => void;
  onViewStatusTracker: () => void;
}

export const DynamicTrackWizard: React.FC<DynamicTrackWizardProps> = ({
  candidate,
  initialApplication,
  onSubmitted,
  onViewStatusTracker,
}) => {
  const { t } = useI18n();
  const { branding } = useBranding();

  const track: CandidateTrack =
    candidate.track === 'non_executive' ? 'non_executive' : 'executive';

  const [template, setTemplate] = useState<FormTemplateItem | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Form Data by Section: { [sectionId: string]: { [fieldKey: string]: any } }
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});

  // Uploaded Documents
  const [documents, setDocuments] = useState<DocumentRecord[]>(
    initialApplication?.documents || []
  );

  // Submission Confirmation Modal
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [submittedAtTimestamp, setSubmittedAtTimestamp] = useState<string>('');

  // Autosave State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isNeedsCorrection = initialApplication?.status === 'needs_correction';
  const isLocked = initialApplication?.locked && !isNeedsCorrection;

  // Fetch Template & Restore Saved Application Data
  useEffect(() => {
    let isMounted = true;
    const loadForm = async () => {
      try {
        setLoadingTemplate(true);
        const tmpl = await formBuilderApi.getTemplate(track);
        if (!isMounted) return;
        setTemplate(tmpl);

        // Populate initial data from saved application steps or candidate info
        const restored: Record<string, Record<string, any>> = {};

        // Load saved application steps if any
        if (initialApplication?.application_steps) {
          for (const step of initialApplication.application_steps) {
            const stepNum = step.step_number;
            const section = tmpl.sections[stepNum - 1];
            if (section && step.data) {
              restored[section.id] = { ...step.data };
            }
          }
        }

        // Prepopulate basic candidate bio into Section 1 if empty
        if (tmpl.sections.length > 0) {
          const firstSection = tmpl.sections[0];
          restored[firstSection.id] = {
            full_name: candidate.full_name || '',
            cnic: candidate.cnic || '',
            mobile: candidate.mobile || '',
            contact_number: candidate.mobile || '',
            ...(restored[firstSection.id] || {}),
          };
        }

        // Prepopulate default signing date and place in declaration section if empty
        const declSec = tmpl.sections.find(
          (s) => s.id === 'sec-exec-declaration' || s.id === 'sec-nex-declaration' || s.title.toLowerCase().includes('declaration')
        );
        if (declSec) {
          const today = new Date().toISOString().split('T')[0];
          restored[declSec.id] = {
            signing_date: today,
            place: candidate.branches?.name || 'Lahore',
            ...(restored[declSec.id] || {}),
          };
        }

        setFormData(restored);

        // Restore documents if returned
        if (Array.isArray(initialApplication?.documents)) {
          setDocuments(initialApplication.documents);
        }

        // Resume at saved current_step if valid
        if (initialApplication?.current_step && initialApplication.current_step > 1) {
          const totalWizardSteps = tmpl.sections.length + 2;
          const savedIdx = Math.min(
            initialApplication.current_step - 1,
            totalWizardSteps - 1
          );
          setCurrentSectionIndex(savedIdx);
        }
      } catch (err) {
        console.error('Failed to load candidate track template:', err);
      } finally {
        if (isMounted) setLoadingTemplate(false);
      }
    };

    loadForm();
    return () => {
      isMounted = false;
    };
  }, [track, candidate, initialApplication]);

  // Debounced Autosave to Backend
  const triggerAutosave = useCallback(
    (sectionIndex: number, section: FormSectionItem, data: Record<string, any>) => {
      if (isLocked) return;
      setSaveStatus('saving');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const stepNum = sectionIndex + 1;
        const res = await autosaveStepData(stepNum, section.title, data);
        if (res.success) {
          setSaveStatus('saved');
          const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastSavedAt(time);
        } else {
          setSaveStatus('error');
        }
      }, 1000);
    },
    [isLocked]
  );

  // Field Value Change Handler
  const handleFieldChange = (section: FormSectionItem, fieldKey: string, value: any) => {
    if (isLocked) return;
    setFormData((prev) => {
      const sectionData = prev[section.id] || {};
      const updatedSection = { ...sectionData, [fieldKey]: value };
      const updatedAll = { ...prev, [section.id]: updatedSection };

      triggerAutosave(currentSectionIndex, section, updatedSection);
      return updatedAll;
    });

    // Clear validation error on change
    if (validationErrors[fieldKey]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  // Repeatable Table Row Handlers
  const handleAddTableRow = (section: FormSectionItem, field: FormFieldItem) => {
    if (isLocked) return;
    const currentRows = formData[section.id]?.[field.field_key] || [];
    const newRow: Record<string, string> = {};
    if (field.table_columns) {
      for (const col of field.table_columns) {
        newRow[col.key] = '';
      }
    }
    const updatedRows = [...currentRows, newRow];
    handleFieldChange(section, field.field_key, updatedRows);
  };

  const handleUpdateTableRow = (
    section: FormSectionItem,
    field: FormFieldItem,
    rowIndex: number,
    colKey: string,
    value: string
  ) => {
    if (isLocked) return;
    const currentRows = [...(formData[section.id]?.[field.field_key] || [])];
    if (!currentRows[rowIndex]) {
      currentRows[rowIndex] = {};
    }
    currentRows[rowIndex] = { ...currentRows[rowIndex], [colKey]: value };
    handleFieldChange(section, field.field_key, currentRows);
  };

  const handleDeleteTableRow = (
    section: FormSectionItem,
    field: FormFieldItem,
    rowIndex: number
  ) => {
    if (isLocked) return;
    const currentRows = [...(formData[section.id]?.[field.field_key] || [])];
    currentRows.splice(rowIndex, 1);
    handleFieldChange(section, field.field_key, currentRows);
  };

  // Section Validation
  const validateCurrentSection = (section: FormSectionItem): boolean => {
    const currentData = formData[section.id] || {};
    const errors: Record<string, string> = {};

    for (const field of section.fields) {
      if (field.is_required) {
        const val = currentData[field.field_key];
        if (val === undefined || val === null || val === '') {
          errors[field.field_key] = `${field.label} is required.`;
        } else if (Array.isArray(val) && val.length === 0) {
          errors[field.field_key] = `Please add at least one entry for ${field.label}.`;
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step calculations:
  // 0 .. (sections.length - 1) => Template Form Sections
  // sections.length => Document Upload Step
  // sections.length + 1 => Sign & Submit Step
  const formSectionsCount = template?.sections.length || 0;
  const docsStepIndex = formSectionsCount;
  const signStepIndex = formSectionsCount + 1;
  const totalWizardSteps = formSectionsCount + 2;

  const isCurrentDocsStep = currentSectionIndex === docsStepIndex;
  const isCurrentSignStep = currentSectionIndex === signStepIndex;
  const isCurrentFormSection = currentSectionIndex < formSectionsCount;

  // Navigation Handlers
  const handleNextSection = () => {
    if (!template) return;

    if (isCurrentFormSection) {
      const currentSection = template.sections[currentSectionIndex];
      if (!validateCurrentSection(currentSection)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (isCurrentDocsStep) {
      // Validate mandatory documents before going to Sign & Submit
      const mandatoryTypes = ['cnic_front', 'cnic_back', 'photograph', 'education_certificate'];
      const missing = mandatoryTypes.filter((t) => !documents.some((d) => d.type === t));
      if (missing.length > 0) {
        setSubmitError(
          'Please upload all mandatory documents (CNIC Front, CNIC Back, Recent Photograph, and Education Certificate) before proceeding to review.'
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setSubmitError(null);
      setCurrentSectionIndex(signStepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
      setSubmitError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Final Submit Application Callback
  const handleFinalSubmit = async (signaturePayload: {
    signatureDataUrl?: string;
    typedSignature?: string;
    signatureHash?: string;
    thumbDataUrl?: string;
    attestationConfirmed: boolean;
  }) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await submitCandidateApplication(signaturePayload);
      if (!res.success) {
        throw new Error(res.error || 'Failed to submit candidate onboarding application.');
      }

      setSubmittedAtTimestamp(res.submitted_at || new Date().toISOString());
      setShowConfirmationModal(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please check network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingTemplate || !template) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-sm font-bold text-slate-900">Loading Joining Dossier...</h3>
        <p className="text-xs text-slate-500 mt-1">
          Configuring {track === 'executive' ? 'Executive' : 'Non-Executive'} form fields &amp; validations...
        </p>
      </div>
    );
  }

  const currentSection = isCurrentFormSection ? template.sections[currentSectionIndex] : null;
  const currentSectionData = currentSection ? formData[currentSection.id] || {} : {};
  const progressPercent = Math.round(((currentSectionIndex + 1) / totalWizardSteps) * 100);

  return (
    <div id="dynamic-candidate-wizard" className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Needs Correction Attention Banner */}
      {isNeedsCorrection && (
        <div
          id="needs-correction-alert-banner"
          className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">Action Required: Correction Requested</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                  Resubmission Needed
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                Your application has been flagged for revisions. Please review the reviewer&apos;s remarks below, make the necessary corrections, and resubmit.
              </p>
              {initialApplication.decision_reason && (
                <div className="mt-2.5 p-3 rounded-xl bg-white/90 border border-amber-200 text-xs font-medium text-slate-800">
                  <span className="font-bold text-amber-900 block mb-0.5">Reviewer Remarks:</span>
                  <p>{initialApplication.decision_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner: Candidate Information & Track Indicator */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" size="sm" className="font-mono font-bold bg-indigo-50 text-indigo-800 border-indigo-200">
              {candidate.joining_id}
            </Badge>
            <Badge
              variant={track === 'executive' ? 'primary' : 'success'}
              size="sm"
              className="font-bold"
            >
              {track === 'executive' ? 'Executive Track Form' : 'Non-Executive Track Form'}
            </Badge>
            {isLocked && (
              <Badge variant="success" size="sm" className="font-bold">
                Submitted &amp; Locked
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-black text-slate-900">
            {candidate.full_name} &bull; Joining Dossier
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {branding.companyName} Official Joining &bull; {candidate.branches?.name || 'Assigned Branch'}
          </p>
        </div>

        {/* Action Controls & Autosave Status */}
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewStatusTracker}
            leftIcon={<Clock className="w-3.5 h-3.5 text-indigo-600" />}
          >
            View Status Tracker
          </Button>

          {!isLocked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border bg-slate-50 border-slate-200">
              {saveStatus === 'saving' && (
                <>
                  <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                  <span className="text-indigo-600 font-bold">{t('wizard.autosaving')}</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">
                    {t('wizard.savedAt')} {lastSavedAt}
                  </span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-700">{t('wizard.autosaveFailed')}</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">{t('wizard.allChangesSaved')}</span>
                </>
              )}
            </div>
          )}
          <LanguageSelector />
        </div>
      </Card>

      {/* Progress Bar & Step Navigation */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>
            Step {currentSectionIndex + 1} of {totalWizardSteps}:{' '}
            <strong className="text-indigo-700 font-bold">
              {isCurrentDocsStep
                ? 'Upload Documents'
                : isCurrentSignStep
                ? 'Review & Sign'
                : currentSection?.title}
            </strong>
          </span>
          <span className="text-indigo-600 font-mono font-bold">{progressPercent}% Completed</span>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Selector Horizontal Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {template.sections.map((sec, idx) => {
            const isCompleted = idx < currentSectionIndex;
            const isCurrent = idx === currentSectionIndex;

            return (
              <button
                key={sec.id}
                onClick={() => {
                  if (idx <= currentSectionIndex || (currentSection && validateCurrentSection(currentSection))) {
                    setCurrentSectionIndex(idx);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isCompleted
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-white text-indigo-700'
                      : isCompleted
                      ? 'bg-indigo-200 text-indigo-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span>{sec.title}</span>
              </button>
            );
          })}

          {/* Document Upload Tab */}
          <button
            onClick={() => setCurrentSectionIndex(docsStepIndex)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              isCurrentDocsStep
                ? 'bg-indigo-600 text-white shadow-xs'
                : currentSectionIndex > docsStepIndex
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Documents</span>
          </button>

          {/* Sign & Submit Tab */}
          <button
            onClick={() => setCurrentSectionIndex(signStepIndex)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              isCurrentSignStep
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Review &amp; Sign</span>
          </button>
        </div>
      </Card>

      {/* Validation or Submission Errors */}
      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{submitError}</span>
        </div>
      )}

      {/* STEP CONTENT ROUTING */}
      {isCurrentDocsStep ? (
        /* ------------------------------------------------------------- */
        /* DEDICATED DOCUMENT UPLOAD STEP                                */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          <DocumentUploadStep
            applicationId={initialApplication?.id || ''}
            existingDocuments={documents}
            onDocumentsUpdated={(updated) => setDocuments(updated)}
            isReadOnly={isLocked}
          />

          {/* Bottom Step Actions for Document Upload */}
          <Card className="p-5 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevSection}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous Section
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              id="wizard-docs-next-btn"
              onClick={handleNextSection}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next: Review &amp; Sign
            </Button>
          </Card>
        </div>
      ) : isCurrentSignStep ? (
        /* ------------------------------------------------------------- */
        /* DEDICATED REVIEW, SIGN & SUBMIT STEP                         */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          <SignatureStep
            candidate={candidate}
            sections={template.sections}
            formData={formData}
            documents={documents}
            onEditSection={(secIdx) => setCurrentSectionIndex(secIdx)}
            onEditDocuments={() => setCurrentSectionIndex(docsStepIndex)}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />

          {/* Bottom Back Button */}
          <Card className="p-5 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevSection}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Back to Documents
            </Button>
          </Card>
        </div>
      ) : currentSection ? (
        /* ------------------------------------------------------------- */
        /* DYNAMIC FORM SECTION                                          */
        /* ------------------------------------------------------------- */
        <Card
          id={`section-container-${currentSection.id}`}
          className="p-6 space-y-6"
        >
          {/* Section Header */}
          <PageHeader
            title={currentSection.title}
            description={currentSection.description}
            roleContext={
              currentSection.urdu_title
                ? `Section ${currentSectionIndex + 1} of ${totalWizardSteps} • ${currentSection.urdu_title}`
                : `Section ${currentSectionIndex + 1} of ${totalWizardSteps}`
            }
            className="mb-4 pb-4 border-b border-slate-100"
          />

          {/* Official Signing Notice for Declaration Section */}
          {(currentSection.id === 'sec-exec-declaration' ||
            currentSection.id === 'sec-nex-declaration' ||
            currentSection.title.toLowerCase().includes('declaration')) && (
            <div
              id="declaration-signing-notice"
              className="mb-5 p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-3"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-indigo-900 block mb-0.5">Official Digital Signature Notice</strong>
                <span>
                  Please confirm your signing location and date below. To ensure legal integrity, your official digital signature and biometric verification are executed on the final comprehensive <strong>Review &amp; Sign</strong> tab after attaching all mandatory documents.
                </span>
              </div>
            </div>
          )}

          {/* Section Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentSection.fields.map((field) => {
              const fieldValue = currentSectionData[field.field_key] ?? '';
              const fieldError = validationErrors[field.field_key];
              const isFullWidth =
                field.field_type === 'textarea' ||
                field.field_type === 'table' ||
                field.field_type === 'declaration' ||
                field.field_type === 'signature';

              return (
                <div
                  key={field.id}
                  id={`field-wrapper-${field.field_key}`}
                  className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1">
                      <span>{field.label}</span>
                      {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    {field.urdu_label && (
                      <span className="text-xs text-slate-400 font-urdu" dir="rtl">
                        {field.urdu_label}
                      </span>
                    )}
                  </div>

                  {field.help_text && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{field.help_text}</span>
                    </p>
                  )}

                  {/* 1. TEXT INPUT */}
                  {field.field_type === 'text' && (
                    <Input
                      type="text"
                      disabled={isLocked}
                      value={fieldValue}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.value)}
                    />
                  )}

                  {/* 2. NUMBER INPUT */}
                  {field.field_type === 'number' && (
                    <Input
                      type="number"
                      disabled={isLocked}
                      value={fieldValue}
                      placeholder={field.placeholder || '0'}
                      onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.value)}
                    />
                  )}

                  {/* 3. DATE INPUT */}
                  {field.field_type === 'date' && (
                    <Input
                      type="date"
                      disabled={isLocked}
                      value={fieldValue}
                      onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.value)}
                    />
                  )}

                  {/* 4. DROPDOWN */}
                  {field.field_type === 'dropdown' && (
                    <Select
                      disabled={isLocked}
                      value={fieldValue}
                      onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.value)}
                    >
                      <option value="">Select option...</option>
                      {field.options?.map((opt, oIdx) => (
                        <option key={oIdx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  )}

                  {/* 5. YES / NO TOGGLE WITH CONDITIONAL DETAILS */}
                  {field.field_type === 'yes_no' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 max-w-sm">
                        <label
                          className={`flex items-center justify-center gap-2 h-11 sm:h-12 px-4 rounded-lg border text-sm font-bold cursor-pointer transition-all shadow-xs ${
                            fieldValue === 'yes' || (typeof fieldValue === 'object' && fieldValue.answer === 'yes')
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            disabled={isLocked}
                            name={`radio-${field.field_key}`}
                            value="yes"
                            checked={
                              fieldValue === 'yes' ||
                              (typeof fieldValue === 'object' && fieldValue.answer === 'yes')
                            }
                            onChange={() => {
                              const prevDetails =
                                typeof fieldValue === 'object' ? fieldValue.details : '';
                              handleFieldChange(currentSection, field.field_key, {
                                answer: 'yes',
                                details: prevDetails,
                              });
                            }}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Yes</span>
                        </label>

                        <label
                          className={`flex items-center justify-center gap-2 h-11 sm:h-12 px-4 rounded-lg border text-sm font-bold cursor-pointer transition-all shadow-xs ${
                            fieldValue === 'no' || (typeof fieldValue === 'object' && fieldValue.answer === 'no')
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            disabled={isLocked}
                            name={`radio-${field.field_key}`}
                            value="no"
                            checked={
                              fieldValue === 'no' ||
                              (typeof fieldValue === 'object' && fieldValue.answer === 'no')
                            }
                            onChange={() => {
                              handleFieldChange(currentSection, field.field_key, {
                                answer: 'no',
                                details: '',
                              });
                            }}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>No</span>
                        </label>
                      </div>

                      {/* Conditional Details Textarea if "yes" */}
                      {(fieldValue === 'yes' ||
                        (typeof fieldValue === 'object' && fieldValue.answer === 'yes')) && (
                        <div className="pt-2 animate-in fade-in-50 duration-200">
                          <label className="text-xs font-semibold text-slate-600 block mb-1">
                            Please specify full particulars / details:
                          </label>
                          <Textarea
                            rows={3}
                            disabled={isLocked}
                            value={typeof fieldValue === 'object' ? fieldValue.details || '' : ''}
                            placeholder="Provide relevant details (names, nature, dates, or circumstances)..."
                            onChange={(e) => {
                              handleFieldChange(currentSection, field.field_key, {
                                answer: 'yes',
                                details: e.target.value,
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. TEXTAREA */}
                  {field.field_type === 'textarea' && (
                    <Textarea
                      rows={3}
                      disabled={isLocked}
                      value={fieldValue}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.value)}
                    />
                  )}

                  {/* 7. REPEATABLE TABLE (Dynamic Rows) */}
                  {field.field_type === 'table' && (
                    <div className="space-y-3 pt-2">
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                            <tr>
                              <th className="p-3 w-10 text-center">#</th>
                              {field.table_columns?.map((col) => (
                                <th key={col.key} className="p-3 font-bold">
                                  {col.label}
                                </th>
                              ))}
                              {!isLocked && <th className="p-3 w-12 text-center">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Array.isArray(fieldValue) && fieldValue.length > 0 ? (
                              fieldValue.map((row: any, rIdx: number) => (
                                <tr key={rIdx} className="hover:bg-slate-50/50">
                                  <td className="p-3 text-center text-slate-400 font-mono text-xs">
                                    {rIdx + 1}
                                  </td>
                                  {field.table_columns?.map((col) => (
                                    <td key={col.key} className="p-2.5">
                                      <Input
                                        disabled={isLocked}
                                        value={row[col.key] || ''}
                                        placeholder={`Enter ${col.label.toLowerCase()}`}
                                        onChange={(e) =>
                                          handleUpdateTableRow(
                                            currentSection,
                                            field,
                                            rIdx,
                                            col.key,
                                            e.target.value
                                          )
                                        }
                                        className="h-10 text-sm"
                                      />
                                    </td>
                                  ))}
                                  {!isLocked && (
                                    <td className="p-2.5 text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteTableRow(currentSection, field, rIdx)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                        title="Delete row"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={(field.table_columns?.length || 1) + 2}
                                  className="p-4 text-center text-slate-400 italic text-xs"
                                >
                                  No records added yet. Click &quot;Add Record&quot; below to enter details.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {!isLocked && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddTableRow(currentSection, field)}
                          leftIcon={<Plus className="w-4 h-4" />}
                          className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                        >
                          Add Record
                        </Button>
                      )}
                    </div>
                  )}

                  {/* 8. LEGAL DECLARATION CHECKBOX */}
                  {field.field_type === 'declaration' && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-300 space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={fieldValue === true || fieldValue === 'true'}
                          onChange={(e) => handleFieldChange(currentSection, field.field_key, e.target.checked)}
                          className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-sm text-slate-800 leading-relaxed font-medium">
                          {field.help_text || field.label}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* 9. INTERACTIVE DIGITAL SIGNATURE PAD */}
                  {field.field_type === 'signature' && (
                    <div className="pt-1">
                      <SignaturePadInput
                        id={`field-sig-${field.field_key}`}
                        disabled={isLocked}
                        value={fieldValue}
                        candidateName={candidate.full_name}
                        signingId={candidate.joining_id}
                        onChange={(val) => handleFieldChange(currentSection, field.field_key, val)}
                      />
                    </div>
                  )}

                  {/* Field Level Error Message */}
                  {fieldError && (
                    <p className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldError}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons for Dynamic Form Section */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={currentSectionIndex === 0}
              onClick={handlePrevSection}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous Section
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              id="wizard-next-section-btn"
              onClick={handleNextSection}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next Section
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Submission Confirmation Modal */}
      {showConfirmationModal && (
        <SubmissionConfirmationModal
          candidate={candidate}
          submittedAt={submittedAtTimestamp}
          onProceedToTracker={() => {
            setShowConfirmationModal(false);
            onSubmitted();
          }}
        />
      )}
    </div>
  );
};
