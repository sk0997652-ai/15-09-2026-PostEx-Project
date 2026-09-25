import React from 'react';
import { GraduationCap, Briefcase, Building, Calendar, DollarSign, Clock } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step2Data } from '../../lib/candidateApi';
import { Input, Select } from '../ui';

interface WizardStep2Props {
  data: Step2Data;
  onChange: (field: keyof Step2Data, value: string) => void;
  disabled?: boolean;
}

export const WizardStep2: React.FC<WizardStep2Props> = ({ data, onChange, disabled = false }) => {
  const { t } = useI18n();

  return (
    <div id="candidate-wizard-step-2" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t('step2.heading')}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t('step2.subheading')}</p>
      </div>

      {/* Academic Qualifications Section */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Academic Record</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Highest Qualification */}
          <Select
            id="step2-highest-edu"
            label={t('step2.highestEdu')}
            required
            disabled={disabled}
            value={data.highest_qualification || ''}
            onChange={(e) => onChange('highest_qualification', e.target.value)}
            options={[
              { value: '', label: t('common.select') },
              { value: 'matric', label: t('step2.matric') },
              { value: 'intermediate', label: t('step2.inter') },
              { value: 'bachelor', label: t('step2.bachelor') },
              { value: 'master', label: t('step2.master') },
              { value: 'diploma', label: t('step2.diploma') },
            ]}
          />

          {/* Degree Title */}
          <Input
            id="step2-degree-title"
            label={t('step2.degreeTitle')}
            required
            disabled={disabled}
            value={data.degree_title || ''}
            onChange={(e) => onChange('degree_title', e.target.value)}
            placeholder={t('step2.degreePlaceholder')}
          />

          {/* Institute Name */}
          <Input
            id="step2-institute"
            label={t('step2.institute')}
            required
            disabled={disabled}
            value={data.institute_name || ''}
            onChange={(e) => onChange('institute_name', e.target.value)}
            placeholder="e.g. University of the Punjab / BISE Lahore"
          />

          {/* Graduation Year */}
          <Input
            id="step2-grad-year"
            label={t('step2.gradYear')}
            type="number"
            min="1980"
            max="2030"
            required
            disabled={disabled}
            value={data.graduation_year || ''}
            onChange={(e) => onChange('graduation_year', e.target.value)}
            placeholder="e.g. 2023"
            className="font-mono"
            leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* Professional Experience Section */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Work History &amp; Employment</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Experience */}
          <Select
            id="step2-total-exp"
            label={t('step2.totalExp')}
            required
            disabled={disabled}
            value={data.total_experience || ''}
            onChange={(e) => onChange('total_experience', e.target.value)}
            options={[
              { value: '', label: t('common.select') },
              { value: 'fresh', label: t('step2.fresh') },
              { value: '1-2', label: t('step2.exp1to2') },
              { value: '3-5', label: t('step2.exp3to5') },
              { value: '5+', label: t('step2.exp5plus') },
            ]}
          />

          {/* Availability / Notice Period */}
          <Select
            id="step2-notice-period"
            label={t('step2.noticePeriod')}
            required
            disabled={disabled}
            value={data.notice_period || ''}
            onChange={(e) => onChange('notice_period', e.target.value)}
            leftIcon={<Clock className="w-4 h-4 text-slate-400" />}
            options={[
              { value: '', label: t('common.select') },
              { value: 'immediate', label: t('step2.immediate') },
              { value: '15_days', label: t('step2.notice15') },
              { value: '30_days', label: t('step2.notice30') },
            ]}
          />

          {/* Current / Last Employer */}
          <Input
            id="step2-last-employer"
            label={
              data.total_experience === 'fresh'
                ? `${t('step2.lastEmployer')} (${t('common.optional')})`
                : t('step2.lastEmployer')
            }
            required={data.total_experience !== 'fresh'}
            disabled={disabled}
            value={data.last_employer || ''}
            onChange={(e) => onChange('last_employer', e.target.value)}
            placeholder="e.g. TCS, Leopard, Daraz, or N/A (Fresh)"
            leftIcon={<Building className="w-4 h-4 text-slate-400" />}
          />

          {/* Last Job Title */}
          <Input
            id="step2-last-title"
            label={
              data.total_experience === 'fresh'
                ? `${t('step2.lastTitle')} (${t('common.optional')})`
                : t('step2.lastTitle')
            }
            required={data.total_experience !== 'fresh'}
            disabled={disabled}
            value={data.last_designation || ''}
            onChange={(e) => onChange('last_designation', e.target.value)}
            placeholder="e.g. Courier Associate, Hub Coordinator"
          />

          {/* Last Monthly Salary */}
          <div className="md:col-span-2">
            <div className="max-w-xs">
              <Input
                id="step2-last-salary"
                label={`${t('step2.lastSalary')} (${t('common.optional')})`}
                type="number"
                disabled={disabled}
                value={data.last_salary || ''}
                onChange={(e) => onChange('last_salary', e.target.value)}
                placeholder="e.g. 45000"
                className="font-mono"
                leftIcon={<DollarSign className="w-4 h-4 text-slate-400" />}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
