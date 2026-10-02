import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Pencil,
  CheckCircle2,
  RotateCcw,
  FileText,
  Clock,
  AlertTriangle,
  History,
  X,
  Upload,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import {
  useHrPortalStore,
  BranchTuple,
  JoinerRecord,
  JoinerTaskDetail,
  ExitRecord,
  hydrateJoinerRecord,
  toggleExitChecklistItem,
  canSuperAdminUndoExit,
  undoEmployeeExit,
  exportRowsToExcel,
  formatRoleDisplayName,
  canRoleVerifyWorkflowTask,
} from '../../lib/hrPortalStore';
import {
  fetchPersistedWorkflowTasks,
  submitWorkflowTaskWithEvidence,
  verifySubmittedWorkflowTask,
  returnSubmittedWorkflowTask,
} from '../../lib/workflowTrackerApi';
import {
  Badge,
  BadgeVariant,
  Button,
  Card,
  Input,
  PageHeader,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
} from '../ui';
import { toTitleCase } from '../../lib/formatText';

export type WorkflowTrackerRole = 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';

export interface WorkflowTrackerViewProps {
  role: WorkflowTrackerRole;
  zoneName?: string;
  branchName?: string;
  assignedBranches?: string[];
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

const SLA_X = 7;
const MIN = 4;

function resolveZoneScope(zoneName?: string): string {
  const z = (zoneName || '').toLowerCase();
  if (z.includes('south') || z.includes('karachi') || z.includes('sindh')) return 'South Zone';
  if (z.includes('north') || z.includes('islamabad') || z.includes('rawalpindi') || z.includes('peshawar')) {
    return 'North Zone';
  }
  return 'Central Zone';
}

function resolveBranchScope(
  branches: BranchTuple[],
  branchName?: string,
  zoneName?: string
): string {
  const b = (branchName || '').toLowerCase();
  for (const [name] of branches) {
    const firstWord = name.split(' ')[0].toLowerCase();
    if (b.includes(name.toLowerCase()) || b.includes(firstWord)) {
      return name;
    }
  }
  const resolvedZone = resolveZoneScope(zoneName);
  const firstInZone = branches.find((item) => item[1] === resolvedZone);
  return firstInZone ? firstInZone[0] : branches[0]?.[0] || 'Gulberg Hub';
}

function resolveCentralHrBranchSet(
  branches: BranchTuple[],
  assignedBranches?: string[],
  zoneName?: string
): Set<string> {
  const matched = new Set<string>();
  if (assignedBranches && assignedBranches.length > 0) {
    for (const raw of assignedBranches) {
      const low = raw.toLowerCase();
      for (const [name] of branches) {
        const firstWord = name.split(' ')[0].toLowerCase();
        if (low.includes(name.toLowerCase()) || low.includes(firstWord)) {
          matched.add(name);
        }
      }
    }
  }
  if (matched.size === 0) {
    const resolvedZone = resolveZoneScope(zoneName);
    for (const [name, z] of branches) {
      if (z === resolvedZone) {
        matched.add(name);
      }
    }
  }
  return matched;
}

function getEvidencePlaceholder(shortLabel: string, taskName: string): string {
  const low = (shortLabel + ' ' + taskName).toLowerCase();
  if (low.includes('code')) return 'Enter Employee Code (e.g. PX-EMP-1042)';
  if (low.includes('machine')) return 'Enter Biometric / Machine Enrolment ID (e.g. BIO-8841)';
  if (low.includes('login')) return 'Enter System Login / Username (e.g. ahmed.khan@postex.pk)';
  if (low.includes('sim')) return 'Enter Issued SIM Number / ICCID (e.g. 0300-4123987)';
  if (low.includes('id')) return 'Enter ID Card Serial / Batch No (e.g. IDC-2026-109)';
  if (low.includes('doc')) return 'Enter Courier Tracking / Dispatch Ref (e.g. TCS-HO-99281)';
  return 'Enter Evidence Reference / Document ID';
}

export const WorkflowTrackerView: React.FC<WorkflowTrackerViewProps> = ({
  role,
  zoneName,
  branchName,
  assignedBranches,
  currentUser,
}) => {
  const [store, updateStore] = useHrPortalStore();
  const tasks = store.tasks;
  const ecfItems = store.ecfItems;

  // Ensure every joiner in view has hydrated taskDetails
  const peopleState = useMemo(() => {
    return store.joiners.map((j, idx) => hydrateJoinerRecord(j, tasks, idx));
  }, [store.joiners, tasks]);

  const exitsState = store.exits;

  const allBranches: BranchTuple[] = useMemo(() => {
    return store.branches.map(
      (b) => [b.name, b.zone, b.hrOfficer || b.branchManager] as BranchTuple
    );
  }, [store.branches]);

  const [wview, setWview] = useState<'j' | 'e' | 's' | 't'>('j');
  const [q, setQ] = useState('');
  const [fs, setFs] = useState('');
  const [exitQ, setExitQ] = useState('');
  const [exitFs, setExitFs] = useState('');
  const [lvl, setLvl] = useState<'Zone' | 'Branch' | 'HR'>('Zone');

  // Task Settings inputs
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDay, setNewTaskDay] = useState('');
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newEcfItem, setNewEcfItem] = useState('');

  // Employee Workflow Drawer State
  const [selectedJoinerId, setSelectedJoinerId] = useState<string | null>(null);
  const [activeTaskFormIndex, setActiveTaskFormIndex] = useState<number | null>(null);
  const [evidenceRefInput, setEvidenceRefInput] = useState('');
  const [completionNoteInput, setCompletionNoteInput] = useState('');
  const [evidenceFileNameInput, setEvidenceFileNameInput] = useState('');
  const [evidenceFileUrlInput, setEvidenceFileUrlInput] = useState('');
  const [returningTaskIndex, setReturningTaskIndex] = useState<number | null>(null);
  const [returnReasonInput, setReturnReasonInput] = useState('');
  const [verificationNoteInput, setVerificationNoteInput] = useState<Record<number, string>>({});
  const [drawerBanner, setDrawerBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [submittingTaskIdx, setSubmittingTaskIdx] = useState<number | null>(null);

  // HR Performance Drill-Down State
  const [drilldownTarget, setDrilldownTarget] = useState<{
    level: 'Zone' | 'Branch' | 'HR';
    name: string;
  } | null>(null);

  // Load persisted workflow tasks from backend on mount
  useEffect(() => {
    fetchPersistedWorkflowTasks().catch(() => {});
  }, []);

  // Show HR Performance tab ONLY to Super Admin and Zonal HR
  const canViewHrPerformance = role === 'super_admin' || role === 'zonal_hr';

  // Scope branches, joiners, and exits by role
  const { scopedBranches, scopedPeople, scopedExits } = useMemo(() => {
    if (role === 'super_admin') {
      return {
        scopedBranches: allBranches,
        scopedPeople: peopleState,
        scopedExits: exitsState,
      };
    }

    if (role === 'zonal_hr') {
      const targetZone = resolveZoneScope(zoneName);
      return {
        scopedBranches: allBranches.filter((b) => b[1] === targetZone),
        scopedPeople: peopleState.filter((p) => p.b[1] === targetZone),
        scopedExits: exitsState.filter((e) => e.b[1] === targetZone),
      };
    }

    if (role === 'central_hr') {
      const branchSet = resolveCentralHrBranchSet(allBranches, assignedBranches, zoneName);
      return {
        scopedBranches: allBranches.filter((b) => branchSet.has(b[0])),
        scopedPeople: peopleState.filter((p) => branchSet.has(p.b[0])),
        scopedExits: exitsState.filter((e) => branchSet.has(e.b[0])),
      };
    }

    // branch_manager -> own branch
    const targetBranch = resolveBranchScope(allBranches, branchName, zoneName);
    return {
      scopedBranches: allBranches.filter((b) => b[0] === targetBranch),
      scopedPeople: peopleState.filter((p) => p.b[0] === targetBranch),
      scopedExits: exitsState.filter((e) => e.b[0] === targetBranch),
    };
  }, [role, zoneName, branchName, assignedBranches, allBranches, peopleState, exitsState]);

  const getTaskDetail = (j: JoinerRecord, k: number): JoinerTaskDetail => {
    if (j.taskDetails && j.taskDetails[k]) {
      return j.taskDetails[k];
    }
    const hydrated = hydrateJoinerRecord(j, tasks);
    return hydrated.taskDetails![k];
  };

  /**
   * Task state evaluation:
   * - 'na': Not needed for this designation
   * - 'sub': Submitted with evidence (awaiting verification — NOT counted as completed!)
   * - 'ret': Returned for correction (NOT counted as completed!)
   * - 'ok': Verified on or before target day
   * - 'late': Verified after target day
   * - 'over': Unverified ('pending' | 'submitted' | 'returned') and past target day
   * - 'pend': Pending and within target day
   */
  const ts = (
    j: JoinerRecord,
    k: number
  ):
    | ['na']
    | ['sub', number]
    | ['ret', number]
    | ['ok' | 'late', number]
    | ['over', number]
    | ['pend'] => {
    const td = getTaskDetail(j, k);
    const targetDay = tasks[k]?.[1] ?? 0;

    if (td.status === 'not_needed' || j.done[k] === 'x') return ['na'];

    if (td.status === 'verified') {
      const doneDay =
        typeof td.completedDayOffset === 'number'
          ? td.completedDayOffset
          : typeof j.done[k] === 'number'
          ? (j.done[k] as number)
          : j.ago;
      return [doneDay <= targetDay ? 'ok' : 'late', Math.max(0, doneDay - targetDay)];
    }

    if (td.status === 'submitted') {
      return ['sub', Math.max(0, j.ago - targetDay)];
    }

    if (td.status === 'returned') {
      return ['ret', Math.max(0, j.ago - targetDay)];
    }

    return j.ago > targetDay ? ['over', j.ago - targetDay] : ['pend'];
  };

  const isTaskOverdue = (j: JoinerRecord, k: number): boolean => {
    const td = getTaskDetail(j, k);
    const targetDay = tasks[k]?.[1] ?? 0;
    if (td.status === 'not_needed' || td.status === 'verified') return false;
    return j.ago > targetDay;
  };

  const formatChipLabel = (j: JoinerRecord, k: number): string => {
    const [st, d] = ts(j, k);
    if (st === 'na') return 'Not needed';
    if (st === 'sub') return 'Submitted';
    if (st === 'ret') return 'Returned';
    if (st === 'ok') return 'Verified';
    if (st === 'late') return `Verified +${d}d`;
    if (st === 'over') return `Overdue ${d}d`;
    return 'Pending';
  };

  const renderChip = (j: JoinerRecord, k: number) => {
    const [st, d] = ts(j, k);
    if (st === 'na') return <span className="text-caption text-slate-400">Not needed</span>;
    if (st === 'sub') return <Badge variant="info">Submitted</Badge>;
    if (st === 'ret') return <Badge variant="error">Returned</Badge>;
    if (st === 'ok') return <Badge variant="success">Verified</Badge>;
    if (st === 'late') return <Badge variant="warning">Verified +{d}d</Badge>;
    if (st === 'over') return <Badge variant="error">Overdue {d}d</Badge>;
    return <Badge variant="neutral">Pending</Badge>;
  };

  const jstat = (j: JoinerRecord) => {
    let a = 0;
    let dn = 0;
    let ov = 0;
    let submittedCount = 0;
    let returnedCount = 0;

    tasks.forEach((_, k) => {
      const td = getTaskDetail(j, k);
      if (td.status === 'not_needed' || j.done[k] === 'x') return;
      a++;
      if (td.status === 'verified') {
        dn++;
      } else {
        if (td.status === 'submitted') submittedCount++;
        if (td.status === 'returned') returnedCount++;
        if (isTaskOverdue(j, k)) ov++;
      }
    });

    const st = ov > 0 ? 'Has overdue' : dn === a ? 'Complete' : 'In progress';
    return { a, dn, ov, submittedCount, returnedCount, st };
  };

  const isEcfItemDone = (e: ExitRecord, idx: number): boolean => {
    if (Array.isArray(e.checklist) && idx < e.checklist.length) {
      return Boolean(e.checklist[idx]);
    }
    return idx < e.k;
  };

  const exDoneCount = (e: ExitRecord) => {
    return ecfItems.filter((_, idx) => isEcfItemDone(e, idx)).length;
  };

  const exS = (e: ExitRecord): [string, BadgeVariant] =>
    exDoneCount(e) >= ecfItems.length
      ? ['Cleared', 'success']
      : e.ago > SLA_X
      ? ['Overdue', 'error']
      : ['In progress', 'warning'];

  const ag = (js: JoinerRecord[], es: ExitRecord[]) => {
    let tot = 0;
    let ok = 0;
    let ov = 0;
    let verifiedCount = 0;
    let applicableCount = 0;
    let submittedCount = 0;
    const cd: number[] = [];

    js.forEach((j) => {
      tasks.forEach((_, k) => {
        const td = getTaskDetail(j, k);
        const [st] = ts(j, k);
        if (st === 'na') return;
        applicableCount++;
        if (td.status === 'verified') verifiedCount++;
        if (td.status === 'submitted') submittedCount++;
        if (isTaskOverdue(j, k)) ov++;

        if (st === 'pend' || st === 'sub') return;
        tot++;
        if (st === 'ok') ok++;
      });
      if (jstat(j).st === 'Complete') {
        const numericDone = j.done.filter(
          (v, k): v is number => k < tasks.length && v !== 'x' && v !== null
        );
        if (numericDone.length > 0) {
          cd.push(Math.max(...numericDone));
        }
      }
    });

    return {
      n: js.length,
      pct: tot ? (ok / tot) * 100 : 0,
      ov,
      verifiedCount,
      applicableCount,
      submittedCount,
      avg: cd.length ? cd.reduce((a, b) => a + b, 0) / cd.length : 0,
      ecf: es.filter((e) => exDoneCount(e) < ecfItems.length).length,
    };
  };

  const flag = (a: { n: number; pct: number }): [string, BadgeVariant, string] =>
    a.n < MIN
      ? ['Low volume', 'neutral', '']
      : a.pct >= 85
      ? ['On track', 'success', '']
      : a.pct >= 65
      ? ['Watch', 'warning', 'w']
      : ['Needs action', 'error', 'b'];

  const renderBar = (f: number, c = '') => {
    const fillColor =
      c === 'b'
        ? 'bg-rose-500'
        : c === 'w'
        ? 'bg-amber-500'
        : 'bg-indigo-600';
    return (
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1 min-w-[64px]">
        <div
          className={`h-full rounded-full transition-all ${fillColor}`}
          style={{ width: `${Math.min(Math.max(f, 0), 100)}%` }}
        />
      </div>
    );
  };

  const handleDeleteTask = (idx: number) => {
    updateStore((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx),
      joiners: prev.joiners.map((j) => ({
        ...j,
        done: j.done.filter((_, i) => i !== idx),
        taskDetails: (j.taskDetails || []).filter((_, i) => i !== idx),
      })),
    }));
  };

  const handleAddTask = () => {
    const nm = newTaskName.trim();
    if (!nm) return;
    const targetDay = newTaskDay ? Number(newTaskDay) : 0;
    const shortLabel = newTaskLabel.trim() || nm.split(' ')[0];
    updateStore((prev) => ({
      ...prev,
      tasks: [...prev.tasks, [nm, targetDay, shortLabel]],
      joiners: prev.joiners.map((j, idx) => {
        const nextDone = [...j.done, null];
        return hydrateJoinerRecord({ ...j, done: nextDone }, [...prev.tasks, [nm, targetDay, shortLabel]], idx);
      }),
    }));
    setNewTaskName('');
    setNewTaskDay('');
    setNewTaskLabel('');
  };

  const handleDeleteEcfItem = (idx: number) => {
    updateStore((prev) => ({
      ...prev,
      ecfItems: prev.ecfItems.filter((_, i) => i !== idx),
      exits: prev.exits.map((ex) => {
        const nextList = (ex.checklist || []).filter((_, i) => i !== idx);
        return {
          ...ex,
          checklist: nextList,
          k: nextList.filter(Boolean).length,
        };
      }),
    }));
  };

  const handleAddEcfItem = () => {
    const nm = newEcfItem.trim();
    if (!nm) return;
    updateStore((prev) => ({
      ...prev,
      ecfItems: [...prev.ecfItems, nm],
      exits: prev.exits.map((ex) => ({
        ...ex,
        checklist: [...(ex.checklist || prev.ecfItems.map((_, i) => i < ex.k)), false],
      })),
    }));
    setNewEcfItem('');
  };

  const subTabs: [('j' | 'e' | 's' | 't'), string][] = canViewHrPerformance
    ? [
        ['j', 'Joiner Tracker'],
        ['e', 'Exits & ECF'],
        ['s', 'HR Performance'],
        ['t', 'Task Settings'],
      ]
    : [
        ['j', 'Joiner Tracker'],
        ['e', 'Exits & ECF'],
        ['t', 'Task Settings'],
      ];

  const activeSubTab = !canViewHrPerformance && wview === 's' ? 'j' : wview;

  // Filtered Joiner rows
  const filteredJoiners = useMemo(() => {
    const query = q.trim().toLowerCase();
    return scopedPeople
      .map((j) => [j, jstat(j)] as const)
      .filter(
        ([j]) =>
          !query ||
          (j.n + j.b[0] + j.hr + (j.employeeCode || '')).toLowerCase().includes(query)
      )
      .filter(([, st]) => {
        if (!fs) return true;
        if (fs === 'Submitted') return st.submittedCount > 0;
        return st.st === fs;
      })
      .sort((a, b) => a[0].ago - b[0].ago);
  }, [scopedPeople, tasks, q, fs]);

  // Filtered Exits rows
  const filteredExits = useMemo(() => {
    const query = exitQ.trim().toLowerCase();
    return scopedExits.filter((e) => {
      const [statusLabel] = exS(e);
      if (query && !(e.n + e.b[0] + e.b[2] + e.type).toLowerCase().includes(query)) {
        return false;
      }
      if (exitFs && statusLabel !== exitFs) return false;
      return true;
    });
  }, [scopedExits, ecfItems, exitQ, exitFs]);

  // Export handlers respecting current filters
  const handleExportJoiners = () => {
    const rows = filteredJoiners.map(([j, st]) => {
      const base: Record<string, any> = {
        'Employee Code': j.employeeCode || j.id,
        Joiner: j.n,
        Designation: j.d,
        Branch: j.b[0],
        Zone: j.b[1],
        'HR Officer': j.hr,
        Joined: `${j.ago}d ago`,
      };
      tasks.forEach((t, k) => {
        base[t[2]] = formatChipLabel(j, k);
      });
      base.Progress = `${st.dn}/${st.a}`;
      base.Status = st.st;
      return base;
    });
    exportRowsToExcel('PostEx_Workflow_Joiners_Export.xlsx', 'Joiners', rows);
  };

  const handleExportExits = () => {
    const rows = filteredExits.map((e) => {
      const [statusLabel] = exS(e);
      const dn = exDoneCount(e);
      const base: Record<string, any> = {
        Employee: e.n,
        Designation: e.d,
        Branch: e.b[0],
        Zone: e.b[1],
        'HR Officer': e.b[2],
        'Exit Type': e.type,
        Left: `${e.ago}d ago`,
      };
      ecfItems.forEach((item, idx) => {
        base[item] = isEcfItemDone(e, idx) ? 'Done' : 'Pending';
      });
      base.Progress = `${dn}/${ecfItems.length}`;
      base.Status = statusLabel;
      return base;
    });
    exportRowsToExcel('PostEx_Workflow_Exits_ECF_Export.xlsx', 'Exits & ECF', rows);
  };

  // Selected Joiner for Drawer
  const selectedJoiner = useMemo(() => {
    if (!selectedJoinerId) return null;
    return peopleState.find((j) => j.id === selectedJoinerId) || null;
  }, [selectedJoinerId, peopleState]);

  const openJoinerDrawer = (joiner: JoinerRecord) => {
    setSelectedJoinerId(joiner.id);
    setDrawerBanner(null);
    setReturningTaskIndex(null);
    setReturnReasonInput('');
    // Automatically pre-open the first Pending or Returned task form for quick access
    const firstActionableIdx = tasks.findIndex((_, k) => {
      const td = getTaskDetail(joiner, k);
      return td.status === 'pending' || td.status === 'returned';
    });
    if (firstActionableIdx >= 0) {
      const td = getTaskDetail(joiner, firstActionableIdx);
      setActiveTaskFormIndex(firstActionableIdx);
      setEvidenceRefInput(td.evidenceReference || '');
      setCompletionNoteInput(td.completionNote || '');
      setEvidenceFileNameInput(td.evidenceFileName || '');
      setEvidenceFileUrlInput(td.evidenceUrl || '');
    } else {
      setActiveTaskFormIndex(null);
      setEvidenceRefInput('');
      setCompletionNoteInput('');
      setEvidenceFileNameInput('');
      setEvidenceFileUrlInput('');
    }
  };

  const closeJoinerDrawer = () => {
    setSelectedJoinerId(null);
    setActiveTaskFormIndex(null);
    setReturningTaskIndex(null);
    setDrawerBanner(null);
  };

  const resolveActorName = (joiner?: JoinerRecord | null): string => {
    if (currentUser?.name) return currentUser.name;
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'zonal_hr') return `${resolveZoneScope(zoneName)} HR Manager`;
    if (role === 'central_hr') return joiner?.hr || 'Central HR Officer';
    return `${resolveBranchScope(allBranches, branchName, zoneName)} Manager`;
  };

  const canVerifyTasks = canRoleVerifyWorkflowTask(role);

  const handleOpenTaskForm = (joiner: JoinerRecord, k: number) => {
    const td = getTaskDetail(joiner, k);
    setActiveTaskFormIndex(k);
    setReturningTaskIndex(null);
    setEvidenceRefInput(td.evidenceReference || '');
    setCompletionNoteInput(td.completionNote || '');
    setEvidenceFileNameInput(td.evidenceFileName || '');
    setEvidenceFileUrlInput(td.evidenceUrl || '');
    setDrawerBanner(null);
  };

  const handleEvidenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceFileNameInput(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEvidenceFileUrlInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTaskEvidence = async (joiner: JoinerRecord, k: number) => {
    const td = getTaskDetail(joiner, k);
    const trimmedRef = evidenceRefInput.trim();
    const trimmedFile = evidenceFileNameInput.trim();
    const trimmedNote = completionNoteInput.trim();

    if (!trimmedRef && !trimmedFile) {
      setDrawerBanner({
        type: 'error',
        text: `Please provide an Evidence Reference / ID or attach proof for "${td.taskName}" before submitting.`,
      });
      return;
    }

    setSubmittingTaskIdx(k);
    try {
      const actorName = resolveActorName(joiner);
      const result = await submitWorkflowTaskWithEvidence({
        joiner,
        taskDetail: td,
        evidenceReference: trimmedRef,
        completionNote: trimmedNote,
        evidenceFileName: trimmedFile || undefined,
        evidenceUrl: evidenceFileUrlInput || undefined,
        actorName,
        actorRole: role,
      });

      if (!result.success) {
        setDrawerBanner({
          type: 'error',
          text: result.error || 'Failed to submit task.',
        });
        return;
      }

      setActiveTaskFormIndex(null);
      setDrawerBanner({
        type: 'info',
        text: `"${td.taskName}" has been submitted with evidence (${trimmedRef || trimmedFile}). Status is now Submitted — awaiting verification.`,
      });
    } finally {
      setSubmittingTaskIdx(null);
    }
  };

  const handleVerifyTask = async (joiner: JoinerRecord, k: number) => {
    const td = getTaskDetail(joiner, k);
    setSubmittingTaskIdx(k);
    try {
      const actorName = resolveActorName(joiner);
      const vNote = verificationNoteInput[k] || '';
      const result = await verifySubmittedWorkflowTask({
        joiner,
        taskDetail: td,
        verificationNote: vNote,
        actorName,
        actorRole: role,
      });

      if (!result.success) {
        setDrawerBanner({
          type: 'error',
          text: result.error || 'Failed to verify task.',
        });
        return;
      }

      setDrawerBanner({
        type: 'success',
        text: `"${td.taskName}" has been verified by ${toTitleCase(actorName)}. Joiner Progress and Status updated automatically.`,
      });
    } finally {
      setSubmittingTaskIdx(null);
    }
  };

  const handleReturnTask = async (joiner: JoinerRecord, k: number) => {
    const td = getTaskDetail(joiner, k);
    const trimmedReason = returnReasonInput.trim();
    if (!trimmedReason) {
      setDrawerBanner({
        type: 'error',
        text: 'Please provide a reason for returning this task to the HR Officer.',
      });
      return;
    }

    setSubmittingTaskIdx(k);
    try {
      const actorName = resolveActorName(joiner);
      const result = await returnSubmittedWorkflowTask({
        joiner,
        taskDetail: td,
        returnReason: trimmedReason,
        actorName,
        actorRole: role,
      });

      if (!result.success) {
        setDrawerBanner({
          type: 'error',
          text: result.error || 'Failed to return task.',
        });
        return;
      }

      setReturningTaskIndex(null);
      setReturnReasonInput('');
      setDrawerBanner({
        type: 'info',
        text: `"${td.taskName}" was returned for correction: "${trimmedReason}".`,
      });
    } finally {
      setSubmittingTaskIdx(null);
    }
  };

  const A = ag(scopedPeople, scopedExits);
  const compCount = scopedPeople.filter((j) => jstat(j).st === 'Complete').length;
  const oc = tasks.map((_, k) => scopedPeople.filter((j) => isTaskOverdue(j, k)).length);
  const mx = Math.max(...oc, 1);

  return (
    <div id="workflow-tracker-view" className="space-y-6 text-body text-slate-900">
      <PageHeader
        title="Workflow Tracker"
        description="Onboarding tasks, exits and HR performance — issued and owned by HR."
      />

      {/* Sub-tabs Navigation matching OrganizationStructureView */}
      <div
        id="wseg"
        className="flex border-b border-slate-200 gap-6 text-caption font-semibold overflow-x-auto"
      >
        {subTabs.map(([key, label]) => {
          const isActive = key === activeSubTab;
          return (
            <button
              key={key}
              type="button"
              data-w={key}
              onClick={() => setWview(key)}
              className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'text-indigo-700 border-b-2 border-indigo-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {/* 1) JOINER TRACKER */}
        {activeSubTab === 'j' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-5">
                <div className="text-table-header uppercase text-slate-500">Joiners In View</div>
                <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                  {scopedPeople.length}
                </div>
                <div className="text-caption text-slate-500 mt-0.5">across scope</div>
              </Card>

              <Card className="p-5">
                <div className="text-table-header uppercase text-slate-500">Fully Onboarded</div>
                <div className="text-kpi-number text-emerald-600 font-mono tabular-nums mt-1">
                  {compCount}
                </div>
                <div className="text-caption text-slate-500 mt-0.5">
                  {scopedPeople.length > 0
                    ? Math.round((compCount / scopedPeople.length) * 100)
                    : 0}
                  % of joiners
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-table-header uppercase text-slate-500">Overdue Tasks</div>
                <div className="text-kpi-number text-rose-600 font-mono tabular-nums mt-1">
                  {A.ov}
                </div>
                <div className="text-caption text-slate-500 mt-0.5">past target day</div>
              </Card>

              <Card className="p-5">
                <div className="text-table-header uppercase text-slate-500">Tasks Done On Time</div>
                <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                  {A.pct.toFixed(0)}%
                </div>
                <div className="text-caption text-slate-500 mt-0.5">of all verified tasks</div>
              </Card>
            </div>

            <Card title="Overdue By Task">
              <div className="space-y-3">
                {tasks.map((t, k) => (
                  <div
                    key={`${t[0]}-${k}`}
                    className="grid grid-cols-[170px_1fr_auto] items-center gap-3 text-caption"
                  >
                    <span className="text-slate-700 font-medium truncate">{t[0]}</span>
                    {renderBar((oc[k] / mx) * 100, oc[k] ? 'b' : '')}
                    <b className="font-mono font-semibold text-slate-900 w-8 text-right">{oc[k]}</b>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Joiners"
              description="Click the edit (pencil) icon on any joiner row to submit task evidence, review submissions, and verify onboarding tasks."
              action={
                <Button
                  id="export-joiners-excel-btn"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportJoiners}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Export To Excel
                </Button>
              }
            >
              <div className="space-y-4">
                <TableToolbar
                  searchInputId="q"
                  searchValue={q}
                  onSearchChange={setQ}
                  searchPlaceholder="Search joiner, code, branch or HR"
                  filters={[
                    {
                      id: 'fs',
                      label: 'Filter by Status',
                      value: fs,
                      onChange: setFs,
                      options: [
                        { value: '', label: 'All statuses' },
                        { value: 'Has overdue', label: 'Has overdue' },
                        { value: 'In progress', label: 'In progress' },
                        { value: 'Submitted', label: 'Awaiting verification (Submitted)' },
                        { value: 'Complete', label: 'Complete' },
                      ],
                    },
                  ]}
                  hasActiveFilters={Boolean(q || fs)}
                  onReset={() => {
                    setQ('');
                    setFs('');
                  }}
                />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Joiner</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Hr Officer</TableHead>
                      <TableHead>Joined</TableHead>
                      {tasks.map((t, k) => (
                        <TableHead key={`${t[2]}-${k}`}>{toTitleCase(t[2])}</TableHead>
                      ))}
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody id="tb">
                    {filteredJoiners.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={tasks.length + 7}
                          className="text-center py-8 text-caption text-slate-500"
                        >
                          No joiners match.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredJoiners.map(([j, st], idx) => (
                        <TableRow
                          key={`${j.id || j.n}-${idx}`}
                          data-joiner-id={j.id}
                          className={
                            selectedJoinerId === j.id ? 'bg-indigo-50/40' : undefined
                          }
                        >
                          <TableCell mobileRole="primary">
                            <div className="font-semibold text-slate-900">{toTitleCase(j.n)}</div>
                            <div className="text-caption text-slate-500 flex items-center gap-1.5">
                              <span>{j.d}</span>
                              {j.employeeCode && (
                                <span className="font-mono text-slate-400">• {j.employeeCode}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="Branch" className="text-slate-700">
                            <div>{j.b[0]}</div>
                            <div className="text-caption text-slate-400">{j.b[1]}</div>
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="HR Officer" className="text-slate-700">
                            {toTitleCase(j.hr)}
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="Joined" className="font-mono text-slate-600">
                            {j.ago}d ago
                          </TableCell>
                          {tasks.map((t, k) => (
                            <TableCell key={k} mobileRole="field" mobileLabel={toTitleCase(t[2])}>
                              {renderChip(j, k)}
                            </TableCell>
                          ))}
                          <TableCell mobileRole="field" mobileLabel="Progress">
                            <Badge
                              data-testid={`joiner-progress-${j.id}`}
                              variant={
                                st.st === 'Complete' ? 'success' : st.ov ? 'error' : 'neutral'
                              }
                              className="font-mono"
                            >
                              {st.dn}/{st.a}
                            </Badge>
                          </TableCell>
                          <TableCell mobileRole="status" data-testid={`joiner-status-${j.id}`}>
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                variant={
                                  st.st === 'Complete'
                                    ? 'success'
                                    : st.st === 'Has overdue'
                                    ? 'error'
                                    : 'warning'
                                }
                              >
                                {st.st}
                              </Badge>
                              {st.submittedCount > 0 && (
                                <Badge variant="info">{st.submittedCount} Submitted</Badge>
                              )}
                              {st.returnedCount > 0 && (
                                <Badge variant="error">{st.returnedCount} Returned</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell mobileRole="actions" className="text-right">
                            <button
                              type="button"
                              id={`edit-joiner-btn-${j.id}`}
                              data-testid={`edit-joiner-btn-${j.id}`}
                              onClick={() => openJoinerDrawer(j)}
                              title={`Manage workflow tasks for ${toTitleCase(j.n)}`}
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}

        {/* 2) EXITS & ECF */}
        {activeSubTab === 'e' &&
          (() => {
            const totX = Math.max(ecfItems.length, 1);
            const op = scopedExits.filter((e) => exDoneCount(e) < ecfItems.length);
            const od = op.filter((e) => e.ago > SLA_X).length;
            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Open Ecfs</div>
                    <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                      {op.length}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">clearance not complete</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Overdue Ecfs</div>
                    <div className="text-kpi-number text-rose-600 font-mono tabular-nums mt-1">
                      {od}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">open past {SLA_X} days</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Cleared</div>
                    <div className="text-kpi-number text-emerald-600 font-mono tabular-nums mt-1">
                      {scopedExits.length - op.length}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">ECF fully complete</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Exits In View</div>
                    <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                      {scopedExits.length}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">all exit types</div>
                  </Card>
                </div>

                <Card
                  title="Employee Clearance Forms"
                  description="Click any checklist item tag to mark Done/Pending. When all items are Done, status becomes Cleared and employee moves to Exited/Archive."
                  action={
                    <Button
                      id="export-exits-excel-btn"
                      variant="secondary"
                      size="sm"
                      onClick={handleExportExits}
                      leftIcon={<Download className="w-4 h-4" />}
                    >
                      Export To Excel
                    </Button>
                  }
                >
                  <div className="space-y-4">
                    <TableToolbar
                      searchInputId="exit-q"
                      searchValue={exitQ}
                      onSearchChange={setExitQ}
                      searchPlaceholder="Search employee, branch or HR"
                      filters={[
                        {
                          id: 'exit-fs',
                          label: 'Filter by Status',
                          value: exitFs,
                          onChange: setExitFs,
                          options: [
                            { value: '', label: 'All statuses' },
                            { value: 'In progress', label: 'In progress' },
                            { value: 'Overdue', label: 'Overdue' },
                            { value: 'Cleared', label: 'Cleared' },
                          ],
                        },
                      ]}
                      hasActiveFilters={Boolean(exitQ || exitFs)}
                      onReset={() => {
                        setExitQ('');
                        setExitFs('');
                      }}
                    />

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Hr Officer</TableHead>
                          <TableHead>Exit Type</TableHead>
                          <TableHead>Left</TableHead>
                          {ecfItems.map((x, idx) => (
                            <TableHead key={`${x}-${idx}`}>{toTitleCase(x)}</TableHead>
                          ))}
                          <TableHead>Progress</TableHead>
                          <TableHead>Status</TableHead>
                          {role === 'super_admin' && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExits.map((e, idx) => {
                          const st = exS(e);
                          const dn = exDoneCount(e);
                          const canUndo =
                            role === 'super_admin' &&
                            canSuperAdminUndoExit(e.initiatedAt, e.ago);
                          return (
                            <TableRow key={`${e.id || e.n}-${idx}`}>
                              <TableCell mobileRole="primary">
                                <div className="font-semibold text-slate-900">{toTitleCase(e.n)}</div>
                                <div className="text-caption text-slate-500">{e.d}</div>
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Branch" className="text-slate-700">
                                {e.b[0]}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="HR Officer" className="text-slate-700">
                                {toTitleCase(e.b[2])}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Exit Type">
                                <Badge variant={e.type === 'Absconding' ? 'error' : 'neutral'}>
                                  {e.type}
                                </Badge>
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Left" className="font-mono text-slate-600">
                                {e.ago}d ago
                              </TableCell>
                              {ecfItems.map((itemLabel, i) => {
                                const itemDone = isEcfItemDone(e, i);
                                return (
                                  <TableCell key={i} mobileRole="field" mobileLabel={toTitleCase(itemLabel)}>
                                    <button
                                      type="button"
                                      onClick={() => toggleExitChecklistItem(e.id, i, e.b[2])}
                                      className="cursor-pointer focus:outline-none"
                                      title="Click to toggle Done / Pending"
                                    >
                                      {itemDone ? (
                                        <Badge variant="success">Done</Badge>
                                      ) : (
                                        <Badge variant={e.ago > SLA_X ? 'error' : 'neutral'}>
                                          Pending
                                        </Badge>
                                      )}
                                    </button>
                                  </TableCell>
                                );
                              })}
                              <TableCell mobileRole="field" mobileLabel="Progress">
                                <div className="flex items-center gap-2.5 min-w-[120px]">
                                  {renderBar(
                                    (dn / totX) * 100,
                                    e.ago > SLA_X && dn < ecfItems.length ? 'b' : ''
                                  )}
                                  <span className="text-caption font-bold font-mono text-slate-700 w-9 text-right">
                                    {dn}/{ecfItems.length}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell mobileRole="status">
                                <Badge variant={st[1]}>{st[0]}</Badge>
                              </TableCell>
                              {role === 'super_admin' && (
                                <TableCell mobileRole="actions">
                                  {canUndo && (
                                    <Button
                                      type="button"
                                      variant="danger"
                                      size="sm"
                                      onClick={() =>
                                        undoEmployeeExit({
                                          exitId: e.id,
                                          employeeId: e.employeeId,
                                          actorName: 'Super Admin',
                                        })
                                      }
                                    >
                                      Undo Exit
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            );
          })()}

        {/* 3) HR PERFORMANCE (Super Admin & Zonal HR only) */}
        {activeSubTab === 's' &&
          canViewHrPerformance &&
          (() => {
            const zs = [...new Set(scopedBranches.map((b) => b[1]))];
            const G: [string, string, (b: BranchTuple) => boolean][] =
              lvl === 'Zone'
                ? zs.map((z) => [z, '', (x: BranchTuple) => x[1] === z])
                : lvl === 'Branch'
                ? scopedBranches.map((b) => [b[0], b[1], (x: BranchTuple) => x[0] === b[0]])
                : scopedBranches.map((b) => [b[2], b[0], (x: BranchTuple) => x[2] === b[2]]);

            const rows = G.map(([nm, sub, f]) => {
              const groupJoiners = scopedPeople.filter((j) => f(j.b));
              const groupExits = scopedExits.filter((e) => f(e.b));
              const a = ag(groupJoiners, groupExits);
              return { n: nm, sub, a, fl: flag(a), groupJoiners };
            }).sort(
              (x, y) => Number(x.a.n < MIN) - Number(y.a.n < MIN) || x.a.pct - y.a.pct
            );

            const handleExportHrPerformance = () => {
              const exportData = rows.map((r) => ({
                [lvl === 'HR' ? 'HR Officer' : lvl]: r.n,
                Scope: r.sub || 'All',
                Joiners: r.a.n,
                'Verified Tasks': `${r.a.verifiedCount}/${r.a.applicableCount}`,
                'Submitted (Awaiting Verification)': r.a.submittedCount,
                'On-time Rate (%)': `${r.a.pct.toFixed(0)}%`,
                'Avg Days': r.a.avg ? Number(r.a.avg.toFixed(1)) : '—',
                Overdue: r.a.ov,
                'Open ECFs': r.a.ecf,
                Flag: r.fl[0],
              }));
              exportRowsToExcel(
                `PostEx_HR_Performance_${lvl}_Export.xlsx`,
                'HR Performance',
                exportData
              );
            };

            const activeDrillRow =
              drilldownTarget && drilldownTarget.level === lvl
                ? rows.find((r) => r.n === drilldownTarget.name) || null
                : null;

            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">On-Time Task Rate</div>
                    <div
                      className={`text-kpi-number font-mono tabular-nums mt-1 ${
                        A.pct >= 85 ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {A.pct.toFixed(0)}%
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">all HR officers</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Avg Days To Onboard</div>
                    <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                      {A.avg.toFixed(1)}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">fully onboarded joiners</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Overdue Tasks</div>
                    <div className="text-kpi-number text-rose-600 font-mono tabular-nums mt-1">
                      {A.ov}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">across scope</div>
                  </Card>

                  <Card className="p-5">
                    <div className="text-table-header uppercase text-slate-500">Open Ecfs</div>
                    <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
                      {A.ecf}
                    </div>
                    <div className="text-caption text-slate-500 mt-0.5">awaiting clearance</div>
                  </Card>
                </div>

                <Card
                  title={toTitleCase(`Scorecard by ${lvl}`)}
                  description="Click any row to drill down into the joiners and onboarding task verification status for that scope."
                  action={
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div
                        id="lv"
                        className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1"
                      >
                        {(['Zone', 'Branch', 'HR officer'] as const).map((l) => {
                          const dataKey = l === 'HR officer' ? 'HR' : l;
                          const isOn = l === lvl || (lvl === 'HR' && l === 'HR officer');
                          return (
                            <button
                              key={l}
                              type="button"
                              data-l={dataKey}
                              onClick={() => {
                                setLvl(dataKey);
                                setDrilldownTarget(null);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-caption font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                isOn
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {toTitleCase(l)}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        id="export-hr-performance-excel-btn"
                        variant="secondary"
                        size="sm"
                        onClick={handleExportHrPerformance}
                        leftIcon={<Download className="w-4 h-4" />}
                      >
                        Export To Excel
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div className="rounded-xl bg-indigo-50/80 border border-indigo-200/80 px-4 py-2.5 text-caption text-indigo-900">
                      Worst performers listed first. Fewer than {MIN} joiners is marked Low
                      volume and not judged. Only verified tasks count toward completion.
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{toTitleCase(lvl === 'HR' ? 'HR officer' : lvl)}</TableHead>
                          <TableHead>Joiners</TableHead>
                          <TableHead>Verified Tasks</TableHead>
                          <TableHead>On-Time Rate</TableHead>
                          <TableHead>Avg Days</TableHead>
                          <TableHead>Overdue</TableHead>
                          <TableHead>Open Ecfs</TableHead>
                          <TableHead>Flag</TableHead>
                          <TableHead className="text-right">Drill-Down</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => {
                          const isSelected = activeDrillRow?.n === r.n;
                          return (
                            <TableRow
                              key={r.n}
                              onClick={() =>
                                setDrilldownTarget(
                                  isSelected ? null : { level: lvl, name: r.n }
                                )
                              }
                              className={`cursor-pointer ${
                                isSelected ? 'bg-indigo-50/50' : ''
                              }`}
                            >
                              <TableCell mobileRole="primary">
                                <div className="font-semibold text-slate-900">
                                  {lvl === 'HR' ? toTitleCase(r.n) : r.n}
                                </div>
                                {r.sub ? (
                                  <div className="text-caption text-slate-500">{r.sub}</div>
                                ) : null}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Joiners" className="font-mono text-slate-700">
                                {r.a.n}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Verified Tasks">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="neutral" className="font-mono">
                                    {r.a.verifiedCount}/{r.a.applicableCount}
                                  </Badge>
                                  {r.a.submittedCount > 0 && (
                                    <Badge variant="info">{r.a.submittedCount} Sub</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="On-Time Rate">
                                <div className="flex items-center gap-2.5 min-w-[120px]">
                                  {renderBar(r.a.pct, r.fl[2])}
                                  <span className="text-caption font-bold font-mono text-slate-700 w-9 text-right">
                                    {r.a.pct.toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Avg Days" className="font-mono text-slate-700">
                                {r.a.avg ? r.a.avg.toFixed(1) : '—'}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Overdue" className="font-mono text-slate-700">
                                {r.a.ov}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Open ECFs" className="font-mono text-slate-700">
                                {r.a.ecf}
                              </TableCell>
                              <TableCell mobileRole="status">
                                <Badge variant={r.fl[1]}>{r.fl[0]}</Badge>
                              </TableCell>
                              <TableCell mobileRole="actions" className="text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDrilldownTarget(
                                      isSelected ? null : { level: lvl, name: r.n }
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50 text-tag font-semibold transition-colors cursor-pointer"
                                >
                                  <span>{isSelected ? 'Hide' : 'Joiners'}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* Interactive Drill-Down Card */}
                {activeDrillRow && (
                  <Card
                    title={toTitleCase(`Joiner Breakdown — ${activeDrillRow.n}`)}
                    description={`Showing ${activeDrillRow.groupJoiners.length} joiners in ${activeDrillRow.n}. Click the pencil icon on any joiner to open their workflow drawer.`}
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDrilldownTarget(null)}
                      >
                        Close Breakdown
                      </Button>
                    }
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Joiner</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Hr Officer</TableHead>
                          <TableHead>Joined</TableHead>
                          {tasks.map((t, k) => (
                            <TableHead key={`dd-${t[2]}-${k}`}>{toTitleCase(t[2])}</TableHead>
                          ))}
                          <TableHead>Progress</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeDrillRow.groupJoiners.map((j) => {
                          const st = jstat(j);
                          return (
                            <TableRow key={`dd-row-${j.id}`}>
                              <TableCell mobileRole="primary">
                                <div className="font-semibold text-slate-900">{toTitleCase(j.n)}</div>
                                <div className="text-caption text-slate-500">{j.d}</div>
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Branch">
                                {j.b[0]}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="HR Officer">
                                {toTitleCase(j.hr)}
                              </TableCell>
                              <TableCell mobileRole="field" mobileLabel="Joined" className="font-mono">
                                {j.ago}d ago
                              </TableCell>
                              {tasks.map((t, k) => (
                                <TableCell key={k} mobileRole="field" mobileLabel={toTitleCase(t[2])}>
                                  {renderChip(j, k)}
                                </TableCell>
                              ))}
                              <TableCell mobileRole="field" mobileLabel="Progress">
                                <Badge
                                  variant={
                                    st.st === 'Complete' ? 'success' : st.ov ? 'error' : 'neutral'
                                  }
                                  className="font-mono"
                                >
                                  {st.dn}/{st.a}
                                </Badge>
                              </TableCell>
                              <TableCell mobileRole="status">
                                <Badge
                                  variant={
                                    st.st === 'Complete'
                                      ? 'success'
                                      : st.st === 'Has overdue'
                                      ? 'error'
                                      : 'warning'
                                  }
                                >
                                  {st.st}
                                </Badge>
                              </TableCell>
                              <TableCell mobileRole="actions" className="text-right">
                                <button
                                  type="button"
                                  onClick={() => openJoinerDrawer(j)}
                                  title={`Manage workflow tasks for ${toTitleCase(j.n)}`}
                                  className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </>
            );
          })()}

        {/* 4) TASK SETTINGS */}
        {activeSubTab === 't' && (
          <>
            <div className="rounded-xl bg-indigo-50/80 border border-indigo-200/80 px-4 py-3 text-caption text-indigo-900">
              Deleting a task only stops tracking it going forward — it does not touch any
              record already saved.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Onboarding Tasks">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Target Day</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((t, i) => (
                        <TableRow key={`${t[0]}-${i}`}>
                          <TableCell mobileRole="primary" className="font-semibold text-slate-900">
                            {t[0]}
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="Target Day" className="font-mono text-slate-700">
                            Day {t[1]}
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="Label">
                            <Badge variant="neutral">{t[2]}</Badge>
                          </TableCell>
                          <TableCell mobileRole="actions" className="text-right">
                            <button
                              type="button"
                              data-kind="t"
                              data-i={i}
                              onClick={() => handleDeleteTask(i)}
                              className="px-3 py-1 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 text-tag font-semibold transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-dashed border-slate-200">
                    <div className="flex-1 min-w-[160px]">
                      <Input
                        id="tn"
                        placeholder="Task name"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        id="td"
                        placeholder="Day"
                        type="number"
                        value={newTaskDay}
                        onChange={(e) => setNewTaskDay(e.target.value)}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        id="tsl"
                        placeholder="Label"
                        value={newTaskLabel}
                        onChange={(e) => setNewTaskLabel(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      data-kind="t"
                      onClick={handleAddTask}
                    >
                      Add Task
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Ecf Checklist Items">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ecfItems.map((x, i) => (
                        <TableRow key={`${x}-${i}`}>
                          <TableCell mobileRole="primary" className="font-semibold text-slate-900">
                            {x}
                          </TableCell>
                          <TableCell mobileRole="actions" className="text-right">
                            <button
                              type="button"
                              data-kind="x"
                              data-i={i}
                              onClick={() => handleDeleteEcfItem(i)}
                              className="px-3 py-1 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 text-tag font-semibold transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-dashed border-slate-200">
                    <div className="flex-1 min-w-[180px]">
                      <Input
                        id="xn"
                        placeholder="Item name"
                        value={newEcfItem}
                        onChange={(e) => setNewEcfItem(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      data-kind="x"
                      onClick={handleAddEcfItem}
                    >
                      Add Item
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* EMPLOYEE WORKFLOW DRAWER / SLIDE-OVER MODAL */}
      {selectedJoiner &&
        (() => {
          const st = jstat(selectedJoiner);
          return (
            <div
              id="employee-workflow-drawer-backdrop"
              data-testid="employee-workflow-drawer"
              className="fixed inset-0 z-50 flex justify-end bg-slate-500/40 backdrop-blur-xs"
              onClick={closeJoinerDrawer}
            >
              <div
                className="relative w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-card-heading text-slate-900">
                        {toTitleCase(selectedJoiner.n)}
                      </h2>
                      <Badge variant="neutral" className="font-mono">
                        {selectedJoiner.employeeCode || selectedJoiner.id}
                      </Badge>
                      <Badge
                        data-testid="drawer-joiner-status"
                        variant={
                          st.st === 'Complete'
                            ? 'success'
                            : st.st === 'Has overdue'
                            ? 'error'
                            : 'warning'
                        }
                      >
                        {st.st}
                      </Badge>
                    </div>
                    <p className="text-caption text-slate-600">
                      {selectedJoiner.d} • {selectedJoiner.b[0]} ({selectedJoiner.b[1]}) • Assigned HR:{' '}
                      <span className="font-semibold text-slate-800">
                        {toTitleCase(selectedJoiner.hr)}
                      </span>
                    </p>
                    <p className="text-caption text-slate-500">
                      Joined {selectedJoiner.ago}d ago ({selectedJoiner.joinedDate})
                    </p>
                  </div>
                  <button
                    type="button"
                    id="close-workflow-drawer-btn"
                    onClick={closeJoinerDrawer}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Summary Bar */}
                <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 text-caption">
                    <div>
                      <span className="text-slate-500">Verified Progress: </span>
                      <span
                        data-testid="drawer-joiner-progress"
                        className="font-mono font-bold text-slate-900"
                      >
                        {st.dn}/{st.a}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Submitted: </span>
                      <span className="font-mono font-semibold text-indigo-700">
                        {st.submittedCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Overdue: </span>
                      <span className="font-mono font-semibold text-rose-600">{st.ov}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-caption text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>
                      Active Role: <b className="text-slate-900">{formatRoleDisplayName(role)}</b>
                      {canVerifyTasks ? ' (Can Submit & Verify)' : ' (Submitter Only)'}
                    </span>
                  </div>
                </div>

                {/* Drawer Feedback Banner */}
                {drawerBanner && (
                  <div
                    data-testid="drawer-feedback-banner"
                    className={`mx-6 mt-4 px-4 py-3 rounded-xl border text-caption flex items-start justify-between gap-3 ${
                      drawerBanner.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : drawerBanner.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    }`}
                  >
                    <span>{drawerBanner.text}</span>
                    <button
                      type="button"
                      onClick={() => setDrawerBanner(null)}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Scrollable Tasks List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                  {tasks.map((t, k) => {
                    const td = getTaskDetail(selectedJoiner, k);
                    const [chipState, dayDiff] = ts(selectedJoiner, k);
                    const isFormOpen = activeTaskFormIndex === k;
                    const isReturning = returningTaskIndex === k;
                    const isBusy = submittingTaskIdx === k;

                    return (
                      <div
                        key={`drawer-task-${k}`}
                        data-testid={`drawer-task-card-${k}`}
                        className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs"
                      >
                        {/* Task Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">
                                {k + 1}. {t[0]}
                              </span>
                              <Badge variant="neutral">{t[2]}</Badge>
                            </div>
                            <div className="text-caption text-slate-500 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                Target SLA: Day {t[1]} • Due {td.dueAt.slice(0, 10)}
                              </span>
                            </div>
                          </div>

                          <div data-testid={`drawer-task-status-${k}`}>
                            {td.status === 'not_needed' ? (
                              <Badge variant="neutral">Not needed</Badge>
                            ) : td.status === 'submitted' ? (
                              <Badge variant="info">Submitted</Badge>
                            ) : td.status === 'returned' ? (
                              <Badge variant="error">Returned</Badge>
                            ) : td.status === 'verified' ? (
                              chipState === 'late' ? (
                                <Badge variant="warning">Verified +{dayDiff}d</Badge>
                              ) : (
                                <Badge variant="success">Verified</Badge>
                              )
                            ) : chipState === 'over' ? (
                              <Badge variant="error">Overdue {dayDiff}d</Badge>
                            ) : (
                              <Badge variant="neutral">Pending</Badge>
                            )}
                          </div>
                        </div>

                        {/* Returned Reason Alert */}
                        {td.status === 'returned' && td.returnReason && (
                          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-caption text-rose-900 space-y-1">
                            <div className="font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              <span>Returned for Correction: {td.returnReason}</span>
                            </div>
                            {td.returnedByName && (
                              <div className="text-rose-700">
                                Returned by {toTitleCase(td.returnedByName)} (
                                {formatRoleDisplayName(td.returnedByRole || '')}) on{' '}
                                {td.returnedAt ? new Date(td.returnedAt).toLocaleString() : '—'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Existing Evidence Summary (for submitted, verified, or returned tasks) */}
                        {(td.evidenceReference || td.evidenceFileName || td.completionNote) && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-caption space-y-1.5">
                            {td.evidenceReference && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Evidence Reference / ID:</span>
                                <span
                                  data-testid={`drawer-task-evidence-${k}`}
                                  className="font-mono font-semibold text-slate-900"
                                >
                                  {td.evidenceReference}
                                </span>
                              </div>
                            )}
                            {td.evidenceFileName && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Attached Proof:</span>
                                <span className="font-medium text-indigo-700 flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5" />
                                  {td.evidenceFileName}
                                </span>
                              </div>
                            )}
                            {td.completionNote && (
                              <div>
                                <span className="text-slate-500">Completion Note: </span>
                                <span className="text-slate-800">{td.completionNote}</span>
                              </div>
                            )}
                            {td.submittedByName && (
                              <div className="text-slate-500 pt-1 border-t border-slate-200/80">
                                Submitted by{' '}
                                <b className="text-slate-700">{toTitleCase(td.submittedByName)}</b> (
                                {formatRoleDisplayName(td.submittedByRole || '')}) on{' '}
                                {td.submittedAt ? new Date(td.submittedAt).toLocaleString() : '—'}
                              </div>
                            )}
                            {td.status === 'verified' && td.verifiedByName && (
                              <div className="text-emerald-700 font-medium">
                                Verified by{' '}
                                <b>{toTitleCase(td.verifiedByName)}</b> (
                                {formatRoleDisplayName(td.verifiedByRole || '')}) on{' '}
                                {td.verifiedAt ? new Date(td.verifiedAt).toLocaleString() : '—'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Area for Pending or Returned Tasks */}
                        {(td.status === 'pending' || td.status === 'returned') && (
                          <div className="pt-1">
                            {!isFormOpen ? (
                              <Button
                                type="button"
                                id={`open-submit-task-btn-${k}`}
                                data-testid={`open-submit-task-btn-${k}`}
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenTaskForm(selectedJoiner, k)}
                              >
                                {td.status === 'returned'
                                  ? 'Resubmit Task With Evidence'
                                  : 'Submit Task With Evidence'}
                              </Button>
                            ) : (
                              <div
                                data-testid={`task-submit-form-${k}`}
                                className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-3"
                              >
                                <div className="text-caption font-semibold text-slate-800">
                                  {td.status === 'returned'
                                    ? 'Resubmit Corrected Task Evidence'
                                    : 'Submit Task Evidence for Verification'}
                                </div>

                                <div className="space-y-2.5">
                                  <div>
                                    <label
                                      htmlFor={`task-evidence-ref-${k}`}
                                      className="block text-caption font-medium text-slate-700 mb-1"
                                    >
                                      Evidence Reference / ID *
                                    </label>
                                    <Input
                                      id={`task-evidence-ref-${k}`}
                                      placeholder={getEvidencePlaceholder(t[2], t[0])}
                                      value={evidenceRefInput}
                                      onChange={(e) => setEvidenceRefInput(e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <label
                                      htmlFor={`task-completion-note-${k}`}
                                      className="block text-caption font-medium text-slate-700 mb-1"
                                    >
                                      Completion Note
                                    </label>
                                    <Input
                                      id={`task-completion-note-${k}`}
                                      placeholder="Add operational handoff or verification note"
                                      value={completionNoteInput}
                                      onChange={(e) => setCompletionNoteInput(e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-caption font-medium text-slate-700 mb-1">
                                      Supporting Document / Proof (Optional)
                                    </label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <label
                                        htmlFor={`task-evidence-file-${k}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-caption font-medium cursor-pointer"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Attach File</span>
                                        <input
                                          id={`task-evidence-file-${k}`}
                                          type="file"
                                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                          className="hidden"
                                          onChange={handleEvidenceFileUpload}
                                        />
                                      </label>
                                      {evidenceFileNameInput && (
                                        <span className="text-caption text-indigo-700 font-medium">
                                          {evidenceFileNameInput}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    id={`submit-task-btn-${k}`}
                                    data-testid={`submit-task-btn-${k}`}
                                    variant="primary"
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() => handleSubmitTaskEvidence(selectedJoiner, k)}
                                  >
                                    {isBusy ? 'Submitting...' : 'Submit For Verification'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setActiveTaskFormIndex(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Verification / Return Controls for Submitted Tasks */}
                        {td.status === 'submitted' && (
                          <div className="pt-1 space-y-2.5">
                            {canVerifyTasks ? (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    id={`verify-task-btn-${k}`}
                                    data-testid={`verify-task-btn-${k}`}
                                    variant="primary"
                                    size="sm"
                                    disabled={isBusy}
                                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                                    onClick={() => handleVerifyTask(selectedJoiner, k)}
                                  >
                                    {isBusy ? 'Verifying...' : 'Verify Task'}
                                  </Button>
                                  <Button
                                    type="button"
                                    id={`open-return-task-btn-${k}`}
                                    data-testid={`open-return-task-btn-${k}`}
                                    variant="danger"
                                    size="sm"
                                    disabled={isBusy}
                                    leftIcon={<RotateCcw className="w-4 h-4" />}
                                    onClick={() => {
                                      setReturningTaskIndex(isReturning ? null : k);
                                      setReturnReasonInput('');
                                    }}
                                  >
                                    Return For Correction
                                  </Button>
                                </div>

                                {isReturning && (
                                  <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3 space-y-2">
                                    <label
                                      htmlFor={`return-reason-input-${k}`}
                                      className="block text-caption font-semibold text-rose-900"
                                    >
                                      Return Reason (Required) *
                                    </label>
                                    <Input
                                      id={`return-reason-input-${k}`}
                                      placeholder="Explain what needs correction (e.g. Invalid tracking number)"
                                      value={returnReasonInput}
                                      onChange={(e) => setReturnReasonInput(e.target.value)}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        id={`confirm-return-task-btn-${k}`}
                                        data-testid={`confirm-return-task-btn-${k}`}
                                        variant="danger"
                                        size="sm"
                                        disabled={isBusy}
                                        onClick={() => handleReturnTask(selectedJoiner, k)}
                                      >
                                        Confirm Return
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setReturningTaskIndex(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div
                                data-testid={`awaiting-verifier-notice-${k}`}
                                className="rounded-lg bg-indigo-50/80 border border-indigo-200 px-3 py-2 text-caption text-indigo-900"
                              >
                                Submitted and awaiting verification by Zonal HR, Branch Manager, or
                                Super Admin. Central HR cannot self-verify submitted tasks.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Audit History Timeline per Task */}
                        {td.history && td.history.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="text-tag font-semibold text-slate-500 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              <span>Task Audit Trail ({td.history.length})</span>
                            </div>
                            <div className="space-y-1">
                              {td.history.map((h) => (
                                <div
                                  key={h.id}
                                  className="text-caption text-slate-600 flex items-start justify-between gap-2 bg-slate-50/70 px-2.5 py-1.5 rounded-lg"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-800 uppercase text-tag mr-1.5">
                                      {h.action}
                                    </span>
                                    <span>by {toTitleCase(h.actorName)}</span>{' '}
                                    <span className="text-slate-400">({h.actorRole})</span>
                                    {h.evidenceReference && (
                                      <span className="font-mono text-slate-700 ml-1.5">
                                        [{h.evidenceReference}]
                                      </span>
                                    )}
                                    {h.returnReason && (
                                      <span className="text-rose-700 ml-1.5">
                                        — Reason: {h.returnReason}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-tag text-slate-400 whitespace-nowrap">
                                    {new Date(h.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Drawer Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
                  <span className="text-caption text-slate-500">
                    All task submissions and verifications are logged in the portal audit trail.
                  </span>
                  <Button variant="secondary" size="sm" onClick={closeJoinerDrawer}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
