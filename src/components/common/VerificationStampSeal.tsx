import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, CheckCircle2, Award, FileCheck } from 'lucide-react';

export type VerificationStage = 'candidate_signature' | 'branch_signature' | 'central_approval';

export interface VerificationStampSealProps {
  stage: VerificationStage;
  title?: string;
  subtitle?: string;
  signerName?: string;
  timestamp?: string;
  code?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const STAGE_CONFIG: Record<
  VerificationStage,
  {
    ringColor: string;
    badgeBg: string;
    badgeText: string;
    sealBorder: string;
    textColor: string;
    accentColor: string;
    defaultTitle: string;
    defaultSubtitle: string;
    defaultSigner: string;
    icon: React.ComponentType<{ className?: string }>;
    sealText: string;
  }
> = {
  candidate_signature: {
    ringColor: 'border-indigo-500/40',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    sealBorder: 'border-indigo-600',
    textColor: 'text-indigo-950',
    accentColor: 'text-indigo-600',
    defaultTitle: 'Digitally Attested & Signed',
    defaultSubtitle: 'Official Candidate Submission Seal',
    defaultSigner: 'Applicant Verification',
    icon: ShieldCheck,
    sealText: 'POSTEX • CANDIDATE VERIFIED • ATTESTED •',
  },
  branch_signature: {
    ringColor: 'border-emerald-500/40',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    sealBorder: 'border-emerald-600',
    textColor: 'text-emerald-950',
    accentColor: 'text-emerald-600',
    defaultTitle: 'Physically Inspected & Certified',
    defaultSubtitle: 'Branch Manager Verification Seal',
    defaultSigner: 'Branch Manager Attestation',
    icon: Award,
    sealText: 'POSTEX • BRANCH MANAGER CERTIFIED • SECURE •',
  },
  central_approval: {
    ringColor: 'border-indigo-500/40',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    sealBorder: 'border-indigo-700',
    textColor: 'text-slate-900',
    accentColor: 'text-indigo-600',
    defaultTitle: 'Formally Approved & Enrolled',
    defaultSubtitle: 'Central HR Corporate Seal',
    defaultSigner: 'Central HR Executive',
    icon: FileCheck,
    sealText: 'POSTEX • CORPORATE HR APPROVED • ENROLLED •',
  },
};

export const VerificationStampSeal: React.FC<VerificationStampSealProps> = ({
  stage,
  title,
  subtitle,
  signerName,
  timestamp,
  code,
  size = 'md',
  showDetails = true,
  className = '',
}) => {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;

  const displayTitle = title || config.defaultTitle;
  const displaySubtitle = subtitle || config.defaultSubtitle;
  const displaySigner = signerName || config.defaultSigner;

  // Sizing definitions
  const sealDimensions = {
    sm: {
      outer: 'w-16 h-16',
      inner: 'w-13 h-13',
      icon: 'w-6 h-6',
      title: 'text-xs font-bold',
      sub: 'text-[10px]',
    },
    md: {
      outer: 'w-22 h-22 sm:w-24 sm:h-24',
      inner: 'w-18 h-18 sm:w-20 sm:h-20',
      icon: 'w-8 h-8 sm:w-9 sm:h-9',
      title: 'text-sm sm:text-base font-black',
      sub: 'text-xs',
    },
    lg: {
      outer: 'w-28 h-28 sm:w-32 sm:h-32',
      inner: 'w-24 h-24 sm:w-28 sm:h-28',
      icon: 'w-10 h-10 sm:w-12 sm:h-12',
      title: 'text-base sm:text-lg font-black',
      sub: 'text-xs sm:text-sm',
    },
  }[size];

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      id={`verification-stamp-${stage}`}
    >
      {/* Official Animated Stamp Landing Animation */}
      <motion.div
        initial={{ scale: 1.4, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: -2 }}
        transition={{
          type: 'spring',
          damping: 14,
          stiffness: 220,
          mass: 0.8,
        }}
        className="relative flex items-center justify-center p-1"
      >
        {/* Outer Ripple Effect */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            repeatDelay: 2.2,
            ease: 'easeOut',
          }}
          className={`absolute inset-0 rounded-full border-2 ${config.ringColor} pointer-events-none`}
        />

        {/* Outer Concentric Stamp Rings */}
        <div
          className={`${sealDimensions.outer} rounded-full border-2 border-dashed ${config.sealBorder} flex items-center justify-center p-1 bg-white/90 shadow-sm relative`}
        >
          {/* Inner Solid Ring with Notched Dots */}
          <div
            className={`${sealDimensions.inner} rounded-full border-2 ${config.sealBorder} flex flex-col items-center justify-center relative p-1 bg-gradient-to-br from-white to-slate-50`}
          >
            {/* Top Star Accent */}
            <div className="absolute top-1 text-[8px] text-indigo-700 tracking-widest font-black">
              ★ ★ ★
            </div>

            {/* Central Stage Insignia Icon */}
            <Icon className={`${sealDimensions.icon} ${config.accentColor} my-auto transition-transform`} />

            {/* Bottom Verified Label */}
            <span
              className={`text-[8px] font-black tracking-widest uppercase ${config.accentColor} absolute bottom-1 px-1 font-mono`}
            >
              VERIFIED
            </span>
          </div>
        </div>

        {/* Small "OFFICIAL SEAL" Ribbon Badge */}
        <div
          className={`absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-white border border-slate-200 shadow-2xs ${config.textColor} flex items-center gap-1`}
        >
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          <span>OFFICIAL SEAL</span>
        </div>
      </motion.div>

      {/* Optional Accompanying Verification Certificate Text */}
      {showDetails && (
        <div className="text-center mt-3 max-w-sm space-y-1">
          <h4 className={`${sealDimensions.title} ${config.textColor} tracking-tight`}>
            {displayTitle}
          </h4>
          <p className={`${sealDimensions.sub} text-slate-500 leading-snug`}>
            {displaySubtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {displaySigner && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                <span>By:</span>
                <strong className="text-slate-900">{displaySigner}</strong>
              </span>
            )}
            {timestamp && (
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {new Date(timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {code && (
            <div className="pt-1">
              <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[260px] mx-auto">
                Cert: {code}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
