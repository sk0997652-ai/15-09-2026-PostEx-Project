import React from 'react';
import { Users, UserCheck, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step3Data } from '../../lib/candidateApi';
import { Input, Select } from '../ui';

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
          <Input
            id="step3-kin-name"
            label={t('step3.kinName')}
            required
            disabled={disabled}
            value={data.next_of_kin_name || ''}
            onChange={(e) => onChange('next_of_kin_name', e.target.value)}
            placeholder="e.g. Parveen Bibi"
          />

          <Select
            id="step3-kin-relation"
            label={t('step3.kinRelation')}
            required
            disabled={disabled}
            value={data.next_of_kin_relation || ''}
            onChange={(e) => onChange('next_of_kin_relation', e.target.value)}
            options={[
              { value: '', label: t('common.select') },
              { value: 'father', label: t('step3.kinRelationFather') },
              { value: 'mother', label: t('step3.kinRelationMother') },
              { value: 'spouse', label: t('step3.kinRelationSpouse') },
              { value: 'brother', label: t('step3.kinRelationBrother') },
              { value: 'sister', label: t('step3.kinRelationSister') },
              { value: 'other', label: t('step3.kinRelationOther') },
            ]}
          />

          <Input
            id="step3-kin-phone"
            label={t('step3.kinPhone')}
            type="tel"
            required
            disabled={disabled}
            value={data.next_of_kin_phone || ''}
            onChange={(e) => onChange('next_of_kin_phone', e.target.value)}
            placeholder="03001234567"
            className="font-mono"
          />

          <div className="md:col-span-3">
            <div className="w-36">
              <Input
                id="step3-dependents"
                label={`${t('step3.dependentsCount')} (${t('common.optional')})`}
                type="number"
                min="0"
                max="20"
                disabled={disabled}
                value={data.dependents_count || '0'}
                onChange={(e) => onChange('dependents_count', e.target.value)}
                className="font-mono"
              />
            </div>
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
          <Input
            id="step3-ref1-name"
            label={t('step3.refName')}
            required
            disabled={disabled}
            value={data.ref1_name || ''}
            onChange={(e) => onChange('ref1_name', e.target.value)}
            placeholder="e.g. Asad Malik"
          />

          <Input
            id="step3-ref1-org"
            label={t('step3.refOrg')}
            required
            disabled={disabled}
            value={data.ref1_organization || ''}
            onChange={(e) => onChange('ref1_organization', e.target.value)}
            placeholder="e.g. Atlas Logistics / Punjab College"
          />

          <Input
            id="step3-ref1-designation"
            label={t('step3.refDesignation')}
            required
            disabled={disabled}
            value={data.ref1_designation || ''}
            onChange={(e) => onChange('ref1_designation', e.target.value)}
            placeholder="e.g. Warehouse Manager / Professor"
          />

          <Input
            id="step3-ref1-phone"
            label={t('step3.refPhone')}
            type="tel"
            required
            disabled={disabled}
            value={data.ref1_phone || ''}
            onChange={(e) => onChange('ref1_phone', e.target.value)}
            placeholder="03017654321"
            className="font-mono"
          />

          <div className="md:col-span-2">
            <Input
              id="step3-ref1-city"
              label={t('step3.refCity')}
              required
              disabled={disabled}
              value={data.ref1_city || ''}
              onChange={(e) => onChange('ref1_city', e.target.value)}
              placeholder="e.g. Lahore"
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
          <Input
            id="step3-ref2-name"
            label={t('step3.refName')}
            required
            disabled={disabled}
            value={data.ref2_name || ''}
            onChange={(e) => onChange('ref2_name', e.target.value)}
            placeholder="e.g. Zafar Iqbal"
          />

          <Input
            id="step3-ref2-org"
            label={t('step3.refOrg')}
            required
            disabled={disabled}
            value={data.ref2_organization || ''}
            onChange={(e) => onChange('ref2_organization', e.target.value)}
            placeholder="e.g. National Bank / Community Elder"
          />

          <Input
            id="step3-ref2-designation"
            label={t('step3.refDesignation')}
            required
            disabled={disabled}
            value={data.ref2_designation || ''}
            onChange={(e) => onChange('ref2_designation', e.target.value)}
            placeholder="e.g. Operations Officer / Family Friend"
          />

          <Input
            id="step3-ref2-phone"
            label={t('step3.refPhone')}
            type="tel"
            required
            disabled={disabled}
            value={data.ref2_phone || ''}
            onChange={(e) => onChange('ref2_phone', e.target.value)}
            placeholder="03219876543"
            className="font-mono"
          />

          <div className="md:col-span-2">
            <Input
              id="step3-ref2-city"
              label={t('step3.refCity')}
              required
              disabled={disabled}
              value={data.ref2_city || ''}
              onChange={(e) => onChange('ref2_city', e.target.value)}
              placeholder="e.g. Lahore / Rawalpindi"
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
