import React from 'react';
import { User, Phone, Mail, Home, MapPin, Heart, AlertCircle } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step1Data } from '../../lib/candidateApi';

interface WizardStep1Props {
  data: Step1Data;
  onChange: (field: keyof Step1Data, value: string) => void;
  disabled?: boolean;
}

export const WizardStep1: React.FC<WizardStep1Props> = ({ data, onChange, disabled = false }) => {
  const { t } = useI18n();

  return (
    <div id="candidate-wizard-step-1" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t('step1.heading')}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t('step1.subheading')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.fullName')} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="step1-full-name"
              disabled={disabled}
              value={data.full_name || ''}
              onChange={(e) => onChange('full_name', e.target.value)}
              placeholder="e.g. Muhammad Usman Ali"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Father / Husband Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.fatherHusbandName')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="step1-father-name"
            disabled={disabled}
            value={data.father_husband_name || ''}
            onChange={(e) => onChange('father_husband_name', e.target.value)}
            placeholder="e.g. Tariq Mehmood"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
          />
        </div>

        {/* CNIC */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.cnic')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="step1-cnic"
            disabled={disabled}
            value={data.cnic || ''}
            onChange={(e) => onChange('cnic', e.target.value)}
            placeholder="35201-1234567-1"
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.dob')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            id="step1-dob"
            disabled={disabled}
            value={data.dob || ''}
            onChange={(e) => onChange('dob', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.gender')} <span className="text-rose-500">*</span>
          </label>
          <select
            id="step1-gender"
            disabled={disabled}
            value={data.gender || ''}
            onChange={(e) => onChange('gender', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50 cursor-pointer"
          >
            <option value="">{t('common.select')}</option>
            <option value="male">{t('step1.genderMale')}</option>
            <option value="female">{t('step1.genderFemale')}</option>
            <option value="other">{t('step1.genderOther')}</option>
          </select>
        </div>

        {/* Marital Status */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.maritalStatus')} <span className="text-rose-500">*</span>
          </label>
          <select
            id="step1-marital-status"
            disabled={disabled}
            value={data.marital_status || ''}
            onChange={(e) => onChange('marital_status', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50 cursor-pointer"
          >
            <option value="">{t('common.select')}</option>
            <option value="single">{t('step1.single')}</option>
            <option value="married">{t('step1.married')}</option>
            <option value="divorced">{t('step1.divorced')}</option>
            <option value="widowed">{t('step1.widowed')}</option>
          </select>
        </div>

        {/* Blood Group */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.bloodGroup')} <span className="text-rose-500">*</span>
          </label>
          <select
            id="step1-blood-group"
            disabled={disabled}
            value={data.blood_group || ''}
            onChange={(e) => onChange('blood_group', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50 cursor-pointer"
          >
            <option value="">{t('common.select')}</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.mobile')} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="tel"
              id="step1-mobile"
              disabled={disabled}
              value={data.mobile || ''}
              onChange={(e) => onChange('mobile', e.target.value)}
              placeholder="03001234567"
              className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Email */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.email')} <span className="text-slate-400 font-normal">{t('common.optional')}</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="email"
              id="step1-email"
              disabled={disabled}
              value={data.email || ''}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="candidate@example.com"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Emergency Contact</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {t('step1.emergencyPerson')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step1-emergency-name"
              disabled={disabled}
              value={data.emergency_contact_name || ''}
              onChange={(e) => onChange('emergency_contact_name', e.target.value)}
              placeholder="e.g. Tariq Mehmood"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {t('step1.emergencyRelation')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="step1-emergency-relation"
              disabled={disabled}
              value={data.emergency_contact_relation || ''}
              onChange={(e) => onChange('emergency_contact_relation', e.target.value)}
              placeholder="e.g. Father / Brother"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {t('step1.emergencyPhone')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              id="step1-emergency-phone"
              disabled={disabled}
              value={data.emergency_contact_phone || ''}
              onChange={(e) => onChange('emergency_contact_phone', e.target.value)}
              placeholder="03009876543"
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Residential Address & Province */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.address')} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Home className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="step1-address"
              disabled={disabled}
              value={data.residential_address || ''}
              onChange={(e) => onChange('residential_address', e.target.value)}
              placeholder="House #, Street, Sector / Area"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.city')} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="step1-city"
              disabled={disabled}
              value={data.city || ''}
              onChange={(e) => onChange('city', e.target.value)}
              placeholder="e.g. Lahore, Karachi, Rawalpindi"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('step1.province')} <span className="text-rose-500">*</span>
          </label>
          <select
            id="step1-province"
            disabled={disabled}
            value={data.province || ''}
            onChange={(e) => onChange('province', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white disabled:bg-slate-50 cursor-pointer"
          >
            <option value="">{t('common.select')}</option>
            <option value="Punjab">{t('step1.provPunjab')}</option>
            <option value="Sindh">{t('step1.provSindh')}</option>
            <option value="KPK">{t('step1.provKpk')}</option>
            <option value="Balochistan">{t('step1.provBalochistan')}</option>
            <option value="Islamabad">{t('step1.provIslamabad')}</option>
            <option value="AJK">{t('step1.provAjk')}</option>
            <option value="Gilgit-Baltistan">{t('step1.provGb')}</option>
          </select>
        </div>
      </div>
    </div>
  );
};
