// ==============================================================================
// Supabase-Backed Form Templates & Organization Settings Service
// Replaces file-based storage with 100% durable Supabase Postgres persistence.
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CandidateTrack,
  FormFieldItem,
  FormFieldType,
  FormSectionItem,
  FormTemplateItem,
  OrganizationSettings,
} from '../types/formTemplates';
import { getInitialSeedTemplates } from './seedTemplates';

export class FormTemplatesDbService {
  // --------------------------------------------------------------------------
  // 1. Organization Settings
  // --------------------------------------------------------------------------
  async getOrgSettings(supabase: SupabaseClient): Promise<OrganizationSettings> {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching organization_settings from Supabase:', error);
      throw new Error(`Failed to load organization settings: ${error.message}`);
    }

    if (!data) {
      // Create default row in Supabase
      const defaultSettings: OrganizationSettings = {
        id: 'default-org-settings',
        company_name: 'PostEx',
        portal_name: 'HR Onboarding Portal',
        support_email: 'hr-support@postex.pk',
        data_retention_days: 90,
        auto_archive_enabled: true,
        updated_at: new Date().toISOString(),
      };

      await supabase.from('organization_settings').insert(defaultSettings);
      return defaultSettings;
    }

    return {
      id: data.id,
      company_name: data.company_name || 'PostEx',
      portal_name: data.portal_name || 'HR Onboarding Portal',
      logo_storage_path: data.logo_storage_path,
      support_email: data.support_email || 'hr-support@postex.pk',
      data_retention_days: data.data_retention_days ?? 90,
      auto_archive_enabled: data.auto_archive_enabled ?? true,
      updated_at: data.updated_at || new Date().toISOString(),
      updated_by: data.updated_by,
    };
  }

  async updateOrgSettings(
    settings: Partial<OrganizationSettings>,
    userId: string | undefined,
    supabase: SupabaseClient
  ): Promise<OrganizationSettings> {
    const existing = await this.getOrgSettings(supabase);

    const updatePayload = {
      company_name: settings.company_name ?? existing.company_name,
      portal_name: settings.portal_name ?? existing.portal_name,
      logo_storage_path: settings.logo_storage_path ?? existing.logo_storage_path,
      support_email: settings.support_email ?? existing.support_email,
      data_retention_days: settings.data_retention_days ?? existing.data_retention_days,
      auto_archive_enabled: settings.auto_archive_enabled ?? existing.auto_archive_enabled,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };

    const { data, error } = await supabase
      .from('organization_settings')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update organization settings in Supabase: ${error.message}`);
    }

    return data;
  }

  // --------------------------------------------------------------------------
  // 2. Active Form Template Retrieval
  // --------------------------------------------------------------------------
  async getActiveTemplate(track: CandidateTrack, supabase: SupabaseClient): Promise<FormTemplateItem> {
    const { data: dbTemplate, error: tErr } = await supabase
      .from('form_templates')
      .select('*')
      .eq('track', track)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tErr || !dbTemplate) {
      throw new Error(`Failed to load ${track} form template from Supabase: ${tErr?.message || 'Template not found'}`);
    }

    const { data: dbSections, error: sErr } = await supabase
      .from('form_sections')
      .select('*')
      .eq('template_id', dbTemplate.id)
      .order('order_index', { ascending: true });

    if (sErr) {
      throw new Error(`Failed to load sections for template ${dbTemplate.id}: ${sErr.message}`);
    }

    const sectionIds = (dbSections || []).map((s) => s.id);
    let dbFields: any[] = [];

    if (sectionIds.length > 0) {
      const { data: fieldsData, error: fErr } = await supabase
        .from('form_fields')
        .select('*')
        .in('section_id', sectionIds)
        .order('order_index', { ascending: true });

      if (fErr) {
        throw new Error(`Failed to load fields for template ${dbTemplate.id}: ${fErr.message}`);
      }
      dbFields = fieldsData || [];
    }

    const fieldsBySection: Record<string, FormFieldItem[]> = {};
    for (const f of dbFields) {
      if (!fieldsBySection[f.section_id]) fieldsBySection[f.section_id] = [];
      fieldsBySection[f.section_id].push({
        id: f.id,
        section_id: f.section_id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type as FormFieldType,
        is_required: Boolean(f.is_required),
        order_index: f.order_index,
        options: Array.isArray(f.options) ? f.options : [],
        table_columns: Array.isArray(f.table_columns) ? f.table_columns : [],
        conditional_label: f.conditional_label || undefined,
        placeholder: f.placeholder || undefined,
      });
    }

    const compiledSections: FormSectionItem[] = (dbSections || []).map((s) => ({
      id: s.id,
      template_id: s.template_id,
      title: s.title,
      order_index: s.order_index,
      description: s.description || undefined,
      fields: fieldsBySection[s.id] || [],
    }));

    return {
      id: dbTemplate.id,
      track: dbTemplate.track as CandidateTrack,
      version: dbTemplate.version || 1,
      is_active: Boolean(dbTemplate.is_active),
      created_at: dbTemplate.created_at || new Date().toISOString(),
      sections: compiledSections,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Form Field Operations (Direct to Supabase Postgres)
  // --------------------------------------------------------------------------
  async addField(
    track: CandidateTrack,
    sectionId: string,
    fieldData: Omit<FormFieldItem, 'id' | 'section_id'>,
    supabase: SupabaseClient
  ): Promise<FormFieldItem> {
    const newFieldId = `fld-${track.slice(0, 4)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const insertPayload = {
      id: newFieldId,
      section_id: sectionId,
      field_key: fieldData.field_key || `field_${Date.now()}`,
      label: fieldData.label,
      field_type: fieldData.field_type,
      is_required: Boolean(fieldData.is_required),
      order_index: fieldData.order_index ?? 99,
      options: fieldData.options || [],
      table_columns: fieldData.table_columns || [],
      conditional_label: fieldData.conditional_label || null,
      placeholder: fieldData.placeholder || null,
    };

    const { data, error } = await supabase
      .from('form_fields')
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to add form field to Supabase: ${error?.message || 'Unknown error'}`);
    }

    return {
      id: data.id,
      section_id: data.section_id,
      field_key: data.field_key,
      label: data.label,
      field_type: data.field_type as FormFieldType,
      is_required: Boolean(data.is_required),
      order_index: data.order_index,
      options: data.options || [],
      table_columns: data.table_columns || [],
      conditional_label: data.conditional_label,
      placeholder: data.placeholder,
    };
  }

  async updateField(
    track: CandidateTrack,
    fieldId: string,
    updates: Partial<FormFieldItem>,
    supabase: SupabaseClient
  ): Promise<FormFieldItem> {
    const updatePayload: Record<string, any> = {};

    if (updates.label !== undefined) updatePayload.label = updates.label;
    if (updates.field_type !== undefined) updatePayload.field_type = updates.field_type;
    if (updates.is_required !== undefined) updatePayload.is_required = updates.is_required;
    if (updates.order_index !== undefined) updatePayload.order_index = updates.order_index;
    if (updates.options !== undefined) updatePayload.options = updates.options;
    if (updates.table_columns !== undefined) updatePayload.table_columns = updates.table_columns;
    if (updates.conditional_label !== undefined) updatePayload.conditional_label = updates.conditional_label;
    if (updates.placeholder !== undefined) updatePayload.placeholder = updates.placeholder;

    const { data, error } = await supabase
      .from('form_fields')
      .update(updatePayload)
      .eq('id', fieldId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update form field ${fieldId} in Supabase: ${error?.message || 'Field not found'}`);
    }

    return {
      id: data.id,
      section_id: data.section_id,
      field_key: data.field_key,
      label: data.label,
      field_type: data.field_type as FormFieldType,
      is_required: Boolean(data.is_required),
      order_index: data.order_index,
      options: data.options || [],
      table_columns: data.table_columns || [],
      conditional_label: data.conditional_label,
      placeholder: data.placeholder,
    };
  }

  async deleteField(track: CandidateTrack, fieldId: string, supabase: SupabaseClient): Promise<boolean> {
    const { error } = await supabase.from('form_fields').delete().eq('id', fieldId);
    if (error) {
      throw new Error(`Failed to delete form field ${fieldId} from Supabase: ${error.message}`);
    }
    return true;
  }

  async reorderFields(
    track: CandidateTrack,
    sectionId: string,
    fieldIdsInOrder: string[],
    supabase: SupabaseClient
  ): Promise<FormFieldItem[]> {
    for (let index = 0; index < fieldIdsInOrder.length; index++) {
      const fieldId = fieldIdsInOrder[index];
      const { error } = await supabase
        .from('form_fields')
        .update({ order_index: index + 1 })
        .eq('id', fieldId)
        .eq('section_id', sectionId);

      if (error) {
        console.warn(`Failed to update order_index for field ${fieldId}:`, error.message);
      }
    }

    const { data: updatedFields, error: fetchErr } = await supabase
      .from('form_fields')
      .select('*')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: true });

    if (fetchErr) {
      throw new Error(`Failed to retrieve reordered fields: ${fetchErr.message}`);
    }

    return (updatedFields || []).map((f) => ({
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
    }));
  }

  // --------------------------------------------------------------------------
  // 4. Form Section Operations (Direct to Supabase Postgres)
  // --------------------------------------------------------------------------
  async addSection(
    track: CandidateTrack,
    title: string,
    description: string | undefined,
    supabase: SupabaseClient
  ): Promise<FormSectionItem> {
    const template = await this.getActiveTemplate(track, supabase);
    const newSectionId = `sec-${track.slice(0, 4)}-${Date.now()}`;
    const newOrder = template.sections.length + 1;

    const { data, error } = await supabase
      .from('form_sections')
      .insert({
        id: newSectionId,
        template_id: template.id,
        title: title.trim(),
        order_index: newOrder,
        description: description || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to add section to Supabase: ${error?.message || 'Unknown error'}`);
    }

    return {
      id: data.id,
      template_id: data.template_id,
      title: data.title,
      order_index: data.order_index,
      description: data.description,
      fields: [],
    };
  }

  async deleteSection(track: CandidateTrack, sectionId: string, supabase: SupabaseClient): Promise<boolean> {
    // Delete fields in section first to guarantee clean deletion
    await supabase.from('form_fields').delete().eq('section_id', sectionId);
    const { error } = await supabase.from('form_sections').delete().eq('id', sectionId);
    if (error) {
      throw new Error(`Failed to delete section ${sectionId} from Supabase: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 5. Reset Track to Default Official Template
  // --------------------------------------------------------------------------
  async resetTrackToDefault(track: CandidateTrack, supabase: SupabaseClient): Promise<FormTemplateItem> {
    const seeds = getInitialSeedTemplates();
    const seedTemplate = seeds[track];
    if (!seedTemplate) {
      throw new Error(`No seed template found for track ${track}`);
    }

    // Get existing template record
    let { data: template } = await supabase
      .from('form_templates')
      .select('id')
      .eq('track', track)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      const { data: newTmpl, error: tErr } = await supabase
        .from('form_templates')
        .insert({
          id: seedTemplate.id,
          track: seedTemplate.track,
          version: seedTemplate.version,
          is_active: true,
        })
        .select()
        .single();
      if (tErr) throw new Error(`Failed to create template: ${tErr.message}`);
      template = newTmpl;
    }

    // Find all current sections for this template
    const { data: currentSections } = await supabase
      .from('form_sections')
      .select('id')
      .eq('template_id', template!.id);

    const sectionIds = (currentSections || []).map((s) => s.id);
    if (sectionIds.length > 0) {
      // Delete existing fields
      await supabase.from('form_fields').delete().in('section_id', sectionIds);
      // Delete existing sections
      await supabase.from('form_sections').delete().eq('template_id', template!.id);
    }

    // Insert default seed sections and fields
    for (const sec of seedTemplate.sections) {
      await supabase.from('form_sections').insert({
        id: sec.id,
        template_id: template!.id,
        title: sec.title,
        order_index: sec.order_index,
        description: sec.description || null,
      });

      if (sec.fields && sec.fields.length > 0) {
        const fieldsToInsert = sec.fields.map((f) => ({
          id: f.id,
          section_id: sec.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: Boolean(f.is_required),
          order_index: f.order_index,
          options: f.options || [],
          table_columns: f.table_columns || [],
          conditional_label: f.conditional_label || null,
          placeholder: f.placeholder || null,
        }));
        await supabase.from('form_fields').insert(fieldsToInsert);
      }
    }

    return await this.getActiveTemplate(track, supabase);
  }

  // --------------------------------------------------------------------------
  // 6. Candidate Track Resolution (Supabase candidates table)
  // --------------------------------------------------------------------------
  async getCandidateTrack(candidateId: string, supabase: SupabaseClient): Promise<CandidateTrack> {
    const { data } = await supabase
      .from('candidates')
      .select('track')
      .eq('id', candidateId)
      .maybeSingle();

    if (data?.track === 'non_executive' || data?.track === 'executive') {
      return data.track;
    }
    return 'executive';
  }

  async setCandidateTrack(candidateId: string, track: CandidateTrack, supabase: SupabaseClient): Promise<void> {
    await supabase.from('candidates').update({ track }).eq('id', candidateId);
    await supabase.from('applications').update({ track }).eq('candidate_id', candidateId);
  }
}

export const formTemplatesService = new FormTemplatesDbService();
