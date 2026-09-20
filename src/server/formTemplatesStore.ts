// ==============================================================================
// Dynamic Form Templates, Sections, Fields & Org Branding Store
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

export type CandidateTrack = 'executive' | 'non_executive';

export type FormFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'yes_no'
  | 'textarea'
  | 'repeatable_table'
  | 'signature';

export interface TableColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown';
  options?: string[];
}

export interface FormFieldItem {
  id: string;
  section_id: string;
  field_key: string;
  label: string;
  field_type: FormFieldType;
  is_required: boolean;
  order_index: number;
  options?: string[];
  table_columns?: TableColumnDef[];
  conditional_label?: string; // for yes_no details
  placeholder?: string;
}

export interface FormSectionItem {
  id: string;
  template_id: string;
  title: string;
  order_index: number;
  description?: string;
  fields: FormFieldItem[];
}

export interface FormTemplateItem {
  id: string;
  track: CandidateTrack;
  version: number;
  is_active: boolean;
  created_at: string;
  sections: FormSectionItem[];
}

export interface OrganizationSettings {
  id: string;
  company_name: string;
  portal_name: string;
  logo_storage_path?: string;
  support_email: string;
  data_retention_days: number;
  auto_archive_enabled: boolean;
  updated_at: string;
  updated_by?: string;
}

// ------------------------------------------------------------------------------
// Seed Templates Definition (Real Physical Company Joining Forms)
// ------------------------------------------------------------------------------

