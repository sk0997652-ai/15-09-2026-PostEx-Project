import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formBuilderApi } from '../../lib/formBuilderApi';
import {
  CandidateTrack,
  FormFieldItem,
  FormFieldType,
  FormSectionItem,
  FormTemplateItem,
} from '../../server/formTemplatesStore';

export const FormBuilderModule: React.FC = () => {
  const [selectedTrack, setSelectedTrack] = useState<CandidateTrack>('executive');
  const [template, setTemplate] = useState<FormTemplateItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Field Edit / Create Modal
  const [fieldModal, setFieldModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    sectionId: string;
    fieldId?: string;
    form: {
      label: string;
      field_key: string;
      field_type: FormFieldType;
      is_required: boolean;
      placeholder?: string;
      conditional_label?: string;
      optionsString?: string;
    };
  }>({
    open: false,
    mode: 'create',
    sectionId: '',
    form: {
      label: '',
      field_key: '',
      field_type: 'text',
      is_required: false,
    },
  });

  // Section Create Modal
  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: '',
    description: '',
  });

  const loadTemplate = async (track: CandidateTrack) => {
    try {
      setLoading(true);
      const data = await formBuilderApi.getTemplate(track);
      setTemplate(data);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load form template.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate(selectedTrack);
  }, [selectedTrack]);

  // Open Add Field
  const handleOpenAddField = (sectionId: string) => {
    setFieldModal({
      open: true,
      mode: 'create',
      sectionId,
      form: {
        label: '',
        field_key: '',
        field_type: 'text',
        is_required: false,
        placeholder: '',
        conditional_label: '',
        optionsString: '',
      },
    });
  };

  // Open Edit Field
  const handleOpenEditField = (sectionId: string, field: FormFieldItem) => {
    setFieldModal({
      open: true,
      mode: 'edit',
      sectionId,
      fieldId: field.id,
      form: {
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        is_required: field.is_required,
        placeholder: field.placeholder || '',
        conditional_label: field.conditional_label || '',
        optionsString: field.options ? field.options.join(', ') : '',
      },
    });
  };

  // Save Field
  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { mode, sectionId, fieldId, form } = fieldModal;
      const options = form.optionsString
        ? form.optionsString.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      if (mode === 'create') {
        await formBuilderApi.addField(selectedTrack, sectionId, {
          label: form.label,
          field_key: form.field_key || form.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          field_type: form.field_type,
          is_required: form.is_required,
          placeholder: form.placeholder,
          conditional_label: form.conditional_label,
          options,
        });
        setActionMessage({ type: 'success', text: `Field "${form.label}" added successfully.` });
      } else if (fieldId) {
        await formBuilderApi.updateField(selectedTrack, fieldId, {
          label: form.label,
          field_type: form.field_type,
          is_required: form.is_required,
          placeholder: form.placeholder,
          conditional_label: form.conditional_label,
          options,
        });
        setActionMessage({ type: 'success', text: `Field "${form.label}" updated successfully.` });
      }

      setFieldModal((prev) => ({ ...prev, open: false }));
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Operation failed.' });
    }
  };

  // Delete Field
  const handleDeleteField = async (fieldId: string, label: string) => {
    if (!window.confirm(`Are you sure you want to remove field "${label}" from the ${selectedTrack} form template?`)) {
      return;
    }
    try {
      await formBuilderApi.deleteField(selectedTrack, fieldId);
      setActionMessage({ type: 'success', text: `Field "${label}" deleted.` });
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete field.' });
    }
  };

  // Move Field Up/Down
  const handleMoveField = async (section: FormSectionItem, fieldIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    if (targetIndex < 0 || targetIndex >= section.fields.length) return;

    const newFields = [...section.fields];
    const [moved] = newFields.splice(fieldIndex, 1);
    newFields.splice(targetIndex, 0, moved);

    const orderedIds = newFields.map((f) => f.id);
    try {
      await formBuilderApi.reorderFields(selectedTrack, section.id, orderedIds);
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reorder fields.' });
    }
  };

  // Add Section
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await formBuilderApi.addSection(selectedTrack, sectionModal.title, sectionModal.description);
      setActionMessage({ type: 'success', text: `Section "${sectionModal.title}" created.` });
      setSectionModal({ open: false, title: '', description: '' });
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to add section.' });
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    const trackLabel = selectedTrack === 'executive' ? 'Executive Track' : 'Non-Executive Track';
    if (!window.confirm(`Are you sure you want to restore the official physical joining form defaults for ${trackLabel}? Any custom changes will be reset.`)) {
      return;
    }
    try {
      await formBuilderApi.resetToDefault(selectedTrack);
      setActionMessage({ type: 'success', text: `${trackLabel} restored to default physical form structure.` });
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reset template.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Track Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" />
            <span>Super Admin Dynamic Form Builder</span>
          </div>
          <h2 className="text-lg font-black text-slate-900">Joining Dossier Template Manager</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure sections, input fields, validations, and tables for both onboarding tracks.
          </p>
        </div>

        {/* Dual Track Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            id="tab-track-executive"
            onClick={() => setSelectedTrack('executive')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTrack === 'executive'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Executive Track
          </button>
          <button
            id="tab-track-non-executive"
            onClick={() => setSelectedTrack('non_executive')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTrack === 'non_executive'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Non-Executive Track
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* Track Overview Card */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>
                Active Template: {selectedTrack === 'executive' ? 'Executive Track' : 'Non-Executive Track'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                v{template?.version || 1}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {selectedTrack === 'executive'
                ? 'Corporate & management dossier: 12 sections including Education, Employment, Benefits & Referees.'
                : 'Operational frontline dossier: 8 sections including Employee Info, Address & Family, Academic, References & Job Info.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSectionModal({ open: true, title: '', description: '' })}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Section</span>
          </button>
          <button
            onClick={handleResetToDefault}
            title="Reset to official company physical form seed"
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Sections and Fields List */}
      <div className="space-y-6">
        {template?.sections.map((section, sIdx) => (
          <div key={section.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Section Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {sIdx + 1}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{section.title}</h3>
                  {section.description && (
                    <p className="text-[11px] text-slate-500">{section.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {section.fields.length} {section.fields.length === 1 ? 'field' : 'fields'}
                </span>
                <button
                  onClick={() => handleOpenAddField(section.id)}
                  className="px-2.5 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Field</span>
                </button>
              </div>
            </div>

            {/* Field Table */}
            <div className="divide-y divide-slate-100">
              {section.fields.map((field, fIdx) => (
                <div
                  key={field.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={fIdx === 0}
                        onClick={() => handleMoveField(section, fIdx, 'up')}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={fIdx === section.fields.length - 1}
                        onClick={() => handleMoveField(section, fIdx, 'down')}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Field Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{field.label}</span>
                        {field.is_required && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                            Required
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                          {field.field_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        <span>key: {field.field_key}</span>
                        {field.placeholder && <span>• placeholder: "{field.placeholder}"</span>}
                        {field.options && field.options.length > 0 && (
                          <span>• [{field.options.join(', ')}]</span>
                        )}
                        {field.table_columns && field.table_columns.length > 0 && (
                          <span>• cols: [{field.table_columns.map((c) => c.label).join(', ')}]</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditField(section.id, field)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Edit Field"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id, field.label)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {section.fields.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No fields in this section yet. Click "Add Field" to create one.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT FIELD MODAL */}
      {fieldModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {fieldModal.mode === 'create' ? 'Add New Form Field' : 'Edit Form Field'}
              </h3>
              <button
                onClick={() => setFieldModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Field Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Driving License Number"
                  value={fieldModal.form.label}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      form: {
                        ...fieldModal.form,
                        label: e.target.value,
                        field_key:
                          fieldModal.mode === 'create' && !fieldModal.form.field_key
                            ? e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
                            : fieldModal.form.field_key,
                      },
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Field Type</label>
                  <select
                    value={fieldModal.form.field_type}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        form: { ...fieldModal.form, field_type: e.target.value as FormFieldType },
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="text">Single-line Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date Picker</option>
                    <option value="dropdown">Dropdown Options</option>
                    <option value="yes_no">Yes / No Switch</option>
                    <option value="textarea">Multi-line Textarea</option>
                    <option value="repeatable_table">Repeatable Data Table</option>
                    <option value="signature">Candidate Signature</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Field Key (Unique Identifier)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. driving_license_no"
                    value={fieldModal.form.field_key}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        form: { ...fieldModal.form, field_key: e.target.value },
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              {fieldModal.form.field_type === 'dropdown' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Dropdown Options (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Male, Female, Other"
                    value={fieldModal.form.optionsString}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        form: { ...fieldModal.form, optionsString: e.target.value },
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              )}

              {fieldModal.form.field_type === 'yes_no' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Conditional Details Label (if "Yes" is selected)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. If yes, please specify relative details"
                    value={fieldModal.form.conditional_label}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        form: { ...fieldModal.form, conditional_label: e.target.value },
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Placeholder Text (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Enter registered engine number"
                  value={fieldModal.form.placeholder}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      form: { ...fieldModal.form, placeholder: e.target.value },
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={fieldModal.form.is_required}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        form: { ...fieldModal.form, is_required: e.target.checked },
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Mandatory Field (Candidate cannot proceed without filling)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFieldModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {fieldModal.mode === 'create' ? 'Create Field' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SECTION MODAL */}
      {sectionModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Section</h3>
              <button
                onClick={() => setSectionModal({ open: false, title: '', description: '' })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Section Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Additional Certifications"
                  value={sectionModal.title}
                  onChange={(e) => setSectionModal({ ...sectionModal, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Subtitle</label>
                <textarea
                  rows={2}
                  placeholder="Brief guidance for candidates filling this section..."
                  value={sectionModal.description}
                  onChange={(e) => setSectionModal({ ...sectionModal, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSectionModal({ open: false, title: '', description: '' })}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
