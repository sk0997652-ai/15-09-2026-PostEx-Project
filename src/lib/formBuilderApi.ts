import { CandidateTrack, FormFieldItem, FormSectionItem, FormTemplateItem } from '../server/formTemplatesStore';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = localStorage.getItem('postex_staff_token') || localStorage.getItem('supabase_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const formBuilderApi = {
  // Public or Candidate / Staff access to track template
  async getTemplate(track: CandidateTrack): Promise<FormTemplateItem> {
    const res = await fetch(`/api/form-templates/${track}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch form template');
    }
    return data.template;
  },

  // Add field
  async addField(
    track: CandidateTrack,
    sectionId: string,
    fieldData: Partial<FormFieldItem>
  ): Promise<FormFieldItem> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/form-builder/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ track, section_id: sectionId, ...fieldData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add field');
    }
    return data.field;
  },

  // Update field
  async updateField(
    track: CandidateTrack,
    fieldId: string,
    updates: Partial<FormFieldItem>
  ): Promise<FormFieldItem> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/form-builder/fields/${fieldId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ track, ...updates }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update field');
    }
    return data.field;
  },

  // Delete field
  async deleteField(track: CandidateTrack, fieldId: string): Promise<boolean> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/form-builder/fields/${fieldId}?track=${track}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete field');
    }
    return true;
  },

  // Reorder fields
  async reorderFields(track: CandidateTrack, sectionId: string, fieldIdsInOrder: string[]): Promise<FormFieldItem[]> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/form-builder/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ track, section_id: sectionId, field_ids: fieldIdsInOrder }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reorder fields');
    }
    return data.fields;
  },

  // Add section
  async addSection(track: CandidateTrack, title: string, description?: string): Promise<FormSectionItem> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/form-builder/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ track, title, description }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add section');
    }
    return data.section;
  },

  // Reset track to default
  async resetToDefault(track: CandidateTrack): Promise<FormTemplateItem> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/form-builder/reset-default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ track }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset template');
    }
    return data.template;
  },
};
