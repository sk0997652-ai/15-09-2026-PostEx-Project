import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export type TrackType =
  | 'Frontline & Field'
  | 'Branch & Operations'
  | 'Corporate Staff'
  | 'Leadership';

export type BranchType = 'Hub' | 'Sub-Hub' | 'Warehouse';

export type EmployeeLifecycleStatus = 'Active' | 'Exit In Progress' | 'Exited';

export type ExitType = 'Resignation' | 'Termination' | 'Absconding';

export interface PortalDepartment {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface PortalDesignation {
  id: string;
  name: string;
  department: string;
  track: TrackType;
  needsMachine: 'Yes' | 'No';
  createdAt: string;
}

export interface PortalBranch {
  id: string;
  name: string;
  zone: string;
  branchManager: string;
  hrOfficer: string;
  type: BranchType;
  createdAt: string;
}

export interface EmployeeExitMetadata {
  exitType: ExitType;
  lastWorkingDate: string;
  reason: string;
  notes: string;
  initiatedAt: string;
  initiatedBy: string;
  clearedAt?: string;
  ecfId: string;
}

export interface PortalEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  cnic: string;
  contactNumber: string;
  designation: string;
  branch: string;
  zone: string;
  joiningDate: string;
  status: EmployeeLifecycleStatus;
  isNewJoiner: boolean;
  exitInfo?: EmployeeExitMetadata;
}

export type BranchTuple = [string, string, string]; // [branchName, zoneName, hrOfficer]
export type TaskTuple = [string, number, string]; // [taskName, targetDay, shortLabel]
export type DoneValue = number | 'x' | null;

export interface JoinerRecord {
  id: string;
  n: string;
  d: string;
  hasMachineAccess: boolean;
  b: BranchTuple;
  ago: number;
  done: DoneValue[];
  hr: string;
}

export interface ExitRecord {
  id: string;
  employeeId?: string;
  employeeCode?: string;
  n: string;
  d: string;
  b: BranchTuple;
  ago: number;
  k: number;
  checklist: boolean[];
  type: ExitType;
  lastWorkingDate?: string;
  reason?: string;
  notes?: string;
  initiatedAt: string;
}

