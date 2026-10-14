import { onboardingDb } from '../src/server/onboarding/onboardingDb';
import {
  STAGE_CONFIG,
  getStageBadgeText,
  executeStageTransition,
  InvalidStageTransitionError,
} from '../src/server/onboarding/onboardingStateMachine';
import { runOnboardingDemoSeed } from '../src/server/onboarding/scripts/seedOnboardingDemo';
import { masterDataAdapter } from '../src/server/onboarding/adapters/masterDataAdapter';
import { createEmployeeFromOnboarding } from '../src/server/onboarding/adapters/employeeIntegrationAdapter';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Starting PostEx Employee Onboarding Backend Test Suite');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Test Group 1: Master Data Adapter (Read-only, zero writes)
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 1: Master Data Adapter (Read-Only) ---');
  const branches = await masterDataAdapter.getExistingBranches();
  assert(branches.length > 0, `MasterDataAdapter reads existing branches (found: ${branches.length})`);

  const designations = await masterDataAdapter.getExistingDesignations();
  assert(designations.length > 0, `MasterDataAdapter reads existing designations (found: ${designations.length})`);

  // ---------------------------------------------------------------------------
  // Test Group 2: Demo Seed Script (640 candidates across 8 stages)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 2: Demo Seed Script & Safety Guards ---');
  await runOnboardingDemoSeed();

  const totalCandidates = onboardingDb.getCandidatesCount();
  assert(totalCandidates === 640, `Seeded exactly 640 demo candidates (found: ${totalCandidates})`);

  // Verify all candidates have PX-EMP-<number> ID format
  const sampleCandidates = await onboardingDb.getCandidates({ page: 1, pageSize: 50 });
  const allMatchEmpId = sampleCandidates.items.every((c) => /^PX-EMP-\d+$/.test(c.emp_id));
  assert(allMatchEmpId, 'All candidates conform to Emp ID format PX-EMP-<number>');

  // ---------------------------------------------------------------------------
  // Test Group 3: Summary Metrics & 7 Flashcards
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Summary Metrics & 7 Flashcards ---');
  const summary = await onboardingDb.getSummary();

  assert(summary.flashcards.pending > 0, `Onboarding Pending count calculated: ${summary.flashcards.pending}`);
  assert(summary.flashcards.onboarded === 160, `Onboarded count matches 160: ${summary.flashcards.onboarded}`);
  assert(summary.flashcards.need_correction === 45, `Need Correction count matches 45: ${summary.flashcards.need_correction}`);
  assert(summary.flashcards.rejected === 50, `Rejected count matches 50: ${summary.flashcards.rejected}`);
  assert(summary.flashcards.overdue > 0, `Overdue cases identified (>2 days SLA): ${summary.flashcards.overdue}`);
  assert(summary.flashcards.sla_met > 0, `SLA Met count calculated: ${summary.flashcards.sla_met}`);
  assert(summary.flashcards.avg_time_days > 0, `Avg. Time (days) calculated: ${summary.flashcards.avg_time_days}`);

  // ---------------------------------------------------------------------------
  // Test Group 4: Pipeline by Stage (8 stages in fixed order, counts only)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Pipeline by Stage (Fixed 8 Stages) ---');
  assert(summary.pipeline_by_stage.length === 8, `Pipeline contains exactly 8 stages: ${summary.pipeline_by_stage.length}`);

  const expectedStageLabels = [
    'Invited',
    'Filling Form',
    'BM Review',
    'HR Review',
    'Need Correction',
    'Joining Tasks',
    'Onboarded',
    'Rejected',
  ];

  const stageLabelsMatch = summary.pipeline_by_stage.every((s, idx) => s.stage === expectedStageLabels[idx]);
  assert(stageLabelsMatch, `Pipeline stages are in exact order: ${expectedStageLabels.join(' -> ')}`);

  const stageColors = {
    Invited: '#94a3b8',
    Draft: '#64748b',
    BM_Review: '#0ea5e9',
    HR_Review: '#6366f1',
    Need_Correction: '#f59e0b',
    Joining_Tasks: '#8b5cf6',
    Onboarded: '#10b981',
    Rejected: '#e11d48',
  };
  const colorsMatch = summary.pipeline_by_stage.every((s) => s.color === (stageColors as any)[s.stage_raw]);
  assert(colorsMatch, 'Pipeline stage colors strictly match specification');

  // ---------------------------------------------------------------------------
  // Test Group 5: Who is Holding Cases (Candidate, Branch Manager, HR, HR Officer)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Who is Holding Cases Panel ---');
  assert(summary.who_is_holding.length === 4, `Who is Holding contains exactly 4 roles: ${summary.who_is_holding.length}`);

  const holdingRoles = summary.who_is_holding.map((r) => r.role);
  assert(
    holdingRoles[0] === 'Candidate' &&
    holdingRoles[1] === 'Branch Manager' &&
    holdingRoles[2] === 'HR' &&
    holdingRoles[3] === 'HR Officer',
    `Roles match Candidate, Branch Manager, HR, HR Officer`
  );

  const slaIsTwoDays = summary.who_is_holding.every((r) => r.sla_days === 2);
  assert(slaIsTwoDays, 'SLA is set to 2 days for all holding rows');

  // ---------------------------------------------------------------------------
  // Test Group 6: Table UI Stage Badges
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 6: Stage Badge Formatting Rules ---');
  assert(
    getStageBadgeText({ stage: 'Draft' } as any) === 'Filling Form',
    'Draft stage displays as "Filling Form"'
  );
  assert(
    getStageBadgeText({ stage: 'Need_Correction', returned_by: 'BM' } as any) === 'Correction · BM',
    'Returned by BM displays as "Correction · BM"'
  );
  assert(
    getStageBadgeText({ stage: 'Need_Correction', returned_by: 'HR' } as any) === 'Correction · HR',
    'Returned by HR displays as "Correction · HR"'
  );
  assert(
    getStageBadgeText({ stage: 'Rejected', rejected_by: 'BM' } as any) === 'Rejected · BM',
    'Rejected by BM displays as "Rejected · BM"'
  );
  assert(
    getStageBadgeText({ stage: 'Rejected', rejected_by: 'HR' } as any) === 'Rejected · HR',
    'Rejected by HR displays as "Rejected · HR"'
  );

  // ---------------------------------------------------------------------------
  // Test Group 7: State Machine Transitions & Employee Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 7: State Machine Transitions & Employee Integration ---');
  const dummyCandidate = {
    id: 'test-cand-01',
    emp_id: 'PX-EMP-9999',
    full_name: 'Test Candidate',
    cnic: '35201-9999999-1',
    mobile: '+92 300 1234567',
    designation_id: designations[0].id,
    branch_id: branches[0].id,
    stage: 'Joining_Tasks' as const,
    reminders_count: 0,
    invited_at: new Date().toISOString(),
    stage_entered_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const transitionRes = await executeStageTransition(dummyCandidate, {
    targetStage: 'Onboarded',
  });

  assert(transitionRes.updatedCandidate.stage === 'Onboarded', 'Candidate transitioned to Onboarded');
  assert(transitionRes.employeeCreated === true, 'createEmployeeFromOnboarding adapter called on Onboarded');
  assert(!!transitionRes.updatedCandidate.employee_id, 'employee_id linked to Onboarded candidate');

  // Test invalid transition
  let caughtError = false;
  try {
    await executeStageTransition(dummyCandidate, {
      targetStage: 'Draft',
    });
  } catch (err: any) {
    if (err instanceof InvalidStageTransitionError) {
      caughtError = true;
    }
  }
  assert(caughtError, 'Invalid stage transition properly throws InvalidStageTransitionError');

  // ---------------------------------------------------------------------------
  // Test Group 8: Search & Filter Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 8: Search & Filters ---');
  const searchRes = await onboardingDb.getCandidates({ search: 'PX-EMP-1005' });
  assert(searchRes.items.length === 1, `Search by Emp ID returned exact match: ${searchRes.items[0]?.emp_id}`);

  const tabRes = await onboardingDb.getCandidates({ tab: 'BM Review' });
  const allBM = tabRes.items.every((c) => c.stage_raw === 'BM_Review');
  assert(allBM && tabRes.items.length > 0, `BM Review tab returns only BM_Review candidates (${tabRes.items.length} items)`);

  // ---------------------------------------------------------------------------
  // Test Group 9: Timeline 6-Step Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 9: Timeline 6 Steps ---');
  const firstCand = sampleCandidates.items[0];
  const timeline = await onboardingDb.getCandidateTimeline(firstCand.id);
  assert(timeline !== null, 'Candidate timeline retrieved');
  assert(timeline?.steps.length === 6, `Timeline has exactly 6 steps: ${timeline?.steps.length}`);
  assert(timeline?.steps[0].title === 'Profile Created', 'Step 1 is Profile Created');
  assert(timeline?.steps[5].title === 'Added to Employee List', 'Step 6 is Added to Employee List');

  // ---------------------------------------------------------------------------
  // Test Group 10: Remind Single & Remind All Overdue
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 10: Reminders ---');
  const openCand = sampleCandidates.items.find((c) => c.can_remind);
  if (openCand) {
    const remindLog = await onboardingDb.remindCandidate(openCand.id);
    assert(remindLog.candidate_id === openCand.id, 'Remind single candidate logged reminder');
  }

  const batchRemind = await onboardingDb.remindAllOverdue();
  assert(batchRemind.count >= 0, `Batch remind executed for ${batchRemind.count} overdue cases`);

  // ---------------------------------------------------------------------------
  // Test Group 11: Candidate Creation & Duplicate CNIC Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Group 11: Candidate Creation & CNIC Guard ---');
  const newCand = await onboardingDb.createCandidate({
    full_name: 'Zahid Iqbal',
    cnic: '35201-1111222-3',
    mobile: '+92 321 9876543',
    branch_id: branches[0].id,
    designation_id: designations[0].id,
  });

  assert(newCand.stage === 'Invited', 'New candidate created in stage Invited');
  assert(newCand.emp_id.startsWith('PX-EMP-'), `New candidate assigned Emp ID: ${newCand.emp_id}`);

  let duplicateBlocked = false;
  try {
    await onboardingDb.createCandidate({
      full_name: 'Duplicate Test',
      cnic: '35201-1111222-3',
      mobile: '+92 321 0000000',
      branch_id: branches[0].id,
      designation_id: designations[0].id,
    });
  } catch (err: any) {
    duplicateBlocked = true;
  }
  assert(duplicateBlocked, 'Duplicate CNIC correctly blocked with validation error');

  console.log('\n================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests} / ${totalTests} checks verified!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
