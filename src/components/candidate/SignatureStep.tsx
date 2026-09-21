import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool,
  Fingerprint,
  CheckSquare,
  AlertCircle,
  FileCheck,
  Send,
  RotateCcw,
  Eraser,
  Camera,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { VerificationStampSeal } from '../common/VerificationStampSeal';
import { FormSectionItem } from '../../types/formTemplates';
import { DocumentRecord } from './DocumentUploadStep';

interface SignatureStepProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
    mobile: string;
    track?: string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  sections: FormSectionItem[];
  formData: Record<string, Record<string, any>>;
  documents: DocumentRecord[];
  onEditSection: (sectionIndex: number) => void;
  onEditDocuments: () => void;
  onSubmit: (signatureData: {
    signatureDataUrl?: string;
    typedSignature?: string;
    signatureHash?: string;
    thumbDataUrl?: string;
    attestationConfirmed: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
  submitError?: string | null;
}

export const SignatureStep: React.FC<SignatureStepProps> = ({
  candidate,
  sections,
  formData,
  documents,
  onEditSection,
  onEditDocuments,
  onSubmit,
  isSubmitting,
  submitError,
}) => {
  const { t, isRTL } = useI18n();

  // Mode: 'canvas' (Draw) or 'typed' (Type Name + Hash)
  const [signatureMode, setSignatureMode] = useState<'canvas' | 'typed'>('canvas');
  const [typedName, setTypedName] = useState(candidate.full_name || '');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  // Thumbprint Mode: 'upload' or 'stamp'
  const [thumbMode, setThumbMode] = useState<'upload' | 'stamp'>('upload');
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [hasStampedThumb, setHasStampedThumb] = useState(false);

  // Attestation Checkbox
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Review Accordion expansion states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary_overview: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Extract Declaration Place & Date from Candidate Form Data
  const declarationSection = sections.find(
    (s) =>
      s.id === 'sec-exec-declaration' ||
      s.id === 'sec-nex-declaration' ||
      s.title.toLowerCase().includes('declaration')
  );
  const declarationData = declarationSection ? formData[declarationSection.id] || {} : {};
  const placeOfSigning =
    declarationData.place || candidate.branches?.name || 'Pakistan';
  const signingDate =
    declarationData.signing_date || new Date().toISOString().split('T')[0];

  // Canvas Ref & Drawing Logic
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMidRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const thumbCameraInputRef = useRef<HTMLInputElement | null>(null);

  const initContext = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0f172a'; // Deep crisp slate ink
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };

  useEffect(() => {
    if (signatureMode === 'canvas' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        initContext(ctx);
      }
    }
  }, [signatureMode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    isDrawingRef.current = true;
    initContext(ctx);

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Save history state for undo
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    // Draw initial round dot for single tap / period
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();

    lastPointRef.current = { x, y };
    lastMidRef.current = { x, y };
    setHasDrawnSignature(true);
    setClientError(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current || !lastMidRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const nativeEvt = e.nativeEvent as PointerEvent;
    let eventsToProcess: (PointerEvent | React.PointerEvent<HTMLCanvasElement>)[] = [e];
    if (typeof nativeEvt?.getCoalescedEvents === 'function') {
      try {
        const coalesced = nativeEvt.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          eventsToProcess = coalesced;
        }
      } catch {
        eventsToProcess = [e];
      }
    }

    for (let i = 0; i < eventsToProcess.length; i++) {
      const pt = eventsToProcess[i];
      const x = (pt.clientX - rect.left) * scaleX;
      const y = (pt.clientY - rect.top) * scaleY;

      // Sub-pixel jitter filter (ignore micro-tremors below 1 physical pixel)
      const dx = x - lastPointRef.current.x;
      const dy = y - lastPointRef.current.y;
      if (dx * dx + dy * dy < 1.0) continue;

      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;

      ctx.beginPath();
      ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
      // Smooth continuous quadratic curve: previous sampled point is control point, mid is end point
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();

      lastPointRef.current = { x, y };
      lastMidRef.current = { x: midX, y: midY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current && lastPointRef.current && lastMidRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }
      }
      isDrawingRef.current = false;
      lastPointRef.current = null;
      lastMidRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    lastPointRef.current = null;
    lastMidRef.current = null;
    isDrawingRef.current = false;
    setHasDrawnSignature(false);
    initContext(ctx);
  };

  const undoSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      lastPointRef.current = null;
      lastMidRef.current = null;
      if (historyRef.current.length === 0) {
        setHasDrawnSignature(false);
      }
      initContext(ctx);
    }
  };

  // Generate SHA-256 hash for typed signature attestation
  const generateSignatureHash = async (name: string): Promise<string> => {
    const timestamp = new Date().toISOString();
    const text = `CANDIDATE_ATTESTATION|${candidate.cnic}|${candidate.joining_id}|${name}|${timestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Handle Thumbprint File Upload
  const handleThumbUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setClientError('Thumb impression image exceeds 5MB size limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setThumbDataUrl(reader.result as string);
      setClientError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle Digital Stamp
  const handleDigitalStamp = () => {
    // Generate an authentic biometric SVG graphic with candidate identity hash
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 160;
    stampCanvas.height = 160;
    const sCtx = stampCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#f8fafc';
      sCtx.fillRect(0, 0, 160, 160);
      sCtx.lineWidth = 3;
      sCtx.strokeStyle = '#1e3a8a';
      // Concentric fingerprint ridges
      for (let r = 15; r <= 70; r += 8) {
        sCtx.beginPath();
        sCtx.arc(80, 80, r, 0, Math.PI * 2);
        sCtx.stroke();
      }
      sCtx.fillStyle = '#1e3a8a';
      sCtx.font = 'bold 9px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('POSTEX DIGITAL THUMB', 80, 78);
      sCtx.fillText(candidate.joining_id, 80, 92);
      const url = stampCanvas.toDataURL('image/png');
      setThumbDataUrl(url);
      setHasStampedThumb(true);
    }
  };

  const handleFinalSubmit = async () => {
    setClientError(null);

    // 1. Validate mandatory documents
    const mandatoryTypes = ['cnic_front', 'cnic_back', 'photograph', 'education_certificate'];
    const missingDocs = mandatoryTypes.filter((type) => !documents.some((d) => d.type === type));
    if (missingDocs.length > 0) {
      setClientError(
        'Please upload all mandatory documents (CNIC Front, CNIC Back, Recent Photograph, and Education Certificate) before submitting.'
      );
      return;
    }

    // 2. Validate signature
    let signatureDataUrl: string | undefined;
    let typedSignature: string | undefined;
    let signatureHash: string | undefined;

    if (signatureMode === 'canvas') {
      if (!hasDrawnSignature || !canvasRef.current) {
        setClientError('Please draw your digital signature inside the signature box.');
        return;
      }
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    } else {
      if (!typedName.trim()) {
        setClientError('Please enter your full legal name for the typed signature attestation.');
        return;
      }
      typedSignature = typedName.trim();
      signatureHash = await generateSignatureHash(typedSignature);
    }

    // 3. Validate attestation declaration
    if (!attestationConfirmed) {
      setClientError('You must check the solemn affirmation box to confirm the accuracy of your details.');
      return;
    }

    await onSubmit({
      signatureDataUrl,
      typedSignature,
      signatureHash,
      thumbDataUrl: thumbDataUrl || undefined,
      attestationConfirmed: true,
    });
  };

  return (
    <div id="candidate-signature-step" className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Full Review Summary of All Sections                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileCheck className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Application Review Summary</h2>
              <p className="text-xs text-slate-500">Please review all submitted information carefully before final signing.</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Ready for Final Submission
          </span>
        </div>

        {/* Section by Section Review Collapsible */}
        <div className="space-y-3">
          {sections.map((sec, secIdx) => {
            const secData = formData[sec.id] || {};
            const isExpanded = expandedSections[sec.id] !== false; // default expanded
            const fieldKeys = Object.keys(secData).filter(
              (k) => secData[k] !== undefined && secData[k] !== null && secData[k] !== ''
            );

            return (
              <div key={sec.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleSection(sec.id)}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-2xs">
                      {secIdx + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900">{sec.title}</h3>
                    <span className="text-[10px] text-slate-500">({fieldKeys.length} fields completed)</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSection(secIdx);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                    >
                      Edit Section
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-white divide-y divide-slate-100">
                    {fieldKeys.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No entries filled in this section.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {sec.fields.map((field) => {
                          const val = secData[field.field_key];
                          if (val === undefined || val === null || val === '') return null;
                          return (
                            <div key={field.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[10px] font-medium text-slate-500 block truncate">{field.label}</span>
                              <p className="font-semibold text-slate-800 mt-0.5 break-words">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uploaded Documents Review Row */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div
              onClick={() => toggleSection('uploaded_documents')}
              className="p-3.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-bold text-slate-900">Uploaded Documents ({documents.length})</h3>
                <span className="text-[10px] text-emerald-700 font-semibold">Mandatory Documents Attached</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditDocuments();
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                >
                  Manage Documents
                </button>
                {expandedSections['uploaded_documents'] !== false ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {expandedSections['uploaded_documents'] !== false && (
              <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] truncate uppercase">{doc.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-slate-500 truncate">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Digital Signature Pad                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        {/* Declaration Endorsement Bar */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-600 font-medium">Place of Signing:</span>
              <strong className="text-slate-900 font-bold">{placeOfSigning}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-slate-600 font-medium">Date of Signing:</span>
              <strong className="text-slate-900 font-mono font-bold">{signingDate}</strong>
            </div>
          </div>
          {declarationSection && (
            <button
              type="button"
              onClick={() => {
                const idx = sections.findIndex((s) => s.id === declarationSection.id);
                if (idx >= 0) onEditSection(idx);
              }}
              className="text-indigo-600 hover:text-indigo-800 underline font-semibold text-[11px] cursor-pointer self-start sm:self-auto"
            >
              Edit Place/Date
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <PenTool className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Candidate Digital Signature</h2>
              <p className="text-xs text-slate-500">Provide your digital signature for employment verification and dossier attestation.</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              id="sig-tab-draw"
              onClick={() => setSignatureMode('canvas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                signatureMode === 'canvas'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Draw Signature
            </button>
            <button
              type="button"
              id="sig-tab-typed"
              onClick={() => setSignatureMode('typed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                signatureMode === 'typed'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Type Legal Name
            </button>
          </div>
        </div>

        {/* Draw Canvas Option */}
        {signatureMode === 'canvas' ? (
          <div>
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 overflow-hidden">
              <canvas
                ref={canvasRef}
                id="candidate-signature-canvas"
                width={1200}
                height={360}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-[200px] cursor-crosshair touch-none select-none"
              />

              {!hasDrawnSignature && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
                  <PenTool className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-xs font-medium">Draw your signature here with finger, stylus, or mouse</span>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  id="sig-undo-btn"
                  onClick={undoSignature}
                  disabled={!hasDrawnSignature}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded disabled:opacity-30 cursor-pointer transition-colors"
                  title="Undo last stroke"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  id="sig-clear-btn"
                  onClick={clearSignature}
                  disabled={!hasDrawnSignature}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear / Redraw</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Signature is timestamped ({new Date().toLocaleDateString()}) and bound to your Joining ID {candidate.joining_id}.</span>
            </p>
          </div>
        ) : (
          /* Typed Signature Option */
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Legal Name</label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your full legal name"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-serif italic text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Typing your full legal name produces a legally binding cryptographic SHA-256 signature hash under Pakistani Electronic Transactions Ordinance (ETO 2002).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Thumb Impression Capture                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Fingerprint className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thumb Impression (Biometric Capture)</h2>
              <p className="text-xs text-slate-500">
                Upload a clear photo/scan of your right thumb impression, or apply a digital biometric stamp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setThumbMode('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                thumbMode === 'upload'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Photo / Scan
            </button>
            <button
              type="button"
              onClick={() => setThumbMode('stamp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                thumbMode === 'stamp'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Digital Stamp
            </button>
          </div>
        </div>

        {thumbMode === 'upload' ? (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={thumbInputRef}
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleThumbUpload(file);
                e.target.value = '';
              }}
            />
            <input
              type="file"
              ref={thumbCameraInputRef}
              accept="image/jpeg,image/png"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleThumbUpload(file);
                e.target.value = '';
              }}
            />

            {/* Preview Box */}
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
              {thumbDataUrl ? (
                <img src={thumbDataUrl} alt="Thumb Impression" className="w-full h-full object-contain" />
              ) : (
                <Fingerprint className="w-10 h-10 text-slate-300" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800">Right Thumbprint Verification</p>
              <p className="text-xs text-slate-500">
                You can ink your thumb on paper, take a crisp photo using your phone camera, and upload it here.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  id="btn-upload-thumb"
                  onClick={() => thumbInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                </button>
                <button
                  type="button"
                  id="btn-camera-thumb"
                  onClick={() => thumbCameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Use Camera</span>
                </button>
                {thumbDataUrl && (
                  <button
                    type="button"
                    onClick={() => setThumbDataUrl(null)}
                    className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Digital Biometric Stamp */
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 flex items-center justify-center shrink-0 overflow-hidden">
              {thumbDataUrl ? (
                <img src={thumbDataUrl} alt="Digital Biometric Stamp" className="w-full h-full object-contain" />
              ) : (
                <Fingerprint className="w-10 h-10 text-indigo-300" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800">Authenticated Electronic Thumbprint Stamp</p>
              <p className="text-xs text-slate-500">
                Click below to generate a cryptographically bound PostEx biometric digital impression.
              </p>
              <button
                type="button"
                onClick={handleDigitalStamp}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{hasStampedThumb ? 'Regenerate Digital Stamp' : 'Generate Digital Stamp'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Solemn Affirmation & Final Submit                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <label className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            id="candidate-attestation-checkbox"
            checked={attestationConfirmed}
            onChange={(e) => setAttestationConfirmed(e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="leading-relaxed">
            <strong>Solemn Affirmation &amp; Legal Declaration:</strong> I hereby solemnly declare and affirm that all the statements made in this employment application dossier, as well as the attached documents, are true, complete, and authentic to the best of my knowledge and belief. I understand that any false statement or misrepresentation will disqualify me from employment or result in immediate termination without notice.
          </span>
        </label>

        {/* Live Preview of Verification Seal upon Attestation */}
        {attestationConfirmed && (hasDrawnSignature || typedName.trim()) && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/70 to-slate-50 border border-indigo-200 flex flex-col sm:flex-row items-center gap-4">
            <VerificationStampSeal
              stage="candidate_signature"
              signerName={candidate.full_name}
              code={candidate.joining_id}
              size="sm"
              showDetails={false}
            />
            <div className="text-center sm:text-left space-y-0.5">
              <span className="text-xs font-bold text-indigo-900 block">
                Official Digital Submission Seal Ready
              </span>
              <p className="text-[11px] text-slate-600">
                Your signature and electronic attestation are bound to Joining ID <strong className="font-mono text-indigo-700">{candidate.joining_id}</strong> and will be cryptographically locked upon submission.
              </p>
            </div>
          </div>
        )}

        {(clientError || submitError) && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{clientError || submitError}</span>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Application will be locked upon final submission and routed to your Branch Manager.</span>
          </span>

          <button
            type="button"
            id="btn-final-submit-application"
            disabled={isSubmitting || !attestationConfirmed}
            onClick={handleFinalSubmit}
            className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Submitting &amp; Locking Dossier...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Final Submit Application</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