export interface PortalAuditEntry {
  id: string;
  action: string;
  actor_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface HrPortalState {
  departments: PortalDepartment[];
  designations: PortalDesignation[];
  branches: PortalBranch[];
  employees: PortalEmployee[];
  tasks: TaskTuple[];
  ecfItems: string[];
  joiners: JoinerRecord[];
  exits: ExitRecord[];
  auditLogs: PortalAuditEntry[];
  approvedHeadcountOverrides: Record<string, number>; // key: `${branchName}::${designationName}`
}

const STORAGE_KEY = 'postex_hr_portal_store_v1';
const STORE_EVENT = 'postex-hr-store-update';

export const DEFAULT_BRANCH_TUPLES: BranchTuple[] = [
  ['Gulshan Hub', 'South Zone', 'Asad Khan'],
  ['Korangi Hub', 'South Zone', 'Bilal Ahmed'],
  ['Clifton Sub-Hub', 'South Zone', 'Sana Iqbal'],
  ['Gulberg Hub', 'Central Zone', 'Hamza Ali'],
  ['Model Town Hub', 'Central Zone', 'Usman Raza'],
  ['Johar Town Sub-Hub', 'Central Zone', 'Ayesha Noor'],
  ['Blue Area Hub', 'North Zone', 'Farhan Shah'],
  ['Saddar Warehouse', 'North Zone', 'Kamran Butt'],
];

export const DEFAULT_DESIGNATIONS_SEED: [string, number, string, TrackType][] = [
  ['Delivery Courier I', 1, 'Fleet & Last Mile', 'Frontline & Field'],
  ['Rider II', 1, 'Fleet & Last Mile', 'Frontline & Field'],
  ['Loader', 0, 'Hub & Warehouse Operations', 'Frontline & Field'],
  ['Pickup Helper', 0, 'Fleet & Last Mile', 'Frontline & Field'],
  ['Branch Assistant', 1, 'Field Operations', 'Branch & Operations'],
  ['Last Mile Assistant', 1, 'Field Operations', 'Branch & Operations'],
  ['Sweeper', 0, 'Hub & Warehouse Operations', 'Frontline & Field'],
  ['Branch Supervisor', 1, 'Field Operations', 'Leadership'],
  ['Sorting Assistant', 0, 'Hub & Warehouse Operations', 'Branch & Operations'],
  ['Store Assistant', 1, 'Corporate HR & Admin', 'Corporate Staff'],
];

export const INITIAL_TASKS: TaskTuple[] = [
  ['Employee code opened', 0, 'Code'],
  ['Machine enrolment', 1, 'Machine'],
  ['Login credentials', 1, 'Login'],
  ['SIM issued', 2, 'SIM'],
  ['ID card issued', 3, 'ID card'],
  ['Documents sent to head office', 5, 'Docs to HO'],
];

export const INITIAL_ECF: string[] = [
  'ID card',
  'SIM',
  'Login',
  'Machine',
  'Assets',
  'ECF to HO',
];

const FIRST_NAMES = ['Ahmed', 'Usman', 'Bilal', 'Hassan', 'Zain', 'Imran', 'Faisal', 'Asif', 'Saad', 'Owais'];
const LAST_NAMES = ['Khan', 'Ali', 'Raza', 'Malik', 'Butt', 'Shah'];

function buildInitialSeedState(): HrPortalState {
  let s0 = 7;
  const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;

  const nowIso = new Date().toISOString();

  const departments: PortalDepartment[] = [
    { id: 'dept-1', name: 'Field Operations', code: 'DEPT-OPS', createdAt: nowIso },
    { id: 'dept-2', name: 'Fleet & Last Mile', code: 'DEPT-FLT', createdAt: nowIso },
    { id: 'dept-3', name: 'Hub & Warehouse Operations', code: 'DEPT-HUB', createdAt: nowIso },
    { id: 'dept-4', name: 'Corporate HR & Admin', code: 'DEPT-HR', createdAt: nowIso },
  ];

  const designations: PortalDesignation[] = DEFAULT_DESIGNATIONS_SEED.map(
    ([name, machine, department, track], idx) => ({
      id: `desig-${idx + 1}`,
      name,
      department,
      track,
      needsMachine: machine ? 'Yes' : 'No',
      createdAt: nowIso,
    })
  );

  const branches: PortalBranch[] = DEFAULT_BRANCH_TUPLES.map(([name, zone, hr], idx) => ({
    id: `branch-${idx + 1}`,
    name,
    zone,
    branchManager: hr,
    hrOfficer: hr,
    type: name.includes('Sub-Hub')
      ? 'Sub-Hub'
      : name.includes('Warehouse')
      ? 'Warehouse'
      : 'Hub',
    createdAt: nowIso,
  }));

  const joiners: JoinerRecord[] = Array.from({ length: 28 }, (_, i) => {
    const b = DEFAULT_BRANCH_TUPLES[i % 8];
    const d = DEFAULT_DESIGNATIONS_SEED[Math.floor(rnd() * DEFAULT_DESIGNATIONS_SEED.length)];
    const ago = 1 + Math.floor(rnd() * 30);
    const stall = rnd() < 0.25;
    const done: DoneValue[] = INITIAL_TASKS.map(([lbl, t]) => {
      if (!d[1] && (lbl === 'Login credentials' || lbl === 'SIM issued')) return 'x';
      if (stall && t >= 3) return null;
      const dd = t + Math.round(rnd() * 8);
      return dd <= ago ? dd : null;
    });
    return {
      id: `joiner-${i + 1}`,
      n: FIRST_NAMES[i % 10] + ' ' + LAST_NAMES[(i * 3 + 1) % 6],
      d: d[0],
      hasMachineAccess: Boolean(d[1]),
      b,
      ago,
      done,
      hr: b[2],
    };
  });

  const exits: ExitRecord[] = Array.from({ length: 8 }, (_, i) => {
    const b = DEFAULT_BRANCH_TUPLES[(i * 3) % 8];
    const ago = 1 + Math.floor(rnd() * 18);
    const k = ago > 10 ? (rnd() < 0.6 ? 6 : Math.floor(rnd() * 6)) : Math.floor(rnd() * 6);
    const types: ExitType[] = ['Resignation', 'Termination', 'Absconding'];
    const checklist = INITIAL_ECF.map((_, idx) => idx < k);
    const initiatedDate = new Date(Date.now() - ago * 86400000).toISOString();
    return {
      id: `exit-seed-${i + 1}`,
      employeeId: `emp-exit-seed-${i + 1}`,
      employeeCode: `PX-EMP-${2001 + i}`,
      n: FIRST_NAMES[(i + 4) % 10] + ' ' + LAST_NAMES[(i * 5) % 6],
      d: DEFAULT_DESIGNATIONS_SEED[i % 10][0],
      b,
      ago,
      k,
      checklist,
      type: types[i % 3],
      lastWorkingDate: initiatedDate.slice(0, 10),
      reason: 'Seeded historical clearance record',
      notes: '',
      initiatedAt: initiatedDate,
    };
  });

  // Seed active employees across all 8 branches + seeded exit records so the Employee list & Archive are populated
  const activeEmployees: PortalEmployee[] = Array.from({ length: 24 }, (_, i) => {
    const b = DEFAULT_BRANCH_TUPLES[i % 8];
    const d = DEFAULT_DESIGNATIONS_SEED[i % DEFAULT_DESIGNATIONS_SEED.length];
    const cnicSuffix = String(10000000 + i * 137).slice(0, 8);
    const phoneSuffix = String(1000000 + i * 241).slice(0, 7);
    const joinDay = new Date(Date.now() - (45 + i * 5) * 86400000).toISOString().slice(0, 10);
    return {
      id: `emp-active-${i + 1}`,
      employeeCode: `PX-EMP-${1001 + i}`,
      fullName: `${FIRST_NAMES[(i + 2) % 10]} ${LAST_NAMES[(i * 2 + 1) % 6]}`,
      cnic: `35202${cnicSuffix}`,
      contactNumber: `0300${phoneSuffix}`,
      designation: d[0],
      branch: b[0],
      zone: b[1],
      joiningDate: joinDay,
      status: 'Active',
      isNewJoiner: false,
    };
  });

  const exitEmployees: PortalEmployee[] = exits.map((ex, i) => {
    const isCleared = ex.k >= INITIAL_ECF.length;
    const cnicSuffix = String(50000000 + i * 319).slice(0, 8);
    const phoneSuffix = String(4000000 + i * 513).slice(0, 7);
    return {
      id: ex.employeeId || `emp-exit-seed-${i + 1}`,
      employeeCode: ex.employeeCode || `PX-EMP-${2001 + i}`,
      fullName: ex.n,
      cnic: `42101${cnicSuffix}`,
      contactNumber: `0321${phoneSuffix}`,
      designation: ex.d,
      branch: ex.b[0],
      zone: ex.b[1],
      joiningDate: '2024-06-15',
      status: isCleared ? 'Exited' : 'Exit In Progress',
      isNewJoiner: false,
      exitInfo: {
        exitType: ex.type,
        lastWorkingDate: ex.lastWorkingDate || '2025-01-10',
        reason: ex.reason || 'Personal reasons',
        notes: ex.notes || '',
        initiatedAt: ex.initiatedAt,
        initiatedBy: ex.b[2],
        clearedAt: isCleared ? new Date().toISOString() : undefined,
        ecfId: ex.id,
      },
    };
  });

  return {
    departments,
    designations,
    branches,
    employees: [...activeEmployees, ...exitEmployees],
    tasks: INITIAL_TASKS.map((t) => [...t] as TaskTuple),
    ecfItems: [...INITIAL_ECF],
    joiners,
    exits,
    auditLogs: [],
    approvedHeadcountOverrides: {},
  };
}

let memoryState: HrPortalState | null = null;

export function getHrPortalState(): HrPortalState {
  if (typeof window === 'undefined') {
    if (!memoryState) memoryState = buildInitialSeedState();
    return memoryState;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HrPortalState;
      if (
        parsed &&
        Array.isArray(parsed.departments) &&
        Array.isArray(parsed.designations) &&
        Array.isArray(parsed.branches) &&
        Array.isArray(parsed.employees) &&
        Array.isArray(parsed.tasks) &&
        Array.isArray(parsed.ecfItems) &&
        Array.isArray(parsed.joiners) &&
        Array.isArray(parsed.exits)
      ) {
        // Ensure checklist array exists on exits
        parsed.exits = parsed.exits.map((ex) => ({
          ...ex,
          checklist: Array.isArray(ex.checklist)
            ? ex.checklist
            : parsed.ecfItems.map((_, idx) => idx < (ex.k ?? 0)),
        }));
        parsed.auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [];
        parsed.approvedHeadcountOverrides = parsed.approvedHeadcountOverrides || {};
        memoryState = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to initial seed state
  }
  const initial = buildInitialSeedState();
  saveHrPortalState(initial, false);
  return initial;
}

export function saveHrPortalState(nextState: HrPortalState, emit = true): void {
  memoryState = nextState;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage quota errors
    }
    if (emit) {
      window.dispatchEvent(new CustomEvent(STORE_EVENT));
    }
  }
}

