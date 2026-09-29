import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { OrgStructure, superAdminApi } from '../../lib/superAdminApi';
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
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

const PAKISTAN_REGIONS = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
] as const;

const BRANCH_TYPES = ['Hub', 'Sub-Hub', 'Warehouse', 'Franchise'] as const;

const DEPARTMENT_CATEGORIES = ['Field Operations', 'Corporate (Head Office)'] as const;

const EMPLOYMENT_CATEGORIES = ['Rider', 'In-House Staff'] as const;

export const OrganizationStructureView: React.FC<OrganizationStructureViewProps> = ({
  org,
  loading,
  onRefresh,
  setNotification,
}) => {
  const [orgSubTab, setOrgSubTab] = useState<'zones' | 'branches' | 'departments' | 'designations'>('zones');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState('');
  const [orgParentFilter, setOrgParentFilter] = useState('');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgModalMode, setOrgModalMode] = useState<'create' | 'edit'>('create');
  const [orgEditId, setOrgEditId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<any>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setModalError(null);
    if (orgSubTab === 'zones') {
      setOrgForm({
        name: '',
        zone_code: '',
        region: '',
        is_active: true,
      });
    }
    if (orgSubTab === 'branches') {
      setOrgForm({
        name: '',
        branch_code: '',
        zone_id: org?.zones[0]?.id || '',
        branch_type: '',
        city_address: '',
        contact_number: '',
        is_active: true,
      });
    }
    if (orgSubTab === 'departments') {
      setOrgForm({
        name: '',
        department_code: '',
        department_category: '',
        is_active: true,
      });
    }
    if (orgSubTab === 'designations') {
      setOrgForm({
        name: '',
        department_id: org?.departments[0]?.id || '',
        employment_category: '',
        is_active: true,
      });
    }
    setShowOrgModal(true);
  };

  const handleOpenOrgEdit = (item: any) => {
    setOrgModalMode('edit');
    setOrgEditId(item.id);
    setModalError(null);
    setOrgForm({
      ...item,
      city_address: item.city_address ?? item.address ?? '',
      contact_number: item.contact_number ?? '',
      is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
    });
    setShowOrgModal(true);
  };

  const handleSaveOrgEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
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
      setModalError(err.message);
      setNotification({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
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

  const filteredItems = useMemo(() => {
    return currentItems.filter((item: any) => {
      const isActive = typeof item.is_active === 'boolean' ? item.is_active : true;
      if (orgSearch.trim()) {
        const q = orgSearch.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesCode = (
          item.zone_code ||
          item.branch_code ||
          item.department_code ||
          item.region ||
          item.city_address ||
          ''
        )
          .toLowerCase()
          .includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      if (orgStatusFilter) {
        if (orgStatusFilter === 'active' && !isActive) return false;
        if (orgStatusFilter === 'inactive' && isActive) return false;
      }
      if (orgParentFilter) {
        if (orgSubTab === 'zones' && item.region !== orgParentFilter) return false;
        if (orgSubTab === 'branches' && item.zone_id !== orgParentFilter) return false;
        if (orgSubTab === 'departments' && item.department_category !== orgParentFilter) return false;
        if (orgSubTab === 'designations' && item.department_id !== orgParentFilter) return false;
      }
      return true;
    });
  }, [currentItems, orgSearch, orgStatusFilter, orgParentFilter, orgSubTab]);

  const getColSpan = () => {
    if (orgSubTab === 'zones') return 6;
    if (orgSubTab === 'branches') return 9;
    if (orgSubTab === 'departments') return 6;
    if (orgSubTab === 'designations') return 6;
    return 5;
  };

  return (
    <div id="super-admin-org-structure-view" className="space-y-6">
      <PageHeader
        title="Organization Structure"
        description="Manage and configure operating Zones, Branches, Departments, and Designations."
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
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto">
        {(['zones', 'branches', 'departments', 'designations'] as const).map((tab) => {
          const count = org ? (org as any)[tab]?.length || 0 : 0;
          return (
            <button
              key={tab}
              id={`org-subtab-${tab}`}
              onClick={() => {
                setOrgSubTab(tab);
                setOrgSearch('');
                setOrgStatusFilter('');
                setOrgParentFilter('');
              }}
              className={`pb-3 capitalize transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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

      {/* Entity Search & Filter Toolbar */}
      <TableToolbar
        searchInputId="org-entity-search-input"
        searchValue={orgSearch}
        onSearchChange={setOrgSearch}
        searchPlaceholder={`Search ${orgSubTab} by name or code...`}
        filters={
          orgSubTab === 'zones'
            ? [
                {
                  id: 'org-zone-region-filter',
                  label: 'Filter by Region',
                  value: orgParentFilter,
                  onChange: setOrgParentFilter,
                  options: [
                    { value: '', label: 'All Regions' },
                    ...PAKISTAN_REGIONS.map((r) => ({ value: r, label: r })),
                  ],
                },
              ]
            : orgSubTab === 'branches'
            ? [
                {
                  id: 'org-branch-zone-filter',
                  label: 'Filter by Zone',
                  value: orgParentFilter,
                  onChange: setOrgParentFilter,
                  options: [
                    { value: '', label: 'All Zones' },
                    ...(org?.zones || []).map((z) => ({ value: z.id, label: z.name })),
                  ],
                },
              ]
            : orgSubTab === 'departments'
            ? [
                {
                  id: 'org-dept-category-filter',
                  label: 'Filter by Category',
                  value: orgParentFilter,
                  onChange: setOrgParentFilter,
                  options: [
                    { value: '', label: 'All Categories' },
                    ...DEPARTMENT_CATEGORIES.map((c) => ({ value: c, label: c })),
                  ],
                },
              ]
            : [
                {
                  id: 'org-desig-dept-filter',
                  label: 'Filter by Department',
                  value: orgParentFilter,
                  onChange: setOrgParentFilter,
                  options: [
                    { value: '', label: 'All Departments' },
                    ...(org?.departments || []).map((d) => ({ value: d.id, label: d.name })),
                  ],
                },
              ]
        }
        statusPills={[
          { value: '', label: 'All Statuses', variant: 'info', count: currentItems.length },
          {
            value: 'active',
            label: 'Active',
            variant: 'success',
            count: currentItems.filter((i: any) =>
              typeof i.is_active === 'boolean' ? i.is_active : true
            ).length,
          },
          {
            value: 'inactive',
            label: 'Inactive',
            variant: 'neutral',
            count: currentItems.filter((i: any) => i.is_active === false).length,
          },
        ]}
        activeStatus={orgStatusFilter}
        onStatusChange={setOrgStatusFilter}
        hasActiveFilters={Boolean(orgSearch || orgStatusFilter || orgParentFilter)}
        onReset={() => {
          setOrgSearch('');
          setOrgStatusFilter('');
          setOrgParentFilter('');
        }}
      />

      {/* Entity Data Table */}
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{orgSubTab === 'designations' ? 'Designation Title' : `${orgSubTab.slice(0, -1)} Name`}</TableHead>
              {orgSubTab === 'zones' && (
                <>
                  <TableHead>Zone Code</TableHead>
                  <TableHead>Region / Province</TableHead>
                </>
              )}
              {orgSubTab === 'branches' && (
                <>
                  <TableHead>Branch Code</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Branch Type</TableHead>
                  <TableHead hideOnTablet>City / Address</TableHead>
                  <TableHead hideOnTablet>Contact Number</TableHead>
                </>
              )}
              {orgSubTab === 'departments' && (
                <>
                  <TableHead>Department Code</TableHead>
                  <TableHead>Department Category</TableHead>
                </>
              )}
              {orgSubTab === 'designations' && (
                <>
                  <TableHead>Department</TableHead>
                  <TableHead>Employment Category</TableHead>
                </>
              )}
              <TableHead>Status</TableHead>
              <TableHead hideOnTablet>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length > 0 ? (
              filteredItems.map((item: any) => {
                const isActive = typeof item.is_active === 'boolean' ? item.is_active : true;
                return (
                  <TableRow key={item.id}>
                    <TableCell mobileRole="primary" className="font-bold text-slate-900">
                      {item.name}
                    </TableCell>
                    {orgSubTab === 'zones' && (
                      <>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Zone Code"
                          className="font-mono text-xs text-indigo-700 font-semibold"
                        >
                          {item.zone_code || '—'}
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Region"
                          className="text-slate-600"
                        >
                          {item.region || '—'}
                        </TableCell>
                      </>
                    )}
                    {orgSubTab === 'branches' && (
                      <>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Branch Code"
                          className="font-mono text-xs text-indigo-700 font-semibold"
                        >
                          {item.branch_code || '—'}
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Zone"
                          className="text-slate-600"
                        >
                          {item.zones?.name || item.zone_id}
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Branch Type">
                          {item.branch_type ? (
                            <Badge variant="neutral" size="sm">{item.branch_type}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="City / Address"
                          hideOnTablet
                          className="text-slate-600"
                        >
                          {item.city_address || item.address || '—'}
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Contact"
                          hideOnTablet
                          className="text-slate-500 font-mono text-xs"
                        >
                          {item.contact_number || '—'}
                        </TableCell>
                      </>
                    )}
                    {orgSubTab === 'departments' && (
                      <>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Dept Code"
                          className="font-mono text-xs text-indigo-700 font-semibold"
                        >
                          {item.department_code || '—'}
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Category">
                          {item.department_category ? (
                            <Badge variant="neutral" size="sm">{item.department_category}</Badge>
                          ) : '—'}
                        </TableCell>
                      </>
                    )}
                    {orgSubTab === 'designations' && (
                      <>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Department"
                          className="text-slate-600"
                        >
                          {item.departments?.name || item.department_id}
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Category">
                          {item.employment_category ? (
                            <Badge
                              variant={item.employment_category === 'Rider' ? 'warning' : 'primary'}
                              size="sm"
                            >
                              {item.employment_category}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </>
                    )}
                    <TableCell mobileRole="status">
                      <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                        {isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Created At"
                      hideOnTablet
                      className="text-slate-400 font-mono text-xs"
                    >
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell mobileRole="actions" className="text-right">
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
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={getColSpan()}
                  className="py-12 text-center text-slate-400"
                >
                  {orgSearch || orgStatusFilter || orgParentFilter
                    ? `No ${orgSubTab} match the selected filter criteria.`
                    : `No ${orgSubTab} configured yet. Click "Add ${orgSubTab.slice(0, -1)}" above.`}
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
          {modalError && (
            <div
              id="org-modal-error-banner"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          {/* 1. ZONE FORM FIELDS */}
          {orgSubTab === 'zones' && (
            <>
              <Input
                id="org-input-zone-name"
                label="Zone Name"
                type="text"
                required
                value={orgForm.name || ''}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="e.g. Central Zone"
              />

              <Input
                id="org-input-zone-code"
                label="Zone Code"
                type="text"
                required
                value={orgForm.zone_code || ''}
                onChange={(e) => setOrgForm({ ...orgForm, zone_code: e.target.value })}
                placeholder="e.g. ZN-CENTRAL"
              />

              <Select
                id="org-select-zone-region"
                label="Region / Province"
                required
                value={orgForm.region || ''}
                onChange={(e) => setOrgForm({ ...orgForm, region: e.target.value })}
              >
                <option value="">Select Region / Province...</option>
                {PAKISTAN_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </Select>
            </>
          )}

          {/* 2. BRANCH FORM FIELDS */}
          {orgSubTab === 'branches' && (
            <>
              <Input
                id="org-input-branch-name"
                label="Branch Name"
                type="text"
                required
                value={orgForm.name || ''}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="e.g. Gulberg Hub"
              />

              <Input
                id="org-input-branch-code"
                label="Branch Code"
                type="text"
                required
                value={orgForm.branch_code || ''}
                onChange={(e) => setOrgForm({ ...orgForm, branch_code: e.target.value })}
                placeholder="e.g. LHE-01"
              />

              <Select
                id="org-select-branch-zone"
                label="Zone"
                required
                value={orgForm.zone_id || ''}
                onChange={(e) => setOrgForm({ ...orgForm, zone_id: e.target.value })}
              >
                <option value="">Select Zone...</option>
                {org?.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} {z.zone_code ? `(${z.zone_code})` : ''}
                  </option>
                ))}
              </Select>

              <Select
                id="org-select-branch-type"
                label="Branch Type"
                required
                value={orgForm.branch_type || ''}
                onChange={(e) => setOrgForm({ ...orgForm, branch_type: e.target.value })}
              >
                <option value="">Select Branch Type...</option>
                {BRANCH_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </Select>

              <Input
                id="org-input-branch-city-address"
                label="City / Address"
                type="text"
                required
                value={orgForm.city_address ?? orgForm.address ?? ''}
                onChange={(e) => setOrgForm({ ...orgForm, city_address: e.target.value, address: e.target.value })}
                placeholder="e.g. 12-B Industrial Area, Gulberg III, Lahore"
              />

              <Input
                id="org-input-branch-contact"
                label="Contact Number (Optional)"
                type="text"
                value={orgForm.contact_number || ''}
                onChange={(e) => setOrgForm({ ...orgForm, contact_number: e.target.value })}
                placeholder="e.g. 042-35712345"
              />
            </>
          )}

          {/* 3. DEPARTMENT FORM FIELDS */}
          {orgSubTab === 'departments' && (
            <>
              <Input
                id="org-input-department-name"
                label="Department Name"
                type="text"
                required
                value={orgForm.name || ''}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="e.g. Last Mile Operations"
              />

              <Input
                id="org-input-department-code"
                label="Department Code"
                type="text"
                required
                value={orgForm.department_code || ''}
                onChange={(e) => setOrgForm({ ...orgForm, department_code: e.target.value })}
                placeholder="e.g. DEPT-OPS"
              />

              <Select
                id="org-select-department-category"
                label="Department Category"
                required
                value={orgForm.department_category || ''}
                onChange={(e) => setOrgForm({ ...orgForm, department_category: e.target.value })}
              >
                <option value="">Select Department Category...</option>
                {DEPARTMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </>
          )}

          {/* 4. DESIGNATION FORM FIELDS */}
          {orgSubTab === 'designations' && (
            <>
              <Input
                id="org-input-designation-title"
                label="Designation Title"
                type="text"
                required
                value={orgForm.name || ''}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="e.g. Delivery Rider"
              />

              <Select
                id="org-select-designation-department"
                label="Department"
                required
                value={orgForm.department_id || ''}
                onChange={(e) => setOrgForm({ ...orgForm, department_id: e.target.value })}
              >
                <option value="">Select Department...</option>
                {org?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.department_code ? `(${d.department_code})` : ''}
                  </option>
                ))}
              </Select>

              <Select
                id="org-select-designation-employment-category"
                label="Employment Category"
                required
                value={orgForm.employment_category || ''}
                onChange={(e) => setOrgForm({ ...orgForm, employment_category: e.target.value })}
              >
                <option value="">Select Employment Category...</option>
                {EMPLOYMENT_CATEGORIES.map((ec) => (
                  <option key={ec} value={ec}>
                    {ec}
                  </option>
                ))}
              </Select>
            </>
          )}

          {/* STATUS TOGGLE (Shared across all 4 entities, default Active) */}
          <div className="flex items-center justify-between pt-2 pb-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="font-semibold text-slate-800 block text-xs">Status</span>
              <span className="text-[11px] text-slate-500">
                {(typeof orgForm.is_active === 'boolean' ? orgForm.is_active : true)
                  ? 'Active — available for assignment across the portal'
                  : 'Inactive — hidden from new assignments'}
              </span>
            </div>
            <button
              id="org-toggle-status-btn"
              type="button"
              role="switch"
              aria-checked={typeof orgForm.is_active === 'boolean' ? orgForm.is_active : true}
              onClick={() =>
                setOrgForm({
                  ...orgForm,
                  is_active: !(typeof orgForm.is_active === 'boolean' ? orgForm.is_active : true),
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                (typeof orgForm.is_active === 'boolean' ? orgForm.is_active : true)
                  ? 'bg-emerald-600'
                  : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  (typeof orgForm.is_active === 'boolean' ? orgForm.is_active : true)
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

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
              id="org-save-submit-btn"
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : `Save ${orgSubTab.slice(0, -1)}`}
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
