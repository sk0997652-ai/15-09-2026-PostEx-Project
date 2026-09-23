import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  MapPin,
  Briefcase,
  Layers,
} from 'lucide-react';
import { OrgStructure, superAdminApi } from '../../lib/superAdminApi';
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  Modal,
  Input,
  Select,
  Badge,
} from '../ui';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';

export interface OrganizationStructureViewProps {
  org: OrgStructure | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const OrganizationStructureView: React.FC<OrganizationStructureViewProps> = ({
  org,
  loading,
  onRefresh,
  setNotification,
}) => {
  const [orgSubTab, setOrgSubTab] = useState<'zones' | 'branches' | 'departments' | 'designations'>('zones');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgModalMode, setOrgModalMode] = useState<'create' | 'edit'>('create');
  const [orgEditId, setOrgEditId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<any>({});

  // Unified Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    open: boolean;
    type: 'org';
    targetId: string;
    targetName: string;
    subTab?: 'zones' | 'branches' | 'departments' | 'designations';
    isDeleting: boolean;
  }>({
    open: false,
    type: 'org',
    targetId: '',
    targetName: '',
    isDeleting: false,
  });

  const handleOpenOrgCreate = () => {
    setOrgModalMode('create');
    setOrgEditId(null);
    if (orgSubTab === 'zones') setOrgForm({ name: '' });
    if (orgSubTab === 'branches') setOrgForm({ name: '', zone_id: org?.zones[0]?.id || '', address: '' });
    if (orgSubTab === 'departments') setOrgForm({ name: '' });
    if (orgSubTab === 'designations') setOrgForm({ name: '', department_id: org?.departments[0]?.id || '' });
    setShowOrgModal(true);
  };

  const handleOpenOrgEdit = (item: any) => {
    setOrgModalMode('edit');
    setOrgEditId(item.id);
    setOrgForm({ ...item });
    setShowOrgModal(true);
  };

  const handleSaveOrgEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (orgModalMode === 'create') {
        await superAdminApi.createOrgEntity(orgSubTab, orgForm);
        setNotification({ type: 'success', text: `Created new ${orgSubTab.slice(0, -1)}.` });
      } else if (orgEditId) {
        await superAdminApi.updateOrgEntity(orgSubTab, orgEditId, orgForm);
        setNotification({ type: 'success', text: `Updated ${orgSubTab.slice(0, -1)}.` });
      }
      setShowOrgModal(false);
      await onRefresh();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleDeleteOrgEntity = (id: string, name: string) => {
    setDeleteModalState({
      open: true,
      type: 'org',
      targetId: id,
      targetName: name,
      subTab: orgSubTab,
      isDeleting: false,
    });
  };