export function updateHrPortalState(updater: (prev: HrPortalState) => HrPortalState): HrPortalState {
  const current = getHrPortalState();
  const next = updater(current);
  saveHrPortalState(next, true);
  return next;
}

export function useHrPortalStore(): [HrPortalState, (updater: (prev: HrPortalState) => HrPortalState) => void] {
  const [state, setState] = useState<HrPortalState>(() => getHrPortalState());

  useEffect(() => {
    const handleSync = () => {
      setState({ ...getHrPortalState() });
    };
    window.addEventListener(STORE_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(STORE_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const update = (updater: (prev: HrPortalState) => HrPortalState) => {
    const next = updateHrPortalState(updater);
    setState({ ...next });
  };

  return [state, update];
}

// ============================================================================
// Audit Log Helper
// ============================================================================
export function appendPortalAuditLog(
  state: HrPortalState,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any>,
  actorType = 'staff'
): PortalAuditEntry[] {
  const entry: PortalAuditEntry = {
    id: `audit-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    actor_type: actorType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: new Date().toISOString(),
  };
  return [entry, ...(state.auditLogs || [])];
}

// ============================================================================
// Employee Exit Lifecycle Actions
// ============================================================================
export function markEmployeeExit(params: {
  employeeId: string;
  exitType: ExitType;
  lastWorkingDate: string;
  reason: string;
  notes: string;
  actorName: string;
}): { success: boolean; error?: string } {
  const state = getHrPortalState();
  const emp = state.employees.find((e) => e.id === params.employeeId);
  if (!emp) {
    return { success: false, error: 'Employee not found.' };
  }
  if (emp.status !== 'Active') {
    return { success: false, error: `Employee is already in "${emp.status}" status.` };
  }

  // Find branch tuple and assigned HR officer
  const branchObj = state.branches.find(
    (b) => b.name.toLowerCase() === emp.branch.toLowerCase()
  );
  const tupleMatch = DEFAULT_BRANCH_TUPLES.find(
    (b) => b[0].toLowerCase() === emp.branch.toLowerCase()
  );
  const branchName = branchObj?.name || tupleMatch?.[0] || emp.branch || 'Gulberg Hub';
  const zoneName = branchObj?.zone || tupleMatch?.[1] || emp.zone || 'Central Zone';
  const hrOfficer = branchObj?.hrOfficer || branchObj?.branchManager || tupleMatch?.[2] || 'Hamza Ali';

  const ecfId = `ecf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  // Compute days since lastWorkingDate (minimum 0)
  const lwdMs = Date.parse(params.lastWorkingDate);
  const diffDays = !Number.isNaN(lwdMs)
    ? Math.max(0, Math.floor((Date.now() - lwdMs) / 86400000))
    : 0;

  const newExitRecord: ExitRecord = {
    id: ecfId,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    n: emp.fullName,
    d: emp.designation,
    b: [branchName, zoneName, hrOfficer],
    ago: diffDays,
    k: 0,
    checklist: state.ecfItems.map(() => false),
    type: params.exitType,
    lastWorkingDate: params.lastWorkingDate,
    reason: params.reason,
    notes: params.notes,
    initiatedAt: nowIso,
  };

  updateHrPortalState((prev) => {
    const nextEmployees = prev.employees.map((item) =>
      item.id === emp.id
        ? {
            ...item,
            status: 'Exit In Progress' as EmployeeLifecycleStatus,
            exitInfo: {
              exitType: params.exitType,
              lastWorkingDate: params.lastWorkingDate,
              reason: params.reason,
              notes: params.notes,
              initiatedAt: nowIso,
              initiatedBy: params.actorName,
              ecfId,
            },
          }
        : item
    );

    const nextAudit = appendPortalAuditLog(
      prev,
      'employee_exit_initiated',
      'employee',
      emp.employeeCode || emp.id,
      {
        employee_name: emp.fullName,
        employee_code: emp.employeeCode,
        branch: branchName,
        zone: zoneName,
        hr_officer: hrOfficer,
        exit_type: params.exitType,
        last_working_date: params.lastWorkingDate,
        reason: params.reason,
        notes: params.notes,
        new_status: 'Exit In Progress',
        initiated_by: params.actorName,
      }
    );

    return {
      ...prev,
      employees: nextEmployees,
      exits: [newExitRecord, ...prev.exits],
      auditLogs: nextAudit,
    };
  });

  return { success: true };
}

export function toggleExitChecklistItem(exitId: string, itemIdx: number, actorName = 'HR Officer'): void {
  updateHrPortalState((prev) => {
    let clearedEmployeeId: string | undefined;
    let clearedEmployeeName = '';
    let clearedEmployeeCode = '';

    const nextExits = prev.exits.map((ex) => {
      if (ex.id !== exitId) return ex;
      const currentList =
        Array.isArray(ex.checklist) && ex.checklist.length === prev.ecfItems.length
          ? [...ex.checklist]
          : prev.ecfItems.map((_, idx) => idx < ex.k);
      currentList[itemIdx] = !currentList[itemIdx];
      const doneCount = currentList.filter(Boolean).length;
      if (doneCount >= prev.ecfItems.length && ex.employeeId) {
        clearedEmployeeId = ex.employeeId;
        clearedEmployeeName = ex.n;
        clearedEmployeeCode = ex.employeeCode || ex.employeeId;
      }
      return {
        ...ex,
        checklist: currentList,
        k: doneCount,
      };
    });

    const targetExit = nextExits.find((e) => e.id === exitId);
    const isNowFullyCleared =
      targetExit && prev.ecfItems.length > 0 && targetExit.k >= prev.ecfItems.length;

    const nextEmployees = prev.employees.map((emp) => {
      if (
        (targetExit?.employeeId && emp.id === targetExit.employeeId) ||
        (targetExit?.n && emp.fullName === targetExit.n && emp.branch === targetExit.b[0])
      ) {
        const nextStatus: EmployeeLifecycleStatus = isNowFullyCleared
          ? 'Exited'
          : 'Exit In Progress';
        return {
          ...emp,
          status: nextStatus,
          exitInfo: emp.exitInfo
            ? {
                ...emp.exitInfo,
                clearedAt: isNowFullyCleared ? new Date().toISOString() : undefined,
              }
            : undefined,
        };
      }
      return emp;
    });

    let nextAudit = prev.auditLogs;
    if (isNowFullyCleared && clearedEmployeeId) {
      nextAudit = appendPortalAuditLog(
        prev,
        'employee_exit_cleared',
        'employee',
        clearedEmployeeCode,
        {
          employee_name: clearedEmployeeName,
          employee_code: clearedEmployeeCode,
          ecf_id: exitId,
          new_status: 'Exited',
          cleared_by: actorName,
        }
      );
    }

    return {
      ...prev,
      exits: nextExits,
      employees: nextEmployees,
      auditLogs: nextAudit,
    };
  });
}

export function canSuperAdminUndoExit(initiatedAt?: string, agoDays?: number): boolean {
  if (typeof agoDays === 'number' && agoDays <= 7) {
    if (!initiatedAt) return true;
  }
  if (!initiatedAt) return false;
  const ts = Date.parse(initiatedAt);
  if (Number.isNaN(ts)) return (agoDays ?? 99) <= 7;
  const diffDays = (Date.now() - ts) / 86400000;
  return diffDays <= 7;
}

export function undoEmployeeExit(params: {
  employeeId?: string;
  exitId?: string;
  actorName: string;
}): { success: boolean; error?: string } {
  const state = getHrPortalState();
  const emp = params.employeeId
    ? state.employees.find((e) => e.id === params.employeeId)
    : state.employees.find((e) => e.exitInfo?.ecfId === params.exitId);
  const ex = params.exitId
    ? state.exits.find((x) => x.id === params.exitId)
    : state.exits.find((x) => x.employeeId === params.employeeId);

  const initiatedAt = emp?.exitInfo?.initiatedAt || ex?.initiatedAt;
  const agoDays = ex?.ago;

  if (!canSuperAdminUndoExit(initiatedAt, agoDays)) {
    return {
      success: false,
      error: 'Undo exit is only permitted for Super Admin within 7 days of exit initiation.',
    };
  }

  updateHrPortalState((prev) => {
    const nextEmployees = prev.employees.map((item) => {
      if (
        (emp && item.id === emp.id) ||
        (ex && item.id === ex.employeeId) ||
        (ex && item.fullName === ex.n && item.branch === ex.b[0])
      ) {
        const copy = { ...item, status: 'Active' as EmployeeLifecycleStatus };
        delete copy.exitInfo;
        return copy;
      }
      return item;
    });

    const nextExits = prev.exits.filter((item) => {
      if (ex && item.id === ex.id) return false;
      if (emp && item.employeeId === emp.id) return false;
      return true;
    });

    const nextAudit = appendPortalAuditLog(
      prev,
      'employee_exit_undone',
      'employee',
      emp?.employeeCode || ex?.employeeCode || emp?.id || ex?.id || 'employee',
      {
        employee_name: emp?.fullName || ex?.n || 'Employee',
        restored_status: 'Active',
        undone_by: params.actorName,
      }
    );

    return {
      ...prev,
      employees: nextEmployees,
      exits: nextExits,
      auditLogs: nextAudit,
    };
  });

  return { success: true };
}

// ============================================================================
// Excel Date, Phone, CNIC & SheetJS Import/Export Helpers
// ============================================================================

/**
 * Fix 1: Accept real Excel date serial numbers and text dates
 * (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) and convert them to YYYY-MM-DD.
 */
export function parseExcelDateToYMD(rawVal: unknown): string | null {
  if (rawVal === null || rawVal === undefined || rawVal === '') return null;

  if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
    const y = rawVal.getUTCFullYear();
    const m = String(rawVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Check if Excel serial number (e.g. 40000 - 65000)
  if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
    if (rawVal > 20000 && rawVal < 80000) {
      const utcDays = Math.floor(rawVal - 25569);
      const utcMs = utcDays * 86400 * 1000;
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) {
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    return null;
  }

  const str = String(rawVal).trim();
  if (!str) return null;

  // Numeric string representing an Excel date serial (e.g. "45321")
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial > 20000 && serial < 80000) {
      const utcDays = Math.floor(serial - 25569);
      const dt = new Date(utcDays * 86400 * 1000);
      if (!Number.isNaN(dt.getTime())) {
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    if (y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const check = new Date(Date.UTC(y, m - 1, d));
      if (
        check.getUTCFullYear() === y &&
        check.getUTCMonth() + 1 === m &&
        check.getUTCDate() === d
      ) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const check = new Date(Date.UTC(y, m - 1, d));
      if (
        check.getUTCFullYear() === y &&
        check.getUTCMonth() + 1 === m &&
        check.getUTCDate() === d
      ) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  return null;
}

/**
 * Fix 2: Phone and CNIC: always treat as text, keep the leading zero (e.g., 03001234567).
 */
export function normalizePhoneText(rawVal: unknown): string {
  if (rawVal === null || rawVal === undefined) return '';
  let s = String(rawVal).trim().replace(/[\s-]/g, '');
  if (!s) return '';
  // If Excel stripped the leading 0 from a 10-digit Pakistani mobile number (e.g. 3001234567)
  if (/^3\d{9}$/.test(s)) {
    s = '0' + s;
  }
  return s;
}

export function normalizeCnicText(rawVal: unknown): string {
  if (rawVal === null || rawVal === undefined) return '';
  let s = String(rawVal).trim().replace(/[\s-]/g, '');
  if (!s) return '';
  // If Excel stripped a leading 0 on a 12-digit number
  if (/^\d{12}$/.test(s)) {
    s = '0' + s;
  }
  return s;
}

/**
 * Export an array of objects to an Excel (.xlsx) file in the browser.
 * Sets Text format ('@') on CNIC and Contact Number columns when present.
 */
export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, any>[],
  textColumns: string[] = ['CNIC*', 'CNIC', 'Masked CNIC', 'Contact Number*', 'Contact Number', 'Mobile']
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

  // Identify column indices that should be formatted as Text '@'
  const textColIndices = new Set<number>();
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    const headerCell = ws[headerAddr];
    if (headerCell && textColumns.includes(String(headerCell.v).trim())) {
      textColIndices.add(C);
    }
  }

  // Enforce string cell type and '@' text format on all cells in those columns
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (const C of textColIndices) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell) {
        cell.t = 's';
        cell.v = String(cell.v ?? '');
        cell.z = '@';
      }
    }
  }

  // Set column widths and column default number format
  const colCount = range.e.c - range.s.c + 1;
  ws['!cols'] = Array.from({ length: Math.max(colCount, 1) }, (_, idx) => ({
    wch: 22,
    ...(textColIndices.has(idx) ? { z: '@' } : {}),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