export function getInitialSeedTemplates(): { executive: FormTemplateItem; non_executive: FormTemplateItem } {
  // 1. Executive Track Template
  const execTemplateId = 'tmpl-executive-v1';
  const execSections: FormSectionItem[] = [
    {
      id: 'sec-exec-personal',
      template_id: execTemplateId,
      title: 'Personal Information',
      order_index: 1,
      description: 'Basic bio-data, national identity, and communication coordinates',
      fields: [
        { id: 'f-e-1', section_id: 'sec-exec-personal', field_key: 'full_name', label: 'Full Name', field_type: 'text', is_required: true, order_index: 1 },
        { id: 'f-e-2', section_id: 'sec-exec-personal', field_key: 'title', label: 'Title', field_type: 'dropdown', is_required: true, order_index: 2, options: ['Mr.', 'Ms.', 'Mrs.', 'Dr.'] },
        { id: 'f-e-3', section_id: 'sec-exec-personal', field_key: 'gender', label: 'Gender', field_type: 'dropdown', is_required: true, order_index: 3, options: ['Male', 'Female', 'Other'] },
        { id: 'f-e-4', section_id: 'sec-exec-personal', field_key: 'religion', label: 'Religion', field_type: 'text', is_required: false, order_index: 4 },
        { id: 'f-e-5', section_id: 'sec-exec-personal', field_key: 'marital_status', label: 'Marital Status', field_type: 'dropdown', is_required: true, order_index: 5, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
        { id: 'f-e-6', section_id: 'sec-exec-personal', field_key: 'spouse_contact', label: 'Spouse Contact Number', field_type: 'text', is_required: false, order_index: 6 },
        { id: 'f-e-7', section_id: 'sec-exec-personal', field_key: 'father_husband_name', label: "Father's / Husband's Name", field_type: 'text', is_required: true, order_index: 7 },
        { id: 'f-e-8', section_id: 'sec-exec-personal', field_key: 'dob', label: 'Date of Birth', field_type: 'date', is_required: true, order_index: 8 },
        { id: 'f-e-9', section_id: 'sec-exec-personal', field_key: 'place_of_birth', label: 'Place of Birth', field_type: 'text', is_required: true, order_index: 9 },
        { id: 'f-e-10', section_id: 'sec-exec-personal', field_key: 'nationality', label: 'Nationality', field_type: 'text', is_required: true, order_index: 10, options: ['Pakistani'] },
        { id: 'f-e-11', section_id: 'sec-exec-personal', field_key: 'domicile', label: 'Domicile (District / Province)', field_type: 'text', is_required: false, order_index: 11 },
        { id: 'f-e-12', section_id: 'sec-exec-personal', field_key: 'cnic', label: 'CNIC Number (13 Digits)', field_type: 'text', is_required: true, order_index: 12, placeholder: '35201-1234567-1' },
        { id: 'f-e-13', section_id: 'sec-exec-personal', field_key: 'permanent_address', label: 'Permanent Address', field_type: 'textarea', is_required: true, order_index: 13 },
        { id: 'f-e-14', section_id: 'sec-exec-personal', field_key: 'current_address', label: 'Current Address', field_type: 'textarea', is_required: true, order_index: 14 },
        { id: 'f-e-15', section_id: 'sec-exec-personal', field_key: 'landline_phone', label: 'Phone Number (Landline)', field_type: 'text', is_required: false, order_index: 15 },
        { id: 'f-e-16', section_id: 'sec-exec-personal', field_key: 'mobile', label: 'Mobile Number (Pakistani 03XXXXXXXXX)', field_type: 'text', is_required: true, order_index: 16, placeholder: '03001234567' },
      ],
    },
    {
      id: 'sec-exec-spouse-dependents',
      template_id: execTemplateId,
      title: 'Spouse & Dependents',
      order_index: 2,
      description: 'Family details, dependent children or elders, and housing status',
      fields: [
        { id: 'f-e-20', section_id: 'sec-exec-spouse-dependents', field_key: 'spouse_name', label: 'Name of Spouse (if applicable)', field_type: 'text', is_required: false, order_index: 1 },
        {
          id: 'f-e-21',
          section_id: 'sec-exec-spouse-dependents',
          field_key: 'dependents_table',
          label: 'Dependent Details (allow up to 5 rows)',
          field_type: 'repeatable_table',
          is_required: false,
          order_index: 2,
          table_columns: [
            { key: 'relationship', label: 'Relationship', type: 'dropdown', options: ['Husband', 'Wife', 'Son', 'Daughter', 'Father', 'Mother'] },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'cnic', label: 'CNIC / B-Form', type: 'text' },
            { key: 'marriage_date', label: 'Marriage Date', type: 'date' },
            { key: 'dob', label: 'Date of Birth', type: 'date' },
          ],
        },
        {
          id: 'f-e-22',
          section_id: 'sec-exec-spouse-dependents',
          field_key: 'residence_status',
          label: 'Residence Status',
          field_type: 'dropdown',
          is_required: true,
          order_index: 3,
          options: ['Own a house', 'Rent it', 'Live with relatives', 'Company provided'],
        },
      ],
    },
    {
      id: 'sec-exec-health',
      template_id: execTemplateId,
      title: 'Health Details',
      order_index: 3,
      description: 'Physical fitness, medical examinations, and hospitalization history',
      fields: [
        { id: 'f-e-30', section_id: 'sec-exec-health', field_key: 'blood_group', label: 'Blood Group', field_type: 'dropdown', is_required: true, order_index: 1, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
        { id: 'f-e-31', section_id: 'sec-exec-health', field_key: 'last_medical_exam_date', label: 'Last Medical Examination Date', field_type: 'date', is_required: false, order_index: 2 },
        { id: 'f-e-32', section_id: 'sec-exec-health', field_key: 'occasion_of_last_exam', label: 'Occasion of Last Exam', field_type: 'text', is_required: false, order_index: 3 },
        { id: 'f-e-33', section_id: 'sec-exec-health', field_key: 'result_of_last_exam', label: 'Result of Last Exam', field_type: 'text', is_required: false, order_index: 4 },
        { id: 'f-e-34', section_id: 'sec-exec-health', field_key: 'has_illness_or_disability', label: 'Any illness requiring hospitalization or physical disability?', field_type: 'yes_no', is_required: true, order_index: 5, conditional_label: 'If yes, please provide complete medical details' },
        { id: 'f-e-35', section_id: 'sec-exec-health', field_key: 'illness_details', label: 'Details of illness or disability', field_type: 'textarea', is_required: false, order_index: 6 },
      ],
    },
    {
      id: 'sec-exec-academic',
      template_id: execTemplateId,
      title: 'Academic Details',
      order_index: 4,
      description: 'Educational qualifications, certifications, honors, and awards',
      fields: [
        {
          id: 'f-e-40',
          section_id: 'sec-exec-academic',
          field_key: 'academic_record',
          label: 'Academic Record',
          field_type: 'repeatable_table',
          is_required: true,
          order_index: 1,
          table_columns: [
            { key: 'examination_passed', label: 'Examination Passed', type: 'dropdown', options: ['Matriculation / O-Levels', 'Intermediate / A-Levels', 'Graduation / Bachelor', 'Post-Graduation / Master', 'Doctorate / PhD', 'Other Specialized Degree', 'Diploma / Short Course'] },
            { key: 'year', label: 'Year Passed', type: 'text' },
            { key: 'division_grade', label: 'Division / Grade / GPA', type: 'text' },
            { key: 'institution', label: 'Name of Institution / Board', type: 'text' },
            { key: 'major_subjects', label: 'Major Subjects', type: 'text' },
          ],
        },
        { id: 'f-e-41', section_id: 'sec-exec-academic', field_key: 'special_training', label: 'Special Training or Professional Courses', field_type: 'textarea', is_required: false, order_index: 2 },
        { id: 'f-e-42', section_id: 'sec-exec-academic', field_key: 'honors_awards', label: 'Any Honors, Awards or Scholarships Won', field_type: 'textarea', is_required: false, order_index: 3 },
        { id: 'f-e-43', section_id: 'sec-exec-academic', field_key: 'foreign_degrees', label: 'Any Foreign Degree or Distinction', field_type: 'text', is_required: false, order_index: 4 },
        { id: 'f-e-44', section_id: 'sec-exec-academic', field_key: 'other_academic_notes', label: 'Any other to mention', field_type: 'text', is_required: false, order_index: 5 },
      ],
    },
    {
      id: 'sec-exec-languages',
      template_id: execTemplateId,
      title: 'Language Proficiency',
      order_index: 5,
      description: 'Competence in spoken, reading, and written communication',
      fields: [
        {
          id: 'f-e-50',
          section_id: 'sec-exec-languages',
          field_key: 'languages_table',
          label: 'Languages',
          field_type: 'repeatable_table',
          is_required: false,
          order_index: 1,
          table_columns: [
            { key: 'language', label: 'Language', type: 'text' },
            { key: 'spoken', label: 'Spoken Proficiency', type: 'dropdown', options: ['Slight', 'Moderate', 'Proficient'] },
            { key: 'read', label: 'Reading Proficiency', type: 'dropdown', options: ['Slight', 'Moderate', 'Proficient'] },
            { key: 'written', label: 'Written Proficiency', type: 'dropdown', options: ['Slight', 'Moderate', 'Proficient'] },
          ],
        },
      ],
    },
    {
      id: 'sec-exec-employment',
      template_id: execTemplateId,
      title: 'Employment History',
      order_index: 6,
      description: 'Previous corporate employers, tenure, compensation breakdown, and service bonds',
      fields: [
        {
          id: 'f-e-60',
          section_id: 'sec-exec-employment',
          field_key: 'employment_record',
          label: 'Employment Record (up to 6 past positions)',
          field_type: 'repeatable_table',
          is_required: false,
          order_index: 1,
          table_columns: [
            { key: 'date_from', label: 'Date From', type: 'date' },
            { key: 'date_to', label: 'Date To', type: 'date' },
            { key: 'employer_name_address', label: 'Employer Name & Address', type: 'text' },
            { key: 'position_held', label: 'Position(s) Held', type: 'text' },
            { key: 'gross_salary_starting', label: 'Gross Salary — Starting (PKR)', type: 'number' },
            { key: 'gross_salary_last', label: 'Gross Salary — Present/Last (PKR)', type: 'number' },
            { key: 'reason_for_leaving', label: 'Reasons for Leaving', type: 'text' },
          ],
        },
        { id: 'f-e-61', section_id: 'sec-exec-employment', field_key: 'pay_total', label: 'Last Pay Package Breakdown: Total Gross (PKR)', field_type: 'number', is_required: false, order_index: 2 },
        { id: 'f-e-62', section_id: 'sec-exec-employment', field_key: 'pay_basic', label: 'Basic Salary (PKR)', field_type: 'number', is_required: false, order_index: 3 },
        { id: 'f-e-63', section_id: 'sec-exec-employment', field_key: 'pay_utilities', label: 'Utilities Allowance (PKR)', field_type: 'number', is_required: false, order_index: 4 },
        { id: 'f-e-64', section_id: 'sec-exec-employment', field_key: 'pay_transport', label: 'Transport Allowance (PKR)', field_type: 'number', is_required: false, order_index: 5 },
        { id: 'f-e-65', section_id: 'sec-exec-employment', field_key: 'pay_house_rent', label: 'House Rent Allowance (PKR)', field_type: 'number', is_required: false, order_index: 6 },
        { id: 'f-e-66', section_id: 'sec-exec-employment', field_key: 'pay_entertainment', label: 'Entertainment Allowance (PKR)', field_type: 'number', is_required: false, order_index: 7 },
        { id: 'f-e-67', section_id: 'sec-exec-employment', field_key: 'pay_bonus', label: 'Bonus / Commissions (PKR)', field_type: 'number', is_required: false, order_index: 8 },
        { id: 'f-e-68', section_id: 'sec-exec-employment', field_key: 'pay_provident_fund', label: 'Provident Fund (PKR)', field_type: 'number', is_required: false, order_index: 9 },
        { id: 'f-e-69', section_id: 'sec-exec-employment', field_key: 'pay_others', label: 'Others — specify (PKR)', field_type: 'text', is_required: false, order_index: 10 },
        { id: 'f-e-70', section_id: 'sec-exec-employment', field_key: 'other_benefits', label: 'Details of any other benefits from present/last employer', field_type: 'textarea', is_required: false, order_index: 11 },
        { id: 'f-e-71', section_id: 'sec-exec-employment', field_key: 'has_incentive_reward', label: 'Any Incentive, Reward, or other allowance received?', field_type: 'yes_no', is_required: false, order_index: 12, conditional_label: 'If yes, specify details of incentive/reward' },
        { id: 'f-e-72', section_id: 'sec-exec-employment', field_key: 'is_under_service_bond', label: 'Are you under any service bond with your present employer?', field_type: 'yes_no', is_required: true, order_index: 13 },
      ],
    },
    {
      id: 'sec-exec-present-job',
      template_id: execTemplateId,
      title: 'Present Job Information',
      order_index: 7,
      description: 'Corporate onboarding role, work station, and agreed compensation',
      fields: [
        { id: 'f-e-80', section_id: 'sec-exec-present-job', field_key: 'position_applied', label: 'Position Applied For', field_type: 'text', is_required: true, order_index: 1 },
        { id: 'f-e-81', section_id: 'sec-exec-present-job', field_key: 'employee_id_ref', label: 'Employee ID (if applicable / rehire)', field_type: 'text', is_required: false, order_index: 2 },
        { id: 'f-e-82', section_id: 'sec-exec-present-job', field_key: 'date_of_joining', label: 'Date of Joining', field_type: 'date', is_required: false, order_index: 3 },
        { id: 'f-e-83', section_id: 'sec-exec-present-job', field_key: 'salary_gross', label: 'Salary — Gross Agreed (PKR)', field_type: 'number', is_required: false, order_index: 4 },
        { id: 'f-e-84', section_id: 'sec-exec-present-job', field_key: 'work_location', label: 'Work Location / Hub', field_type: 'text', is_required: false, order_index: 5 },
      ],
    },
    {
      id: 'sec-exec-preferences',
      template_id: execTemplateId,
      title: 'Work Preferences',
      order_index: 8,
      description: 'Mobility, travel willingness, own vehicle, and driver license',
      fields: [
        { id: 'f-e-90', section_id: 'sec-exec-preferences', field_key: 'work_anywhere_pakistan', label: 'Prepared to work anywhere in Pakistan?', field_type: 'yes_no', is_required: true, order_index: 1 },
        { id: 'f-e-91', section_id: 'sec-exec-preferences', field_key: 'extensive_travel', label: 'Prepared for extensive travel?', field_type: 'yes_no', is_required: true, order_index: 2 },
        { id: 'f-e-92', section_id: 'sec-exec-preferences', field_key: 'own_transport', label: 'Do you have your own transport?', field_type: 'yes_no', is_required: true, order_index: 3 },
        { id: 'f-e-93', section_id: 'sec-exec-preferences', field_key: 'driving_license', label: 'Do you have a Driving License?', field_type: 'yes_no', is_required: true, order_index: 4 },
      ],
    },
    {
      id: 'sec-exec-emergency',
      template_id: execTemplateId,
      title: 'Emergency Contact',
      order_index: 9,
      description: 'Designated next-of-kin or emergency respondent coordinates',
      fields: [
        { id: 'f-e-100', section_id: 'sec-exec-emergency', field_key: 'emergency_name', label: 'Full Name', field_type: 'text', is_required: true, order_index: 1 },
        { id: 'f-e-101', section_id: 'sec-exec-emergency', field_key: 'emergency_address', label: 'Address', field_type: 'textarea', is_required: true, order_index: 2 },
        { id: 'f-e-102', section_id: 'sec-exec-emergency', field_key: 'emergency_city', label: 'City', field_type: 'text', is_required: true, order_index: 3 },
        { id: 'f-e-103', section_id: 'sec-exec-emergency', field_key: 'emergency_relationship', label: 'Relationship', field_type: 'text', is_required: true, order_index: 4 },
        { id: 'f-e-104', section_id: 'sec-exec-emergency', field_key: 'emergency_contact', label: 'Contact Number', field_type: 'text', is_required: true, order_index: 5, placeholder: '03XXXXXXXXX' },
      ],
    },
    {
      id: 'sec-exec-references',
      template_id: execTemplateId,
      title: 'References',
      order_index: 10,
      description: 'Four credible references (2 personal, 2 professional business contacts)',
      fields: [
        {
          id: 'f-e-110',
          section_id: 'sec-exec-references',
          field_key: 'references_table',
          label: 'References (4 rows: Personal 1, Personal 2, Business 1, Business 2)',
          field_type: 'repeatable_table',
          is_required: true,
          order_index: 1,
          table_columns: [
            { key: 'category', label: 'Category', type: 'dropdown', options: ['Personal (1)', 'Personal (2)', 'Business (1)', 'Business (2)'] },
            { key: 'name', label: 'Full Name', type: 'text' },
            { key: 'position', label: 'Designation / Organization', type: 'text' },
            { key: 'address', label: 'Postal Address', type: 'text' },
            { key: 'contact_no', label: 'Contact Number', type: 'text' },
          ],
        },
        { id: 'f-e-111', section_id: 'sec-exec-references', field_key: 'has_relative_in_company', label: 'Does any relative or friend work in this organization?', field_type: 'yes_no', is_required: true, order_index: 2, conditional_label: 'If yes, state Name, Designation, and Relationship' },
      ],
    },
    {
      id: 'sec-exec-interests',
      template_id: execTemplateId,
      title: 'Interests & Career Choice',
      order_index: 11,
      description: 'Professional memberships, organizational alignment, and candidate statement',
      fields: [
        { id: 'f-e-120', section_id: 'sec-exec-interests', field_key: 'club_memberships', label: 'Membership of Professional, Social, Cultural Organizations and Clubs', field_type: 'textarea', is_required: false, order_index: 1 },
        { id: 'f-e-121', section_id: 'sec-exec-interests', field_key: 'reasons_for_selecting', label: 'Reasons for selecting this organization', field_type: 'textarea', is_required: true, order_index: 2 },
        { id: 'f-e-122', section_id: 'sec-exec-interests', field_key: 'suitability_statement', label: 'Why do you consider yourself suitable for the position applied?', field_type: 'textarea', is_required: true, order_index: 3 },
      ],
    },
    {
      id: 'sec-exec-declaration',
      template_id: execTemplateId,
      title: 'Declaration',
      order_index: 12,
      description: 'Legal affirmation of truthfulness and declaration of signing particulars',
      fields: [
        { id: 'f-e-130', section_id: 'sec-exec-declaration', field_key: 'place', label: 'Place (City of Signing)', field_type: 'text', is_required: true, order_index: 1, placeholder: 'e.g. Lahore / Karachi / Islamabad' },
        { id: 'f-e-131', section_id: 'sec-exec-declaration', field_key: 'signing_date', label: 'Date of Signing', field_type: 'date', is_required: true, order_index: 2 },
      ],
    },
  ];

  const executiveTemplate: FormTemplateItem = {
    id: execTemplateId,
    track: 'executive',
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    sections: execSections,
  };

  // 2. Non-Executive Track Template
  const nonExecTemplateId = 'tmpl-non-executive-v1';
  const nonExecSections: FormSectionItem[] = [
    {
      id: 'sec-nex-employee',
      template_id: nonExecTemplateId,
      title: 'Employee Information',
      order_index: 1,
      description: 'Frontline candidate biographical data and identity particulars',
      fields: [
        { id: 'f-ne-1', section_id: 'sec-nex-employee', field_key: 'designation_applied', label: 'Designation Applied For', field_type: 'text', is_required: true, order_index: 1 },
        { id: 'f-ne-2', section_id: 'sec-nex-employee', field_key: 'name_as_per_cnic', label: 'Name, as per CNIC', field_type: 'text', is_required: true, order_index: 2 },
        { id: 'f-ne-3', section_id: 'sec-nex-employee', field_key: 'cnic', label: 'Employee CNIC Number (13 Digits)', field_type: 'text', is_required: true, order_index: 3, placeholder: '35201-1234567-1' },
        { id: 'f-ne-4', section_id: 'sec-nex-employee', field_key: 'dob', label: 'Date of Birth', field_type: 'date', is_required: true, order_index: 4 },
        { id: 'f-ne-5', section_id: 'sec-nex-employee', field_key: 'contact_number', label: 'Contact Number (Mobile)', field_type: 'text', is_required: true, order_index: 5, placeholder: '03001234567' },
        { id: 'f-ne-6', section_id: 'sec-nex-employee', field_key: 'cnic_issue_date', label: 'CNIC Issuance Date', field_type: 'date', is_required: false, order_index: 6 },
        { id: 'f-ne-7', section_id: 'sec-nex-employee', field_key: 'cnic_expiry_date', label: 'CNIC Expiry Date', field_type: 'date', is_required: false, order_index: 7 },
        { id: 'f-ne-8', section_id: 'sec-nex-employee', field_key: 'marital_status', label: 'Marital Status', field_type: 'dropdown', is_required: true, order_index: 8, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
        { id: 'f-ne-9', section_id: 'sec-nex-employee', field_key: 'place_of_birth', label: 'Place of Birth', field_type: 'text', is_required: true, order_index: 9 },
        { id: 'f-ne-10', section_id: 'sec-nex-employee', field_key: 'gender', label: 'Gender', field_type: 'dropdown', is_required: true, order_index: 10, options: ['Male', 'Female', 'Other'] },
        { id: 'f-ne-11', section_id: 'sec-nex-employee', field_key: 'blood_group', label: 'Blood Group', field_type: 'dropdown', is_required: true, order_index: 11, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
        { id: 'f-ne-12', section_id: 'sec-nex-employee', field_key: 'father_name_cnic', label: "Father's Name, as per CNIC", field_type: 'text', is_required: true, order_index: 12 },
        { id: 'f-ne-13', section_id: 'sec-nex-employee', field_key: 'religion', label: 'Religion', field_type: 'text', is_required: false, order_index: 13 },
        { id: 'f-ne-14', section_id: 'sec-nex-employee', field_key: 'father_cnic', label: "Father's CNIC Number", field_type: 'text', is_required: false, order_index: 14, placeholder: '35201-XXXXXXX-X' },
        { id: 'f-ne-15', section_id: 'sec-nex-employee', field_key: 'mother_name_cnic', label: "Mother's Name, as per CNIC", field_type: 'text', is_required: false, order_index: 15 },
      ],
    },
    {
      id: 'sec-nex-address',
      template_id: nonExecTemplateId,
      title: 'Address & Family',
      order_index: 2,
      description: 'Residential coordinates, next of kin, and internal company relatives',
      fields: [
        { id: 'f-ne-20', section_id: 'sec-nex-address', field_key: 'permanent_address', label: 'Permanent Address', field_type: 'textarea', is_required: true, order_index: 1 },
        { id: 'f-ne-21', section_id: 'sec-nex-address', field_key: 'current_address', label: 'Current Address', field_type: 'textarea', is_required: true, order_index: 2 },
        { id: 'f-ne-22', section_id: 'sec-nex-address', field_key: 'next_of_kin_name', label: 'Next of Kin Name', field_type: 'text', is_required: true, order_index: 3 },
        { id: 'f-ne-23', section_id: 'sec-nex-address', field_key: 'next_of_kin_relation', label: 'Next of Kin Relationship', field_type: 'text', is_required: true, order_index: 4 },
        { id: 'f-ne-24', section_id: 'sec-nex-address', field_key: 'next_of_kin_contact', label: 'Next of Kin Contact Number', field_type: 'text', is_required: true, order_index: 5, placeholder: '03XXXXXXXXX' },
        { id: 'f-ne-25', section_id: 'sec-nex-address', field_key: 'has_relative_working', label: 'Any relative/blood relation working within the company?', field_type: 'yes_no', is_required: true, order_index: 6, conditional_label: 'If yes, please specify relative name, branch, and role' },
      ],
    },
    {
      id: 'sec-nex-experience',
      template_id: nonExecTemplateId,
      title: 'Experience',
      order_index: 3,
      description: 'Tenure in applied operational role and geographic flexibility',
      fields: [
        { id: 'f-ne-30', section_id: 'sec-nex-experience', field_key: 'total_experience', label: 'Total Experience in Position Applied', field_type: 'text', is_required: true, order_index: 1, placeholder: 'e.g. 2 Years as Delivery Courier' },
        { id: 'f-ne-31', section_id: 'sec-nex-experience', field_key: 'willing_to_work_anywhere', label: 'Willing to work anywhere in Pakistan?', field_type: 'yes_no', is_required: true, order_index: 2 },
      ],
    },
    {
      id: 'sec-nex-academic',
      template_id: nonExecTemplateId,
      title: 'Academic Details',
      order_index: 4,
      description: 'Educational certificates and academic background',
      fields: [
        {
          id: 'f-ne-40',
          section_id: 'sec-nex-academic',
          field_key: 'academic_record',
          label: 'Academic Record',
          field_type: 'repeatable_table',
          is_required: true,
          order_index: 1,
          table_columns: [
            { key: 'degree', label: 'Degree / Certificate', type: 'dropdown', options: ['Matriculation', 'Intermediate', 'Graduation', 'Masters', 'Professional', 'Other'] },
            { key: 'subjects', label: 'Subjects', type: 'text' },
            { key: 'institute', label: 'Institute / School', type: 'text' },
            { key: 'passing_year', label: 'Passing Year', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'sec-nex-employment',
      template_id: nonExecTemplateId,
      title: 'Employment Record',
      order_index: 5,
      description: 'Previous logistics hubs, courier companies, or warehouse roles',
      fields: [
        {
          id: 'f-ne-50',
          section_id: 'sec-nex-employment',
          field_key: 'employment_record',
          label: 'Employment Record',
          field_type: 'repeatable_table',
          is_required: false,
          order_index: 1,
          table_columns: [
            { key: 'company_name', label: 'Company Name', type: 'text' },
            { key: 'position', label: 'Position', type: 'text' },
            { key: 'responsibilities', label: 'Major Responsibilities', type: 'text' },
            { key: 'duration_from', label: 'Duration From', type: 'date' },
            { key: 'duration_to', label: 'Duration To', type: 'date' },
            { key: 'achievements', label: 'Achievements / Notes', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'sec-nex-references',
      template_id: nonExecTemplateId,
      title: 'References',
      order_index: 6,
      description: 'Four credible references (2 personal acquaintances, 2 business or past employers)',
      fields: [
        {
          id: 'f-ne-60',
          section_id: 'sec-nex-references',
          field_key: 'references_table',
          label: 'References (4 fixed rows: Personal 1, Personal 2, Business 1, Business 2)',
          field_type: 'repeatable_table',
          is_required: true,
          order_index: 1,
          table_columns: [
            { key: 'type', label: 'Type', type: 'dropdown', options: ['Personal (1)', 'Personal (2)', 'Business (1)', 'Business (2)'] },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'position_relation', label: 'Position / Relationship', type: 'text' },
            { key: 'contact_number', label: 'Contact Number', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'sec-nex-current-job',
      template_id: nonExecTemplateId,
      title: 'Current Job Information',
      order_index: 7,
      description: 'Assigned division, zone, operational branch, department, and salary',
      fields: [
        { id: 'f-ne-70', section_id: 'sec-nex-current-job', field_key: 'division', label: 'Division', field_type: 'text', is_required: false, order_index: 1 },
        { id: 'f-ne-71', section_id: 'sec-nex-current-job', field_key: 'zone', label: 'Zone (Pre-filled from assignment)', field_type: 'text', is_required: false, order_index: 2 },
        { id: 'f-ne-72', section_id: 'sec-nex-current-job', field_key: 'branch', label: 'Branch / Hub', field_type: 'text', is_required: false, order_index: 3 },
        { id: 'f-ne-73', section_id: 'sec-nex-current-job', field_key: 'work_location', label: 'Area / Work Location', field_type: 'text', is_required: false, order_index: 4 },
        { id: 'f-ne-74', section_id: 'sec-nex-current-job', field_key: 'department', label: 'Department', field_type: 'text', is_required: false, order_index: 5 },
        { id: 'f-ne-75', section_id: 'sec-nex-current-job', field_key: 'sub_department', label: 'Sub Department', field_type: 'text', is_required: false, order_index: 6 },
        { id: 'f-ne-76', section_id: 'sec-nex-current-job', field_key: 'function', label: 'Function', field_type: 'text', is_required: false, order_index: 7 },
        { id: 'f-ne-77', section_id: 'sec-nex-current-job', field_key: 'current_designation', label: 'Current Designation', field_type: 'text', is_required: false, order_index: 8 },
        { id: 'f-ne-78', section_id: 'sec-nex-current-job', field_key: 'additional_replacement', label: 'Additional / Replacement', field_type: 'text', is_required: false, order_index: 9 },
        { id: 'f-ne-79', section_id: 'sec-nex-current-job', field_key: 'date_of_joining', label: 'Date of Joining', field_type: 'date', is_required: false, order_index: 10 },
        { id: 'f-ne-80', section_id: 'sec-nex-current-job', field_key: 'monthly_gross_salary', label: 'Monthly Gross Salary (PKR)', field_type: 'number', is_required: false, order_index: 11 },
        { id: 'f-ne-81', section_id: 'sec-nex-current-job', field_key: 'shift_details', label: 'Shift Details (Day / Night / Morning)', field_type: 'text', is_required: false, order_index: 12 },
      ],
    },
    {
      id: 'sec-nex-declaration',
      template_id: nonExecTemplateId,
      title: 'Declaration',
      order_index: 8,
      description: 'Affirmation of truthfulness, financial consent, and declaration of signing particulars',
      fields: [
        { id: 'f-ne-90', section_id: 'sec-nex-declaration', field_key: 'place', label: 'Place (City of Signing)', field_type: 'text', is_required: true, order_index: 1, placeholder: 'e.g. Lahore / Karachi / Islamabad' },
        { id: 'f-ne-91', section_id: 'sec-nex-declaration', field_key: 'signing_date', label: 'Date of Signing', field_type: 'date', is_required: true, order_index: 2 },
      ],
    },
  ];

  const nonExecutiveTemplate: FormTemplateItem = {
    id: nonExecTemplateId,
    track: 'non_executive',
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    sections: nonExecSections,
  };

  return { executive: executiveTemplate, non_executive: nonExecutiveTemplate };
}

// ------------------------------------------------------------------------------
// In-Memory & Database-Synchronized Form Store Class
// ------------------------------------------------------------------------------

export class FormTemplatesService {
  private templates: { executive: FormTemplateItem; non_executive: FormTemplateItem };
  private orgSettings: OrganizationSettings;
  private candidateTrackMap: Map<string, CandidateTrack> = new Map();

  constructor() {
    this.templates = getInitialSeedTemplates();
    this.orgSettings = {
      id: 'default-org-settings',
      company_name: 'PostEx',
      portal_name: 'HR Onboarding Portal',
      support_email: 'hr-support@postex.pk',
      data_retention_days: 90,
      auto_archive_enabled: true,
      updated_at: new Date().toISOString(),
    };
  }

  // --- Candidate Track Management ---
  setCandidateTrack(candidateId: string, track: CandidateTrack) {
    this.candidateTrackMap.set(candidateId, track);
  }

  getCandidateTrack(candidateId: string): CandidateTrack {
    return this.candidateTrackMap.get(candidateId) || 'executive';
  }

  // --- Organization Branding ---
  async getOrgSettings(supabase?: SupabaseClient): Promise<OrganizationSettings> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          this.orgSettings = {
            id: data.id,
            company_name: data.company_name || this.orgSettings.company_name,
            portal_name: data.portal_name || this.orgSettings.portal_name,
            logo_storage_path: data.logo_storage_path || this.orgSettings.logo_storage_path,
            support_email: data.support_email || this.orgSettings.support_email,
            data_retention_days: data.data_retention_days || this.orgSettings.data_retention_days,
            auto_archive_enabled: data.auto_archive_enabled ?? this.orgSettings.auto_archive_enabled,
            updated_at: data.updated_at || this.orgSettings.updated_at,
            updated_by: data.updated_by,
          };
        }
      } catch (e) {
        // Fallback to cache if table not ready
      }
    }
    return this.orgSettings;
  }

  async updateOrgSettings(
    updates: Partial<OrganizationSettings>,
    updatedBy?: string,
    supabase?: SupabaseClient
  ): Promise<OrganizationSettings> {
    const updated: OrganizationSettings = {
      ...this.orgSettings,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || this.orgSettings.updated_by,
    };
    this.orgSettings = updated;

    if (supabase) {
      try {
        await supabase.from('organization_settings').upsert({
          id: this.orgSettings.id,
          company_name: updated.company_name,
          portal_name: updated.portal_name,
          logo_storage_path: updated.logo_storage_path,
          support_email: updated.support_email,
          data_retention_days: updated.data_retention_days,
          auto_archive_enabled: updated.auto_archive_enabled,
          updated_at: updated.updated_at,
          updated_by: updated.updated_by,
        });
      } catch (e) {
        console.warn('Could not write to organization_settings table in Supabase yet:', e);
      }
    }

    return this.orgSettings;
  }

  // --- Form Template Retrieval ---
  async getActiveTemplate(track: CandidateTrack, supabase?: SupabaseClient): Promise<FormTemplateItem> {
    return this.getTemplateForTrack(track, supabase);
  }

  async getTemplateForTrack(track: CandidateTrack, supabase?: SupabaseClient): Promise<FormTemplateItem> {
    if (supabase) {
      try {
        const { data: dbTemplate, error: tErr } = await supabase
          .from('form_templates')
          .select('*')
          .eq('track', track)
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbTemplate && !tErr) {
          const { data: dbSections } = await supabase
            .from('form_sections')
            .select('*')
            .eq('template_id', dbTemplate.id)
            .order('order_index', { ascending: true });

          if (dbSections && dbSections.length > 0) {
            const sectionIds = dbSections.map((s) => s.id);
            const { data: dbFields } = await supabase
              .from('form_fields')
              .select('*')
              .in('section_id', sectionIds)
              .order('order_index', { ascending: true });

            const fieldsBySection: Record<string, FormFieldItem[]> = {};
            for (const f of dbFields || []) {
              if (!fieldsBySection[f.section_id]) fieldsBySection[f.section_id] = [];
              fieldsBySection[f.section_id].push({
                id: f.id,
                section_id: f.section_id,
                field_key: f.field_key,
                label: f.label,
                field_type: f.field_type as FormFieldType,
                is_required: Boolean(f.is_required),
                order_index: f.order_index,
                options: f.options || [],
                table_columns: f.table_columns || [],
                conditional_label: f.conditional_label,
                placeholder: f.placeholder,
              });
            }

            const compiledSections: FormSectionItem[] = dbSections.map((s) => ({
              id: s.id,
              template_id: s.template_id,
              title: s.title,
              order_index: s.order_index,
              description: s.description,
              fields: fieldsBySection[s.id] || [],
            }));

            this.templates[track] = {
              id: dbTemplate.id,
              track,
              version: dbTemplate.version || 1,
              is_active: Boolean(dbTemplate.is_active),
              created_at: dbTemplate.created_at || new Date().toISOString(),
              sections: compiledSections,
            };
          }
        }
      } catch (e) {
        // Fallback to memory store if tables not yet populated
      }
    }

    return this.templates[track];
  }

  // --- Add Field ---
  async addField(
    track: CandidateTrack,
    sectionId: string,
    fieldData: Omit<FormFieldItem, 'id' | 'section_id'>,
    supabase?: SupabaseClient
  ): Promise<FormFieldItem> {
    const template = this.templates[track];
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new Error(`Section ${sectionId} not found in ${track} track template.`);
    }

    const newFieldId = `field-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newField: FormFieldItem = {
      id: newFieldId,
      section_id: sectionId,
      field_key: fieldData.field_key || `custom_${Date.now()}`,
      label: fieldData.label,
      field_type: fieldData.field_type,
      is_required: Boolean(fieldData.is_required),
      order_index: fieldData.order_index ?? section.fields.length + 1,
      options: fieldData.options || [],
      table_columns: fieldData.table_columns || [],
      conditional_label: fieldData.conditional_label,
      placeholder: fieldData.placeholder,
    };

    section.fields.push(newField);
    section.fields.sort((a, b) => a.order_index - b.order_index);

    if (supabase) {
      try {
        await supabase.from('form_fields').insert({
          id: newField.id,
          section_id: newField.section_id,
          field_key: newField.field_key,
          label: newField.label,
          field_type: newField.field_type,
          is_required: newField.is_required,
          order_index: newField.order_index,
          options: newField.options,
          table_columns: newField.table_columns,
        });
      } catch (e) {
        console.warn('Could not insert into form_fields in Supabase:', e);
      }
    }

    return newField;
  }

  // --- Update Field ---
  async updateField(
    track: CandidateTrack,
    fieldId: string,
    updates: Partial<FormFieldItem>,
    supabase?: SupabaseClient
  ): Promise<FormFieldItem> {
    const template = this.templates[track];
    let targetField: FormFieldItem | null = null;

    for (const section of template.sections) {
      const idx = section.fields.findIndex((f) => f.id === fieldId);
      if (idx !== -1) {
        section.fields[idx] = { ...section.fields[idx], ...updates };
        targetField = section.fields[idx];
        break;
      }
    }

    if (!targetField) {
      throw new Error(`Field ${fieldId} not found in ${track} track template.`);
    }

    if (supabase) {
      try {
        await supabase
          .from('form_fields')
          .update({
            label: targetField.label,
            field_type: targetField.field_type,
            is_required: targetField.is_required,
            order_index: targetField.order_index,
            options: targetField.options,
            table_columns: targetField.table_columns,
          })
          .eq('id', fieldId);
      } catch (e) {
        console.warn('Could not update form_fields in Supabase:', e);
      }
    }

    return targetField;
  }

  // --- Delete Field ---
  async deleteField(track: CandidateTrack, fieldId: string, supabase?: SupabaseClient): Promise<boolean> {
    const template = this.templates[track];
    let deleted = false;

    for (const section of template.sections) {
      const idx = section.fields.findIndex((f) => f.id === fieldId);
      if (idx !== -1) {
        section.fields.splice(idx, 1);
        deleted = true;
        break;
      }
    }

    if (supabase && deleted) {
      try {
        await supabase.from('form_fields').delete().eq('id', fieldId);
      } catch (e) {
        console.warn('Could not delete from form_fields in Supabase:', e);
      }
    }

    return deleted;
  }

  // --- Reorder Fields / Sections ---
  async reorderFields(
    track: CandidateTrack,
    sectionId: string,
    fieldIdsInOrder: string[],
    supabase?: SupabaseClient
  ): Promise<FormFieldItem[]> {
    const template = this.templates[track];
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error('Section not found');

    const fieldMap = new Map(section.fields.map((f) => [f.id, f]));
    const reordered: FormFieldItem[] = [];

    fieldIdsInOrder.forEach((id, index) => {
      const f = fieldMap.get(id);
      if (f) {
        f.order_index = index + 1;
        reordered.push(f);
      }
    });

    section.fields = reordered;

    if (supabase) {
      try {
        for (const f of reordered) {
          await supabase.from('form_fields').update({ order_index: f.order_index }).eq('id', f.id);
        }
      } catch (e) {
        console.warn('Could not update order in Supabase:', e);
      }
    }

    return reordered;
  }

  // --- Add Section ---
  async addSection(
    track: CandidateTrack,
    title: string,
    description?: string,
    supabase?: SupabaseClient
  ): Promise<FormSectionItem> {
    const template = this.templates[track];
    const newSectionId = `sec-${track}-${Date.now()}`;
    const newSection: FormSectionItem = {
      id: newSectionId,
      template_id: template.id,
      title: title.trim(),
      order_index: template.sections.length + 1,
      description: description || '',
      fields: [],
    };

    template.sections.push(newSection);

    if (supabase) {
      try {
        await supabase.from('form_sections').insert({
          id: newSection.id,
          template_id: newSection.template_id,
          title: newSection.title,
          order_index: newSection.order_index,
          description: newSection.description,
        });
      } catch (e) {
        console.warn('Could not insert section into Supabase:', e);
      }
    }

    return newSection;
  }

  // --- Reset to Default Seed Template ---
  resetTrackToDefault(track: CandidateTrack): FormTemplateItem {
    const seeds = getInitialSeedTemplates();
    this.templates[track] = seeds[track];
    return this.templates[track];
  }
}

export const formTemplatesService = new FormTemplatesService();
