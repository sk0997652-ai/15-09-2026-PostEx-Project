import React, { useState, useMemo } from 'react';
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

const WORKFLOW_TRACKER_CSS = `
.wt-root {
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
  .wt-root:not([data-theme="light"]) {
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
.wt-root[data-theme="dark"] {
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
.wt-root * {
  box-sizing: border-box;
}
.wt-root button,
.wt-root input,
.wt-root select {
  font: inherit;
  color: inherit;
}
.wt-root :focus-visible {
  outline: 2px solid var(--acc);
  outline-offset: 2px;
}
.wt-root .wrap {
  padding: 26px;
  display: grid;
  gap: 20px;
  max-width: 1440px;
  margin: 0 auto;
}
.wt-root .top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.wt-root .head h1 {
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 0;
}
.wt-root .head p {
  color: var(--mut);
  margin: 4px 0 0;
  max-width: 70ch;
  font-size: 13.5px;
}
.wt-root .card {
  background: var(--sf);
  border: 1px solid var(--line);
  border-radius: 14px;
}
.wt-root .pad {
  padding: 20px;
}
.wt-root .kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  overflow: hidden;
}
.wt-root .kpi {
  padding: 18px 20px;
  border-right: 1px solid var(--line);
}
.wt-root .kpi:last-child {
  border: 0;
}
.wt-root .kpi .l {
  color: var(--mut);
  font-weight: 600;
  font-size: 12.5px;
}
.wt-root .kpi .v {
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -1px;
  margin: 7px 0 2px;
}
.wt-root .kpi .s {
  font-size: 12.5px;
  color: var(--mut);
}
.wt-root .kpi.bad .v {
  color: var(--bad);
}
.wt-root .kpi.ok .v {
  color: var(--ok);
}
.wt-root .ct {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.wt-root .ct h2 {
  font-size: 15.5px;
  font-weight: 700;
  margin: 0;
}
.wt-root .ct small {
  color: var(--mut);
  font-size: 12.5px;
}
.wt-root .tag {
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-block;
}
.wt-root .t-ok {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 13%, transparent);
}
.wt-root .t-w {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 15%, transparent);
}
.wt-root .t-b {
  color: var(--bad);
  background: color-mix(in srgb, var(--bad) 13%, transparent);
}
.wt-root .t-n {
  color: var(--mut);
  background: var(--sf2);
  border: 1px solid var(--line);
}
.wt-root .bar {
  height: 7px;
  background: var(--line);
  border-radius: 7px;
  overflow: hidden;
  flex: 1;
}
.wt-root .bar i {
  display: block;
  height: 100%;
  border-radius: 7px;
  background: var(--acc);
}
.wt-root .bar.w i {
  background: var(--warn);
}
.wt-root .bar.b i {
  background: var(--bad);
}
.wt-root .fr {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 120px;
}
.wt-root .fr span {
  font-weight: 700;
  width: 36px;
  text-align: right;
  font-size: 12.5px;
}
.wt-root .scroll {
  overflow-x: auto;
  margin: 0 -20px;
  padding: 0 20px;
}
.wt-root table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}
.wt-root th {
  font-size: 12px;
  color: var(--mut);
  font-weight: 600;
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  background: var(--sf);
}
.wt-root td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  font-size: 13.5px;
}
.wt-root tr:last-child td {
  border: 0;
}
.wt-root tr:hover td {
  background: var(--sf2);
}
.wt-root td small {
  display: block;
  color: var(--mut);
  font-size: 12px;
}
.wt-root td b {
  font-weight: 600;
}
.wt-root .rule {
  background: var(--accs);
  border-radius: 12px;
  padding: 11px 15px;
  font-size: 12.5px;
  margin: 0;
}
.wt-root .ov {
  display: grid;
  gap: 11px;
}
.wt-root .ov div {
  display: grid;
  grid-template-columns: 170px 1fr auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
}
.wt-root .ov b {
  text-align: right;
}
.wt-root .g2 {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 20px;
}
.wt-root .wseg {
  display: flex;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 3px;
  overflow-x: auto;
}
.wt-root .wseg button {
  border: 0;
  background: none;
  padding: 6px 13px;
  border-radius: 8px;
  color: var(--mut);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}
.wt-root .wseg button.on {
  background: var(--sf);
  color: var(--acc);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.wt-root .tb {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.wt-root .tb input,
.wt-root .tb select {
  background: var(--sf2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 12px;
  min-width: 170px;
}
.wt-root .delb {
  background: none;
  border: 1px solid var(--line);
  color: var(--bad);
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}
.wt-root .addrow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}
.wt-root .addrow input {
  background: var(--sf2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 11px;
  min-width: 0;
}
.wt-root .addb {
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
.wt-root .btn {
  border: 1px solid var(--line);
  background: var(--sf2);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12.5px;
}
@media (max-width: 1180px) {
  .wt-root .kpis {
    grid-template-columns: 1fr 1fr;
  }
  .wt-root .kpi:nth-child(2) {
    border-right: 0;
  }
  .wt-root .kpi:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }
  .wt-root .g2 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 860px) {
  .wt-root .wrap {
    padding: 14px;
  }
}
`;

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
  const [theme, setTheme] = useState<'light' | 'dark' | undefined>(undefined);

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
    if (st === 'na') return <span style={{ color: 'var(--mut)' }}>Not needed</span>;
    if (st === 'ok') return <span className="tag t-ok">Done</span>;
    if (st === 'late') return <span className="tag t-w">Done +{d}d</span>;
    if (st === 'over') return <span className="tag t-b">Overdue {d}d</span>;
    return <span className="tag t-n">Pending</span>;
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

  const exS = (e: ExitRecord): [string, string] =>
    exDoneCount(e) >= ecfItems.length
      ? ['Cleared', 't-ok']
      : e.ago > SLA_X
      ? ['Overdue', 't-b']
      : ['In progress', 't-w'];

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

  const flag = (a: { n: number; pct: number }): [string, string, string] =>
    a.n < MIN
      ? ['Low volume', 't-n', '']
      : a.pct >= 85
      ? ['On track', 't-ok', '']
      : a.pct >= 65
      ? ['Watch', 't-w', 'w']
      : ['Needs action', 't-b', 'b'];

  const renderBar = (f: number, c = '') => (
    <div className={`bar ${c}`.trim()}>
      <i style={{ width: `${Math.min(Math.max(f, 0), 100)}%` }} />
    </div>
  );

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const isDark = prev
        ? prev === 'dark'
        : typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? 'light' : 'dark';
    });
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
    <div className="wt-root" data-theme={theme} id="workflow-tracker-view">
      <style>{WORKFLOW_TRACKER_CSS}</style>
      <div className="wrap">
        <div className="top">
          <div className="head">
            <h1>Workflow Tracker</h1>
            <p>Onboarding tasks, exits and HR performance — issued and owned by HR.</p>
          </div>
          <button type="button" className="btn" id="th" onClick={handleToggleTheme}>
            Toggle theme
          </button>
        </div>

        <div>
          <div
            className="wseg"
            id="wseg"
            style={{ marginBottom: 20, width: 'fit-content', maxWidth: '100%' }}
          >
            {subTabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={key === activeSubTab ? 'on' : ''}
                data-w={key}
                onClick={() => setWview(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            {/* 1) JOINER TRACKER */}
            {activeSubTab === 'j' && (
              <>
                <div className="card kpis">
                  <div className="kpi">
                    <div className="l">Joiners in view</div>
                    <div className="v">{scopedPeople.length}</div>
                    <div className="s">across scope</div>
                  </div>
                  <div className="kpi ok">
                    <div className="l">Fully onboarded</div>
                    <div className="v">{compCount}</div>
                    <div className="s">
                      {scopedPeople.length > 0
                        ? Math.round((compCount / scopedPeople.length) * 100)
                        : 0}
                      % of joiners
                    </div>
                  </div>
                  <div className="kpi bad">
                    <div className="l">Overdue tasks</div>
                    <div className="v">{A.ov}</div>
                    <div className="s">past target day</div>
                  </div>
                  <div className="kpi">
                    <div className="l">Tasks done on time</div>
                    <div className="v">{A.pct.toFixed(0)}%</div>
                    <div className="s">of all due tasks</div>
                  </div>
                </div>

                <div className="card pad">
                  <div className="ct">
                    <h2>Overdue by task</h2>
                  </div>
                  <div className="ov">
                    {tasks.map((t, k) => (
                      <div key={`${t[0]}-${k}`}>
                        <span>{t[0]}</span>
                        {renderBar((oc[k] / mx) * 100, oc[k] ? 'b' : '')}
                        <b>{oc[k]}</b>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card pad">
                  <div className="ct">
                    <h2>Joiners</h2>
                    <button
                      type="button"
                      className="btn"
                      id="export-joiners-excel-btn"
                      onClick={handleExportJoiners}
                    >
                      Export to Excel
                    </button>
                  </div>
                  <div className="tb">
                    <input
                      id="q"
                      placeholder="Search joiner, branch or HR"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <select id="fs" value={fs} onChange={(e) => setFs(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="Has overdue">Has overdue</option>
                      <option value="In progress">In progress</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Joiner</th>
                          <th>Branch</th>
                          <th>HR officer</th>
                          <th>Joined</th>
                          {tasks.map((t, k) => (
                            <th key={`${t[2]}-${k}`}>{t[2]}</th>
                          ))}
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody id="tb">
                        {filteredJoiners.length === 0 ? (
                          <tr>
                            <td
                              colSpan={tasks.length + 5}
                              style={{ textAlign: 'center', color: 'var(--mut)', padding: 26 }}
                            >
                              No joiners match.
                            </td>
                          </tr>
                        ) : (
                          filteredJoiners.map(([j, st], idx) => (
                            <tr key={`${j.id || j.n}-${idx}`}>
                              <td>
                                <b>{j.n}</b>
                                <small>{j.d}</small>
                              </td>
                              <td>{j.b[0]}</td>
                              <td>{j.hr}</td>
                              <td>{j.ago}d ago</td>
                              {tasks.map((_, k) => (
                                <td key={k}>{renderChip(j, k)}</td>
                              ))}
                              <td>
                                <span
                                  className={`tag ${
                                    st.st === 'Complete' ? 't-ok' : st.ov ? 't-b' : 't-n'
                                  }`}
                                >
                                  {st.dn}/{st.a}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                    <div className="card kpis">
                      <div className="kpi">
                        <div className="l">Open ECFs</div>
                        <div className="v">{op.length}</div>
                        <div className="s">clearance not complete</div>
                      </div>
                      <div className="kpi bad">
                        <div className="l">Overdue ECFs</div>
                        <div className="v">{od}</div>
                        <div className="s">open past {SLA_X} days</div>
                      </div>
                      <div className="kpi ok">
                        <div className="l">Cleared</div>
                        <div className="v">{scopedExits.length - op.length}</div>
                        <div className="s">ECF fully complete</div>
                      </div>
                      <div className="kpi">
                        <div className="l">Exits in view</div>
                        <div className="v">{scopedExits.length}</div>
                        <div className="s">all exit types</div>
                      </div>
                    </div>

                    <div className="card pad">
                      <div className="ct">
                        <div>
                          <h2>Employee clearance forms</h2>
                          <small>
                            Click any checklist item tag to mark Done/Pending. When all items are Done, status becomes Cleared and employee moves to Exited/Archive.
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          id="export-exits-excel-btn"
                          onClick={handleExportExits}
                        >
                          Export to Excel
                        </button>
                      </div>
                      <div className="tb">
                        <input
                          id="exit-q"
                          placeholder="Search employee, branch or HR"
                          value={exitQ}
                          onChange={(e) => setExitQ(e.target.value)}
                        />
                        <select
                          id="exit-fs"
                          value={exitFs}
                          onChange={(e) => setExitFs(e.target.value)}
                        >
                          <option value="">All statuses</option>
                          <option value="In progress">In progress</option>
                          <option value="Overdue">Overdue</option>
                          <option value="Cleared">Cleared</option>
                        </select>
                      </div>
                      <div className="scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Branch</th>
                              <th>HR officer</th>
                              <th>Exit type</th>
                              <th>Left</th>
                              {ecfItems.map((x, idx) => (
                                <th key={`${x}-${idx}`}>{x}</th>
                              ))}
                              <th>Progress</th>
                              <th>Status</th>
                              {role === 'super_admin' && <th></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExits.map((e, idx) => {
                              const st = exS(e);
                              const dn = exDoneCount(e);
                              const canUndo =
                                role === 'super_admin' &&
                                canSuperAdminUndoExit(e.initiatedAt, e.ago);
                              return (
                                <tr key={`${e.id || e.n}-${idx}`}>
                                  <td>
                                    <b>{e.n}</b>
                                    <small>{e.d}</small>
                                  </td>
                                  <td>{e.b[0]}</td>
                                  <td>{e.b[2]}</td>
                                  <td>
                                    <span
                                      className={`tag ${
                                        e.type === 'Absconding' ? 't-b' : 't-n'
                                      }`}
                                    >
                                      {e.type}
                                    </span>
                                  </td>
                                  <td>{e.ago}d ago</td>
                                  {ecfItems.map((_, i) => {
                                    const itemDone = isEcfItemDone(e, i);
                                    return (
                                      <td key={i}>
                                        <button
                                          type="button"
                                          onClick={() => toggleExitChecklistItem(e.id, i, e.b[2])}
                                          style={{
                                            background: 'none',
                                            border: 0,
                                            padding: 0,
                                            cursor: 'pointer',
                                          }}
                                          title="Click to toggle Done / Pending"
                                        >
                                          {itemDone ? (
                                            <span className="tag t-ok">Done</span>
                                          ) : (
                                            <span
                                              className={`tag ${e.ago > SLA_X ? 't-b' : 't-n'}`}
                                            >
                                              Pending
                                            </span>
                                          )}
                                        </button>
                                      </td>
                                    );
                                  })}
                                  <td>
                                    <div className="fr">
                                      {renderBar(
                                        (dn / totX) * 100,
                                        e.ago > SLA_X && dn < ecfItems.length ? 'b' : ''
                                      )}
                                      <span>
                                        {dn}/{ecfItems.length}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`tag ${st[1]}`}>{st[0]}</span>
                                  </td>
                                  {role === 'super_admin' && (
                                    <td>
                                      {canUndo && (
                                        <button
                                          type="button"
                                          className="delb"
                                          onClick={() =>
                                            undoEmployeeExit({
                                              exitId: e.id,
                                              employeeId: e.employeeId,
                                              actorName: 'Super Admin',
                                            })
                                          }
                                        >
                                          Undo exit
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
                    <div className="card kpis">
                      <div className={`kpi ${A.pct >= 85 ? 'ok' : ''}`.trim()}>
                        <div className="l">On-time task rate</div>
                        <div className="v">{A.pct.toFixed(0)}%</div>
                        <div className="s">all HR officers</div>
                      </div>
                      <div className="kpi">
                        <div className="l">Avg days to onboard</div>
                        <div className="v">{A.avg.toFixed(1)}</div>
                        <div className="s">fully onboarded joiners</div>
                      </div>
                      <div className="kpi bad">
                        <div className="l">Overdue tasks</div>
                        <div className="v">{A.ov}</div>
                        <div className="s">across scope</div>
                      </div>
                      <div className="kpi">
                        <div className="l">Open ECFs</div>
                        <div className="v">{A.ecf}</div>
                        <div className="s">awaiting clearance</div>
                      </div>
                    </div>

                    <div className="card pad">
                      <div className="ct">
                        <h2>Scorecard by {lvl.toLowerCase()}</h2>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div className="wseg" id="lv">
                            {(['Zone', 'Branch', 'HR officer'] as const).map((l) => {
                              const dataKey = l === 'HR officer' ? 'HR' : l;
                              const isOn = l === lvl || (lvl === 'HR' && l === 'HR officer');
                              return (
                                <button
                                  key={l}
                                  type="button"
                                  className={isOn ? 'on' : ''}
                                  data-l={dataKey}
                                  onClick={() => setLvl(dataKey)}
                                >
                                  {l}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="btn"
                            id="export-hr-performance-excel-btn"
                            onClick={handleExportHrPerformance}
                          >
                            Export to Excel
                          </button>
                        </div>
                      </div>
                      <p className="rule" style={{ marginBottom: 14 }}>
                        Worst performers listed first. Fewer than {MIN} joiners is marked Low
                        volume and not judged.
                      </p>
                      <div className="scroll">
                        <table style={{ minWidth: 760 }}>
                          <thead>
                            <tr>
                              <th>{lvl === 'HR' ? 'HR officer' : lvl}</th>
                              <th>Joiners</th>
                              <th>On-time rate</th>
                              <th>Avg days</th>
                              <th>Overdue</th>
                              <th>Open ECFs</th>
                              <th>Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.n}>
                                <td>
                                  <b>{r.n}</b>
                                  {r.sub ? <small>{r.sub}</small> : null}
                                </td>
                                <td>{r.a.n}</td>
                                <td>
                                  <div className="fr">
                                    {renderBar(r.a.pct, r.fl[2])}
                                    <span>{r.a.pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                                <td>{r.a.avg ? r.a.avg.toFixed(1) : '—'}</td>
                                <td>{r.a.ov}</td>
                                <td>{r.a.ecf}</td>
                                <td>
                                  <span className={`tag ${r.fl[1]}`}>{r.fl[0]}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}

            {/* 4) TASK SETTINGS */}
            {activeSubTab === 't' && (
              <>
                <div className="rule">
                  Deleting a task only stops tracking it going forward — it does not touch any
                  record already saved.
                </div>
                <div className="g2">
                  <div className="card pad">
                    <div className="ct">
                      <h2>Onboarding tasks</h2>
                    </div>
                    <div className="scroll" style={{ margin: 0 }}>
                      <table style={{ minWidth: 0 }}>
                        <thead>
                          <tr>
                            <th>Task</th>
                            <th>Target day</th>
                            <th>Label</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map((t, i) => (
                            <tr key={`${t[0]}-${i}`}>
                              <td>
                                <b>{t[0]}</b>
                              </td>
                              <td>Day {t[1]}</td>
                              <td>
                                <span className="tag t-n">{t[2]}</span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="delb"
                                  data-kind="t"
                                  data-i={i}
                                  onClick={() => handleDeleteTask(i)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="addrow">
                      <input
                        id="tn"
                        placeholder="Task name"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                      />
                      <input
                        id="td"
                        placeholder="Day"
                        type="number"
                        style={{ width: 70 }}
                        value={newTaskDay}
                        onChange={(e) => setNewTaskDay(e.target.value)}
                      />
                      <input
                        id="tsl"
                        placeholder="Label"
                        style={{ width: 100 }}
                        value={newTaskLabel}
                        onChange={(e) => setNewTaskLabel(e.target.value)}
                      />
                      <button
                        type="button"
                        className="addb"
                        data-kind="t"
                        onClick={handleAddTask}
                      >
                        Add task
                      </button>
                    </div>
                  </div>

                  <div className="card pad">
                    <div className="ct">
                      <h2>ECF checklist items</h2>
                    </div>
                    <div className="scroll" style={{ margin: 0 }}>
                      <table style={{ minWidth: 0 }}>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ecfItems.map((x, i) => (
                            <tr key={`${x}-${i}`}>
                              <td>
                                <b>{x}</b>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="delb"
                                  data-kind="x"
                                  data-i={i}
                                  onClick={() => handleDeleteEcfItem(i)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="addrow">
                      <input
                        id="xn"
                        placeholder="Item name"
                        style={{ flex: 1 }}
                        value={newEcfItem}
                        onChange={(e) => setNewEcfItem(e.target.value)}
                      />
                      <button
                        type="button"
                        className="addb"
                        data-kind="x"
                        onClick={handleAddEcfItem}
                      >
                        Add item
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
