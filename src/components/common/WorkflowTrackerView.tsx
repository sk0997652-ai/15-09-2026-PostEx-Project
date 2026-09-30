import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import {
  useHrPortalStore,
  BranchTuple,
  JoinerRecord,
  ExitRecord,
  toggleExitChecklistItem,
  canSuperAdminUndoExit,
  undoEmployeeExit,
  exportRowsToExcel,
} from '../../lib/hrPortalStore';
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

export const WorkflowTrackerView: React.FC<WorkflowTrackerViewProps> = ({
  role,
  zoneName,
  branchName,
  assignedBranches,
}) => {
  const [store, updateStore] = useHrPortalStore();
  const tasks = store.tasks;
  const ecfItems = store.ecfItems;
  const peopleState = store.joiners;
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

  const ts = (j: JoinerRecord, k: number): ['na'] | ['ok' | 'late', number] | ['over', number] | ['pend'] => {
    const v = j.done[k];
    if (v === 'x') return ['na'];
    if (v != null) return [v <= tasks[k][1] ? 'ok' : 'late', v - tasks[k][1]];
    return j.ago > tasks[k][1] ? ['over', j.ago - tasks[k][1]] : ['pend'];
  };

  const formatChipLabel = (j: JoinerRecord, k: number): string => {
    const [st, d] = ts(j, k);
    if (st === 'na') return 'Not needed';
    if (st === 'ok') return 'Done';
    if (st === 'late') return `Done +${d}d`;
    if (st === 'over') return `Overdue ${d}d`;
    return 'Pending';
  };

  const renderChip = (j: JoinerRecord, k: number) => {
    const [st, d] = ts(j, k);
    if (st === 'na') return <span className="text-caption text-slate-400">Not needed</span>;
    if (st === 'ok') return <Badge variant="success">Done</Badge>;
    if (st === 'late') return <Badge variant="warning">Done +{d}d</Badge>;
    if (st === 'over') return <Badge variant="error">Overdue {d}d</Badge>;
    return <Badge variant="neutral">Pending</Badge>;
  };

  const jstat = (j: JoinerRecord) => {
    const a = j.done.filter((v, k) => k < tasks.length && v !== 'x').length;
    const dn = j.done.filter((v, k) => k < tasks.length && v != null && v !== 'x').length;
    const ov = tasks.filter((_, k) => ts(j, k)[0] === 'over').length;
    const st = ov ? 'Has overdue' : dn === a ? 'Complete' : 'In progress';
    return { a, dn, ov, st };
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
    const cd: number[] = [];

    js.forEach((j) => {
      tasks.forEach((_, k) => {
        const st = ts(j, k)[0];
        if (st === 'na' || st === 'pend') return;
        tot++;
        if (st === 'ok') ok++;
        if (st === 'over') ov++;
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
        const dd = targetDay + ((idx * 3 + 2) % 9);
        return {
          ...j,
          done: [...j.done, dd <= j.ago ? dd : null],
        };
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
      .filter(([j]) => !query || (j.n + j.b[0] + j.hr).toLowerCase().includes(query))
      .filter(([, st]) => !fs || st.st === fs)
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

  const A = ag(scopedPeople, scopedExits);
  const compCount = scopedPeople.filter((j) => jstat(j).st === 'Complete').length;
  const oc = tasks.map((_, k) => scopedPeople.filter((j) => ts(j, k)[0] === 'over').length);
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
              {toTitleCase(label)}
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
                <div className="text-caption text-slate-500 mt-0.5">of all due tasks</div>
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
                  searchPlaceholder="Search joiner, branch or HR"
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
                    </TableRow>
                  </TableHeader>
                  <TableBody id="tb">
                    {filteredJoiners.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={tasks.length + 5}
                          className="text-center py-8 text-caption text-slate-500"
                        >
                          No joiners match.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredJoiners.map(([j, st], idx) => (
                        <TableRow key={`${j.id || j.n}-${idx}`}>
                          <TableCell mobileRole="primary">
                            <div className="font-semibold text-slate-900">{toTitleCase(j.n)}</div>
                            <div className="text-caption text-slate-500">{j.d}</div>
                          </TableCell>
                          <TableCell mobileRole="field" mobileLabel="Branch" className="text-slate-700">
                            {j.b[0]}
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
                          <TableCell mobileRole="status">
                            <Badge
                              variant={
                                st.st === 'Complete' ? 'success' : st.ov ? 'error' : 'neutral'
                              }
                              className="font-mono"
                            >
                              {st.dn}/{st.a}
                            </Badge>
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
              const a = ag(
                scopedPeople.filter((j) => f(j.b)),
                scopedExits.filter((e) => f(e.b))
              );
              return { n: nm, sub, a, fl: flag(a) };
            }).sort(
              (x, y) => Number(x.a.n < MIN) - Number(y.a.n < MIN) || x.a.pct - y.a.pct
            );

            const handleExportHrPerformance = () => {
              const exportData = rows.map((r) => ({
                [lvl === 'HR' ? 'HR Officer' : lvl]: r.n,
                Scope: r.sub || 'All',
                Joiners: r.a.n,
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
                              onClick={() => setLvl(dataKey)}
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
                      volume and not judged.
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{toTitleCase(lvl === 'HR' ? 'HR officer' : lvl)}</TableHead>
                          <TableHead>Joiners</TableHead>
                          <TableHead>On-Time Rate</TableHead>
                          <TableHead>Avg Days</TableHead>
                          <TableHead>Overdue</TableHead>
                          <TableHead>Open Ecfs</TableHead>
                          <TableHead>Flag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.n}>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
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
    </div>
  );
};
