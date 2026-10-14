import {
  OnboardingStage,
  OnboardingReviewerRole,
  OnboardingCandidate,
  OnboardingTimelineEvent,
  OnboardingReminderLog,
  CandidateRow,
  SummaryData,
  TimelineData,
} from './onboardingTypes';
import {
  STAGE_CONFIG,
  getStageBadgeText,
  getWithRole,
} from './onboardingStateMachine';
import { masterDataAdapter } from './adapters/masterDataAdapter';

export class OnboardingDb {
  private candidates: Map<string, OnboardingCandidate> = new Map();
  private timelineEvents: Map<string, OnboardingTimelineEvent[]> = new Map();
  private reminderLogs: Map<string, OnboardingReminderLog[]> = new Map();
  private candidateCounter = 1000;

  constructor() {
    // Initialized empty or seeded through seedOnboardingDemo script
  }

  // --- Master Data (Read-only from existing project tables via adapter) ---
  async getBranches() {
    return masterDataAdapter.getExistingBranches();
  }

  async getDesignations() {
    return masterDataAdapter.getExistingDesignations();
  }

  // --- Data Loading / Seeding helpers for onboarding_* tables ---
  loadCandidate(candidate: OnboardingCandidate, events: OnboardingTimelineEvent[] = []) {
    this.candidates.set(candidate.id, candidate);
    this.timelineEvents.set(candidate.id, events);
    const num = parseInt(candidate.emp_id.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > this.candidateCounter) {
      this.candidateCounter = num;
    }
  }

  clearOnboardingData() {
    this.candidates.clear();
    this.timelineEvents.clear();
    this.reminderLogs.clear();
  }

  getCandidatesCount(): number {
    return this.candidates.size;
  }

