import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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

const DATA_IMPORT_CSS = `
.di-root {
  --bg: #f4f6f5;
  --sf: #fff;
  --sf2: #f8faf9;
  --ink: #13201e;
  --mut: #63716d;
  --line: #e3e8e6;
  --acc: #0e8f83;
  --accs: #dcf2ef;
  --ok: #178a56;
  --warn: #b26f0a;
  --bad: #c73a3a;
  font: 14px/1.5 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink);
  background: var(--bg);
  font-variant-numeric: tabular-nums;
  min-height: 100%;
  border-radius: 14px;
}
@media (prefers-color-scheme: dark) {
  .di-root:not([data-theme="light"]) {
    --bg: #091311;
    --sf: #101c1a;
    --sf2: #0d1816;
    --ink: #e7efed;
    --mut: #8b9d98;
    --line: #213230;
    --acc: #3ec7b8;
    --accs: #123632;
    --ok: #3fc487;
    --warn: #e5a444;
    --bad: #ef6b6b;
  }
}
.di-root[data-theme="dark"] {
  --bg: #091311;
  --sf: #101c1a;
  --sf2: #0d1816;
  --ink: #e7efed;
  --mut: #8b9d98;
  --line: #213230;
  --acc: #3ec7b8;
  --accs: #123632;
  --ok: #3fc487;
  --warn: #e5a444;
  --bad: #ef6b6b;
}
.di-root * {
  box-sizing: border-box;
}
.di-root button,
.di-root input,
.di-root select {
  font: inherit;
  color: inherit;
}
.di-root .wrap {
  padding: 26px;
  display: grid;
  gap: 20px;
  max-width: 1440px;
  margin: 0 auto;
}
.di-root .top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.di-root .head h1 {
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 0;
}
.di-root .head p {
  color: var(--mut);
  margin: 4px 0 0;
  max-width: 75ch;
  font-size: 13.5px;
}
.di-root .card {
  background: var(--sf);
  border: 1px solid var(--line);
  border-radius: 14px;
}
.di-root .pad {
  padding: 20px;
}
.di-root .ct {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.di-root .ct h2 {
  font-size: 15.5px;
  font-weight: 700;
  margin: 0;
}
.di-root .ct small {
  color: var(--mut);
  font-size: 12.5px;
}
.di-root .tag {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-block;
}
.di-root .t-ok {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 13%, transparent);
}
.di-root .t-w {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 15%, transparent);
}
.di-root .t-b {
  color: var(--bad);
  background: color-mix(in srgb, var(--bad) 13%, transparent);
}
.di-root .t-n {
  color: var(--mut);
  background: var(--sf2);
  border: 1px solid var(--line);
}
.di-root .rule {
  background: var(--accs);
  border-radius: 12px;
  padding: 11px 15px;
  font-size: 12.5px;
  margin: 0;
}
.di-root .cards4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.di-root .dropzone {
  border: 1.5px dashed var(--line);
  background: var(--sf2);
  border-radius: 12px;
  padding: 22px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  margin: 12px 0;
}
.di-root .dropzone:hover,
.di-root .dropzone.drag {
  border-color: var(--acc);
  background: var(--accs);
}
.di-root .dropzone.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.di-root .btn {
  border: 1px solid var(--line);
  background: var(--sf2);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12.5px;
}
.di-root .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.di-root .addb {
  background: var(--acc);
  color: #fff;
  border: 0;
  border-radius: 10px;
  padding: 8px 15px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
}
.di-root .addb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.di-root .delb {
  background: none;
  border: 1px solid var(--line);
  color: var(--bad);
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}
.di-root .scroll {
  overflow-x: auto;
  margin: 0 -20px;
  padding: 0 20px;
}
.di-root table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}
.di-root th {
  font-size: 12px;
  color: var(--mut);
  font-weight: 600;
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  background: var(--sf);
}
.di-root td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  font-size: 13.5px;
}
.di-root tr:last-child td {
  border: 0;
}
.di-root tr:hover td {
  background: var(--sf2);
}
.di-root select {
  background: var(--sf2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 12px;
}
@media (max-width: 1180px) {
  .di-root .cards4 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 860px) {
  .di-root .wrap {
    padding: 14px;
  }
}
`;

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
  const [theme, setTheme] = useState<'light' | 'dark' | undefined>(undefined);
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

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const isDark = prev
        ? prev === 'dark'
        : typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? 'light' : 'dark';
    });
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

      // Fix 4: Read the first sheet only
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

          // Fix 3: Status column: allow "Active" or "Exited" on import
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

      // Employees import:
      // Fix 3: Allow "Active" or "Exited" on import.
      // Imported existing employees get status "Active" (or "Exited" -> directly into Exited/Archive)
      // and must NOT appear in Joiner Tracker (isNewJoiner: false, no ECF created).
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
    <div className="di-root" data-theme={theme} id="data-import-view">
      <style>{DATA_IMPORT_CSS}</style>
      <div className="wrap">
        <div className="top">
          <div className="head">
            <h1>Data Import</h1>
            <p>
              Bulk import and export Departments, Designations, Branches, and Employees (.xlsx and .csv).
            </p>
          </div>
          <button type="button" className="btn" onClick={handleToggleTheme}>
            Toggle theme
          </button>
        </div>

        {/* Required Note #6 */}
        <div className="rule" id="data-import-browser-note">
          Data is saved in this browser only until the database is connected.
        </div>

        {bannerMsg && (
          <div
            className="card pad"
            style={{
              borderColor: bannerMsg.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span className={`tag ${bannerMsg.type === 'ok' ? 't-ok' : 't-b'}`}>
              {bannerMsg.text}
            </span>
            <button type="button" className="btn" onClick={() => setBannerMsg(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* 4 Import Cards */}
        <div className="cards4">
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
              <div
                key={cardKey}
                className="card pad"
                id={`import-card-${cardKey}`}
                style={{ opacity: unlocked ? 1 : 0.72 }}
              >
                <div className="ct">
                  <div>
                    <h2>
                      {spec.step}. {spec.title}
                    </h2>
                    <small>Columns: {spec.columns.join(', ')}</small>
                  </div>
                  <span className={`tag ${currentCount > 0 ? 't-ok' : 't-n'}`}>
                    {currentCount} records
                  </span>
                </div>

                {lockHint && (
                  <div
                    className="rule"
                    style={{ marginBottom: 12, color: 'var(--warn)' }}
                    data-testid={`lock-hint-${cardKey}`}
                  >
                    {lockHint}
                  </div>
                )}

                <input
                  ref={fileInputRefs[cardKey]}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
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
                  className={`dropzone ${dragOverCard === cardKey ? 'drag' : ''} ${
                    !unlocked ? 'disabled' : ''
                  }`}
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
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {unlocked
                      ? `Drop ${spec.title} .xlsx or .csv file here, or click to browse`
                      : `Locked — Complete previous steps first`}
                  </div>
                  <div style={{ color: 'var(--mut)', fontSize: 12, marginTop: 4 }}>
                    First sheet only • Validates required fields, dates & duplicates before saving
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn"
                    id={`download-template-${cardKey}`}
                    onClick={() => handleDownloadTemplate(cardKey)}
                  >
                    Download Excel Template
                  </button>
                  <button
                    type="button"
                    className="btn"
                    id={`export-current-${cardKey}`}
                    onClick={() => handleExportCurrentData(cardKey)}
                  >
                    Export current data
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload Preview & Validation Card */}
        {preview && (
          <div className="card pad" id="import-preview-card">
            <div className="ct">
              <div>
                <h2>
                  Preview: {TEMPLATE_SPECS[preview.cardType].title} ({preview.fileName})
                </h2>
                <small>Review validation status for every row before importing.</small>
              </div>
              <button type="button" className="btn" onClick={() => setPreview(null)}>
                Close preview
              </button>
            </div>

            {preview.fileError ? (
              <div className="rule" style={{ color: 'var(--bad)', fontWeight: 600 }}>
                Error: {preview.fileError}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag t-ok">{validCount} valid</span>
                    <span className="tag t-b">{errorCount} errors</span>
                    <span className="tag t-w">{duplicateCount} duplicates</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12.5, color: 'var(--mut)', fontWeight: 600 }}>
                      Duplicates:
                      <select
                        value={duplicateMode}
                        onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'update')}
                        style={{ marginLeft: 8 }}
                      >
                        <option value="skip">Skip duplicates</option>
                        <option value="update">Update existing</option>
                      </select>
                    </label>

                    {(errorCount > 0 || (duplicateCount > 0 && duplicateMode === 'skip')) && (
                      <button
                        type="button"
                        className="delb"
                        id="download-error-report-btn"
                        onClick={handleDownloadErrorReport}
                      >
                        Download error report
                      </button>
                    )}

                    <button
                      type="button"
                      className="addb"
                      id="import-valid-rows-btn"
                      disabled={importableCount === 0}
                      onClick={handleImportValidRows}
                    >
                      Import valid rows ({importableCount})
                    </button>
                  </div>
                </div>

                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        {preview.columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                        <th>Validation Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.rowIndex}>
                          <td>{r.rowIndex}</td>
                          {preview.columns.map((col) => (
                            <td key={col}>{r.raw[col] || '—'}</td>
                          ))}
                          <td>
                            {r.status === 'valid' && <span className="tag t-ok">Valid</span>}
                            {r.status === 'duplicate' && (
                              <span className={`tag ${duplicateMode === 'update' ? 't-w' : 't-b'}`}>
                                {duplicateMode === 'update'
                                  ? `Duplicate (Will update): ${r.reason}`
                                  : `Error: ${r.reason}`}
                              </span>
                            )}
                            {r.status === 'error' && (
                              <span className="tag t-b">Error: {r.reason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
