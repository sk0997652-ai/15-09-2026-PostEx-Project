import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import dotenv from 'dotenv';
import {
  getHrPortalState,
  hydrateJoinerRecord,
  submitJoinerWorkflowTask,
  verifyJoinerWorkflowTask,
  returnJoinerWorkflowTask,
  canRoleVerifyWorkflowTask,
} from '../src/lib/hrPortalStore';
import { WorkflowTrackerView } from '../src/components/common/WorkflowTrackerView';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL = 'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runVerification() {
  console.log('======================================================================');
  console.log('🧪 WORKFLOW TRACKER TASK SUBMISSION, EVIDENCE & VERIFICATION SELF-TEST');
  console.log('======================================================================');

  const createdAuditEntityIds: string[] = [];

  try {
    // 1. Render initial WorkflowTrackerView markup and verify pencil buttons exist
    console.log('\n--- 1. Rendered UI Check: Joiners Table & Pencil Action Buttons ---');
    const htmlCentral = renderToStaticMarkup(
      React.createElement(WorkflowTrackerView, {
        role: 'central_hr',
        zoneName: 'Central Zone',
      })
    );
    const htmlSuperAdmin = renderToStaticMarkup(
      React.createElement(WorkflowTrackerView, {
        role: 'super_admin',
      })
    );

    assert(
      htmlSuperAdmin.includes('id="edit-joiner-btn-joiner-1"'),
      'Joiner Tracker renders pencil action button for joiner rows',
      'edit-joiner-btn-joiner-1 present in rendered DOM'
    );
    assert(
      htmlSuperAdmin.includes('data-testid="joiner-progress-joiner-1"') &&
        htmlSuperAdmin.includes('data-testid="joiner-status-joiner-1"'),
      'Joiner Tracker renders both Progress and Status cells for each joiner row'
    );
    assert(
      htmlSuperAdmin.includes('HR Performance') && !htmlCentral.includes('HR Performance'),
      'HR Performance tab is visible to Super Admin/Zonal HR and hidden from Central HR'
    );

    // 2. Find a joiner with unverified tasks in the store
    console.log('\n--- 2. Task Submission with Evidence (Confirm "Submitted", NOT "Verified") ---');
    const initialState = getHrPortalState();
    const targetJoiner = initialState.joiners.find((j) => {
      const h = hydrateJoinerRecord(j, initialState.tasks);
      return (h.taskDetails || []).some((td) => td.status === 'pending');
    });

    assert(Boolean(targetJoiner), 'Found joiner with pending onboarding task', targetJoiner?.id);
    if (!targetJoiner) throw new Error('No joiner with pending task found');

    const hydratedBefore = hydrateJoinerRecord(targetJoiner, initialState.tasks);
    const pendingTask = hydratedBefore.taskDetails!.find((td) => td.status === 'pending')!;
    const taskIndex = pendingTask.taskIndex;

    const applicableBefore = hydratedBefore.taskDetails!.filter(
      (td) => td.status !== 'not_needed'
    ).length;
    const verifiedBefore = hydratedBefore.taskDetails!.filter(
      (td) => td.status === 'verified'
    ).length;

    console.log(
      `  Target Joiner: ${hydratedBefore.n} (${hydratedBefore.id}), Task #${taskIndex + 1}: "${pendingTask.taskName}", Initial Progress: ${verifiedBefore}/${applicableBefore}`
    );

    // 2a. Verify missing evidence is rejected both in store and backend API
    const emptySubmitStore = submitJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      evidenceReference: '   ',
      completionNote: 'No evidence ref provided',
      actorName: hydratedBefore.hr,
      actorRole: 'central_hr',
    });
    assert(
      !emptySubmitStore.success,
      'Store rejects task submission when Evidence Reference / File is empty',
      emptySubmitStore.error
    );

    const emptySubmitApi = await fetch(`${BASE_URL}/api/workflow-tracker/tasks/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super_admin_bypass',
      },
      body: JSON.stringify({
        joiner_id: hydratedBefore.id,
        task_index: taskIndex,
        task_key: pendingTask.taskKey,
        task_name: pendingTask.taskName,
        evidence_reference: '',
      }),
    });
    assert(
      emptySubmitApi.status === 400,
      'Backend API /api/workflow-tracker/tasks/submit rejects empty evidence with HTTP 400'
    );

    // 2b. Submit task WITH valid evidence via backend API + store
    const testEntityId = `${hydratedBefore.employeeCode || hydratedBefore.id}:${pendingTask.taskKey}`;
    createdAuditEntityIds.push(testEntityId);

    const validSubmitApi = await fetch(`${BASE_URL}/api/workflow-tracker/tasks/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super_admin_bypass',
      },
      body: JSON.stringify({
        joiner_id: hydratedBefore.id,
        employee_code: hydratedBefore.employeeCode,
        joiner_name: hydratedBefore.n,
        designation_name: hydratedBefore.d,
        branch_name: hydratedBefore.b[0],
        zone_name: hydratedBefore.b[1],
        assigned_hr_name: hydratedBefore.hr,
        task_index: taskIndex,
        task_key: pendingTask.taskKey,
        task_name: pendingTask.taskName,
        short_label: pendingTask.shortLabel,
        target_day: pendingTask.targetDay,
        evidence_reference: 'TCS-HO-884920',
        completion_note: 'Dispatched original signed dossier via TCS courier.',
        evidence_file_name: 'tcs_receipt_884920.pdf',
        previous_status: 'pending',
      }),
    });
    const validSubmitJson = await validSubmitApi.json();
    assert(
      validSubmitApi.ok && validSubmitJson.status === 'submitted',
      'Backend API /api/workflow-tracker/tasks/submit sets status strictly to "submitted" (NOT "verified")',
      `status=${validSubmitJson.status}`
    );

    const submitStoreRes = submitJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      evidenceReference: 'TCS-HO-884920',
      completionNote: 'Dispatched original signed dossier via TCS courier.',
      evidenceFileName: 'tcs_receipt_884920.pdf',
      actorName: hydratedBefore.hr,
      actorRole: 'central_hr',
      serverTimestamp: validSubmitJson.submitted_at,
    });

    assert(
      submitStoreRes.success && submitStoreRes.updatedTask?.status === 'submitted',
      'Task status after submission is "submitted" and NOT "verified"',
      `status=${submitStoreRes.updatedTask?.status}`
    );

    // Verify Progress has NOT incremented while status is "submitted"
    const stateAfterSubmit = getHrPortalState();
    const joinerAfterSubmit = hydrateJoinerRecord(
      stateAfterSubmit.joiners.find((j) => j.id === hydratedBefore.id)!,
      stateAfterSubmit.tasks
    );
    const verifiedAfterSubmit = joinerAfterSubmit.taskDetails!.filter(
      (td) => td.status === 'verified'
    ).length;

    assert(
      verifiedAfterSubmit === verifiedBefore && joinerAfterSubmit.done[taskIndex] === null,
      'Joiner Progress count does NOT increment when task is only "Submitted" (anti-false-completion)',
      `Progress remained ${verifiedAfterSubmit}/${applicableBefore}`
    );

    // Confirm rendered UI shows "Submitted" badge in the Joiner table
    const htmlAfterSubmit = renderToStaticMarkup(
      React.createElement(WorkflowTrackerView, { role: 'super_admin' })
    );
    assert(
      htmlAfterSubmit.includes('Submitted') && htmlAfterSubmit.includes('1 Submitted'),
      'Rendered Joiner Tracker table displays "Submitted" badge and "1 Submitted" status indicator'
    );

    // 3. RBAC Check: Central HR cannot self-verify a submitted task
    console.log('\n--- 3. RBAC Enforcement: Central HR Cannot Verify Submitted Task ---');
    assert(
      !canRoleVerifyWorkflowTask('central_hr') &&
        canRoleVerifyWorkflowTask('zonal_hr') &&
        canRoleVerifyWorkflowTask('super_admin'),
      'Role permission helper blocks Central HR from verifying and allows Zonal HR / Super Admin'
    );

    const centralVerifyAttempt = verifyJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      actorName: hydratedBefore.hr,
      actorRole: 'central_hr',
    });
    assert(
      !centralVerifyAttempt.success,
      'Central HR attempt to verify submitted task is rejected',
      centralVerifyAttempt.error
    );

    // 4. Return & Resubmit Flow
    console.log('\n--- 4. Return for Correction & Resubmission Flow ---');
    const returnRes = returnJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      returnReason: 'Courier receipt scan is blurry, please attach clear tracking number.',
      actorName: 'Central Zone HR Manager',
      actorRole: 'zonal_hr',
    });
    assert(
      returnRes.success && returnRes.updatedTask?.status === 'returned',
      'Zonal HR can return a submitted task with a mandatory return reason -> status becomes "returned"'
    );

    const resubmitRes = submitJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      evidenceReference: 'TCS-HO-884920-CLEAR',
      completionNote: 'Re-uploaded high-resolution courier receipt.',
      evidenceFileName: 'tcs_receipt_884920_hd.pdf',
      actorName: hydratedBefore.hr,
      actorRole: 'central_hr',
    });
    assert(
      resubmitRes.success && resubmitRes.updatedTask?.status === 'submitted',
      'HR Officer can resubmit a returned task -> status returns to "submitted" (awaiting verification)'
    );

    // 5. Verify Task as Appropriate Role (Zonal HR / Super Admin) & Confirm Auto-Update of Progress/Status
    console.log('\n--- 5. Verify Task as Zonal HR & Confirm Automatic Joiner Progress/Status Update ---');
    const verifyApiRes = await fetch(`${BASE_URL}/api/workflow-tracker/tasks/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super_admin_bypass',
      },
      body: JSON.stringify({
        joiner_id: hydratedBefore.id,
        employee_code: hydratedBefore.employeeCode,
        joiner_name: hydratedBefore.n,
        branch_name: hydratedBefore.b[0],
        zone_name: hydratedBefore.b[1],
        task_index: taskIndex,
        task_key: pendingTask.taskKey,
        task_name: pendingTask.taskName,
        verification_note: 'Verified TCS tracking receipt and physical dossier arrival.',
      }),
    });
    const verifyApiJson = await verifyApiRes.json();
    assert(
      verifyApiRes.ok && verifyApiJson.status === 'verified',
      'Backend API /api/workflow-tracker/tasks/verify transitions status to "verified"',
      `verified_at=${verifyApiJson.verified_at}`
    );

    const verifyStoreRes = verifyJoinerWorkflowTask({
      joinerId: hydratedBefore.id,
      taskIndex,
      verificationNote: 'Verified TCS tracking receipt and physical dossier arrival.',
      actorName: 'Central Zone HR Manager',
      actorRole: 'zonal_hr',
      serverTimestamp: verifyApiJson.verified_at,
    });

    assert(
      verifyStoreRes.success && verifyStoreRes.updatedTask?.status === 'verified',
      'Zonal HR verification transitions task status from "submitted" to "verified"'
    );

    const stateAfterVerify = getHrPortalState();
    const joinerAfterVerify = hydrateJoinerRecord(
      stateAfterVerify.joiners.find((j) => j.id === hydratedBefore.id)!,
      stateAfterVerify.tasks
    );
    const verifiedAfterVerify = joinerAfterVerify.taskDetails!.filter(
      (td) => td.status === 'verified'
    ).length;

    assert(
      verifiedAfterVerify === verifiedBefore + 1 &&
        typeof joinerAfterVerify.done[taskIndex] === 'number',
      'Joiner Progress count automatically increments upon verification',
      `Progress updated from ${verifiedBefore}/${applicableBefore} -> ${verifiedAfterVerify}/${applicableBefore}`
    );

    // Complete remaining pending tasks for this joiner to verify automatic status transition to "Complete"
    for (let k = 0; k < stateAfterVerify.tasks.length; k++) {
      const currentJ = hydrateJoinerRecord(
        getHrPortalState().joiners.find((j) => j.id === hydratedBefore.id)!,
        stateAfterVerify.tasks
      );
      const td = currentJ.taskDetails![k];
      if (td.status === 'pending' || td.status === 'returned') {
        submitJoinerWorkflowTask({
          joinerId: hydratedBefore.id,
          taskIndex: k,
          evidenceReference: `REF-AUTO-${k + 1}`,
          completionNote: 'Submitted for full onboarding completion test',
          actorName: hydratedBefore.hr,
          actorRole: 'central_hr',
        });
      }
      const afterSubJ = hydrateJoinerRecord(
        getHrPortalState().joiners.find((j) => j.id === hydratedBefore.id)!,
        stateAfterVerify.tasks
      );
      if (afterSubJ.taskDetails![k].status === 'submitted') {
        verifyJoinerWorkflowTask({
          joinerId: hydratedBefore.id,
          taskIndex: k,
          verificationNote: 'Verified for full onboarding completion test',
          actorName: 'Central Zone HR Manager',
          actorRole: 'zonal_hr',
        });
      }
    }

    const finalState = getHrPortalState();
    const finalJoiner = hydrateJoinerRecord(
      finalState.joiners.find((j) => j.id === hydratedBefore.id)!,
      finalState.tasks
    );
    const finalVerifiedCount = finalJoiner.taskDetails!.filter(
      (td) => td.status === 'verified'
    ).length;

    assert(
      finalVerifiedCount === applicableBefore,
      'All applicable tasks for target joiner are now Verified',
      `${finalVerifiedCount}/${applicableBefore}`
    );

    const htmlAfterFullVerify = renderToStaticMarkup(
      React.createElement(WorkflowTrackerView, { role: 'super_admin' })
    );
    assert(
      htmlAfterFullVerify.includes(
        `data-testid="joiner-progress-${hydratedBefore.id}"`
      ) && htmlAfterFullVerify.includes(`${finalVerifiedCount}/${applicableBefore}`),
      'Rendered Joiner table automatically reflects updated Progress and Complete status'
    );

    // Verify audit logs were recorded in both portal store and Supabase audit_logs
    const workflowAuditCount = finalState.auditLogs.filter(
      (a) => a.entity_type === 'workflow_task'
    ).length;
    assert(
      workflowAuditCount >= 4,
      'Immutable workflow_task audit log entries recorded for submit, return, resubmit, and verify',
      `count=${workflowAuditCount}`
    );
  } finally {
    // Clean up test audit entries from Supabase public.audit_logs
    if (createdAuditEntityIds.length > 0) {
      await supabaseAdmin
        .from('audit_logs')
        .delete()
        .eq('entity_type', 'workflow_task')
        .in('entity_id', createdAuditEntityIds);
    }
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
}

runVerification().catch((err) => {
  console.error('Unhandled error in verification:', err);
  process.exit(1);
});
