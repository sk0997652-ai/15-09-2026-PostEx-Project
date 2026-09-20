import { SupabaseClient } from '@supabase/supabase-js';
import { formTemplatesService } from './formTemplatesStore';
import { notificationService } from './notificationService';

export interface DataRetentionCleanupResult {
  success: boolean;
  countArchived: number;
  thresholdDays: number;
  cutoffDate: string;
  archivedIds: string[];
  message: string;
}

export class DataRetentionService {
  private archivedApplicationIds: Set<string> = new Set();
  private initialized = false;

  /**
   * Initializes the in-memory cache of soft-archived application IDs from DB audit_logs.
   */
  async ensureInitialized(supabaseAdmin?: SupabaseClient) {
    if (this.initialized || !supabaseAdmin) return;
    try {
      const { data: logs, error } = await supabaseAdmin
        .from('audit_logs')
        .select('entity_id')
        .eq('action', 'data_retention_archived')
        .eq('entity_type', 'applications');

      if (!error && logs) {
        for (const log of logs) {
          if (log.entity_id) {
            this.archivedApplicationIds.add(log.entity_id);
          }
        }
      }
      this.initialized = true;
    } catch (err) {
      console.warn('[DATA RETENTION] Warning initializing archived cache:', err);
    }
  }

  /**
   * Checks whether an application is soft-archived by ID or by decision_reason tag.
   */
  isApplicationArchived(applicationId: string, decisionReason?: string | null): boolean {
    if (this.archivedApplicationIds.has(applicationId)) {
      return true;
    }
    if (decisionReason && decisionReason.includes('[DATA_RETENTION_ARCHIVED')) {
      this.archivedApplicationIds.add(applicationId);
      return true;
    }
    return false;
  }

  /**
   * Runs the data retention cleanup job:
   * 1. Reads configured data retention days from Organization Settings (default 120 days).
   * 2. Scans rejected applications older than threshold.
   * 3. Soft-hides (archives) them by updating decision_reason tag and inserting audit_logs entry.
   * 4. Dispatches notification to admin.
   */
  async runRetentionCleanup(
    supabaseAdmin: SupabaseClient,
    actorId?: string
  ): Promise<DataRetentionCleanupResult> {
    await this.ensureInitialized(supabaseAdmin);

    // 1. Get organizational settings for threshold (default 120 days)
    const orgSettings = await formTemplatesService.getOrgSettings(supabaseAdmin);
    const thresholdDays = Math.max(1, orgSettings.data_retention_days || 120);

    const now = Date.now();
    const cutoffMs = now - thresholdDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString();

    console.log(`[DATA RETENTION] Running retention cleanup with threshold: ${thresholdDays} days (cutoff: ${cutoffDate})`);

    // 2. Query rejected applications
    const { data: rejectedApps, error: queryErr } = await supabaseAdmin
      .from('applications')
      .select(`
        id,
        candidate_id,
        status,
        decided_at,
        created_at,
        decision_reason,
        candidates ( id, full_name, joining_id )
      `)
      .eq('status', 'rejected');

    if (queryErr) {
      throw new Error(`Failed to query rejected applications: ${queryErr.message}`);
    }

    const eligibleToArchive: any[] = [];

    for (const app of rejectedApps || []) {
      // If already archived, skip
      if (this.isApplicationArchived(app.id, app.decision_reason)) {
        continue;
      }

      // Check date: prefer decided_at, fall back to created_at
      const dateToCheck = app.decided_at || app.created_at;
      if (!dateToCheck) continue;

      const appTimestamp = new Date(dateToCheck).getTime();
      if (appTimestamp < cutoffMs) {
        eligibleToArchive.push({
          ...app,
          ageInDays: Math.floor((now - appTimestamp) / (24 * 60 * 60 * 1000)),
        });
      }
    }

    const archivedIds: string[] = [];

    // 3. Process each eligible application
    for (const item of eligibleToArchive) {
      const existingReason = item.decision_reason || 'Application rejected';
      const archiveTag = `[DATA_RETENTION_ARCHIVED: ${new Date().toISOString()}]`;
      const updatedReason = `${existingReason} ${archiveTag}`.trim();

      // Soft-hide: Update decision_reason with archival tag
      const { error: updateErr } = await supabaseAdmin
        .from('applications')
        .update({
          decision_reason: updatedReason,
        })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`[DATA RETENTION] Failed to archive application ${item.id}:`, updateErr);
        continue;
      }

      // Track in in-memory set
      this.archivedApplicationIds.add(item.id);
      archivedIds.push(item.id);

      // Audit Log for compliance
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId || null,
        actor_type: actorId ? 'staff' : 'system',
        action: 'data_retention_archived',
        entity_type: 'applications',
        entity_id: item.id,
        metadata: {
          candidate_id: item.candidate_id,
          candidate_name: item.candidates?.full_name,
          joining_id: item.candidates?.joining_id,
          threshold_days: thresholdDays,
          age_in_days: item.ageInDays,
          decided_at: item.decided_at,
          archive_reason: 'Rejected application exceeded data retention policy threshold',
        },
      });
    }

    // 4. Record summary audit log entry
    if (archivedIds.length > 0 || actorId) {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId || null,
        actor_type: actorId ? 'staff' : 'system',
        action: 'data_retention_cleanup_completed',
        entity_type: 'applications',
        entity_id: 'data_retention_job',
        metadata: {
          threshold_days: thresholdDays,
          cutoff_date: cutoffDate,
          archived_count: archivedIds.length,
          archived_ids: archivedIds,
          triggered_by: actorId ? `staff_${actorId}` : 'automated_cron',
        },
      });
    }

    // 5. Notify administration if records were soft-archived
    if (actorId) {
      await notificationService.notifyDataRetentionCleanup(
        supabaseAdmin,
        actorId,
        archivedIds.length,
        thresholdDays
      );
    }

    return {
      success: true,
      countArchived: archivedIds.length,
      thresholdDays,
      cutoffDate,
      archivedIds,
      message: `Data retention cleanup complete. Soft-archived ${archivedIds.length} rejected application(s) older than ${thresholdDays} days.`,
    };
  }
}

export const dataRetentionService = new DataRetentionService();
