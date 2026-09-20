import React from 'react';
import { GraduationCap, Briefcase, Building, Calendar, DollarSign, Clock } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step2Data } from '../../lib/candidateApi';

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
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.highestEdu')} <span className="text-rose-500">*</span>
            </label>
            <select
              id="step2-highest-edu"
              disabled={disabled}
              value={data.highest_qualification || ''}
              onChange={(e) => onChange('highest_qualification', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100 cursor-pointer"
            >
              <option value="">{t('common.select')}</option>
              <option value="matric">{t('step2.matric')}</option>
              <option value="intermediate">{t('step2.inter')}</option>
              <option value="bachelor">{t('step2.bachelor')}</option>
              <option value="master">{t('step2.master')}</option>
              <option value="diploma">{t('step2.diploma')}</option>
            </select>
          </div>

          {/* Degree Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.degreeTitle')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step2-degree-title"
              disabled={disabled}
              value={data.degree_title || ''}
              onChange={(e) => onChange('degree_title', e.target.value)}
              placeholder={t('step2.degreePlaceholder')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          {/* Institute Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.institute')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step2-institute"
              disabled={disabled}
              value={data.institute_name || ''}
              onChange={(e) => onChange('institute_name', e.target.value)}
              placeholder="e.g. University of the Punjab / BISE Lahore"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          {/* Graduation Year */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.gradYear')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min="1980"
                max="2030"
                id="step2-grad-year"
                disabled={disabled}
                value={data.graduation_year || ''}
                onChange={(e) => onChange('graduation_year', e.target.value)}
                placeholder="e.g. 2023"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
              />
            </div>
          </div>
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
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.totalExp')} <span className="text-rose-500">*</span>
            </label>
            <select
              id="step2-total-exp"
              disabled={disabled}
              value={data.total_experience || ''}
              onChange={(e) => onChange('total_experience', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100 cursor-pointer"
            >
              <option value="">{t('common.select')}</option>
              <option value="fresh">{t('step2.fresh')}</option>
              <option value="1-2">{t('step2.exp1to2')}</option>
              <option value="3-5">{t('step2.exp3to5')}</option>
              <option value="5+">{t('step2.exp5plus')}</option>
            </select>
          </div>

          {/* Availability / Notice Period */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.noticePeriod')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                id="step2-notice-period"
                disabled={disabled}
                value={data.notice_period || ''}
                onChange={(e) => onChange('notice_period', e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100 cursor-pointer"
              >
                <option value="">{t('common.select')}</option>
                <option value="immediate">{t('step2.immediate')}</option>
                <option value="15_days">{t('step2.notice15')}</option>
                <option value="30_days">{t('step2.notice30')}</option>
              </select>
            </div>
          </div>

          {/* Current / Last Employer */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.lastEmployer')}{' '}
              {data.total_experience === 'fresh' ? (
                <span className="text-slate-400 font-normal">{t('common.optional')}</span>
              ) : (
                <span className="text-rose-500">*</span>
              )}
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="step2-last-employer"
                disabled={disabled}
                value={data.last_employer || ''}
                onChange={(e) => onChange('last_employer', e.target.value)}
                placeholder="e.g. TCS, Leopard, Daraz, or N/A (Fresh)"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Last Job Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.lastTitle')}{' '}
              {data.total_experience === 'fresh' ? (
                <span className="text-slate-400 font-normal">{t('common.optional')}</span>
              ) : (
                <span className="text-rose-500">*</span>
              )}
            </label>
            <input
              type="text"
              id="step2-last-title"
              disabled={disabled}
              value={data.last_designation || ''}
              onChange={(e) => onChange('last_designation', e.target.value)}
              placeholder="e.g. Courier Associate, Hub Coordinator"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
            />
          </div>

          {/* Last Monthly Salary */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('step2.lastSalary')} <span className="text-slate-400 font-normal">{t('common.optional')}</span>
            </label>
            <div className="relative max-w-xs">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                id="step2-last-salary"
                disabled={disabled}
                value={data.last_salary || ''}
                onChange={(e) => onChange('last_salary', e.target.value)}
                placeholder="e.g. 45000"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
