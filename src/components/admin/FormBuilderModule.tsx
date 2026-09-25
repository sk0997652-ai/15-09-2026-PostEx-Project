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
  Sliders,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { formBuilderApi } from '../../lib/formBuilderApi';
import {
  CandidateTrack,
  FormFieldItem,
  FormFieldType,
  FormSectionItem,
  FormTemplateItem,
} from '../../types/formTemplates';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';
import { Button, Input, Select, Textarea } from '../ui';

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

  // Dedicated UI Confirmation Modal for Destructive Actions
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: 'field' | 'section' | 'reset';
    fieldId?: string;
    fieldName?: string;
    sectionId?: string;
    sectionTitle?: string;
    isDeleting?: boolean;
  }>({
    open: false,
    type: 'field',
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

  // Trigger Delete Field confirmation
  const handleInitiateDeleteField = (section: FormSectionItem, field: FormFieldItem) => {
    setDeleteModal({
      open: true,
      type: 'field',
      fieldId: field.id,
      fieldName: field.label,
      sectionTitle: section.title,
      isDeleting: false,
    });
  };

  // Trigger Delete Section confirmation
  const handleInitiateDeleteSection = (section: FormSectionItem) => {
    setDeleteModal({
      open: true,
      type: 'section',
      sectionId: section.id,
      sectionTitle: section.title,
      fieldName: section.title,
      isDeleting: false,
    });
  };

  // Trigger Reset Defaults confirmation
  const handleInitiateReset = () => {
    setDeleteModal({
      open: true,
      type: 'reset',
      fieldName: selectedTrack === 'executive' ? 'Executive Track Template' : 'Non-Executive Track Template',
      sectionTitle: `${selectedTrack === 'executive' ? 'Executive' : 'Non-Executive'} Track Defaults`,
      isDeleting: false,
    });
  };

  // Confirm and Execute Deletion / Reset with mandatory audit reason
  const handleExecuteConfirmedAction = async (reason?: string) => {
    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      if (deleteModal.type === 'field' && deleteModal.fieldId) {
        await formBuilderApi.deleteField(selectedTrack, deleteModal.fieldId, reason);
        setActionMessage({
          type: 'success',
          text: `Field "${deleteModal.fieldName}" removed permanently and recorded in audit log.`,
        });
      } else if (deleteModal.type === 'section' && deleteModal.sectionId) {
        await formBuilderApi.deleteSection(selectedTrack, deleteModal.sectionId, reason);
        setActionMessage({
          type: 'success',
          text: `Section "${deleteModal.sectionTitle}" and all nested fields deleted permanently and recorded in audit log.`,
        });
      } else if (deleteModal.type === 'reset') {
        const trackLabel = selectedTrack === 'executive' ? 'Executive Track' : 'Non-Executive Track';
        await formBuilderApi.resetToDefault(selectedTrack, reason);
        setActionMessage({
          type: 'success',
          text: `${trackLabel} restored to default physical form structure and recorded in audit log.`,
        });
      }
      setDeleteModal({ open: false, type: 'field' });
      loadTemplate(selectedTrack);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Deletion operation failed.' });
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
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
          className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
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
          <button onClick={() => setActionMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Track Overview Card */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
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
          <Button
            id="btn-add-section"
            variant="primary"
            size="small"
            onClick={() => setSectionModal({ open: true, title: '', description: '' })}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Section
          </Button>
          <Button
            id="btn-reset-defaults"
            variant="secondary"
            size="small"
            onClick={handleInitiateReset}
            title="Reset to official company physical form seed"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Reset Defaults
          </Button>
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
                <Button
                  id={`btn-add-field-${section.id}`}
                  variant="outline"
                  size="small"
                  onClick={() => handleOpenAddField(section.id)}
                  leftIcon={<Plus className="w-3 h-3" />}
                  className="bg-white border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                >
                  Add Field
                </Button>
                <Button
                  id={`btn-delete-section-${section.id}`}
                  variant="ghost"
                  size="small"
                  onClick={() => handleInitiateDeleteSection(section)}
                  leftIcon={<Trash2 className="w-3 h-3 text-rose-500" />}
                  className="bg-white border border-rose-200 hover:bg-rose-50 text-rose-600"
                  title="Delete entire section and all its fields"
                >
                  Delete Section
                </Button>
              </div>
            </div>

            {/* Field Table */}
            <div className="divide-y divide-slate-100">
              {section.fields.map((field, fIdx) => (
                <div
                  key={field.id}
                  id={`field-row-${field.id}`}
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
                      id={`btn-edit-field-${field.id}`}
                      onClick={() => handleOpenEditField(section.id, field)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Edit Field"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-field-${field.id}`}
                      onClick={() => handleInitiateDeleteField(section, field)}
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
              <Button
                variant="ghost"
                size="small"
                onClick={() => setFieldModal((prev) => ({ ...prev, open: false }))}
                className="p-1 h-auto text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4 text-xs">
              <Input
                id="input-field-label"
                label="Field Label *"
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
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  id="select-field-type"
                  label="Field Type"
                  value={fieldModal.form.field_type}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      form: { ...fieldModal.form, field_type: e.target.value as FormFieldType },
                    })
                  }
                >
                  <option value="text">Single-line Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date Picker</option>
                  <option value="dropdown">Dropdown Options</option>
                  <option value="yes_no">Yes / No Switch</option>
                  <option value="textarea">Multi-line Textarea</option>
                  <option value="repeatable_table">Repeatable Data Table</option>
                  <option value="signature">Candidate Signature</option>
                </Select>

                <Input
                  id="input-field-key"
                  label="Field Key (Unique Identifier) *"
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
                  className="font-mono"
                />
              </div>

              {fieldModal.form.field_type === 'dropdown' && (
                <Input
                  label="Dropdown Options (Comma separated)"
                  type="text"
                  placeholder="e.g. Male, Female, Other"
                  value={fieldModal.form.optionsString}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      form: { ...fieldModal.form, optionsString: e.target.value },
                    })
                  }
                />
              )}

              {fieldModal.form.field_type === 'yes_no' && (
                <Input
                  label='Conditional Details Label (if "Yes" is selected)'
                  type="text"
                  placeholder="e.g. If yes, please specify relative details"
                  value={fieldModal.form.conditional_label}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      form: { ...fieldModal.form, conditional_label: e.target.value },
                    })
                  }
                />
              )}

              <Input
                id="input-field-placeholder"
                label="Placeholder Text (Optional)"
                type="text"
                placeholder="e.g. Enter registered engine number"
                value={fieldModal.form.placeholder}
                onChange={(e) =>
                  setFieldModal({
                    ...fieldModal,
                    form: { ...fieldModal.form, placeholder: e.target.value },
                  })
                }
              />

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    id="checkbox-field-required"
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
                <Button
                  id="btn-cancel-field"
                  type="button"
                  variant="secondary"
                  onClick={() => setFieldModal((prev) => ({ ...prev, open: false }))}
                >
                  Cancel
                </Button>
                <Button
                  id="btn-save-field"
                  type="submit"
                  variant="primary"
                >
                  {fieldModal.mode === 'create' ? 'Create Field' : 'Save Changes'}
                </Button>
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
              <Button
                variant="ghost"
                size="small"
                onClick={() => setSectionModal({ open: false, title: '', description: '' })}
                className="p-1 h-auto text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4 text-xs">
              <Input
                id="input-section-title"
                label="Section Title *"
                type="text"
                required
                placeholder="e.g. Additional Certifications"
                value={sectionModal.title}
                onChange={(e) => setSectionModal({ ...sectionModal, title: e.target.value })}
              />

              <Textarea
                id="input-section-desc"
                label="Description / Subtitle"
                rows={2}
                placeholder="Brief guidance for candidates filling this section..."
                value={sectionModal.description}
                onChange={(e) => setSectionModal({ ...sectionModal, description: e.target.value })}
              />

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSectionModal({ open: false, title: '', description: '' })}
                >
                  Cancel
                </Button>
                <Button
                  id="btn-create-section-submit"
                  type="submit"
                  variant="primary"
                >
                  Create Section
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE DELETE CONFIRMATION MODAL WITH AUDIT REASON */}
      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        title={
          deleteModal.type === 'field'
            ? 'Delete Form Field'
            : deleteModal.type === 'section'
            ? 'Delete Form Section'
            : 'Restore Track Seed Defaults'
        }
        itemName={deleteModal.fieldName || 'Selected Item'}
        itemType={
          deleteModal.type === 'field'
            ? 'Form Field'
            : deleteModal.type === 'section'
            ? 'Form Section'
            : 'Track Template'
        }
        contextInfo={`${selectedTrack === 'executive' ? 'Executive Track' : 'Non-Executive Track'} ${
          deleteModal.sectionTitle ? `→ ${deleteModal.sectionTitle}` : ''
        }`}
        warningMessage={
          deleteModal.type === 'field'
            ? 'Removing this field will permanently omit it from live onboarding forms for all prospective candidates in this track.'
            : deleteModal.type === 'section'
            ? 'Deleting this entire section will permanently remove it along with ALL fields nested inside it. This cannot be undone.'
            : 'Resetting defaults will wipe all custom added fields and restore the official 2026 printed joining form schema.'
        }
        requireReason={true}
        reasonPlaceholder={
          deleteModal.type === 'field'
            ? 'State why this field is being removed (e.g. Field rendered obsolete per HR Circular 2026-04)...'
            : deleteModal.type === 'section'
            ? 'State why this entire section is being deleted (mandatory for audit logging)...'
            : 'State why template is being reset to defaults...'
        }
        confirmButtonLabel={
          deleteModal.type === 'field'
            ? 'Yes, Delete Field'
            : deleteModal.type === 'section'
            ? 'Yes, Delete Section'
            : 'Yes, Reset Defaults'
        }
        isDeleting={deleteModal.isDeleting}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setDeleteModal({ open: false, type: 'field' })}
      />
    </div>
  );
};