  // --- Metrics and Summary Engine ---
  async getSummary(branchId?: string): Promise<SummaryData> {
    const branches = await this.getBranches();
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const allCandidates = Array.from(this.candidates.values()).filter((c) => {
      if (branchId && branchId !== 'ALL' && c.branch_id !== branchId) {
        return false;
      }
      return true;
    });

    const now = Date.now();
    let totalTimeDays = 0;
    let closedCount = 0;
    let slaMetCount = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    let onboardedCount = 0;
    let needCorrectionCount = 0;
    let rejectedCount = 0;

    const pipelineCounts: Record<OnboardingStage, number> = {
      Invited: 0,
      Draft: 0,
      BM_Review: 0,
      HR_Review: 0,
      Need_Correction: 0,
      Joining_Tasks: 0,
      Onboarded: 0,
      Rejected: 0,
    };

    const holdingStats = {
      candidate: { days: 0, count: 0 },
      bm: { days: 0, count: 0 },
      hr: { days: 0, count: 0 },
      hr_officer: { days: 0, count: 0 },
    };

    const branchOverdueMap = new Map<string, number>();

    for (const c of allCandidates) {
      pipelineCounts[c.stage] = (pipelineCounts[c.stage] || 0) + 1;

      const stageEnteredMs = new Date(c.stage_entered_at).getTime();
      const daysInStage = Math.max(0, Math.floor((now - stageEnteredMs) / (1000 * 60 * 60 * 24)));
      const isOverdue = daysInStage > 2;

      const totalCandidateDays = Math.max(0, Math.floor((now - new Date(c.invited_at).getTime()) / (1000 * 60 * 60 * 24)));
      totalTimeDays += totalCandidateDays;

      if (c.stage === 'Onboarded') {
        onboardedCount++;
        closedCount++;
        if (totalCandidateDays <= 7) slaMetCount++;
      } else if (c.stage === 'Rejected') {
        rejectedCount++;
        closedCount++;
      } else {
        // Open case
        pendingCount++;
        if (isOverdue) {
          overdueCount++;
          branchOverdueMap.set(c.branch_id, (branchOverdueMap.get(c.branch_id) || 0) + 1);
        } else {
          slaMetCount++;
        }

        // Who is holding calculation:
        // Candidate = Invited + Draft + Need Correction
        if (c.stage === 'Invited' || c.stage === 'Draft' || c.stage === 'Need_Correction') {
          holdingStats.candidate.count++;
          holdingStats.candidate.days += daysInStage;
        } else if (c.stage === 'BM_Review') {
          holdingStats.bm.count++;
          holdingStats.bm.days += daysInStage;
        } else if (c.stage === 'HR_Review') {
          holdingStats.hr.count++;
          holdingStats.hr.days += daysInStage;
        } else if (c.stage === 'Joining_Tasks') {
          holdingStats.hr_officer.count++;
          holdingStats.hr_officer.days += daysInStage;
        }
      }

      if (c.stage === 'Need_Correction') {
        needCorrectionCount++;
      }
    }

    const totalCount = allCandidates.length || 1;
    const avgTimeDays = +(totalTimeDays / totalCount).toFixed(1);

    // 8 stages in fixed order:
    const orderedStages: OnboardingStage[] = [
      'Invited',
      'Draft',
      'BM_Review',
      'HR_Review',
      'Need_Correction',
      'Joining_Tasks',
      'Onboarded',
      'Rejected',
    ];

    const pipeline_by_stage = orderedStages.map((st) => ({
      stage: STAGE_CONFIG[st].pipelineLabel,
      stage_raw: st,
      count: pipelineCounts[st],
      color: STAGE_CONFIG[st].color,
    }));

    // Who is holding cases: exactly Candidate, Branch Manager, HR, HR Officer
    const who_is_holding = [
      {
        role: 'Candidate',
        open_cases: holdingStats.candidate.count,
        avg_wait_days: holdingStats.candidate.count > 0 ? +(holdingStats.candidate.days / holdingStats.candidate.count).toFixed(1) : 0,
        sla_days: 2,
        is_breached: holdingStats.candidate.count > 0 && holdingStats.candidate.days / holdingStats.candidate.count > 2,
      },
      {
        role: 'Branch Manager',
        open_cases: holdingStats.bm.count,
        avg_wait_days: holdingStats.bm.count > 0 ? +(holdingStats.bm.days / holdingStats.bm.count).toFixed(1) : 0,
        sla_days: 2,
        is_breached: holdingStats.bm.count > 0 && holdingStats.bm.days / holdingStats.bm.count > 2,
      },
      {
        role: 'HR',
        open_cases: holdingStats.hr.count,
        avg_wait_days: holdingStats.hr.count > 0 ? +(holdingStats.hr.days / holdingStats.hr.count).toFixed(1) : 0,
        sla_days: 2,
        is_breached: holdingStats.hr.count > 0 && holdingStats.hr.days / holdingStats.hr.count > 2,
      },
      {
        role: 'HR Officer',
        open_cases: holdingStats.hr_officer.count,
        avg_wait_days: holdingStats.hr_officer.count > 0 ? +(holdingStats.hr_officer.days / holdingStats.hr_officer.count).toFixed(1) : 0,
        sla_days: 2,
        is_breached: holdingStats.hr_officer.count > 0 && holdingStats.hr_officer.days / holdingStats.hr_officer.count > 2,
      },
    ];

    const needs_attention = Array.from(branchOverdueMap.entries())
      .map(([bId, count]) => ({
        branch_id: bId,
        branch_name: branchMap.get(bId) || 'Unknown Branch',
        overdue_count: count,
      }))
      .sort((a, b) => b.overdue_count - a.overdue_count);

    return {
      flashcards: {
        pending: pendingCount,
        onboarded: onboardedCount,
        overdue: overdueCount,
        need_correction: needCorrectionCount,
        rejected: rejectedCount,
        sla_met: slaMetCount,
        avg_time_days: avgTimeDays,
      },
      pipeline_by_stage,
      who_is_holding,
      needs_attention,
    };
  }

