// ==============================================================================
// Dual-Track Form Templates, Sections, Fields & Organization Settings Types
// ==============================================================================

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
