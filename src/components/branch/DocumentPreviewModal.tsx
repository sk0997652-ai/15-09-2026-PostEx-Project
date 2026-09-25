import React from 'react';
import { FileText, Shield, X } from 'lucide-react';
import { BranchDocument, formatDocType } from './types';
import { Button } from '../ui';

interface DocumentPreviewModalProps {
  previewDoc: BranchDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ previewDoc, onClose }: DocumentPreviewModalProps) {
  if (!previewDoc) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">{formatDocType(previewDoc.type)}</h4>
            <p className="text-[10px] text-slate-500 font-mono">{previewDoc.storage_path}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onClose}
            className="p-1 h-auto hover:bg-slate-100 rounded-lg text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mock Document Render */}
        <div className="p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[260px]">
          <div className="w-full max-w-xs bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
            <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
            <div>
              <span className="text-xs font-bold text-slate-800">{formatDocType(previewDoc.type)}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Physical Credential Attestation</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 font-mono break-all">
              Storage: {previewDoc.storage_path}
            </div>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Encrypted Cloud Storage Artifact
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
}
