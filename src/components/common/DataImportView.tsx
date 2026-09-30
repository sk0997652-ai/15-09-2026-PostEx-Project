import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import {
  useHrPortalStore,
  parseExcelDateToYMD,
  normalizeCnicText,
  normalizePhoneText,
  exportRowsToExcel,
  appendPortalAuditLog,
  TrackType,
  BranchType,
  PortalDepartment,
  PortalDesignation,
  PortalBranch,
  PortalEmployee,
} from '../../lib/hrPortalStore';
import { superAdminApi } from '../../lib/superAdminApi';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';
import { toTitleCase } from '../../lib/formatText';

export type ImportCardType = 'departments' | 'designations' | 'branches' | 'employees';

interface PreviewRow {
  rowIndex: number;
  raw: Record<string, string>;
  normalized: Record<string, any>;
  status: 'valid' | 'duplicate' | 'error';
  reason?: string;
}

interface ActivePreviewState {
  cardType: ImportCardType;
  fileName: string;
  columns: string[];
  rows: PreviewRow[];
  fileError?: string;
}

const VALID_TRACKS: TrackType[] = [
  'Frontline & Field',
  'Branch & Operations',
  'Corporate Staff',
  'Leadership',
];

const VALID_BRANCH_TYPES: BranchType[] = ['Hub', 'Sub-Hub', 'Warehouse'];

const TEMPLATE_SPECS: Record<
  ImportCardType,
  {
    title: string;
    step: number;
    columns: string[];
    requiredHeaders: string[];
    sampleRows: Record<string, string>[];
  }
> = {
  departments: {
    title: 'Departments',
    step: 1,
    columns: ['Department Name*', 'Code'],
    requiredHeaders: ['department name'],
    sampleRows: [
      { 'Department Name*': 'Field Operations', Code: 'DEPT-OPS' },
      { 'Department Name*': 'Fleet & Last Mile', Code: 'DEPT-FLT' },
    ],
  },
  designations: {
    title: 'Designations',
    step: 2,
    columns: ['Designation Name*', 'Department*', 'Track', 'Needs Machine'],
    requiredHeaders: ['designation name', 'department'],
    sampleRows: [
      {
        'Designation Name*': 'Delivery Courier I',
        'Department*': 'Fleet & Last Mile',
        Track: 'Frontline & Field',
        'Needs Machine': 'Yes',
      },
      {
        'Designation Name*': 'Loader',
        'Department*': 'Hub & Warehouse Operations',
        Track: 'Frontline & Field',
        'Needs Machine': 'No',
      },
    ],
  },
  branches: {
    title: 'Branches',
    step: 3,
    columns: ['Branch Name*', 'Zone*', 'Branch Manager', 'Type'],
    requiredHeaders: ['branch name', 'zone'],
    sampleRows: [
      {
        'Branch Name*': 'Gulshan Hub',
        'Zone*': 'South Zone',
        'Branch Manager': 'Asad Khan',
        Type: 'Hub',
      },
      {
        'Branch Name*': 'Saddar Warehouse',
        'Zone*': 'North Zone',
        'Branch Manager': 'Kamran Butt',
        Type: 'Warehouse',
      },
    ],
  },
  employees: {
    title: 'Employees',
    step: 4,
    columns: [
      'Employee Code*',
      'Full Name*',
      'CNIC*',
      'Contact Number*',
      'Designation*',
      'Branch*',
      'Joining Date*',
      'Status',
    ],
    requiredHeaders: [
      'employee code',
      'full name',
      'cnic',
      'contact number',
      'designation',
      'branch',
      'joining date',
    ],
    sampleRows: [
      {
        'Employee Code*': 'PX-EMP-3001',
        'Full Name*': 'Tariq Mahmood',
        'CNIC*': '3520212345671',
        'Contact Number*': '03001234567',
        'Designation*': 'Delivery Courier I',
        'Branch*': 'Gulshan Hub',
        'Joining Date*': '2025-02-15',
        Status: 'Active',
      },
      {
        'Employee Code*': 'PX-EMP-3002',
        'Full Name*': 'Noman Sheikh',
        'CNIC*': '4210198765432',
        'Contact Number*': '03217654321',
        'Designation*': 'Loader',
        'Branch*': 'Gulberg Hub',
        'Joining Date*': '15/01/2025',
        Status: 'Exited',
      },
    ],
  },
};