  // --- Table Rows & Query Engine ---
  async getCandidates(params: {
    branch_id?: string;
    tab?: string;
    flashcard?: string;
    search?: string;
    sort?: 'overdue' | 'oldest' | 'name';
    page?: number;
    pageSize?: number;
  }): Promise<{ items: CandidateRow[]; total: number; page: number; pageSize: number; tabCounts: Record<string, number> }> {
    const branches = await this.getBranches();
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const designations = await this.getDesignations();
    const designationMap = new Map(designations.map((d) => [d.id, d.name]));

    const now = Date.now();
    const branchScoped = Array.from(this.candidates.values()).filter((c) => {
      if (params.branch_id && params.branch_id !== 'ALL' && c.branch_id !== params.branch_id) {
        return false;
      }
      return true;
    });

    // Compute tab counts for the 9 exact tabs:
    // All, Invited, Filling, BM Review, HR Review, Correction, Joining, Onboarded, Rejected
    const tabCounts: Record<string, number> = {
      All: branchScoped.length,
      Invited: 0,
      Filling: 0,
      'BM Review': 0,
      'HR Review': 0,
      Correction: 0,
      Joining: 0,
      Onboarded: 0,
      Rejected: 0,
    };

    for (const c of branchScoped) {
      if (c.stage === 'Invited') tabCounts.Invited++;
      else if (c.stage === 'Draft') tabCounts.Filling++;
      else if (c.stage === 'BM_Review') tabCounts['BM Review']++;
      else if (c.stage === 'HR_Review') tabCounts['HR Review']++;
      else if (c.stage === 'Need_Correction') tabCounts.Correction++;
      else if (c.stage === 'Joining_Tasks') tabCounts.Joining++;
      else if (c.stage === 'Onboarded') tabCounts.Onboarded++;
      else if (c.stage === 'Rejected') tabCounts.Rejected++;
    }

    // Filter by Tab (if specified and not All)
    let filtered = branchScoped;

    if (params.tab && params.tab !== 'All') {
      filtered = filtered.filter((c) => {
        switch (params.tab) {
          case 'Invited': return c.stage === 'Invited';
          case 'Filling': return c.stage === 'Draft';
          case 'BM Review': return c.stage === 'BM_Review';
          case 'HR Review': return c.stage === 'HR_Review';
          case 'Correction': return c.stage === 'Need_Correction';
          case 'Joining': return c.stage === 'Joining_Tasks';
          case 'Onboarded': return c.stage === 'Onboarded';
          case 'Rejected': return c.stage === 'Rejected';
          default: return true;
        }
      });
    }

    // Filter by Flashcard (mutual exclusive with tab in UI)
    if (params.flashcard) {
      filtered = filtered.filter((c) => {
        const stageEnteredMs = new Date(c.stage_entered_at).getTime();
        const daysInStage = Math.max(0, Math.floor((now - stageEnteredMs) / (1000 * 60 * 60 * 24)));
        const isOverdue = daysInStage > 2;
        const isOpen = c.stage !== 'Onboarded' && c.stage !== 'Rejected';

        switch (params.flashcard) {
          case 'Onboarding Pending': return isOpen;
          case 'Onboarded': return c.stage === 'Onboarded';
          case 'Overdue / Stuck': return isOpen && isOverdue;
          case 'Need Correction': return c.stage === 'Need_Correction';
          case 'Rejected': return c.stage === 'Rejected';
          case 'SLA Met': return (isOpen && !isOverdue) || (c.stage === 'Onboarded' && daysInStage <= 7);
          case 'Avg. Time (days)': return true;
          default: return true;
        }
      });
    }

    // Search filter: emp_id, name, cnic only
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter((c) => {
        return (
          c.emp_id.toLowerCase().includes(q) ||
          c.full_name.toLowerCase().includes(q) ||
          c.cnic.toLowerCase().includes(q)
        );
      });
    }

    // Sort order
    const sortType = params.sort || 'overdue';
    filtered.sort((a, b) => {
      const aEntered = new Date(a.stage_entered_at).getTime();
      const bEntered = new Date(b.stage_entered_at).getTime();
      const aDays = Math.max(0, Math.floor((now - aEntered) / (1000 * 60 * 60 * 24)));
      const bDays = Math.max(0, Math.floor((now - bEntered) / (1000 * 60 * 60 * 24)));

      if (sortType === 'overdue') {
        // Most overdue first: highest days in stage first
        return bDays - aDays;
      }
      if (sortType === 'oldest') {
        // Oldest invite first
        return new Date(a.invited_at).getTime() - new Date(b.invited_at).getTime();
      }
      if (sortType === 'name') {
        return a.full_name.localeCompare(b.full_name);
      }
      return 0;
    });

