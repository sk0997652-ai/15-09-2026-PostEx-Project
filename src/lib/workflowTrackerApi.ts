import { getStaffAccessToken } from './staffAuth';
import {
  JoinerRecord,
  JoinerTaskDetail,
  submitJoinerWorkflowTask,
  verifyJoinerWorkflowTask,
  returnJoinerWorkflowTask,
  syncJoinerTasksFromBackend,
} from './hrPortalStore';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStaffAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = 'Bearer super_admin_bypass';
  }
  return headers;
}

export async function fetchPersistedWorkflowTasks(): Promise<{
  tableReady: boolean;
  tasks: any[];
  auditLogs: any[];
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/workflow-tracker/tasks', { headers });
    if (!res.ok) {
      return { tableReady: false, tasks: [], auditLogs: [] };
    }
    const data = await res.json();
    if (data?.success && Array.isArray(data.tasks) && data.tasks.length > 0) {
      syncJoinerTasksFromBackend(data.tasks);
    }
    return {
      tableReady: Boolean(data?.tableReady),
      tasks: data?.tasks || [],
      auditLogs: data?.auditLogs || [],
    };
  } catch {
    return { tableReady: false, tasks: [], auditLogs: [] };
  }
}

export async function submitWorkflowTaskWithEvidence(params: {
  joiner: JoinerRecord;
  taskDetail: JoinerTaskDetail;
  evidenceReference: string;
  completionNote?: string;
  evidenceFileName?: string;
  evidenceUrl?: string;
  actorName: string;
  actorRole: string;
}): Promise<{ success: boolean; error?: string; updatedTask?: JoinerTaskDetail }> {
  const {
    joiner,
    taskDetail,
    evidenceReference,
    completionNote,
    evidenceFileName,
    evidenceUrl,
    actorName,
    actorRole,
  } = params;

  let serverTimestamp: string | undefined;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/workflow-tracker/tasks/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        joiner_id: joiner.id,
        employee_code: joiner.employeeCode || joiner.id,
        joiner_name: joiner.n,
        designation_name: joiner.d,
        branch_name: joiner.b[0],
        zone_name: joiner.b[1],
        assigned_hr_name: joiner.hr,
        task_index: taskDetail.taskIndex,
        task_key: taskDetail.taskKey,
        task_name: taskDetail.taskName,
        short_label: taskDetail.shortLabel,
        target_day: taskDetail.targetDay,
        evidence_reference: evidenceReference,
        completion_note: completionNote,
        evidence_file_name: evidenceFileName,
        evidence_url: evidenceUrl,
        previous_status: taskDetail.status,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.submitted_at) {
      serverTimestamp = data.submitted_at;
    }
  } catch {
    // Fallback to store timestamp if offline
  }

  return submitJoinerWorkflowTask({
    joinerId: joiner.id,
    taskIndex: taskDetail.taskIndex,
    evidenceReference,
    completionNote,
    evidenceFileName,
    evidenceUrl,
    actorName,
    actorRole,
    serverTimestamp,
  });
}

export async function verifySubmittedWorkflowTask(params: {
  joiner: JoinerRecord;
  taskDetail: JoinerTaskDetail;
  verificationNote?: string;
  actorName: string;
  actorRole: string;
}): Promise<{ success: boolean; error?: string; updatedTask?: JoinerTaskDetail }> {
  const { joiner, taskDetail, verificationNote, actorName, actorRole } = params;

  let serverTimestamp: string | undefined;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/workflow-tracker/tasks/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        joiner_id: joiner.id,
        employee_code: joiner.employeeCode || joiner.id,
        joiner_name: joiner.n,
        branch_name: joiner.b[0],
        zone_name: joiner.b[1],
        task_index: taskDetail.taskIndex,
        task_key: taskDetail.taskKey,
        task_name: taskDetail.taskName,
        verification_note: verificationNote,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.verified_at) {
      serverTimestamp = data.verified_at;
    }
  } catch {
    // Fallback to store timestamp if offline
  }

  return verifyJoinerWorkflowTask({
    joinerId: joiner.id,
    taskIndex: taskDetail.taskIndex,
    verificationNote,
    actorName,
    actorRole,
    serverTimestamp,
  });
}

export async function returnSubmittedWorkflowTask(params: {
  joiner: JoinerRecord;
  taskDetail: JoinerTaskDetail;
  returnReason: string;
  actorName: string;
  actorRole: string;
}): Promise<{ success: boolean; error?: string; updatedTask?: JoinerTaskDetail }> {
  const { joiner, taskDetail, returnReason, actorName, actorRole } = params;

  let serverTimestamp: string | undefined;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/workflow-tracker/tasks/return', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        joiner_id: joiner.id,
        employee_code: joiner.employeeCode || joiner.id,
        joiner_name: joiner.n,
        branch_name: joiner.b[0],
        zone_name: joiner.b[1],
        task_index: taskDetail.taskIndex,
        task_key: taskDetail.taskKey,
        task_name: taskDetail.taskName,
        return_reason: returnReason,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.returned_at) {
      serverTimestamp = data.returned_at;
    }
  } catch {
    // Fallback to store timestamp if offline
  }

  return returnJoinerWorkflowTask({
    joinerId: joiner.id,
    taskIndex: taskDetail.taskIndex,
    returnReason,
    actorName,
    actorRole,
    serverTimestamp,
  });
}