function normalizeHeaderKey(h: string): string {
  return h
    .replace(/\*/g, '')
    .trim()
    .toLowerCase();
}

export const DataImportView: React.FC<{
  onDataImported?: () => void;
}> = ({ onDataImported }) => {
  const [store, updateStore] = useHrPortalStore();
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [preview, setPreview] = useState<ActivePreviewState | null>(null);
  const [dragOverCard, setDragOverCard] = useState<ImportCardType | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null);

  const fileInputRefs: Record<ImportCardType, React.RefObject<HTMLInputElement | null>> = {
    departments: useRef<HTMLInputElement | null>(null),
    designations: useRef<HTMLInputElement | null>(null),
    branches: useRef<HTMLInputElement | null>(null),
    employees: useRef<HTMLInputElement | null>(null),
  };

  // Enforced import order: Departments -> Designations -> Branches -> Employees
  const hasDepartments = store.departments.length > 0;
  const hasDesignations = store.designations.length > 0;
  const hasBranches = store.branches.length > 0;

  const isCardUnlocked = (card: ImportCardType): boolean => {
    if (card === 'departments') return true;
    if (card === 'designations') return hasDepartments;
    if (card === 'branches') return hasDepartments && hasDesignations;
    if (card === 'employees') return hasDepartments && hasDesignations && hasBranches;
    return false;
  };

  const getLockHint = (card: ImportCardType): string | null => {
    if (card === 'designations' && !hasDepartments) {
      return 'Disabled until Departments have data (Step 1).';
    }
    if (card === 'branches' && (!hasDepartments || !hasDesignations)) {
      return 'Disabled until Departments & Designations have data (Steps 1–2).';
    }
    if (card === 'employees' && (!hasDepartments || !hasDesignations || !hasBranches)) {
      const missing: string[] = [];
      if (!hasDepartments) missing.push('Departments');
      if (!hasDesignations) missing.push('Designations');
      if (!hasBranches) missing.push('Branches');
      return `Disabled until ${missing.join(', ')} have data. Import order: Departments → Designations → Branches → Employees.`;
    }
    return null;
  };

  // Download Excel Template with Text format ('@') for CNIC* and Contact Number*
  const handleDownloadTemplate = (card: ImportCardType) => {
    const spec = TEMPLATE_SPECS[card];
    exportRowsToExcel(
      `PostEx_${spec.title}_Template.xlsx`,
      spec.title,
      spec.sampleRows,
      ['CNIC*', 'Contact Number*']
    );
  };

  // Export current data for a card
  const handleExportCurrentData = (card: ImportCardType) => {
    if (card === 'departments') {
      const rows = store.departments.map((d) => ({
        'Department Name*': d.name,
        Code: d.code,
      }));
      exportRowsToExcel('PostEx_Departments_Export.xlsx', 'Departments', rows);
    } else if (card === 'designations') {
      const rows = store.designations.map((d) => ({
        'Designation Name*': d.name,
        'Department*': d.department,
        Track: d.track,
        'Needs Machine': d.needsMachine,
      }));
      exportRowsToExcel('PostEx_Designations_Export.xlsx', 'Designations', rows);
    } else if (card === 'branches') {
      const rows = store.branches.map((b) => ({
        'Branch Name*': b.name,
        'Zone*': b.zone,
        'Branch Manager': b.branchManager,
        Type: b.type,
      }));
      exportRowsToExcel('PostEx_Branches_Export.xlsx', 'Branches', rows);
    } else if (card === 'employees') {
      const rows = store.employees.map((e) => ({
        'Employee Code*': e.employeeCode,
        'Full Name*': e.fullName,
        'CNIC*': e.cnic,
        'Contact Number*': e.contactNumber,
        'Designation*': e.designation,
        'Branch*': e.branch,
        'Joining Date*': e.joiningDate,
        Status: e.status,
      }));
      exportRowsToExcel('PostEx_Employees_Export.xlsx', 'Employees', rows, [
        'CNIC*',
        'Contact Number*',
      ]);
    }
  };

  // Read & validate uploaded Excel/CSV file (First sheet only)
  const processUploadedFile = async (card: ImportCardType, file: File) => {
    setBannerMsg(null);
    const spec = TEMPLATE_SPECS[card];

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: 'array',
        raw: true,
        cellDates: false,
      });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setPreview({
          cardType: card,
          fileName: file.name,
          columns: spec.columns,
          rows: [],
          fileError: 'The uploaded file has no sheets. Please use the official Excel template.',
        });
        return;
      }

      // Read the first sheet only
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        defval: '',
        raw: true,
      });

      // Filter out completely blank rows
      const nonEmptyRows = matrix.filter(
        (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== '')
      );

      if (nonEmptyRows.length === 0) {
        setPreview({
          cardType: card,
          fileName: file.name,
          columns: spec.columns,
          rows: [],
          fileError: `The uploaded file "${file.name}" is empty. Please add rows using the ${spec.title} template.`,
        });
        return;
      }

      const rawHeaders = nonEmptyRows[0].map((h) => String(h ?? '').trim());
      const normalizedHeaders = rawHeaders.map(normalizeHeaderKey);

      // Verify required template headers exist
      const missingHeaders = spec.requiredHeaders.filter(
        (reqH) => !normalizedHeaders.includes(reqH)
      );

      if (missingHeaders.length > 0) {
        setPreview({
          cardType: card,
          fileName: file.name,
          columns: spec.columns,
          rows: [],
          fileError: `Column headers in "${file.name}" do not match the ${spec.title} template. Expected columns: ${spec.columns.join(', ')}`,
        });
        return;
      }

      if (nonEmptyRows.length === 1) {
        setPreview({
          cardType: card,
          fileName: file.name,
          columns: spec.columns,
          rows: [],
          fileError: `The file "${file.name}" contains headers only and no data rows.`,
        });
        return;
      }

      // Map header index by normalized header name
      const colIdxMap = new Map<string, number>();
      normalizedHeaders.forEach((nh, idx) => {
        if (nh && !colIdxMap.has(nh)) {
          colIdxMap.set(nh, idx);
        }
      });

      const getCell = (rowArr: any[], keyName: string): any => {
        const idx = colIdxMap.get(normalizeHeaderKey(keyName));
        if (idx === undefined) return '';
        return rowArr[idx] ?? '';
      };

      const dataRows = nonEmptyRows.slice(1);
      const previewRows: PreviewRow[] = [];

      // Sets to detect in-file duplicates
      const seenDeptNames = new Set<string>();
      const seenDesigNames = new Set<string>();
      const seenBranchNames = new Set<string>();
      const seenEmpCodes = new Set<string>();
      const seenCnics = new Set<string>();

      dataRows.forEach((rowArr, idx) => {
        const rowNumber = idx + 2;

        if (card === 'departments') {
          const deptName = String(getCell(rowArr, 'Department Name*')).trim();
          const code =
            String(getCell(rowArr, 'Code')).trim() ||
            `DEPT-${deptName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'GEN'}`;

          const rawDisplay = {
            'Department Name*': deptName,
            Code: code,
          };

          if (!deptName) {
            previewRows.push({
              rowIndex: rowNumber,
              raw: rawDisplay,
              normalized: {},
              status: 'error',
              reason: 'Department Name* is required',
            });
            return;
          }

          const lowName = deptName.toLowerCase();
          if (seenDeptNames.has(lowName)) {
            previewRows.push({
              rowIndex: rowNumber,
              raw: rawDisplay,
              normalized: {},
              status: 'error',
              reason: `Duplicate Department Name "${deptName}" within file`,
            });
            return;
          }
          seenDeptNames.add(lowName);

          const existsInStore = store.departments.some(
            (d) => d.name.toLowerCase() === lowName
          );

          previewRows.push({
            rowIndex: rowNumber,
            raw: rawDisplay,
            normalized: { name: deptName, code },
            status: existsInStore ? 'duplicate' : 'valid',
            reason: existsInStore ? `Department "${deptName}" already exists` : undefined,
          });
        } else if (card === 'designations') {
          const desigName = String(getCell(rowArr, 'Designation Name*')).trim();
          const deptName = String(getCell(rowArr, 'Department*')).trim();
          const rawTrack = String(getCell(rowArr, 'Track')).trim() || 'Frontline & Field';
          const rawMachine = String(getCell(rowArr, 'Needs Machine')).trim() || 'Yes';

          const rawDisplay = {
            'Designation Name*': desigName,
            'Department*': deptName,
            Track: rawTrack,
            'Needs Machine': rawMachine,
          };

          const errors: string[] = [];
          if (!desigName) errors.push('Designation Name* is required');
          if (!deptName) errors.push('Department* is required');

          const matchedDept = store.departments.find(
            (d) => d.name.toLowerCase() === deptName.toLowerCase()
          );
          if (deptName && !matchedDept) {
            errors.push(`Department "${deptName}" does not exist`);
          }

          const matchedTrack = VALID_TRACKS.find(
            (t) => t.toLowerCase() === rawTrack.toLowerCase()
          );
          if (!matchedTrack) {
            errors.push(`Invalid Track "${rawTrack}"`);
          }

          const normMachine =
            rawMachine.toLowerCase() === 'yes'
              ? 'Yes'
              : rawMachine.toLowerCase() === 'no'
              ? 'No'
              : null;
          if (!normMachine) {
            errors.push('Needs Machine must be Yes or No');
          }

          const lowName = desigName.toLowerCase();
          if (desigName && seenDesigNames.has(lowName)) {
            errors.push(`Duplicate Designation "${desigName}" within file`);
          }
          if (desigName) seenDesigNames.add(lowName);

          if (errors.length > 0) {
            previewRows.push({
              rowIndex: rowNumber,
              raw: rawDisplay,
              normalized: {},
              status: 'error',
              reason: errors.join('; '),
            });
            return;
          }

          const existsInStore = store.designations.some(
            (d) => d.name.toLowerCase() === lowName
          );

          previewRows.push({
            rowIndex: rowNumber,
            raw: rawDisplay,
            normalized: {
              name: desigName,
              department: matchedDept!.name,
              track: matchedTrack!,
              needsMachine: normMachine!,
            },
            status: existsInStore ? 'duplicate' : 'valid',
            reason: existsInStore ? `Designation "${desigName}" already exists` : undefined,
          });
        } else if (card === 'branches') {
          const branchName = String(getCell(rowArr, 'Branch Name*')).trim();
          const zoneName = String(getCell(rowArr, 'Zone*')).trim();
          const manager = String(getCell(rowArr, 'Branch Manager')).trim() || 'HR Officer';
          const rawType = String(getCell(rowArr, 'Type')).trim() || 'Hub';

          const rawDisplay = {
            'Branch Name*': branchName,
            'Zone*': zoneName,
            'Branch Manager': manager,
            Type: rawType,
          };

          const errors: string[] = [];
          if (!branchName) errors.push('Branch Name* is required');
          if (!zoneName) errors.push('Zone* is required');

          const matchedType = VALID_BRANCH_TYPES.find(
            (t) => t.toLowerCase() === rawType.toLowerCase()
          );
          if (!matchedType) {
            errors.push('Type must be Hub, Sub-Hub, or Warehouse');
          }

          const lowName = branchName.toLowerCase();
          if (branchName && seenBranchNames.has(lowName)) {
            errors.push(`Duplicate Branch "${branchName}" within file`);
          }
          if (branchName) seenBranchNames.add(lowName);

          if (errors.length > 0) {
            previewRows.push({
              rowIndex: rowNumber,
              raw: rawDisplay,
              normalized: {},
              status: 'error',
              reason: errors.join('; '),
            });
            return;
          }

          const existsInStore = store.branches.some(
            (b) => b.name.toLowerCase() === lowName
          );

          previewRows.push({
            rowIndex: rowNumber,
            raw: rawDisplay,
            normalized: {
              name: branchName,
              zone: zoneName,
              branchManager: manager,
              hrOfficer: manager,
              type: matchedType!,
            },
            status: existsInStore ? 'duplicate' : 'valid',
            reason: existsInStore ? `Branch "${branchName}" already exists` : undefined,
          });
        } else if (card === 'employees') {
          const empCode = String(getCell(rowArr, 'Employee Code*')).trim();
          const fullName = String(getCell(rowArr, 'Full Name*')).trim();
          const cnicText = normalizeCnicText(getCell(rowArr, 'CNIC*'));
          const phoneText = normalizePhoneText(getCell(rowArr, 'Contact Number*'));
          const desigName = String(getCell(rowArr, 'Designation*')).trim();
          const branchName = String(getCell(rowArr, 'Branch*')).trim();
          const rawJoinDate = getCell(rowArr, 'Joining Date*');
          const parsedDate = parseExcelDateToYMD(rawJoinDate);
          const rawStatus = String(getCell(rowArr, 'Status')).trim() || 'Active';

          const rawDisplay = {
            'Employee Code*': empCode,
            'Full Name*': fullName,
            'CNIC*': cnicText || String(getCell(rowArr, 'CNIC*')).trim(),
            'Contact Number*': phoneText || String(getCell(rowArr, 'Contact Number*')).trim(),
            'Designation*': desigName,
            'Branch*': branchName,
            'Joining Date*': parsedDate || String(rawJoinDate ?? '').trim(),
            Status: rawStatus,
          };

          const errors: string[] = [];
          if (!empCode) errors.push('Employee Code* is required');
          if (!fullName) errors.push('Full Name* is required');
          if (!cnicText) {
            errors.push('CNIC* is required');
          } else if (!/^\d{13}$/.test(cnicText)) {
            errors.push('CNIC* must be exactly 13 digits');
          }
          if (!phoneText) {
            errors.push('Contact Number* is required');
          }
          if (!desigName) {
            errors.push('Designation* is required');
          }
          if (!branchName) {
            errors.push('Branch* is required');
          }
          if (!parsedDate) {
            errors.push('Joining Date* is invalid (use YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or Excel date)');
          }

          const matchedDesig = store.designations.find(
            (d) => d.name.toLowerCase() === desigName.toLowerCase()
          );
          if (desigName && !matchedDesig) {
            errors.push(`Designation "${desigName}" does not exist`);
          }

          const matchedBranch = store.branches.find(
            (b) => b.name.toLowerCase() === branchName.toLowerCase()
          );
          if (branchName && !matchedBranch) {
            errors.push(`Branch "${branchName}" does not exist`);
          }

          const normStatus =
            rawStatus.toLowerCase() === 'active'
              ? 'Active'
              : rawStatus.toLowerCase() === 'exited'
              ? 'Exited'
              : null;
          if (!normStatus) {
            errors.push('Status must be Active or Exited');
          }

          const lowCode = empCode.toLowerCase();
          if (empCode && seenEmpCodes.has(lowCode)) {
            errors.push(`Duplicate Employee Code "${empCode}" in file`);
          }
          if (empCode) seenEmpCodes.add(lowCode);

          if (cnicText && seenCnics.has(cnicText)) {
            errors.push(`Duplicate CNIC "${cnicText}" in file`);
          }
          if (cnicText) seenCnics.add(cnicText);

          if (errors.length > 0) {
            previewRows.push({
              rowIndex: rowNumber,
              raw: rawDisplay,
              normalized: {},
              status: 'error',
              reason: errors.join('; '),
            });
            return;
          }

          const existingEmp = store.employees.find(
            (e) =>
              e.employeeCode.toLowerCase() === lowCode ||
              e.cnic === cnicText
          );

          previewRows.push({
            rowIndex: rowNumber,
            raw: rawDisplay,
            normalized: {
              employeeCode: empCode,
              fullName,
              cnic: cnicText,
              contactNumber: phoneText,
              designation: matchedDesig!.name,
              branch: matchedBranch!.name,
              zone: matchedBranch!.zone,
              joiningDate: parsedDate!,
              status: normStatus!,
            },
            status: existingEmp ? 'duplicate' : 'valid',
            reason: existingEmp
              ? `Duplicate Employee Code/CNIC (${existingEmp.employeeCode})`
              : undefined,
          });
        }
      });

      setPreview({
        cardType: card,
        fileName: file.name,
        columns: spec.columns,
        rows: previewRows,
      });
    } catch (err: any) {
      setPreview({
        cardType: card,
        fileName: file.name,
        columns: spec.columns,
        rows: [],
        fileError: `Failed to parse "${file.name}": ${err?.message || 'Unsupported file format'}`,
      });
    }
  };

  // Import Valid Rows
  const handleImportValidRows = async () => {
    if (!preview) return;
    const { cardType, rows } = preview;
    const rowsToImport = rows.filter(
      (r) => r.status === 'valid' || (r.status === 'duplicate' && duplicateMode === 'update')
    );

    if (rowsToImport.length === 0) {
      setBannerMsg({
        type: 'bad',
        text: 'No valid rows to import (or duplicates are set to Skip).',
      });
      return;
    }

    const nowIso = new Date().toISOString();

    updateStore((prev) => {
      if (cardType === 'departments') {
        const nextDepts = [...prev.departments];
        rowsToImport.forEach((r) => {
          const idx = nextDepts.findIndex(
            (d) => d.name.toLowerCase() === r.normalized.name.toLowerCase()
          );
          if (idx >= 0) {
            nextDepts[idx] = { ...nextDepts[idx], code: r.normalized.code };
          } else {
            nextDepts.push({
              id: `dept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: r.normalized.name,
              code: r.normalized.code,
              createdAt: nowIso,
            } satisfies PortalDepartment);
          }
        });
        return {
          ...prev,
          departments: nextDepts,
          auditLogs: appendPortalAuditLog(
            prev,
            'bulk_import_departments',
            'departments',
            `import-${rowsToImport.length}`,
            { imported_count: rowsToImport.length, duplicate_mode: duplicateMode }
          ),
        };
      }

      if (cardType === 'designations') {
        const nextDesigs = [...prev.designations];
        rowsToImport.forEach((r) => {
          const idx = nextDesigs.findIndex(
            (d) => d.name.toLowerCase() === r.normalized.name.toLowerCase()
          );
          if (idx >= 0) {
            nextDesigs[idx] = {
              ...nextDesigs[idx],
              department: r.normalized.department,
              track: r.normalized.track,
              needsMachine: r.normalized.needsMachine,
            };
          } else {
            nextDesigs.push({
              id: `desig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: r.normalized.name,
              department: r.normalized.department,
              track: r.normalized.track,
              needsMachine: r.normalized.needsMachine,
              createdAt: nowIso,
            } satisfies PortalDesignation);
          }
        });
        return {
          ...prev,
          designations: nextDesigs,
          auditLogs: appendPortalAuditLog(
            prev,
            'bulk_import_designations',
            'designations',
            `import-${rowsToImport.length}`,
            { imported_count: rowsToImport.length, duplicate_mode: duplicateMode }
          ),
        };
      }

      if (cardType === 'branches') {
        const nextBranches = [...prev.branches];
        rowsToImport.forEach((r) => {
          const idx = nextBranches.findIndex(
            (b) => b.name.toLowerCase() === r.normalized.name.toLowerCase()
          );
          if (idx >= 0) {
            nextBranches[idx] = {
              ...nextBranches[idx],
              zone: r.normalized.zone,
              branchManager: r.normalized.branchManager,
              hrOfficer: r.normalized.hrOfficer,
              type: r.normalized.type,
            };
          } else {
            nextBranches.push({
              id: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: r.normalized.name,
              zone: r.normalized.zone,
              branchManager: r.normalized.branchManager,
              hrOfficer: r.normalized.hrOfficer,
              type: r.normalized.type,
              createdAt: nowIso,
            } satisfies PortalBranch);
          }
        });
        return {
          ...prev,
          branches: nextBranches,
          auditLogs: appendPortalAuditLog(
            prev,
            'bulk_import_branches',
            'branches',
            `import-${rowsToImport.length}`,
            { imported_count: rowsToImport.length, duplicate_mode: duplicateMode }
          ),
        };
      }

      // Employees import
      const nextEmployees = [...prev.employees];
      rowsToImport.forEach((r) => {
        const n = r.normalized;
        const idx = nextEmployees.findIndex(
          (e) =>
            e.employeeCode.toLowerCase() === n.employeeCode.toLowerCase() ||
            e.cnic === n.cnic
        );
        const empRecord: PortalEmployee = {
          id: idx >= 0 ? nextEmployees[idx].id : `emp-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          employeeCode: n.employeeCode,
          fullName: n.fullName,
          cnic: n.cnic,
          contactNumber: n.contactNumber,
          designation: n.designation,
          branch: n.branch,
          zone: n.zone,
          joiningDate: n.joiningDate,
          status: n.status, // 'Active' or 'Exited'
          isNewJoiner: false,
          exitInfo:
            n.status === 'Exited'
              ? {
                  exitType: 'Resignation',
                  lastWorkingDate: n.joiningDate,
                  reason: 'Imported directly as Exited',
                  notes: 'Bulk import archive record',
                  initiatedAt: nowIso,
                  initiatedBy: 'Bulk Import',
                  clearedAt: nowIso,
                  ecfId: '',
                }
              : undefined,
        };
        if (idx >= 0) {
          nextEmployees[idx] = empRecord;
        } else {
          nextEmployees.unshift(empRecord);
        }
      });

      return {
        ...prev,
        employees: nextEmployees,
        auditLogs: appendPortalAuditLog(
          prev,
          'bulk_import_employees',
          'employees',
          `import-${rowsToImport.length}`,
          {
            imported_count: rowsToImport.length,
            active_imported: rowsToImport.filter((r) => r.normalized.status === 'Active').length,
            exited_imported: rowsToImport.filter((r) => r.normalized.status === 'Exited').length,
            duplicate_mode: duplicateMode,
          }
        ),
      };
    });

    // Best-effort background sync with backend org entities if available
    try {
      if (cardType === 'departments') {
        for (const r of rowsToImport) {
          await superAdminApi
            .createOrgEntity('departments', {
              name: r.normalized.name,
              department_code: r.normalized.code,
              department_category: 'Field Operations',
              is_active: true,
            })
            .catch(() => {});
        }
      }
    } catch {
      // Saved in browser store
    }

    setBannerMsg({
      type: 'ok',
      text: `Successfully imported ${rowsToImport.length} ${TEMPLATE_SPECS[cardType].title.toLowerCase()} record(s).`,
    });
    setPreview(null);
    if (onDataImported) onDataImported();
  };

  // Download Error Report (.xlsx with failed rows and reasons)
  const handleDownloadErrorReport = () => {
    if (!preview) return;
    const failedRows = preview.rows.filter(
      (r) => r.status === 'error' || (r.status === 'duplicate' && duplicateMode === 'skip')
    );
    if (failedRows.length === 0) return;

    const reportRows = failedRows.map((r) => ({
      Row: r.rowIndex,
      ...r.raw,
      'Error Reason': r.reason || 'Validation failed',
    }));

    exportRowsToExcel(
      `PostEx_${TEMPLATE_SPECS[preview.cardType].title}_Error_Report.xlsx`,
      'Failed Rows',
      reportRows,
      ['CNIC*', 'Contact Number*']
    );
  };

  const validCount = preview ? preview.rows.filter((r) => r.status === 'valid').length : 0;
  const errorCount = preview ? preview.rows.filter((r) => r.status === 'error').length : 0;
  const duplicateCount = preview ? preview.rows.filter((r) => r.status === 'duplicate').length : 0;
  const importableCount =
    validCount + (duplicateMode === 'update' ? duplicateCount : 0);

  return (
    <div id="data-import-view" className="space-y-6 text-body text-slate-900">
      <PageHeader
        title="Data Import"
        description="Bulk import and export Departments, Designations, Branches, and Employees (.xlsx and .csv)."
      />

      {/* Browser persistence info note */}
      <div
        id="data-import-browser-note"
        className="rounded-xl bg-indigo-50/80 border border-indigo-200/80 px-4 py-3 text-caption text-indigo-900"
      >
        Data is saved in this browser only until the database is connected.
      </div>

      {bannerMsg && (
        <Card
          className={`p-4 flex items-center justify-between gap-3 ${
            bannerMsg.type === 'ok' ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'
          }`}
        >
          <Badge variant={bannerMsg.type === 'ok' ? 'success' : 'error'}>
            {bannerMsg.text}
          </Badge>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setBannerMsg(null)}
          >
            Dismiss
          </Button>
        </Card>
      )}

      {/* 4 Import Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['departments', 'designations', 'branches', 'employees'] as const).map((cardKey) => {
          const spec = TEMPLATE_SPECS[cardKey];
          const unlocked = isCardUnlocked(cardKey);
          const lockHint = getLockHint(cardKey);
          const currentCount =
            cardKey === 'departments'
              ? store.departments.length
              : cardKey === 'designations'
              ? store.designations.length
              : cardKey === 'branches'
              ? store.branches.length
              : store.employees.length;

          return (
            <Card
              key={cardKey}
              id={`import-card-${cardKey}`}
              title={`${spec.step}. ${toTitleCase(spec.title)}`}
              description={`Columns: ${spec.columns.join(', ')}`}
              action={
                <Badge variant={currentCount > 0 ? 'success' : 'neutral'}>
                  {currentCount} records
                </Badge>
              }
              className={!unlocked ? 'opacity-75' : ''}
            >
              {lockHint && (
                <div
                  className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-caption text-amber-800 mb-3"
                  data-testid={`lock-hint-${cardKey}`}
                >
                  {lockHint}
                </div>
              )}

              <input
                ref={fileInputRefs[cardKey]}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={!unlocked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && unlocked) {
                    processUploadedFile(cardKey, f);
                  }
                  e.target.value = '';
                }}
              />

              <div
                onClick={() => {
                  if (unlocked) fileInputRefs[cardKey].current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (unlocked) setDragOverCard(cardKey);
                }}
                onDragLeave={() => setDragOverCard(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCard(null);
                  if (!unlocked) return;
                  const f = e.dataTransfer.files?.[0];
                  if (f) processUploadedFile(cardKey, f);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors my-3 ${
                  !unlocked
                    ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                    : dragOverCard === cardKey
                    ? 'border-indigo-500 bg-indigo-50/60 cursor-pointer'
                    : 'border-slate-200 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer'
                }`}
              >
                <div className="flex justify-center mb-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-body font-bold text-slate-900">
                  {unlocked
                    ? `Drop ${spec.title} .xlsx or .csv file here, or click to browse`
                    : 'Locked — Complete previous steps first'}
                </div>
                <div className="text-caption text-slate-500 mt-1">
                  First sheet only • Validates required fields, dates & duplicates before saving
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  id={`download-template-${cardKey}`}
                  onClick={() => handleDownloadTemplate(cardKey)}
                  leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                >
                  Download Excel Template
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  id={`export-current-${cardKey}`}
                  onClick={() => handleExportCurrentData(cardKey)}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Export Current Data
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Upload Preview & Validation Card */}
      {preview && (
        <Card
          id="import-preview-card"
          title={`Preview: ${toTitleCase(TEMPLATE_SPECS[preview.cardType].title)} (${preview.fileName})`}
          description="Review validation status for every row before importing."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPreview(null)}
            >
              Close Preview
            </Button>
          }
        >
          {preview.fileError ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-caption font-semibold text-rose-700">
              Error: {preview.fileError}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">{validCount} valid</Badge>
                  <Badge variant="error">{errorCount} errors</Badge>
                  <Badge variant="warning">{duplicateCount} duplicates</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 text-caption font-semibold text-slate-600">
                    <span>Duplicates:</span>
                    <div className="w-44">
                      <Select
                        value={duplicateMode}
                        onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'update')}
                        options={[
                          { value: 'skip', label: 'Skip duplicates' },
                          { value: 'update', label: 'Update existing' },
                        ]}
                      />
                    </div>
                  </div>

                  {(errorCount > 0 || (duplicateCount > 0 && duplicateMode === 'skip')) && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      id="download-error-report-btn"
                      onClick={handleDownloadErrorReport}
                    >
                      Download Error Report
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    id="import-valid-rows-btn"
                    disabled={importableCount === 0}
                    onClick={handleImportValidRows}
                  >
                    Import Valid Rows ({importableCount})
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {preview.columns.map((col) => (
                      <TableHead key={col}>{toTitleCase(col)}</TableHead>
                    ))}
                    <TableHead>Validation Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell mobileRole="primary" className="font-mono text-slate-700">
                        {r.rowIndex}
                      </TableCell>
                      {preview.columns.map((col) => (
                        <TableCell
                          key={col}
                          mobileRole="field"
                          mobileLabel={toTitleCase(col)}
                          className={
                            col === 'Employee Code*' || col === 'CNIC*' || col === 'Code'
                              ? 'font-mono text-slate-700'
                              : 'text-slate-800'
                          }
                        >
                          {col === 'Full Name*' || col === 'Branch Manager'
                            ? toTitleCase(r.raw[col]) || '—'
                            : r.raw[col] || '—'}
                        </TableCell>
                      ))}
                      <TableCell mobileRole="status">
                        {r.status === 'valid' && <Badge variant="success">Valid</Badge>}
                        {r.status === 'duplicate' && (
                          <Badge variant={duplicateMode === 'update' ? 'warning' : 'error'}>
                            {duplicateMode === 'update'
                              ? `Duplicate (Will update): ${r.reason}`
                              : `Error: ${r.reason}`}
                          </Badge>
                        )}
                        {r.status === 'error' && (
                          <Badge variant="error">Error: {r.reason}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