  const handleConfirmDeleteOrgEntity = async (reason?: string) => {
    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));
    try {
      await superAdminApi.deleteOrgEntity(deleteModalState.subTab || orgSubTab, deleteModalState.targetId, reason);
      setNotification({ type: 'success', text: `Deleted "${deleteModalState.targetName}".` });
      setDeleteModalState({ open: false, type: 'org', targetId: '', targetName: '', isDeleting: false });
      await onRefresh();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const currentItems = org ? ((org as any)[orgSubTab] || []) : [];

  return (
    <div id="super-admin-org-structure-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Organization Structure"
        description="Manage and configure PostEx operating Zones, Branches, Departments, and Designations."
        roleContext="Hierarchy Manager"
        actions={
          <Button
            id="add-org-entity-btn"
            variant="primary"
            size="sm"
            onClick={handleOpenOrgCreate}
          >
            <Plus className="w-4 h-4" />
            <span>Add {orgSubTab.slice(0, -1)}</span>
          </Button>
        }
      />

      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        {(['zones', 'branches', 'departments', 'designations'] as const).map((tab) => {
          const count = org ? (org as any)[tab]?.length || 0 : 0;
          return (
            <button
              key={tab}
              id={`org-subtab-${tab}`}
              onClick={() => setOrgSubTab(tab)}
              className={`pb-3 capitalize transition-colors cursor-pointer flex items-center gap-1.5 ${
                orgSubTab === tab
                  ? 'text-indigo-700 border-b-2 border-indigo-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{tab}</span>
              <Badge variant={orgSubTab === tab ? 'primary' : 'neutral'} size="sm">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Entity Data Table */}
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {orgSubTab === 'branches' && <TableHead>Zone</TableHead>}
              {orgSubTab === 'branches' && <TableHead>Address</TableHead>}
              {orgSubTab === 'designations' && <TableHead>Department</TableHead>}
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.length > 0 ? (
              currentItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                  {orgSubTab === 'branches' && (
                    <TableCell className="text-slate-600">{item.zones?.name || item.zone_id}</TableCell>
                  )}
                  {orgSubTab === 'branches' && (
                    <TableCell className="text-slate-500">{item.address || '—'}</TableCell>
                  )}
                  {orgSubTab === 'designations' && (
                    <TableCell className="text-slate-600">{item.departments?.name || item.department_id}</TableCell>
                  )}
                  <TableCell className="text-slate-400 font-mono text-xs">
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenOrgEdit(item)}
                        title="Edit"
                        className="p-1.5 text-slate-500 hover:text-slate-900"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteOrgEntity(item.id, item.name)}
                        title="Delete"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={orgSubTab === 'branches' ? 5 : orgSubTab === 'designations' ? 4 : 3}
                  className="py-12 text-center text-slate-400"
                >
                  No {orgSubTab} configured yet. Click "Add {orgSubTab.slice(0, -1)}" above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* CREATE / EDIT ORG MODAL */}
      <Modal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        title={orgModalMode === 'create' ? `Create ${orgSubTab.slice(0, -1)}` : `Edit ${orgSubTab.slice(0, -1)}`}
        description={`Provide organizational unit details for ${orgSubTab}.`}
        size="small"
      >
        <form onSubmit={handleSaveOrgEntity} className="space-y-4 text-xs">
          <Input
            label="Name"
            type="text"
            required
            value={orgForm.name || ''}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
            placeholder={`e.g. ${orgSubTab === 'zones' ? 'North Zone' : orgSubTab === 'branches' ? 'Gulberg Hub' : 'Operations'}`}
          />

          {orgSubTab === 'branches' && (
            <>
              <Select
                label="Zone"
                required
                value={orgForm.zone_id || ''}
                onChange={(e) => setOrgForm({ ...orgForm, zone_id: e.target.value })}
              >
                <option value="">Select Zone...</option>
                {org?.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Physical Address"
                type="text"
                value={orgForm.address || ''}
                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                placeholder="e.g. 12-B Industrial Area, Gulberg III, Lahore"
              />
            </>
          )}

          {orgSubTab === 'designations' && (
            <Select
              label="Department"
              required
              value={orgForm.department_id || ''}
              onChange={(e) => setOrgForm({ ...orgForm, department_id: e.target.value })}
            >
              <option value="">Select Department...</option>
              {org?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}

          <div className="pt-3 flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowOrgModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading}
            >
              Save {orgSubTab.slice(0, -1)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* REUSABLE DELETE CONFIRMATION MODAL */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.open}
        title={`Delete ${deleteModalState.subTab?.slice(0, -1) || 'Item'}`}
        itemName={deleteModalState.targetName}
        itemType={deleteModalState.subTab?.slice(0, -1) || 'Entity'}
        contextInfo={`Organization Structure → ${deleteModalState.subTab}`}
        warningMessage={`Deleting this ${deleteModalState.subTab?.slice(0, -1)} will permanently dissociate it from all assigned employees, branches, or onboarding forms.`}
        requireReason={true}
        reasonPlaceholder="State the operational justification for deleting this organization record (mandatory for audit log)..."
        confirmButtonLabel="Yes, Delete"
        isDeleting={deleteModalState.isDeleting}
        onConfirm={handleConfirmDeleteOrgEntity}
        onCancel={() => setDeleteModalState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
