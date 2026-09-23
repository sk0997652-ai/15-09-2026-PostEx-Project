import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'small' | 'default' | 'large';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'default',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  let sizeClasses = 'max-w-lg'; // default
  if (size === 'small') sizeClasses = 'max-w-md';
  if (size === 'large') sizeClasses = 'max-w-2xl';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-xl w-full ${sizeClasses} overflow-hidden transition-all transform ${className}`}
      >
        {/* Header */}
        {(title || description) && (
          <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              {title && (
                typeof title === 'string' ? (
                  <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                ) : (
                  title
                )
              )}
              {description && (
                typeof description === 'string' ? (
                  <p className="text-sm font-normal text-slate-500 mt-0.5">{description}</p>
                ) : (
                  description
                )
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
