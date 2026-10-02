import React, { useState, useMemo, useRef } from 'react';
import { OrgStructure, superAdminApi, MasterDataEntityType, BulkImportResponse } from '../../lib/superAdminApi';
import {
  MapPin,
  Building2,
  Briefcase,
  Award,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Download,
  FileSpreadsheet,
  Upload,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { exportRowsToCsv, exportRowsToExcel, readExcelFileRows } from '../../lib/hrPortalStore';
import { toTitleCase, formatCodeName, formatEntityName, parseCodeAndName } from '../../lib/formatText';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TablePagination,
  TableToolbar,
  TableToolbarDropdownFilter,
  Textarea,
} from '../ui';

export interface OrganizationStructureViewProps {
  org: OrgStructure | null;
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
  setNotification?: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

type OrgSubTab = MasterDataEntityType;

const BULK_IMPORT_STEPS: Array<{
  entity: MasterDataEntityType;
  label: string;
  stepNum: number;
  requiredColumns: string[];
}> = [
  {
    entity: 'zones',
    label: 'Zones',
    stepNum: 1,
    requiredColumns: ['Zone Code*', 'Zone Name*', 'Region'],
  },
  {
    entity: 'cities',
    label: 'Cities',
    stepNum: 2,
    requiredColumns: ['City Code*', 'City Name*'],
  },
  {
    entity: 'departments',
    label: 'Departments',
    stepNum: 3,
    requiredColumns: ['Department Code*', 'Department Name*', 'Department Category'],
  },
  {
    entity: 'designations',
    label: 'Designations',
    stepNum: 4,
    requiredColumns: ['Designation Code*', 'Designation Name*', 'Department Code*', 'Employment Category'],
  },
  {
    entity: 'branches',
    label: 'Branches',
    stepNum: 5,
    requiredColumns: ['Branch Code*', 'Branch Name*', 'Zone Code*', 'City Code*', 'Branch Type', 'Address', 'Contact Number'],
  },
];

export function OrganizationStructureView({
  org,
  onRefresh,
  setNotification,
}: OrganizationStructureViewProps) {
  const [subTab, setSubTab] = useState<OrgSubTab>('zones');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [branchTypeFilter, setBranchTypeFilter] = useState<string>('ALL');
  const [deptFilterForDesig, setDeptFilterForDesig] = useState<string>('ALL');
  const [empCatFilter, setEmpCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields across entity types
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isActiveInput, setIsActiveInput] = useState(true);

  // Branch & City specific
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [branchTypeInput, setBranchTypeInput] = useState('Hub');
  const [cityAddressInput, setCityAddressInput] = useState('');
  const [contactNumberInput, setContactNumberInput] = useState('');

  // Designation specific
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [employmentCategoryInput, setEmploymentCategoryInput] = useState('In-House Staff');

  // Bulk Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importEntity, setImportEntity] = useState<MasterDataEntityType>('zones');
  const [importMode, setImportMode] = useState<'update' | 'skip'>('update');
  const [importParsedRows, setImportParsedRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importPreview, setImportPreview] = useState<BulkImportResponse | null>(null);
  const [importCommitResult, setImportCommitResult] = useState<BulkImportResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const zonesList = useMemo(() => org?.zones || [], [org?.zones]);
  const citiesList = useMemo(() => org?.cities || [], [org?.cities]);
  const branchesList = useMemo(() => org?.branches || [], [org?.branches]);
  const departmentsList = useMemo(() => org?.departments || [], [org?.departments]);
  const designationsList = useMemo(() => org?.designations || [], [org?.designations]);

  const cityMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; city_code?: string }>();
    for (const c of citiesList) {
      m.set(c.id, c);
    }
    return m;
  }, [citiesList]);

  const zoneMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; zone_code?: string }>();
    for (const z of zonesList) {
      m.set(z.id, z);
    }
    return m;
  }, [zonesList]);

  const deptMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; department_code?: string }>();
    for (const d of departmentsList) {
      m.set(d.id, d);
    }
    return m;
  }, [departmentsList]);

  const clearBanner = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const notifySuccess = (text: string) => {
    setSuccessMsg(text);
    setNotification?.({ type: 'success', text });
  };

  const notifyError = (text: string) => {
    setError(text);
    setNotification?.({ type: 'error', text });
  };

  const openCreateModal = () => {
    clearBanner();
    setModalMode('create');
    setEditingId(null);
    setNameInput('');
    setCodeInput('');
    setIsActiveInput(true);
    setSelectedZoneId(zonesList[0]?.id || '');
    setSelectedCityId('');
    setBranchTypeInput('Hub');
    setCityAddressInput('');
    setContactNumberInput('');
    setSelectedDepartmentId(departmentsList[0]?.id || '');
    setEmploymentCategoryInput('In-House Staff');
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    clearBanner();
    setModalMode('edit');
    setEditingId(item.id);
    setNameInput(item.name || '');
    setIsActiveInput(item.is_active !== false);

    if (subTab === 'zones') {
      setCodeInput(item.zone_code || '');
    } else if (subTab === 'cities') {
      setCodeInput(item.city_code || '');
      setSelectedZoneId(item.zone_id || '');
    } else if (subTab === 'branches') {
      setCodeInput(item.branch_code || '');
      setSelectedZoneId(item.zone_id || '');
      setSelectedCityId(item.city_id || '');
      setBranchTypeInput(item.branch_type || 'Hub');
      setCityAddressInput(item.city_address || item.address || '');
      setContactNumberInput(item.contact_number || '');
    } else if (subTab === 'departments') {
      setCodeInput(item.department_code || '');
    } else if (subTab === 'designations') {
      setCodeInput(item.designation_code || '');
      setSelectedDepartmentId(item.department_id || '');
      setEmploymentCategoryInput(item.employment_category || 'In-House Staff');
    }
    setModalOpen(true);
  };

  // Auto-split if user pastes "CODE | NAME" into the Name or Code field
  const handleCodeOrNamePaste = (field: 'code' | 'name', value: string) => {
    if (value.includes('|')) {
      const parsed = parseCodeAndName(value);
      if (parsed.code && parsed.name) {
        setCodeInput(parsed.code);
        setNameInput(parsed.name);
        return;
      }
    }
    if (field === 'code') {
      setCodeInput(value);
    } else {
      setNameInput(value);
    }
  };

  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();

    const parsed = parseCodeAndName(nameInput, codeInput);
    const finalName = parsed.name || nameInput.trim();
    const finalCode = parsed.code || codeInput.trim();

    if (!finalName) {
      notifyError('Name cannot be empty or whitespace only.');
      return;
    }

    const payload: Record<string, any> = {
      name: finalName,
      is_active: isActiveInput,
    };

    if (subTab === 'zones') {
      if (!finalCode) {
        notifyError('Zone Code is required.');
        return;
      }
      payload.zone_code = finalCode;
    } else if (subTab === 'cities') {
      if (!finalCode) {
        notifyError('City Code is required (e.g., 045).');
        return;
      }
      payload.city_code = finalCode;
      payload.zone_id = selectedZoneId || null;
    } else if (subTab === 'branches') {
      if (!finalCode) {
        notifyError('Branch Code is required (e.g., 0053).');
        return;
      }
      if (!selectedZoneId) {
        notifyError('Please select a parent Zone for the branch.');
        return;
      }
      const chosenCity = selectedCityId ? cityMap.get(selectedCityId) : null;
      const resolvedAddress = cityAddressInput.trim() || chosenCity?.name || finalName;

      payload.branch_code = finalCode;
      payload.zone_id = selectedZoneId;
      payload.city_id = selectedCityId || null;
      payload.branch_type = branchTypeInput;
      payload.city_address = resolvedAddress;
      payload.address = resolvedAddress;
      payload.contact_number = contactNumberInput.trim() || null;
    } else if (subTab === 'departments') {
      if (!finalCode) {
        notifyError('Department Code is required (e.g., 001).');
        return;
      }
      payload.department_code = finalCode;
    } else if (subTab === 'designations') {
      if (!selectedDepartmentId) {
        notifyError('Please select a parent Department for the designation.');
        return;
      }
      payload.department_id = selectedDepartmentId;
      payload.employment_category = employmentCategoryInput;
      payload.designation_code = finalCode || null;
    }

    setBusy(true);
    try {
      const singularLabel =
        subTab === 'cities' ? 'City' : subTab === 'branches' ? 'Branch' : subTab.slice(0, -1);
      if (modalMode === 'create') {
        await superAdminApi.createOrgEntity(subTab, payload);
        notifySuccess(`${toTitleCase(singularLabel)} "${formatEntityName(finalName)}" created.`);
      } else if (editingId) {
        await superAdminApi.updateOrgEntity(subTab, editingId, payload);
        notifySuccess(`${toTitleCase(singularLabel)} "${formatEntityName(finalName)}" updated.`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      notifyError(err.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (item: any) => {
    clearBanner();
    setBusy(true);
    try {
      const nextState = item.is_active === false ? true : false;
      await superAdminApi.updateOrgEntity(subTab, item.id, { is_active: nextState });
      notifySuccess(`"${formatEntityName(item.name)}" marked as ${nextState ? 'Active' : 'Inactive'}.`);
      await onRefresh();
    } catch (err: any) {
      notifyError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleDelete = (id: string, name: string) => {
    clearBanner();
    setDeleteTarget({ id, name: formatEntityName(name) });
    setDeleteReason('');
  };

  const confirmDeleteEntity = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await superAdminApi.deleteOrgEntity(
        subTab,
        deleteTarget.id,
        deleteReason.trim() || `Deleted ${deleteTarget.name} via Super Admin Organization Structure`
      );
      notifySuccess(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err: any) {
      notifyError(err.message);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  // Filtered Lists (codes remain searchable in search boxes!)
  const filteredZones = useMemo(() => {
    return zonesList.filter((z) => {
      const q = searchQuery.toLowerCase().trim();
      const display = formatCodeName(z.zone_code, z.name).toLowerCase();
      const matchesQ =
        !q ||
        display.includes(q) ||
        z.name.toLowerCase().includes(q) ||
        (z.zone_code || '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && z.is_active !== false) ||
        (statusFilter === 'INACTIVE' && z.is_active === false);
      return matchesQ && matchesStatus;
    });
  }, [zonesList, searchQuery, statusFilter]);

  const filteredCities = useMemo(() => {
    return citiesList.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const display = formatCodeName(c.city_code, c.name).toLowerCase();
      const matchesQ =
        !q ||
        display.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.city_code || '').toLowerCase().includes(q);
      const matchesZone = zoneFilter === 'ALL' || !c.zone_id || c.zone_id === zoneFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.is_active !== false) ||
        (statusFilter === 'INACTIVE' && c.is_active === false);
      return matchesQ && matchesZone && matchesStatus;
    });
  }, [citiesList, searchQuery, zoneFilter, statusFilter]);

  const filteredBranches = useMemo(() => {
    return branchesList.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const display = formatCodeName(b.branch_code, b.name).toLowerCase();
      const cityObj = b.cities || (b.city_id ? cityMap.get(b.city_id) : null);
      const cityDisplay = cityObj ? formatCodeName(cityObj.city_code, cityObj.name).toLowerCase() : '';
      const matchesQ =
        !q ||
        display.includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.branch_code || '').toLowerCase().includes(q) ||
        cityDisplay.includes(q) ||
        (b.city_address || b.address || '').toLowerCase().includes(q);
      const matchesZone = zoneFilter === 'ALL' || b.zone_id === zoneFilter;
      const matchesType = branchTypeFilter === 'ALL' || (b.branch_type || 'Hub') === branchTypeFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && b.is_active !== false) ||
        (statusFilter === 'INACTIVE' && b.is_active === false);
      return matchesQ && matchesZone && matchesType && matchesStatus;
    });
  }, [branchesList, cityMap, searchQuery, zoneFilter, branchTypeFilter, statusFilter]);

  const filteredDepartments = useMemo(() => {
    return departmentsList.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const display = formatCodeName(d.department_code, d.name).toLowerCase();
      const matchesQ =
        !q ||
        display.includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.department_code || '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && d.is_active !== false) ||
        (statusFilter === 'INACTIVE' && d.is_active === false);
      return matchesQ && matchesStatus;
    });
  }, [departmentsList, searchQuery, statusFilter]);

  const filteredDesignations = useMemo(() => {
    return designationsList.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const display = formatCodeName(d.designation_code, d.name).toLowerCase();
      const matchesQ =
        !q ||
        display.includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.designation_code || '').toLowerCase().includes(q) ||
        (d.departments?.name || '').toLowerCase().includes(q);
      const matchesDept = deptFilterForDesig === 'ALL' || d.department_id === deptFilterForDesig;
      const matchesCat = empCatFilter === 'ALL' || (d.employment_category || 'In-House Staff') === empCatFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && d.is_active !== false) ||
        (statusFilter === 'INACTIVE' && d.is_active === false);
      return matchesQ && matchesDept && matchesCat && matchesStatus;
    });
  }, [designationsList, searchQuery, deptFilterForDesig, empCatFilter, statusFilter]);

  const paginatedZones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredZones.slice(start, start + pageSize);
  }, [filteredZones, currentPage, pageSize]);

  const paginatedCities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCities.slice(start, start + pageSize);
  }, [filteredCities, currentPage, pageSize]);

  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, currentPage, pageSize]);

  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDepartments.slice(start, start + pageSize);
  }, [filteredDepartments, currentPage, pageSize]);

  const paginatedDesignations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDesignations.slice(start, start + pageSize);
  }, [filteredDesignations, currentPage, pageSize]);

  // Display rule: Exports show NAME only
  const getExportDataForCurrentTab = () => {
    if (subTab === 'zones') {
      return filteredZones.map((z) => ({
        'Zone Name': formatEntityName(z.name),
        Branches: branchesList.filter((b) => b.zone_id === z.id).length,
        Status: z.is_active !== false ? 'Active' : 'Inactive',
      }));
    }
    if (subTab === 'cities') {
      return filteredCities.map((c) => ({
        'City Name': formatEntityName(c.name),
        Status: c.is_active !== false ? 'Active' : 'Inactive',
      }));
    }
    if (subTab === 'branches') {
      return filteredBranches.map((b) => {
        const z = b.zones || zoneMap.get(b.zone_id);
        const c = b.cities || (b.city_id ? cityMap.get(b.city_id) : null);
        return {
          'Branch Name': formatEntityName(b.name),
          Zone: z ? formatEntityName(z.name) : '',
          City: c ? formatEntityName(c.name) : '',
          'Branch Type': b.branch_type || 'Hub',
          'City / Address': formatEntityName(b.city_address || b.address || ''),
          'Contact Number': b.contact_number || '',
          Status: b.is_active !== false ? 'Active' : 'Inactive',
        };
      });
    }
    if (subTab === 'departments') {
      return filteredDepartments.map((d) => ({
        'Department Name': formatEntityName(d.name),
        Designations: designationsList.filter((x) => x.department_id === d.id).length,
        Status: d.is_active !== false ? 'Active' : 'Inactive',
      }));
    }
    return filteredDesignations.map((d) => {
      const dept = d.departments || deptMap.get(d.department_id);
      return {
        'Designation Title': formatEntityName(d.name),
        Department: dept ? formatEntityName(dept.name) : '',
        'Employment Category': d.employment_category || 'In-House Staff',
        Status: d.is_active !== false ? 'Active' : 'Inactive',
      };
    });
  };

  const handleExportCsv = () => {
    const rows = getExportDataForCurrentTab();
    exportRowsToCsv(`postex-master-${subTab}.csv`, rows);
  };

  const handleExportExcel = () => {
    const rows = getExportDataForCurrentTab();
    exportRowsToExcel(`postex-master-${subTab}.xlsx`, subTab.toUpperCase(), rows);
  };

  // ============================================================================
  // Enforced Bulk Import Order & Helpers
  // Order: Zones -> Cities -> Departments -> Designations -> Branches
  // ============================================================================
  const isStepLocked = (stepEntity: MasterDataEntityType): { locked: boolean; reason: string } => {
    if (stepEntity === 'zones') {
      return { locked: false, reason: '' };
    }
    if (stepEntity === 'cities') {
      if (zonesList.length === 0) {
        return { locked: true, reason: 'Import or create at least 1 Zone first' };
      }
      return { locked: false, reason: '' };
    }
    if (stepEntity === 'departments') {
      if (zonesList.length === 0 || citiesList.length === 0) {
        return { locked: true, reason: 'Complete Zones and Cities steps first' };
      }
      return { locked: false, reason: '' };
    }
    if (stepEntity === 'designations') {
      if (zonesList.length === 0 || citiesList.length === 0 || departmentsList.length === 0) {
        return { locked: true, reason: 'Complete Departments step first' };
      }
      return { locked: false, reason: '' };
    }
    if (stepEntity === 'branches') {
      if (
        zonesList.length === 0 ||
        citiesList.length === 0 ||
        departmentsList.length === 0 ||
        designationsList.length === 0
      ) {
        return { locked: true, reason: 'Complete Zones, Cities, Departments & Designations first' };
      }
      return { locked: false, reason: '' };
    }
    return { locked: false, reason: '' };
  };

  const openBulkImportModal = () => {
    clearBanner();
    // Pick current subTab if unlocked, else first unlocked step
    const lockCheck = isStepLocked(subTab);
    const initialStep: MasterDataEntityType = lockCheck.locked ? 'zones' : subTab;
    setImportEntity(initialStep);
    setImportMode('update');
    setImportParsedRows([]);
    setImportFileName('');
    setImportPreview(null);
    setImportCommitResult(null);
    setImportError(null);
    setImportModalOpen(true);
  };

  const handleSelectBulkStep = (stepEntity: MasterDataEntityType) => {
    const check = isStepLocked(stepEntity);
    if (check.locked) {
      setImportError(check.reason);
      return;
    }
    setImportEntity(stepEntity);
    setImportParsedRows([]);
    setImportFileName('');
    setImportPreview(null);
    setImportCommitResult(null);
    setImportError(null);
  };

  const runDryRunPreview = async (
    entityToRun: MasterDataEntityType,
    rowsToRun: any[],
    modeToRun: 'update' | 'skip'
  ) => {
    if (!rowsToRun || rowsToRun.length === 0) {
      setImportError('Please upload an Excel (.xlsx) or CSV (.csv) file with at least one row.');
      return;
    }
    setImportBusy(true);
    setImportError(null);
    setImportCommitResult(null);
    try {
      const preview = await superAdminApi.bulkValidateMasterData({
        entity: entityToRun,
        rows: rowsToRun,
        mode: modeToRun,
      });
      setImportPreview(preview);
    } catch (err: any) {
      setImportError(err.message || 'Failed to validate import rows.');
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportFileName(file.name);
    try {
      const rows = await readExcelFileRows(file);
      setImportParsedRows(rows);
      await runDryRunPreview(importEntity, rows, importMode);
    } catch (err: any) {
      setImportError(err.message || 'Could not parse uploaded file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggleDuplicateMode = async (nextMode: 'update' | 'skip') => {
    setImportMode(nextMode);
    if (importParsedRows.length > 0) {
      await runDryRunPreview(importEntity, importParsedRows, nextMode);
    }
  };

  const handleCommitBulkImport = async () => {
    if (!importParsedRows || importParsedRows.length === 0) {
      setImportError('No rows to import. Please upload a template file first.');
      return;
    }
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await superAdminApi.bulkImportMasterData({
        entity: importEntity,
        rows: importParsedRows,
        mode: importMode,
        dryRun: false,
      });
      setImportCommitResult(res);
      setImportPreview(res);
      setSubTab(importEntity);
      await onRefresh();
      notifySuccess(
        `Bulk import for ${toTitleCase(importEntity)} complete: ${res.summary.added ?? res.summary.created} added, ${res.summary.updated} updated, ${res.summary.skipped} skipped, ${res.summary.failed ?? res.summary.errors} failed.`
      );
    } catch (err: any) {
      setImportError(err.message || 'Bulk import failed.');
    } finally {
      setImportBusy(false);
    }
  };

  const handleDownloadImportTemplate = () => {
    let sampleRows: Record<string, string>[] = [];
    if (importEntity === 'zones') {
      sampleRows = [
        { 'Zone Code*': '01', 'Zone Name*': 'CENTRAL', Region: 'Punjab' },
        { 'Zone Code*': '02', 'Zone Name*': 'SOUTH', Region: 'Sindh' },
      ];
    } else if (importEntity === 'cities') {
      sampleRows = [
        { 'City Code*': '045', 'City Name*': 'SUKKUR' },
        { 'City Code*': '012', 'City Name*': 'LAHORE' },
      ];
    } else if (importEntity === 'departments') {
      sampleRows = [
        { 'Department Code*': '001', 'Department Name*': 'OPERATIONS', 'Department Category': 'Field Operations' },
        { 'Department Code*': '002', 'Department Name*': 'HUMAN RESOURCES', 'Department Category': 'Corporate' },
      ];
    } else if (importEntity === 'designations') {
      const defaultDeptCode = departmentsList[0]?.department_code || '001';
      sampleRows = [
        {
          'Designation Code*': '0151',
          'Designation Name*': 'AREA MANAGER',
          'Department Code*': defaultDeptCode,
          'Employment Category': 'In-House Staff',
        },
        {
          'Designation Code*': '0152',
          'Designation Name*': 'COURIER RIDER',
          'Department Code*': defaultDeptCode,
          'Employment Category': 'Rider',
        },
      ];
    } else {
      const defaultZoneCode = zonesList[0]?.zone_code || '01';
      const defaultCityCode = citiesList[0]?.city_code || '045';
      sampleRows = [
        {
          'Branch Code*': '0053',
          'Branch Name*': 'SKZ',
          'Zone Code*': defaultZoneCode,
          'City Code*': defaultCityCode,
          'Branch Type': 'Hub',
          Address: 'Sukkur Industrial Estate',
          'Contact Number': '+92-71-5630111',
        },
      ];
    }
    exportRowsToExcel(
      `postex-${importEntity}-import-template.xlsx`,
      importEntity.toUpperCase(),
      sampleRows,
      ['Zone Code*', 'City Code*', 'Department Code*', 'Designation Code*', 'Branch Code*', 'Contact Number']
    );
  };

  const handleDownloadErrorReport = () => {
    const source = importCommitResult || importPreview;
    if (!source) return;
    const errorRows = source.rows.filter((r) => r.status === 'Error' || r.action === 'error');
    if (errorRows.length === 0) return;
    const reportRows = errorRows.map((r) => ({
      'Row #': String(r.rowNumber),
      Code: r.code || '',
      Name: r.name || '',
      'Parent Codes': r.parentCodes || '',
      Status: r.status,
      'Error Message': r.error || r.message || 'Validation failed',
    }));
    exportRowsToExcel(
      `postex-${importEntity}-import-errors.xlsx`,
      'IMPORT_ERRORS',
      reportRows,
      ['Row #', 'Code', 'Parent Codes']
    );
  };

  const tabOptions: Array<{
    id: OrgSubTab;
    label: string;
    icon: React.ReactNode;
    count: number;
  }> = [
    {
      id: 'zones',
      label: 'Zones',
      icon: <MapPin className="w-4 h-4" />,
      count: zonesList.length,
    },
    {
      id: 'cities',
      label: 'Cities',
      icon: <Globe className="w-4 h-4" />,
      count: citiesList.length,
    },
    {
      id: 'branches',
      label: 'Branches',
      icon: <Building2 className="w-4 h-4" />,
      count: branchesList.length,
    },
    {
      id: 'departments',
      label: 'Departments',
      icon: <Briefcase className="w-4 h-4" />,
      count: departmentsList.length,
    },
    {
      id: 'designations',
      label: 'Designations',
      icon: <Award className="w-4 h-4" />,
      count: designationsList.length,
    },
  ];

  const singularEntityName =
    subTab === 'cities'
      ? 'City'
      : subTab === 'branches'
      ? 'Branch'
      : subTab === 'zones'
      ? 'Zone'
      : subTab === 'departments'
      ? 'Department'
      : 'Designation';

  // Display Rule: Dropdowns show "CODE | NAME"
  const toolbarFilters = useMemo<TableToolbarDropdownFilter[]>(() => {
    const list: TableToolbarDropdownFilter[] = [];
    if (subTab === 'branches') {
      list.push({
        id: 'org-filter-zone',
        label: 'Filter by Zone',
        value: zoneFilter,
        onChange: (val) => {
          setZoneFilter(val);
          setCurrentPage(1);
        },
        options: [
          { value: 'ALL', label: toTitleCase('All Zones') },
          ...zonesList.map((z) => ({
            value: z.id,
            label: formatCodeName(z.zone_code, z.name),
          })),
        ],
      });
      list.push({
        id: 'org-filter-branch-type',
        label: 'Filter by Branch Type',
        value: branchTypeFilter,
        onChange: (val) => {
          setBranchTypeFilter(val);
          setCurrentPage(1);
        },
        options: [
          { value: 'ALL', label: toTitleCase('All Branch Types') },
          { value: 'Hub', label: toTitleCase('Hub') },
          { value: 'Sub-Hub', label: toTitleCase('Sub-Hub') },
          { value: 'Warehouse', label: toTitleCase('Warehouse') },
          { value: 'Franchise', label: toTitleCase('Franchise') },
        ],
      });
    }
    if (subTab === 'designations') {
      list.push({
        id: 'org-filter-department',
        label: 'Filter by Department',
        value: deptFilterForDesig,
        onChange: (val) => {
          setDeptFilterForDesig(val);
          setCurrentPage(1);
        },
        options: [
          { value: 'ALL', label: toTitleCase('All Departments') },
          ...departmentsList.map((d) => ({
            value: d.id,
            label: formatCodeName(d.department_code, d.name),
          })),
        ],
      });
      list.push({
        id: 'org-filter-emp-category',
        label: 'Filter by Category',
        value: empCatFilter,
        onChange: (val) => {
          setEmpCatFilter(val);
          setCurrentPage(1);
        },
        options: [
          { value: 'ALL', label: toTitleCase('All Categories') },
          { value: 'Rider', label: toTitleCase('Rider') },
          { value: 'In-House Staff', label: toTitleCase('In-House Staff') },
        ],
      });
    }
    list.push({
      id: 'org-filter-status',
      label: 'Filter by Status',
      value: statusFilter,
      onChange: (val) => {
        setStatusFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: 'ALL', label: toTitleCase('All Status') },
        { value: 'ACTIVE', label: toTitleCase('Active Only') },
        { value: 'INACTIVE', label: toTitleCase('Inactive Only') },
      ],
    });
    return list;
  }, [
    subTab,
    zoneFilter,
    zonesList,
    branchTypeFilter,
    deptFilterForDesig,
    departmentsList,
    empCatFilter,
    statusFilter,
  ]);

  const currentBulkStepMeta =
    BULK_IMPORT_STEPS.find((s) => s.entity === importEntity) || BULK_IMPORT_STEPS[0];

  const savableCount = useMemo(() => {
    if (!importPreview) return 0;
    return importPreview.rows.filter(
      (r) => r.status === 'Valid' || (r.status === 'Duplicate' && importMode === 'update')
    ).length;
  }, [importPreview, importMode]);

  return (
    <div id="super-admin-org-structure-view" className="space-y-6">
      {/* Header & Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card
          onClick={() => {
            setSubTab('zones');
            clearBanner();
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className={`p-4 cursor-pointer transition-all ${
            subTab === 'zones'
              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{toTitleCase('Zones')}</span>
              <MapPin className={`w-4 h-4 ${subTab === 'zones' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{zonesList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {zonesList.filter((z) => z.is_active !== false).length} {toTitleCase('active')}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSubTab('cities');
            clearBanner();
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className={`p-4 cursor-pointer transition-all ${
            subTab === 'cities'
              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{toTitleCase('Cities')}</span>
              <Globe className={`w-4 h-4 ${subTab === 'cities' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{citiesList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {citiesList.filter((c) => c.is_active !== false).length} {toTitleCase('active')}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSubTab('branches');
            clearBanner();
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className={`p-4 cursor-pointer transition-all ${
            subTab === 'branches'
              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{toTitleCase('Branches')}</span>
              <Building2 className={`w-4 h-4 ${subTab === 'branches' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{branchesList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {branchesList.filter((b) => b.is_active !== false).length} {toTitleCase('active')}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSubTab('departments');
            clearBanner();
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className={`p-4 cursor-pointer transition-all ${
            subTab === 'departments'
              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{toTitleCase('Departments')}</span>
              <Briefcase className={`w-4 h-4 ${subTab === 'departments' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{departmentsList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {departmentsList.filter((d) => d.is_active !== false).length} {toTitleCase('active')}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSubTab('designations');
            clearBanner();
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className={`p-4 cursor-pointer transition-all ${
            subTab === 'designations'
              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{toTitleCase('Designations')}</span>
              <Award className={`w-4 h-4 ${subTab === 'designations' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{designationsList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {designationsList.filter((d) => d.is_active !== false).length} {toTitleCase('active')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="overflow-hidden p-0">
        {/* Sub-Tabs + Add & Bulk Import Buttons */}
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 mb-0 bg-slate-50/70 border-b border-slate-200/80">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {tabOptions.map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`org-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSubTab(tab.id);
                    clearBanner();
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-caption font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.icon}
                  <span>{toTitleCase(tab.label)}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-tag font-mono ${
                      active ? 'bg-emerald-700 text-emerald-50' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="org-export-csv-btn"
              type="button"
              onClick={handleExportCsv}
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              {toTitleCase('Export CSV')}
            </Button>
            <Button
              id="org-export-excel-btn"
              type="button"
              onClick={handleExportExcel}
              variant="secondary"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              {toTitleCase('Export Excel')}
            </Button>
            <Button
              id="org-bulk-import-btn"
              type="button"
              onClick={openBulkImportModal}
              variant="secondary"
              size="sm"
              leftIcon={<Upload className="w-3.5 h-3.5 text-emerald-600" />}
            >
              {toTitleCase('Bulk Import')}
            </Button>
            <Button
              id="org-add-entity-btn"
              onClick={openCreateModal}
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {toTitleCase(`Add ${singularEntityName}`)}
            </Button>
          </div>
        </CardHeader>

        {/* Search & Contextual Filters Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <TableToolbar
            searchInputId="org-search-input"
            searchPlaceholder={`Search ${subTab} by name or code...`}
            searchValue={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            filters={toolbarFilters}
          />
        </div>

        {/* Status Banners */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-caption font-medium flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 px-2">
              ✕
            </button>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-caption font-medium flex items-center justify-between">
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-800 px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Table Content (Display Rule: Show NAME only; code columns removed, codes still searchable & visible in edit form) */}
        <CardContent className="p-4 space-y-4">
          {subTab === 'zones' && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('Zone Name')}</TableHead>
                    <TableHead>{toTitleCase('Branches')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedZones.map((z) => {
                    const branchCount = branchesList.filter((b) => b.zone_id === z.id).length;
                    const isActive = z.is_active !== false;
                    return (
                      <TableRow key={z.id}>
                        <TableCell className="font-semibold text-slate-900">
                          {formatEntityName(z.name)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {branchCount} {toTitleCase(branchCount === 1 ? 'branch' : 'branches')}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(z)}
                            disabled={busy}
                            className="focus:outline-none"
                          >
                            <Badge variant={isActive ? 'success' : 'neutral'}>
                              {isActive ? toTitleCase('Active') : toTitleCase('Inactive')}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            onClick={() => openEditModal(z)}
                            variant="ghost"
                            size="sm"
                            title="Edit Zone"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(z.id, z.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredZones.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-400">
                        {toTitleCase('No zones match your current filters.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredZones.length / pageSize))}
                totalItems={filteredZones.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}

          {subTab === 'cities' && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('City Name')}</TableHead>
                    <TableHead>{toTitleCase('Branches')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCities.map((c) => {
                    const isActive = c.is_active !== false;
                    const branchCount = branchesList.filter((b) => b.city_id === c.id).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold text-slate-900">
                          {formatEntityName(c.name)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {branchCount} {toTitleCase(branchCount === 1 ? 'branch' : 'branches')}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(c)}
                            disabled={busy}
                            className="focus:outline-none"
                          >
                            <Badge variant={isActive ? 'success' : 'neutral'}>
                              {isActive ? toTitleCase('Active') : toTitleCase('Inactive')}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            onClick={() => openEditModal(c)}
                            variant="ghost"
                            size="sm"
                            title="Edit City"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(c.id, c.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete City"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-400">
                        {toTitleCase('No cities found. Add a city or use Bulk Import.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredCities.length / pageSize))}
                totalItems={filteredCities.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}

          {subTab === 'branches' && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('Branch Name')}</TableHead>
                    <TableHead>{toTitleCase('Zone')}</TableHead>
                    <TableHead>{toTitleCase('City')}</TableHead>
                    <TableHead>{toTitleCase('Type')}</TableHead>
                    <TableHead>{toTitleCase('City / Address')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBranches.map((b) => {
                    const isActive = b.is_active !== false;
                    const z = b.zones || zoneMap.get(b.zone_id);
                    const c = b.cities || (b.city_id ? cityMap.get(b.city_id) : null);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {formatEntityName(b.name)}
                          </div>
                          {b.contact_number && (
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {b.contact_number}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">
                            {z ? formatEntityName(z.name) : toTitleCase('Unassigned')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c ? (
                            <Badge variant="neutral">{formatEntityName(c.name)}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">{toTitleCase(b.branch_type || 'Hub')}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-xs truncate">
                          {formatEntityName(b.city_address || b.address || '—')}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(b)}
                            disabled={busy}
                            className="focus:outline-none"
                          >
                            <Badge variant={isActive ? 'success' : 'neutral'}>
                              {isActive ? toTitleCase('Active') : toTitleCase('Inactive')}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            onClick={() => openEditModal(b)}
                            variant="ghost"
                            size="sm"
                            title="Edit Branch"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(b.id, b.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete Branch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBranches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                        {toTitleCase('No branches match your current filters.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredBranches.length / pageSize))}
                totalItems={filteredBranches.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}

          {subTab === 'departments' && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('Department Name')}</TableHead>
                    <TableHead>{toTitleCase('Designations')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDepartments.map((d) => {
                    const desigCount = designationsList.filter((x) => x.department_id === d.id).length;
                    const isActive = d.is_active !== false;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold text-slate-900">
                          {formatEntityName(d.name)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {desigCount} {toTitleCase(desigCount === 1 ? 'designation' : 'designations')}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(d)}
                            disabled={busy}
                            className="focus:outline-none"
                          >
                            <Badge variant={isActive ? 'success' : 'neutral'}>
                              {isActive ? toTitleCase('Active') : toTitleCase('Inactive')}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            onClick={() => openEditModal(d)}
                            variant="ghost"
                            size="sm"
                            title="Edit Department"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(d.id, d.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete Department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredDepartments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-400">
                        {toTitleCase('No departments match your current filters.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredDepartments.length / pageSize))}
                totalItems={filteredDepartments.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}

          {subTab === 'designations' && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('Designation Title')}</TableHead>
                    <TableHead>{toTitleCase('Department')}</TableHead>
                    <TableHead>{toTitleCase('Employment Category')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDesignations.map((d) => {
                    const isActive = d.is_active !== false;
                    const cat = d.employment_category || 'In-House Staff';
                    const dept = d.departments || deptMap.get(d.department_id);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold text-slate-900">
                          {formatEntityName(d.name)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">
                            {dept ? formatEntityName(dept.name) : toTitleCase('Unassigned')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cat === 'Rider' ? 'warning' : 'info'}>
                            {toTitleCase(cat)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(d)}
                            disabled={busy}
                            className="focus:outline-none"
                          >
                            <Badge variant={isActive ? 'success' : 'neutral'}>
                              {isActive ? toTitleCase('Active') : toTitleCase('Inactive')}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            onClick={() => openEditModal(d)}
                            variant="ghost"
                            size="sm"
                            title="Edit Designation"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(d.id, d.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete Designation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredDesignations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                        {toTitleCase('No designations match your current filters.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredDesignations.length / pageSize))}
                totalItems={filteredDesignations.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={toTitleCase(`${modalMode === 'create' ? 'Create New' : 'Edit'} ${singularEntityName}`)}
        size="medium"
      >
        <form onSubmit={handleSaveEntity} className="space-y-4">
          {subTab === 'zones' && (
            <>
              <Input
                id="org-input-zone-code"
                label={`${toTitleCase('Zone Code')} *`}
                type="text"
                value={codeInput}
                onChange={(e) => handleCodeOrNamePaste('code', e.target.value)}
                placeholder="e.g., 01 or LHR-Z1"
                required
              />
              <Input
                id="org-input-zone-name"
                label={`${toTitleCase('Zone Name')} *`}
                type="text"
                value={nameInput}
                onChange={(e) => handleCodeOrNamePaste('name', e.target.value)}
                placeholder="e.g., CENTRAL"
                required
              />
            </>
          )}

          {subTab === 'cities' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="org-input-city-code"
                  label={`${toTitleCase('City Code')} *`}
                  type="text"
                  value={codeInput}
                  onChange={(e) => handleCodeOrNamePaste('code', e.target.value)}
                  placeholder="e.g., 045"
                  required
                />
                <Input
                  id="org-input-city-name"
                  label={`${toTitleCase('City Name')} *`}
                  type="text"
                  value={nameInput}
                  onChange={(e) => handleCodeOrNamePaste('name', e.target.value)}
                  placeholder="e.g., SUKKUR"
                  required
                />
              </div>
            </>
          )}

          {subTab === 'branches' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="org-input-branch-code"
                  label={`${toTitleCase('Branch Code')} *`}
                  type="text"
                  value={codeInput}
                  onChange={(e) => handleCodeOrNamePaste('code', e.target.value)}
                  placeholder="e.g., 0053"
                  required
                />
                <Select
                  id="org-select-branch-type"
                  label={`${toTitleCase('Branch Type')} *`}
                  value={branchTypeInput}
                  onChange={(e) => setBranchTypeInput(e.target.value)}
                >
                  <option value="Hub">{toTitleCase('Hub')}</option>
                  <option value="Sub-Hub">{toTitleCase('Sub-Hub')}</option>
                  <option value="Warehouse">{toTitleCase('Warehouse')}</option>
                  <option value="Franchise">{toTitleCase('Franchise')}</option>
                </Select>
              </div>
              <Input
                id="org-input-branch-name"
                label={`${toTitleCase('Branch Name')} *`}
                type="text"
                value={nameInput}
                onChange={(e) => handleCodeOrNamePaste('name', e.target.value)}
                placeholder="e.g., SKZ"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  id="org-select-branch-zone"
                  label={`${toTitleCase('Parent Zone')} *`}
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  searchable
                  required
                >
                  <option value="">- Select -</option>
                  {zonesList.map((z) => (
                    <option key={z.id} value={z.id}>
                      {formatCodeName(z.zone_code, z.name)}
                    </option>
                  ))}
                </Select>
                <Select
                  id="org-select-branch-city"
                  label={toTitleCase('City (Optional)')}
                  value={selectedCityId}
                  onChange={(e) => {
                    const nextCityId = e.target.value;
                    setSelectedCityId(nextCityId);
                    if (nextCityId && !cityAddressInput.trim()) {
                      const c = cityMap.get(nextCityId);
                      if (c) setCityAddressInput(c.name);
                    }
                  }}
                  searchable
                >
                  <option value="">- Select -</option>
                  {citiesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCodeName(c.city_code, c.name)}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                id="org-input-branch-address"
                label={
                  selectedCityId
                    ? toTitleCase('City / Street Address (Auto-filled from City if empty)')
                    : `${toTitleCase('City / Street Address')} *`
                }
                type="text"
                value={cityAddressInput}
                onChange={(e) => setCityAddressInput(e.target.value)}
                placeholder="e.g., Sukkur Industrial Area"
                required={!selectedCityId}
              />
              <Input
                id="org-input-branch-contact"
                label={toTitleCase('Contact Number (Optional)')}
                type="text"
                value={contactNumberInput}
                onChange={(e) => setContactNumberInput(e.target.value)}
                placeholder="e.g., +92-42-35761234"
              />
            </>
          )}

          {subTab === 'departments' && (
            <>
              <Input
                id="org-input-department-code"
                label={`${toTitleCase('Department Code')} *`}
                type="text"
                value={codeInput}
                onChange={(e) => handleCodeOrNamePaste('code', e.target.value)}
                placeholder="e.g., 001"
                required
              />
              <Input
                id="org-input-department-name"
                label={`${toTitleCase('Department Name')} *`}
                type="text"
                value={nameInput}
                onChange={(e) => handleCodeOrNamePaste('name', e.target.value)}
                placeholder="e.g., OPERATIONS"
                required
              />
            </>
          )}

          {subTab === 'designations' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="org-input-designation-code"
                  label={toTitleCase('Designation Code')}
                  type="text"
                  value={codeInput}
                  onChange={(e) => handleCodeOrNamePaste('code', e.target.value)}
                  placeholder="e.g., 0151"
                />
                <Input
                  id="org-input-designation-name"
                  label={`${toTitleCase('Designation Title')} *`}
                  type="text"
                  value={nameInput}
                  onChange={(e) => handleCodeOrNamePaste('name', e.target.value)}
                  placeholder="e.g., AREA MANAGER"
                  required
                />
              </div>
              <Select
                id="org-select-designation-department"
                label={`${toTitleCase('Department')} *`}
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                searchable
                required
              >
                <option value="">- Select -</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatCodeName(d.department_code, d.name)}
                  </option>
                ))}
              </Select>
              <Select
                id="org-select-designation-employment-category"
                label={`${toTitleCase('Employment Category')} *`}
                value={employmentCategoryInput}
                onChange={(e) => setEmploymentCategoryInput(e.target.value)}
                helperText={toTitleCase('Determines whether onboarding uses the Rider or In-House Staff form track.')}
              >
                <option value="Rider">{toTitleCase('Rider (Field Delivery / Courier)')}</option>
                <option value="In-House Staff">{toTitleCase('In-House Staff (Hub / Corporate)')}</option>
              </Select>
            </>
          )}

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-700">{toTitleCase('Active Status')}</p>
              <p className="text-xs text-slate-500">{toTitleCase('Inactive items are hidden from new onboarding selections')}</p>
            </div>
            <button
              id="org-toggle-active-status"
              type="button"
              onClick={() => setIsActiveInput((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActiveInput ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActiveInput ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              onClick={() => setModalOpen(false)}
              variant="secondary"
            >
              {toTitleCase('Cancel')}
            </Button>
            <Button
              id="org-modal-submit-btn"
              type="submit"
              disabled={busy}
              isLoading={busy}
              variant="primary"
            >
              {modalMode === 'create' ? toTitleCase('Create') : toTitleCase('Save Changes')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Master Data Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={toTitleCase('Bulk Import Master Data')}
        size="large"
      >
        <div className="space-y-4">
          {/* Enforced Step Order Bar: Zones -> Cities -> Departments -> Designations -> Branches */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Enforced Import Sequence (Parents Must Exist First)
              </span>
              <span className="text-[11px] text-slate-500">
                All codes are stored as text with leading zeros preserved
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {BULK_IMPORT_STEPS.map((step, idx) => {
                const lockInfo = isStepLocked(step.entity);
                const isSelected = importEntity === step.entity;
                return (
                  <React.Fragment key={step.entity}>
                    <button
                      id={`bulk-step-${step.entity}`}
                      type="button"
                      disabled={lockInfo.locked}
                      title={lockInfo.locked ? lockInfo.reason : `Step ${step.stepNum}: ${step.label}`}
                      onClick={() => handleSelectBulkStep(step.entity)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : lockInfo.locked
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer'
                      }`}
                    >
                      {lockInfo.locked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <span
                          className={`w-4 h-4 rounded-full text-[10px] inline-flex items-center justify-center font-bold ${
                            isSelected ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {step.stepNum}
                        </span>
                      )}
                      <span>{step.label}</span>
                    </button>
                    {idx < BULK_IMPORT_STEPS.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Info, Duplicate Mode Toggle, Template Download & File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-white">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="info">Step {currentBulkStepMeta.stepNum} of 5</Badge>
                <h4 className="text-sm font-bold text-slate-900">
                  Import {currentBulkStepMeta.label}
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Template Columns:{' '}
                <span className="font-mono font-medium text-slate-800">
                  {currentBulkStepMeta.requiredColumns.join(' | ')}
                </span>
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <Button
                  id="bulk-download-template-btn"
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadImportTemplate}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download Template (.xlsx)
                </Button>
                <input
                  ref={fileInputRef}
                  id="bulk-file-upload-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <Button
                  id="bulk-upload-file-btn"
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload .xlsx / .csv
                </Button>
              </div>
              {importFileName && (
                <p className="text-xs text-emerald-700 font-medium">
                  Loaded file: <span className="font-mono">{importFileName}</span> ({importParsedRows.length} rows)
                </p>
              )}
            </div>

            {/* Duplicate Handling Toggle */}
            <div className="space-y-2 md:border-l md:border-slate-100 md:pl-4">
              <label className="block text-xs font-semibold text-slate-700">
                Duplicate Code Handling
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="bulk-mode-skip-btn"
                  type="button"
                  onClick={() => handleToggleDuplicateMode('skip')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    importMode === 'skip'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">Skip Duplicates</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Existing codes are left untouched
                  </div>
                </button>
                <button
                  id="bulk-mode-update-btn"
                  type="button"
                  onClick={() => handleToggleDuplicateMode('update')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    importMode === 'update'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">Update In-Place</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Updates name/fields while keeping UUIDs
                  </div>
                </button>
              </div>
            </div>
          </div>

          {importError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{importError}</span>
            </div>
          )}

          {/* Post-Import Summary Banner */}
          {importCommitResult && (
            <div
              id="bulk-import-post-summary"
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Import Completed for {currentBulkStepMeta.label}</span>
                </div>
                {(importCommitResult.summary.failed ?? importCommitResult.summary.errors) > 0 && (
                  <Button
                    id="bulk-download-errors-btn"
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleDownloadErrorReport}
                    leftIcon={<Download className="w-3.5 h-3.5 text-rose-600" />}
                  >
                    Download Error Report (.xlsx)
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white border border-emerald-200">
                  <div className="text-[11px] text-slate-500">Added</div>
                  <div className="text-base font-bold text-emerald-700">
                    {importCommitResult.summary.added ?? importCommitResult.summary.created}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-200">
                  <div className="text-[11px] text-slate-500">Updated (UUID Kept)</div>
                  <div className="text-base font-bold text-blue-700">
                    {importCommitResult.summary.updated}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-200">
                  <div className="text-[11px] text-slate-500">Skipped</div>
                  <div className="text-base font-bold text-slate-700">
                    {importCommitResult.summary.skipped}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-200">
                  <div className="text-[11px] text-slate-500">Failed</div>
                  <div className="text-base font-bold text-rose-700">
                    {importCommitResult.summary.failed ?? importCommitResult.summary.errors}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Preview Screen */}
          {importPreview && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Validation Preview ({importPreview.summary.total} rows)
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="success">
                    Valid: {importPreview.summary.valid ?? importPreview.summary.created}
                  </Badge>
                  <Badge variant="info">
                    Duplicate: {importPreview.summary.duplicates ?? importPreview.summary.updated + importPreview.summary.skipped}
                  </Badge>
                  <Badge variant={importPreview.summary.errors > 0 ? 'error' : 'neutral'}>
                    Error: {importPreview.summary.errors}
                  </Badge>
                  {importPreview.summary.errors > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="text-xs font-semibold text-rose-600 hover:underline inline-flex items-center gap-1 ml-1"
                    >
                      <Download className="w-3 h-3" />
                      Error Report
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row #</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Codes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.rows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {r.rowNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-slate-800">
                          {r.code || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-800">
                          {r.name || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {r.parentCodes || '—'}
                        </TableCell>
                        <TableCell>
                          {r.status === 'Valid' && <Badge variant="success">Valid</Badge>}
                          {r.status === 'Duplicate' && <Badge variant="info">Duplicate</Badge>}
                          {r.status === 'Error' && <Badge variant="error">Error</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {r.error ? (
                            <span className="text-rose-600 font-medium">{r.error}</span>
                          ) : (
                            <span>{r.message || 'Ready'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              {importPreview
                ? `${savableCount} row(s) will be saved (${importMode === 'update' ? 'Valid + Duplicate updates' : 'Valid only; Duplicates skipped'}).`
                : 'Upload a template file (.xlsx or .csv) to preview validation status per row.'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportModalOpen(false)}
              >
                Close
              </Button>
              <Button
                id="org-bulk-import-commit-btn"
                type="button"
                variant="primary"
                onClick={handleCommitBulkImport}
                disabled={importBusy || !importPreview || savableCount === 0}
                isLoading={importBusy}
              >
                Import {savableCount > 0 ? `(${savableCount} Rows)` : ''}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={toTitleCase(`Delete ${singularEntityName}`)}
        size="small"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-900">"{deleteTarget?.name}"</span>?
          </p>
          <Textarea
            id="org-delete-reason"
            label={toTitleCase('Audit Reason (Optional)')}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Reason for deleting this record..."
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
            >
              {toTitleCase('Cancel')}
            </Button>
            <Button
              id="org-confirm-delete-btn"
              type="button"
              variant="danger"
              onClick={confirmDeleteEntity}
              disabled={busy}
              isLoading={busy}
            >
              {toTitleCase('Confirm Delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
