import React from 'react';
import { User, Phone, Mail, Home, MapPin, Heart } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Step1Data } from '../../lib/candidateApi';
import { Input, Select } from '../ui';

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
        <Input
          id="step1-full-name"
          label={t('step1.fullName')}
          required
          disabled={disabled}
          value={data.full_name || ''}
          onChange={(e) => onChange('full_name', e.target.value)}
          placeholder="e.g. Muhammad Usman Ali"
          leftIcon={<User className="w-4 h-4" />}
        />

        {/* Father / Husband Name */}
        <Input
          id="step1-father-name"
          label={t('step1.fatherHusbandName')}
          required
          disabled={disabled}
          value={data.father_husband_name || ''}
          onChange={(e) => onChange('father_husband_name', e.target.value)}
          placeholder="e.g. Tariq Mehmood"
        />

        {/* CNIC */}
        <Input
          id="step1-cnic"
          label={t('step1.cnic')}
          required
          disabled={disabled}
          value={data.cnic || ''}
          onChange={(e) => onChange('cnic', e.target.value)}
          placeholder="35201-1234567-1"
          className="font-mono"
        />

        {/* DOB */}
        <Input
          id="step1-dob"
          label={t('step1.dob')}
          type="date"
          required
          disabled={disabled}
          value={data.dob || ''}
          onChange={(e) => onChange('dob', e.target.value)}
        />

        {/* Gender */}
        <Select
          id="step1-gender"
          label={t('step1.gender')}
          required
          disabled={disabled}
          value={data.gender || ''}
          onChange={(e) => onChange('gender', e.target.value)}
          options={[
            { value: '', label: t('common.select') },
            { value: 'male', label: t('step1.genderMale') },
            { value: 'female', label: t('step1.genderFemale') },
            { value: 'other', label: t('step1.genderOther') },
          ]}
        />

        {/* Marital Status */}
        <Select
          id="step1-marital-status"
          label={t('step1.maritalStatus')}
          required
          disabled={disabled}
          value={data.marital_status || ''}
          onChange={(e) => onChange('marital_status', e.target.value)}
          options={[
            { value: '', label: t('common.select') },
            { value: 'single', label: t('step1.single') },
            { value: 'married', label: t('step1.married') },
            { value: 'divorced', label: t('step1.divorced') },
            { value: 'widowed', label: t('step1.widowed') },
          ]}
        />

        {/* Blood Group */}
        <Select
          id="step1-blood-group"
          label={t('step1.bloodGroup')}
          required
          disabled={disabled}
          value={data.blood_group || ''}
          onChange={(e) => onChange('blood_group', e.target.value)}
          options={[
            { value: '', label: t('common.select') },
            { value: 'A+', label: 'A+' },
            { value: 'A-', label: 'A-' },
            { value: 'B+', label: 'B+' },
            { value: 'B-', label: 'B-' },
            { value: 'AB+', label: 'AB+' },
            { value: 'AB-', label: 'AB-' },
            { value: 'O+', label: 'O+' },
            { value: 'O-', label: 'O-' },
          ]}
        />

        {/* Mobile */}
        <Input
          id="step1-mobile"
          label={t('step1.mobile')}
          type="tel"
          required
          disabled={disabled}
          value={data.mobile || ''}
          onChange={(e) => onChange('mobile', e.target.value)}
          placeholder="03001234567"
          className="font-mono"
          leftIcon={<Phone className="w-4 h-4" />}
        />

        {/* Email */}
        <div className="md:col-span-2">
          <Input
            id="step1-email"
            label={`${t('step1.email')} (${t('common.optional')})`}
            type="email"
            disabled={disabled}
            value={data.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="candidate@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Emergency Contact</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            id="step1-emergency-name"
            label={t('step1.emergencyPerson')}
            required
            disabled={disabled}
            value={data.emergency_contact_name || ''}
            onChange={(e) => onChange('emergency_contact_name', e.target.value)}
            placeholder="e.g. Tariq Mehmood"
          />

          <Input
            id="step1-emergency-relation"
            label={t('step1.emergencyRelation')}
            required
            disabled={disabled}
            value={data.emergency_contact_relation || ''}
            onChange={(e) => onChange('emergency_contact_relation', e.target.value)}
            placeholder="e.g. Father / Brother"
          />

          <Input
            id="step1-emergency-phone"
            label={t('step1.emergencyPhone')}
            type="tel"
            required
            disabled={disabled}
            value={data.emergency_contact_phone || ''}
            onChange={(e) => onChange('emergency_contact_phone', e.target.value)}
            placeholder="03009876543"
            className="font-mono"
          />
        </div>
      </div>

      {/* Residential Address & Province */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <Input
            id="step1-address"
            label={t('step1.address')}
            required
            disabled={disabled}
            value={data.residential_address || ''}
            onChange={(e) => onChange('residential_address', e.target.value)}
            placeholder="House #, Street, Sector / Area"
            leftIcon={<Home className="w-4 h-4" />}
          />
        </div>

        <div>
          <Input
            id="step1-city"
            label={t('step1.city')}
            required
            disabled={disabled}
            value={data.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="e.g. Lahore, Karachi, Rawalpindi"
            leftIcon={<MapPin className="w-4 h-4" />}
          />
        </div>

        <div className="md:col-span-2">
          <Select
            id="step1-province"
            label={t('step1.province')}
            required
            disabled={disabled}
            value={data.province || ''}
            onChange={(e) => onChange('province', e.target.value)}
            options={[
              { value: '', label: t('common.select') },
              { value: 'Punjab', label: t('step1.provPunjab') },
              { value: 'Sindh', label: t('step1.provSindh') },
              { value: 'KPK', label: t('step1.provKpk') },
              { value: 'Balochistan', label: t('step1.provBalochistan') },
              { value: 'Islamabad', label: t('step1.provIslamabad') },
              { value: 'AJK', label: t('step1.provAjk') },
              { value: 'Gilgit-Baltistan', label: t('step1.provGb') },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
