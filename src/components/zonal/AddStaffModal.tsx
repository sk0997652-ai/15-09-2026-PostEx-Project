import React, { useState, useMemo } from 'react';
import { Lock, User, Briefcase, MapPin } from 'lucide-react';
import { Modal, Button, Input, Select } from '../ui';
import { ZonalDepartmentOption, ZonalDesignationOption } from '../../lib/zonalHrApi';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneDisplayName: string;
  zoneBranches: Array<{ id: string; name: string; branch_code?: string; branch_type?: string }>;
  departments: ZonalDepartmentOption[];
  designations: ZonalDesignationOption[];
  newStaffRole: 'central_hr' | 'branch_manager';
  setNewStaffRole: (role: 'central_hr' | 'branch_manager') => void;
  newStaffBranchId: string;
  setNewStaffBranchId: (id: string) => void;
  newStaffBranchIds?: string[];
  setNewStaffBranchIds?: React.Dispatch<React.SetStateAction<string[]>>;
  newStaffName: string;
  setNewStaffName: (name: string) => void;
  newStaffPersonalEmail?: string;
  setNewStaffPersonalEmail?: (email: string) => void;
  newStaffEmail: string;
  setNewStaffEmail: (email: string) => void;
  newStaffPhone: string;
  setNewStaffPhone: (phone: string) => void;
  newStaffEmployeeId?: string;
  setNewStaffEmployeeId?: (empId: string) => void;
  newStaffDepartmentId?: string;
  setNewStaffDepartmentId?: (deptId: string) => void;
  newStaffDesignationId?: string;
  setNewStaffDesignationId?: (desigId: string) => void;
  creatingStaff: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddStaffModal({
  isOpen,
  onClose,
  zoneDisplayName,
  zoneBranches,
  departments = [],
  designations = [],
  newStaffRole,
  setNewStaffRole,
  newStaffBranchId,
  setNewStaffBranchId,
  newStaffBranchIds = [],
  setNewStaffBranchIds,
  newStaffName,
  setNewStaffName,
  newStaffPersonalEmail = '',
  setNewStaffPersonalEmail,
  newStaffEmail,
  setNewStaffEmail,
  newStaffPhone,
  setNewStaffPhone,
  newStaffEmployeeId = 'PX-STAFF-1001',
  setNewStaffEmployeeId,
  newStaffDepartmentId = '',
  setNewStaffDepartmentId,
  newStaffDesignationId = '',
  setNewStaffDesignationId,
  creatingStaff,
  onSubmit,
}: AddStaffModalProps) {
  const [bmSingleBranchMode, setBmSingleBranchMode] = useState(true);

  const filteredDesignations = useMemo(() => {
    if (!newStaffDepartmentId) return [];
    return designations.filter(
      (d) => d.department_id === newStaffDepartmentId && d.is_active !== false
    );
  }, [designations, newStaffDepartmentId]);

  const effectiveBranchIds = useMemo(() => {
    if (newStaffBranchIds && newStaffBranchIds.length > 0) return newStaffBranchIds;
    if (newStaffBranchId) return [newStaffBranchId];
    return [];
  }, [newStaffBranchIds, newStaffBranchId]);

  const isBranchManager = newStaffRole === 'branch_manager';

  const handleToggleBranch = (branchId: string) => {
    if (!setNewStaffBranchIds) {
      setNewStaffBranchId(branchId);
      return;
    }
    const exists = effectiveBranchIds.includes(branchId);
    let nextIds: string[];
    if (isBranchManager && bmSingleBranchMode) {
      nextIds = exists ? [] : [branchId];
    } else {
      nextIds = exists
        ? effectiveBranchIds.filter((id) => id !== branchId)
        : [...effectiveBranchIds, branchId];
    }
    setNewStaffBranchIds(nextIds);
    setNewStaffBranchId(nextIds[0] || '');
  };

  const handleSelectAllBranches = () => {
    if (zoneBranches.length === 0 || !setNewStaffBranchIds) return;
    const allIds = zoneBranches.map((b) => b.id);
    if (isBranchManager && bmSingleBranchMode) {
      if (allIds.length === 1) {
        const next = effectiveBranchIds.length === 1 ? [] : [allIds[0]];
        setNewStaffBranchIds(next);
        setNewStaffBranchId(next[0] || '');
        return;
      }
      setBmSingleBranchMode(false);
    }
    const allSelected = allIds.every((id) => effectiveBranchIds.includes(id));
    const nextIds = allSelected ? [] : allIds;
    setNewStaffBranchIds(nextIds);
    setNewStaffBranchId(nextIds[0] || '');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Zone Staff Account"
      description={`Complete all 4 sections to provision a staff account scoped to ${zoneDisplayName}`}
      size="xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="zonal-submit-create-staff-btn"
            type="submit"
            form="zonal-create-staff-form"
            variant="primary"
            disabled={creatingStaff}
            isLoading={creatingStaff}
          >
            Generate Credentials
          </Button>
        </>
      }
    >
      <form id="zonal-create-staff-form" onSubmit={onSubmit} className="space-y-5">
        {/* SECTION A — Personal */}
        <div
          id="zonal-staff-section-a"
          className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
            <User className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-tag text-slate-900 uppercase">
              Section A — Personal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                id="zonal-new-staff-name"
                label="Full Name *"
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="e.g. Usman Tariq"
              />
            </div>

            <Input
              id="zonal-new-staff-personal-email"
              label="Personal Contact Email (Optional)"
              type="email"
              value={newStaffPersonalEmail}
              onChange={(e) => setNewStaffPersonalEmail?.(e.target.value)}
              placeholder="e.g. usman.personal@gmail.com"
            />

            <Input
              id="zonal-new-staff-phone"
              label="Phone Number (Optional)"
              type="text"
              value={newStaffPhone}
              onChange={(e) => setNewStaffPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
            />
          </div>
        </div>

        {/* SECTION B — Employment Identity */}
        <div
          id="zonal-staff-section-b"
          className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-tag text-slate-900 uppercase">
                Section B — Employment Identity
              </span>
            </div>
            <span className="text-caption text-slate-500">
              Staff ID sequence (separate from EMP-branch candidate IDs)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                id="zonal-new-staff-employee-id"
                label="Employee ID *"
                type="text"
                required
                value={newStaffEmployeeId}
                onChange={(e) => setNewStaffEmployeeId?.(e.target.value)}
                placeholder="e.g. PX-STAFF-1042"
                className="font-mono"
              />
            </div>

            <Select
              id="zonal-new-staff-department"
              label="Department *"
              required
              value={newStaffDepartmentId}
              onChange={(e) => {
                setNewStaffDepartmentId?.(e.target.value);
                setNewStaffDesignationId?.('');
              }}
            >
              <option value="">Select Department</option>
              {departments
                .filter((d) => d.is_active !== false)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.department_code ? `(${d.department_code})` : ''}
                  </option>
                ))}
            </Select>

            <Select
              id="zonal-new-staff-designation"
              label="Designation *"
              required
              disabled={!newStaffDepartmentId}
              value={newStaffDesignationId}
              onChange={(e) => setNewStaffDesignationId?.(e.target.value)}
              hint={!newStaffDepartmentId ? 'Select a Department first to filter designations.' : undefined}
            >
              <option value="">Select Designation</option>
              {filteredDesignations.map((desig) => (
                <option key={desig.id} value={desig.id}>
                  {desig.name}
                  {desig.employment_category ? ` — ${desig.employment_category}` : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* SECTION C — System Access */}
        <div
          id="zonal-staff-section-c"
          className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-tag text-slate-900 uppercase">
                Section C — System Access
              </span>
            </div>
            <span className="text-caption text-slate-500">
              One-time temporary password generated on creation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <Input
              id="zonal-new-staff-email"
              label="Official / Work Email (Login Username) *"
              type="email"
              required
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              placeholder="e.g. usman.tariq@postex.pk"
            />

            <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-caption text-slate-600 md:mt-6">
              A random 14-character password meeting company policy will be generated and shown once. The user will be forced to change it on first login.
            </div>
          </div>
        </div>

        {/* SECTION D — Role & Scope Assignment */}
        <div
          id="zonal-staff-section-d"
          className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-tag text-slate-900 uppercase">
                Section D — Role &amp; Scope Assignment
              </span>
            </div>
            <span className="text-caption text-slate-500">
              Zonal HR is authorized to provision Central HR &amp; Branch Managers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              id="zonal-new-staff-role"
              label="System Role *"
              value={newStaffRole}
              onChange={(e) => {
                const role = e.target.value as 'central_hr' | 'branch_manager';
                setNewStaffRole(role);
                setBmSingleBranchMode(true);
                if (role === 'branch_manager' && effectiveBranchIds.length > 1 && setNewStaffBranchIds) {
                  setNewStaffBranchIds([effectiveBranchIds[0]]);
                  setNewStaffBranchId(effectiveBranchIds[0]);
                }
              }}
              options={[
                { value: 'central_hr', label: 'Central HR (Review & Dossier Approval)' },
                { value: 'branch_manager', label: 'Branch Manager (In-Person Verification)' },
              ]}
            />

            <Input
              id="zonal-new-staff-zone-readonly"
              label="Zone Assignment *"
              type="text"
              disabled
              value={zoneDisplayName}
            />
          </div>

          {/* Branch Tagging Checklist */}
          <div
            id="zonal-branch-tagging-box"
            className="mt-3 p-4 rounded-lg bg-white border border-slate-200 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800 block text-body">
                  Branch Tagging Checklist ({zoneDisplayName})
                </span>
                <span
                  id="zonal-branch-tag-counter"
                  className="text-caption font-semibold text-indigo-700"
                >
                  {effectiveBranchIds.length} of {zoneBranches.length} branches selected
                </span>
              </div>

              <div className="flex items-center gap-3">
                {isBranchManager && (
                  <label className="inline-flex items-center gap-1.5 text-caption text-slate-600 cursor-pointer">
                    <input
                      id="zonal-bm-single-branch-toggle"
                      type="checkbox"
                      checked={bmSingleBranchMode}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBmSingleBranchMode(checked);
                        if (checked && effectiveBranchIds.length > 1 && setNewStaffBranchIds) {
                          setNewStaffBranchIds([effectiveBranchIds[0]]);
                          setNewStaffBranchId(effectiveBranchIds[0]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Single-Branch Default</span>
                  </label>
                )}

                {zoneBranches.length > 0 && (
                  <Button
                    id="zonal-branch-tag-select-all-btn"
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectAllBranches}
                    className="py-1.5 px-3 text-tag"
                  >
                    {zoneBranches.every((b) => effectiveBranchIds.includes(b.id))
                      ? 'Clear All'
                      : 'Select All'}
                  </Button>
                )}
              </div>
            </div>

            {zoneBranches.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-caption">
                No branches found in {zoneDisplayName}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pt-1">
                {zoneBranches.map((br) => {
                  const isChecked = effectiveBranchIds.includes(br.id);
                  return (
                    <label
                      key={br.id}
                      htmlFor={`zonal-branch-tag-checkbox-${br.id}`}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-body cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold'
                          : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <input
                        id={`zonal-branch-tag-checkbox-${br.id}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBranch(br.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{br.name}</span>
                        {br.branch_code && (
                          <span className="text-caption text-slate-500 font-mono">
                            {br.branch_code} {br.branch_type ? `· ${br.branch_type}` : ''}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
