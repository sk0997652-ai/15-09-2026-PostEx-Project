import React from 'react';
import { Users, UserCheck, ShieldCheck, AlertCircle } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step3Data } from '../../lib/candidateApi';

interface WizardStep3Props {
  data: Step3Data;
  onChange: (field: keyof Step3Data, value: string) => void;
  disabled?: boolean;
}

export const WizardStep3: React.FC<WizardStep3Props> = ({ data, onChange, disabled = false }) => {
  const { t } = useI18n();

  return (
    <div id="candidate-wizard-step-3" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t('step3.heading')}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t('step3.subheading')}</p>
      </div>

      {/* Next of Kin Card */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Next of Kin Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.kinName')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-kin-name"
              disabled={disabled}
              value={data.next_of_kin_name || ''}
              onChange={(e) => onChange('next_of_kin_name', e.target.value)}
              placeholder="e.g. Parveen Bibi"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.kinRelation')} <span className="text-rose-500">*</span>
            </label>
            <select
              id="step3-kin-relation"
              disabled={disabled}
              value={data.next_of_kin_relation || ''}
              onChange={(e) => onChange('next_of_kin_relation', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100 cursor-pointer"
            >
              <option value="">{t('common.select')}</option>
              <option value="father">{t('step3.kinRelationFather')}</option>
              <option value="mother">{t('step3.kinRelationMother')}</option>
              <option value="spouse">{t('step3.kinRelationSpouse')}</option>
              <option value="brother">{t('step3.kinRelationBrother')}</option>
              <option value="sister">{t('step3.kinRelationSister')}</option>
              <option value="other">{t('step3.kinRelationOther')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.kinPhone')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              id="step3-kin-phone"
              disabled={disabled}
              value={data.next_of_kin_phone || ''}
              onChange={(e) => onChange('next_of_kin_phone', e.target.value)}
              placeholder="03001234567"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.dependentsCount')} <span className="text-slate-400 font-normal">{t('common.optional')}</span>
            </label>
            <input
              type="number"
              min="0"
              max="20"
              id="step3-dependents"
              disabled={disabled}
              value={data.dependents_count || '0'}
              onChange={(e) => onChange('dependents_count', e.target.value)}
              className="w-32 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Reference 1 Card */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            {t('step3.ref1Heading')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refName')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref1-name"
              disabled={disabled}
              value={data.ref1_name || ''}
              onChange={(e) => onChange('ref1_name', e.target.value)}
              placeholder="e.g. Asad Malik"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refOrg')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref1-org"
              disabled={disabled}
              value={data.ref1_organization || ''}
              onChange={(e) => onChange('ref1_organization', e.target.value)}
              placeholder="e.g. Atlas Logistics / Punjab College"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refDesignation')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref1-designation"
              disabled={disabled}
              value={data.ref1_designation || ''}
              onChange={(e) => onChange('ref1_designation', e.target.value)}
              placeholder="e.g. Warehouse Manager / Professor"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refPhone')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              id="step3-ref1-phone"
              disabled={disabled}
              value={data.ref1_phone || ''}
              onChange={(e) => onChange('ref1_phone', e.target.value)}
              placeholder="03017654321"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refCity')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref1-city"
              disabled={disabled}
              value={data.ref1_city || ''}
              onChange={(e) => onChange('ref1_city', e.target.value)}
              placeholder="e.g. Lahore"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Reference 2 Card */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            {t('step3.ref2Heading')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refName')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref2-name"
              disabled={disabled}
              value={data.ref2_name || ''}
              onChange={(e) => onChange('ref2_name', e.target.value)}
              placeholder="e.g. Zafar Iqbal"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refOrg')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref2-org"
              disabled={disabled}
              value={data.ref2_organization || ''}
              onChange={(e) => onChange('ref2_organization', e.target.value)}
              placeholder="e.g. National Bank / Community Elder"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refDesignation')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref2-designation"
              disabled={disabled}
              value={data.ref2_designation || ''}
              onChange={(e) => onChange('ref2_designation', e.target.value)}
              placeholder="e.g. Operations Officer / Family Friend"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refPhone')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              id="step3-ref2-phone"
              disabled={disabled}
              value={data.ref2_phone || ''}
              onChange={(e) => onChange('ref2_phone', e.target.value)}
              placeholder="03219876543"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step3.refCity')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step3-ref2-city"
              disabled={disabled}
              value={data.ref2_city || ''}
              onChange={(e) => onChange('ref2_city', e.target.value)}
              placeholder="e.g. Lahore / Rawalpindi"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Submission Final Declaration Card */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Final Review &amp; Physical Verification Notice</p>
          <p className="text-indigo-800 leading-relaxed">{t('step3.submitNotice')}</p>
        </div>
      </div>
    </div>
  );
};