    const total = filtered.length;
    const page = Math.max(1, params.page || 1);
    const pageSize = params.pageSize || 15;
    const startIdx = (page - 1) * pageSize;
    const pageItems = filtered.slice(startIdx, startIdx + pageSize);

    const items: CandidateRow[] = pageItems.map((c) => {
      const stageEnteredMs = new Date(c.stage_entered_at).getTime();
      const daysInStage = Math.max(0, Math.floor((now - stageEnteredMs) / (1000 * 60 * 60 * 24)));
      const isOverdue = daysInStage > 2;
      const isOpen = c.stage !== 'Onboarded' && c.stage !== 'Rejected';

      return {
        id: c.id,
        emp_id: c.emp_id,
        emp_name: c.full_name,
        cnic: c.cnic,
        designation: designationMap.get(c.designation_id) || 'Unknown Designation',
        branch: branchMap.get(c.branch_id) || 'Unknown Branch',
        branch_id: c.branch_id,
        stage: getStageBadgeText(c),
        stage_raw: c.stage,
        with_role: getWithRole(c.stage),
        days_in_stage: daysInStage,
        invited_on: new Date(c.invited_at).toISOString().split('T')[0],
        is_overdue: isOverdue && isOpen,
        can_remind: isOpen,
      };
    });

    return { items, total, page, pageSize, tabCounts };
  }

  // --- Timeline Modal Data (6 steps) ---
  async getCandidateTimeline(candidateId: string): Promise<TimelineData | null> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return null;

    const branches = await this.getBranches();
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const designations = await this.getDesignations();
    const designationMap = new Map(designations.map((d) => [d.id, d.name]));

    const events = this.timelineEvents.get(candidateId) || [];

    // The 6 exact steps:
    // 1: Profile Created
    // 2: Joining Form Submitted
    // 3: BM Review
    // 4: HR Review
    // 5: Joining Tasks
    // 6: Added to Employee List

    const stageToStepNumber: Record<OnboardingStage, number> = {
      Invited: 1,
      Draft: 2,
      BM_Review: 3,
      HR_Review: 4,
      Need_Correction: candidate.returned_by === 'HR' ? 4 : 3,
      Joining_Tasks: 5,
      Onboarded: 6,
      Rejected: candidate.rejected_by === 'HR' ? 4 : 3,
    };

    const currentStepNum = stageToStepNumber[candidate.stage];

    const stepDefinitions = [
      { step_number: 1, title: 'Profile Created' },
      { step_number: 2, title: 'Joining Form Submitted' },
      { step_number: 3, title: 'BM Review' },
      { step_number: 4, title: 'HR Review' },
      { step_number: 5, title: 'Joining Tasks' },
      { step_number: 6, title: 'Added to Employee List' },
    ];

    const steps = stepDefinitions.map((def) => {
      let status: 'completed' | 'current' | 'returned' | 'rejected' | 'pending' = 'pending';
      let note: string | undefined;

      if (def.step_number < currentStepNum) {
        status = 'completed';
      } else if (def.step_number === currentStepNum) {
        if (candidate.stage === 'Need_Correction') {
          status = 'returned';
          const by = candidate.returned_by || 'BM';
          note = `Returned to candidate by ${by} — Need Correction`;
          if (candidate.return_reason) note += `: "${candidate.return_reason}"`;
        } else if (candidate.stage === 'Rejected') {
          status = 'rejected';
          const by = candidate.rejected_by || 'HR';
          note = `Rejected by ${by}`;
          if (candidate.reject_reason) note += `: "${candidate.reject_reason}"`;
        } else if (candidate.stage === 'Onboarded') {
          status = 'completed';
          note = 'Employee record successfully created and active in system';
        } else {
          status = 'current';
        }
      } else {
        status = 'pending';
      }

      // Check if custom event recorded
      const matchedEvent = events.find((e) => e.step_number === def.step_number);
      if (matchedEvent && matchedEvent.details && !note) {
        note = matchedEvent.details;
      }

      return {
        step_number: def.step_number,
        title: def.title,
        status,
        note,
        timestamp: matchedEvent?.created_at || (status === 'completed' ? candidate.stage_entered_at : undefined),
      };
    });

    return {
      candidate: {
        emp_id: candidate.emp_id,
        name: candidate.full_name,
        cnic: candidate.cnic,
        designation: designationMap.get(candidate.designation_id) || 'Unknown Designation',
        branch: branchMap.get(candidate.branch_id) || 'Unknown Branch',
        invited_on: new Date(candidate.invited_at).toISOString().split('T')[0],
        current_stage: getStageBadgeText(candidate),
      },
      steps,
    };
  }

  // --- Remind Candidate ---
  async remindCandidate(candidateId: string): Promise<OnboardingReminderLog> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error('Candidate not found');

    const now = new Date().toISOString();
    candidate.reminders_count = (candidate.reminders_count || 0) + 1;
    candidate.last_reminded_at = now;

    const log: OnboardingReminderLog = {
      id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      candidate_id: candidateId,
      channel: 'SYSTEM_NOTIFICATION',
      message: `Follow-up reminder sent for stage: ${getStageBadgeText(candidate)}`,
      reminded_by: 'HR Operations',
      created_at: now,
    };

    const existingLogs = this.reminderLogs.get(candidateId) || [];
    existingLogs.push(log);
    this.reminderLogs.set(candidateId, existingLogs);

    return log;
  }

  // --- Remind All Overdue ---
  async remindAllOverdue(branchId?: string): Promise<{ count: number; candidateIds: string[] }> {
    const now = Date.now();
    const overdueCandidates: string[] = [];

    for (const c of this.candidates.values()) {
      if (branchId && branchId !== 'ALL' && c.branch_id !== branchId) continue;
      if (c.stage === 'Onboarded' || c.stage === 'Rejected') continue;

      const stageEnteredMs = new Date(c.stage_entered_at).getTime();
      const days = Math.floor((now - stageEnteredMs) / (1000 * 60 * 60 * 24));
      if (days > 2) {
        overdueCandidates.push(c.id);
        c.reminders_count = (c.reminders_count || 0) + 1;
        c.last_reminded_at = new Date(now).toISOString();

        const log: OnboardingReminderLog = {
          id: `rem-batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidate_id: c.id,
          channel: 'AUTOMATED_BATCH',
          message: `Overdue SLA reminder triggered`,
          reminded_by: 'HR Automated Workflow',
          created_at: new Date(now).toISOString(),
        };
        const logs = this.reminderLogs.get(c.id) || [];
        logs.push(log);
        this.reminderLogs.set(c.id, logs);
      }
    }

    return { count: overdueCandidates.length, candidateIds: overdueCandidates };
  }

  // --- Create Candidate ---
  async createCandidate(data: {
    full_name: string;
    cnic: string;
    mobile: string;
    email?: string;
    branch_id: string;
    designation_id: string;
  }): Promise<OnboardingCandidate> {
    // Validate duplicate CNIC in onboarding_candidates
    for (const existing of this.candidates.values()) {
      if (existing.cnic === data.cnic && existing.stage !== 'Rejected') {
        throw new Error(`Candidate with CNIC ${data.cnic} is already in onboarding pipeline (Emp ID: ${existing.emp_id})`);
      }
    }

    this.candidateCounter++;
    const emp_id = `PX-EMP-${this.candidateCounter}`;
    const id = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newCandidate: OnboardingCandidate = {
      id,
      emp_id,
      full_name: data.full_name,
      cnic: data.cnic,
      mobile: data.mobile,
      email: data.email,
      branch_id: data.branch_id,
      designation_id: data.designation_id,
      stage: 'Invited',
      invited_at: now,
      stage_entered_at: now,
      reminders_count: 0,
      created_at: now,
      updated_at: now,
    };

    const initialEvent: OnboardingTimelineEvent = {
      id: `evt-${Date.now()}-1`,
      candidate_id: id,
      step_number: 1,
      step_name: 'Profile Created',
      status: 'completed',
      details: 'Profile created and invitation link dispatched',
      actor_name: 'HR Officer',
      actor_role: 'central_hr',
      created_at: now,
    };

    this.candidates.set(id, newCandidate);
    this.timelineEvents.set(id, [initialEvent]);

    return newCandidate;
  }
}

export const onboardingDb = new OnboardingDb();
