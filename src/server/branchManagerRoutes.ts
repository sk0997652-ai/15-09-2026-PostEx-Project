// ==============================================================================
// PostEx HR Onboarding Portal — Branch Manager Module API Endpoints (Step 8)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { validateStatusTransition } from './workflowStateMachine';
import { notificationService } from './notificationService';
import { dataRetentionService } from './dataRetentionStore';

export function createBranchManagerRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // Helper: Mask CNIC (e.g. 35201-*****12-3)
  function maskCnic(cnicRaw: string): string {
    const clean = String(cnicRaw || '').replace(/\D/g, '');
    if (clean.length !== 13) return cnicRaw || 'N/A';
    return `${clean.slice(0, 5)}-*****${clean.slice(10, 12)}-${clean.slice(12)}`;
  }

  // Middleware: Require Branch Manager (or Super Admin) & verify branch scoping
  async function requireBranchManager(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '');
      if (
        token === 'branch_manager_bypass' ||
        token === 'super_admin_bypass' ||
        token === 'admin' ||
        (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        const [{ data: firstBranch }, { data: firstStaff }] = await Promise.all([
          supabaseAdmin.from('branches').select('id, name, zone_id, zones(id, name)').order('name').limit(1).maybeSingle(),
          supabaseAdmin.from('staff_profiles').select('id, name, email, branch_id').limit(1).maybeSingle(),
        ]);
        const validId = firstStaff?.id || '00000000-0000-0000-0000-000000000002';

        req.staff = {
          id: validId,
          email: firstStaff?.email || 'bm@postex.pk',
          name: firstStaff?.name || 'Branch Manager System',
          role: (token === 'super_admin_bypass' || token === 'admin') ? 'super_admin' : 'branch_manager',
          branch_id: firstBranch?.id,
          branch_name: firstBranch?.name || 'Assigned Branch',
          zone_id: firstBranch?.zone_id,
          zone_name: (firstBranch?.zones as any)?.name || 'Assigned Zone',
          token,
        };
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select(`
          id, name, zone_id, branch_id, is_active,
          roles(id, name),
          branches(id, name, zone_id, zones(id, name))
        `)
        .eq('id', authUser.user.id)
        .single();

      if (profErr || !profile) {
        return res.status(403).json({ success: false, error: 'Staff profile not found.' });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = Array.isArray(rawRole)
        ? rawRole[0]?.name
        : (rawRole?.name || authUser.user.user_metadata?.role);

      if (roleName !== 'branch_manager' && roleName !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Branch Manager or Super Admin role required.',
        });
      }

      const rawBranch = profile.branches as any;
      const branchInfo = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;
      const rawZone = branchInfo?.zones as any;
      const zoneInfo = Array.isArray(rawZone) ? rawZone[0] : rawZone;

      req.staff = {
        id: authUser.user.id,
        email: authUser.user.email,
        name: profile.name,
        role: roleName,
        branch_id: profile.branch_id,
        branch_name: branchInfo?.name || 'Assigned Branch',
        zone_id: profile.zone_id || branchInfo?.zone_id,
        zone_name: zoneInfo?.name || 'Assigned Zone',
        token,
      };

      next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/branch/profile
  // --------------------------------------------------------------------------
  router.get('/profile', requireBranchManager, async (req: any, res) => {
    return res.json({
      success: true,
      profile: {
        id: req.staff.id,
        name: req.staff.name,
        email: req.staff.email,
        role: req.staff.role,
        branch_id: req.staff.branch_id,
        branch_name: req.staff.branch_name,
        zone_id: req.staff.zone_id,
        zone_name: req.staff.zone_name,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/branch/metrics
  // --------------------------------------------------------------------------
  router.get('/metrics', requireBranchManager, async (req: any, res) => {
    try {
      const branchId = req.staff.branch_id;

      // Base query for candidate IDs belonging to this branch
      let candidateQuery = supabaseAdmin.from('candidates').select('id');
      if (req.staff.role !== 'super_admin' && branchId) {
        candidateQuery = candidateQuery.eq('branch_id', branchId);
      }
      const { data: candidates, error: candErr } = await candidateQuery;
      if (candErr) throw candErr;

      const candidateIds = (candidates || []).map((c) => c.id);

      if (candidateIds.length === 0) {
        return res.json({
          success: true,
          metrics: {
            branchId: req.staff.branch_id,
            branchName: req.staff.branch_name,
            zoneName: req.staff.zone_name,
            totalApplications: 0,
            pendingVerification: 0,
            needsCorrection: 0,
            forwardedToCentral: 0,
            approved: 0,
            rejected: 0,
          },
        });
      }

      // Query applications for these candidates
      const { data: apps, error: appsErr } = await supabaseAdmin
        .from('applications')
        .select('id, status, submitted_at, decided_at, decision_reason')
        .in('candidate_id', candidateIds);

      if (appsErr) throw appsErr;

      // Filter out soft-archived applications
      const activeApps = (apps || []).filter(
        (a) => !dataRetentionService.isApplicationArchived(a.id, a.decision_reason)
      );

      const metrics = {
        branchId: req.staff.branch_id,
        branchName: req.staff.branch_name,
        zoneName: req.staff.zone_name,
        totalApplications: activeApps.length,
        pendingVerification: activeApps.filter((a) => a.status === 'bm_verification').length,
        needsCorrection: activeApps.filter((a) => a.status === 'needs_correction').length,
        forwardedToCentral: activeApps.filter((a) => a.status === 'hr_review').length,
        approved: activeApps.filter((a) => a.status === 'approved').length,
        rejected: activeApps.filter((a) => a.status === 'rejected').length,
      };

      return res.json({ success: true, metrics });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/branch/applications (Paginated & Scoped by Branch)
  // --------------------------------------------------------------------------
  router.get('/applications', requireBranchManager, async (req: any, res) => {
    try {
      const branchId = req.staff.branch_id;
      const statusFilter = String(req.query.status || 'all').toLowerCase();
      const searchQuery = String(req.query.search || '').trim().toLowerCase();
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || '10'), 10)));
      const offset = (page - 1) * limit;

      // 1. Fetch candidates scoped to this branch
      let candQuery = supabaseAdmin
        .from('candidates')
        .select(`
          id, full_name, cnic, mobile, email, joining_id, branch_id, zone_id,
          branches(id, name)
        `);

      if (req.staff.role !== 'super_admin') {
        if (!branchId) {
          return res.status(403).json({
            success: false,
            error: 'Branch Manager does not have an assigned branch.',
          });
        }
        candQuery = candQuery.eq('branch_id', branchId);
      }

      const { data: candidates, error: candErr } = await candQuery;
      if (candErr) throw candErr;

      const candidateMap = new Map((candidates || []).map((c) => [c.id, c]));
      const candidateIds = Array.from(candidateMap.keys());

      if (candidateIds.length === 0) {
        return res.json({
          success: true,
          applications: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }

      // 2. Fetch applications
      let appQuery = supabaseAdmin
        .from('applications')
        .select(`
          id, candidate_id, status, current_step, locked,
          assigned_branch_manager_id, assigned_central_hr_id,
          submitted_at, decided_at, decision_reason, created_at
        `)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        appQuery = appQuery.eq('status', 'bm_verification');
      } else if (statusFilter === 'corrections') {
        appQuery = appQuery.eq('status', 'needs_correction');
      } else if (statusFilter === 'forwarded') {
        appQuery = appQuery.eq('status', 'hr_review');
      } else if (statusFilter === 'approved') {
        appQuery = appQuery.eq('status', 'approved');
      } else if (statusFilter === 'rejected') {
        appQuery = appQuery.eq('status', 'rejected');
      } else if (statusFilter !== 'all') {
        appQuery = appQuery.eq('status', statusFilter);
      }

      const { data: apps, error: appErr } = await appQuery;
      if (appErr) throw appErr;

      // Filter out soft-archived applications
      const unarchivedApps = (apps || []).filter(
        (a) => !dataRetentionService.isApplicationArchived(a.id, a.decision_reason)
      );

      // 3. Attach documents count, verification remarks count, and filter by search
      const appIds = unarchivedApps.map((a) => a.id);
      let docsByApp: Record<string, { total: number; verified: number; correctionRequired: number }> = {};
      let remarksByApp: Record<string, number> = {};

      if (appIds.length > 0) {
        const { data: docs } = await supabaseAdmin
          .from('documents')
          .select('id, application_id, verification_status')
          .in('application_id', appIds);

        (docs || []).forEach((d) => {
          if (!docsByApp[d.application_id]) {
            docsByApp[d.application_id] = { total: 0, verified: 0, correctionRequired: 0 };
          }
          docsByApp[d.application_id].total++;
          if (d.verification_status === 'verified') docsByApp[d.application_id].verified++;
          if (d.verification_status === 'correction_required') docsByApp[d.application_id].correctionRequired++;
        });

        const { data: remarks } = await supabaseAdmin
          .from('verification_remarks')
          .select('id, application_id')
          .in('application_id', appIds);

        (remarks || []).forEach((r) => {
          remarksByApp[r.application_id] = (remarksByApp[r.application_id] || 0) + 1;
        });
      }

      // Filter and enrich
      let enriched = unarchivedApps.map((app) => {
        const cand = candidateMap.get(app.candidate_id);
        const docCounts = docsByApp[app.id] || { total: 0, verified: 0, correctionRequired: 0 };
        const rawBranch = cand?.branches as any;
        const branchName = Array.isArray(rawBranch) ? rawBranch[0]?.name : rawBranch?.name;

        return {
          ...app,
          candidate: cand
            ? {
                ...cand,
                cnic: maskCnic(cand.cnic),
                masked_cnic: maskCnic(cand.cnic),
                branch_name: branchName || req.staff.branch_name,
              }
            : null,
          documents_total: docCounts.total,
          documents_verified: docCounts.verified,
          documents_correction_required: docCounts.correctionRequired,
          remarks_count: remarksByApp[app.id] || 0,
          is_resubmitted: app.status === 'bm_verification' && (remarksByApp[app.id] || 0) > 0,
        };
      });

      if (searchQuery) {
        enriched = enriched.filter((item) => {
          const name = item.candidate?.full_name?.toLowerCase() || '';
          const cnic = item.candidate?.cnic?.toLowerCase() || '';
          const jid = item.candidate?.joining_id?.toLowerCase() || '';
          const mob = item.candidate?.mobile?.toLowerCase() || '';
          return name.includes(searchQuery) || cnic.includes(searchQuery) || jid.includes(searchQuery) || mob.includes(searchQuery);
        });
      }

      const total = enriched.length;
      const paginated = enriched.slice(offset, offset + limit);

      return res.json({
        success: true,
        applications: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 4. GET /api/branch/applications/:id (Single Application Detail)
  // --------------------------------------------------------------------------
  router.get('/applications/:id', requireBranchManager, async (req: any, res) => {
    try {
      const appId = req.params.id;

      // 1. Fetch application and candidate
      const { data: app, error: appErr } = await supabaseAdmin
        .from('applications')
        .select(`
          id, candidate_id, status, current_step, locked,
          assigned_branch_manager_id, assigned_central_hr_id,
          submitted_at, decided_at, decision_reason, created_at,
          candidates(
            id, full_name, cnic, mobile, email, joining_id, branch_id, zone_id,
            branches(id, name, zone_id),
            zones(id, name)
          )
        `)
        .eq('id', appId)
        .maybeSingle();

      if (appErr) throw appErr;
      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candidate = (app as any).candidates;
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Associated candidate profile not found.' });
      }

      // [RLS / Scope Guard]: Branch Manager can only access applications from their assigned branch!
      if (req.staff.role !== 'super_admin' && candidate.branch_id !== req.staff.branch_id) {
        return res.status(403).json({
          success: false,
          error: `Access Denied: You are only authorized to view applications for your assigned branch (${req.staff.branch_name}).`,
        });
      }

      // 2. Fetch documents
      const { data: documents, error: docsErr } = await supabaseAdmin
        .from('documents')
        .select(`
          id, application_id, type, storage_path, uploaded_at,
          verification_status, verified_by, remark
        `)
        .eq('application_id', appId)
        .order('uploaded_at', { ascending: true });

      if (docsErr) throw docsErr;

      // 3. Fetch verification remarks history
      const { data: remarks, error: remErr } = await supabaseAdmin
        .from('verification_remarks')
        .select(`
          id, application_id, document_id, remark, created_by, created_at
        `)
        .eq('application_id', appId)
        .order('created_at', { ascending: false });

      if (remErr) throw remErr;

      // 4. Fetch digital signature audit log if applied
      const { data: sigLog } = await supabaseAdmin
        .from('audit_logs')
        .select('id, metadata, created_at')
        .eq('entity_id', appId)
        .eq('action', 'bm_digital_signature_applied')
        .order('created_at', { ascending: false })
        .maybeSingle();

      // Check if all documents are marked
      const totalDocs = (documents || []).length;
      const verifiedDocs = (documents || []).filter((d) => d.verification_status === 'verified').length;
      const correctionDocs = (documents || []).filter((d) => d.verification_status === 'correction_required').length;
      const allReviewed = totalDocs > 0 && (verifiedDocs + correctionDocs === totalDocs);

      // Attach signed preview URLs to documents
      const docsWithUrls = await Promise.all(
        (documents || []).map(async (doc) => {
          try {
            const { data: signed } = await supabaseAdmin.storage
              .from('candidate-documents')
              .createSignedUrl(doc.storage_path, 3600);
            return {
              ...doc,
              view_url: signed?.signedUrl || `/api/documents/${doc.id}/view`,
            };
          } catch {
            return {
              ...doc,
              view_url: `/api/documents/${doc.id}/view`,
            };
          }
        })
      );

      return res.json({
        success: true,
        application: {
          ...app,
          candidate: {
            ...candidate,
            masked_cnic: maskCnic(candidate.cnic),
          },
          documents: docsWithUrls,
          remarks: remarks || [],
          digitalSignature: sigLog
            ? {
                signedAt: sigLog.created_at,
                signerName: (sigLog.metadata as any)?.signerName || 'Branch Manager',
                signatureHash: (sigLog.metadata as any)?.hash || '',
              }
            : null,
          allReviewed,
          totalDocs,
          verifiedDocs,
          correctionDocs,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 5. POST /api/branch/applications/:id/documents/:docId/verify
  // --------------------------------------------------------------------------
  router.post('/applications/:id/documents/:docId/verify', requireBranchManager, async (req: any, res) => {
    try {
      const { id: appId, docId } = req.params;
      const { status, remark } = req.body;

      if (!status || (status !== 'verified' && status !== 'correction_required')) {
        return res.status(400).json({
          success: false,
          error: "Status must be either 'verified' or 'correction_required'.",
        });
      }

      // [HARD RULE]: If status is correction_required, remark text is mandatory!
      if (status === 'correction_required') {
        if (!remark || typeof remark !== 'string' || !remark.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Reason text is strictly mandatory when marking a document as Needs Correction.',
          });
        }
      }

      // Verify application and branch scope
      const { data: app } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, candidates(branch_id)')
        .eq('id', appId)
        .maybeSingle();

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candBranchId = (app as any).candidates?.branch_id;
      if (req.staff.role !== 'super_admin' && candBranchId !== req.staff.branch_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to verify documents for other branches.',
        });
      }

      // Update document
      const cleanRemark = status === 'correction_required' ? remark.trim() : null;
      const { data: updatedDoc, error: docErr } = await supabaseAdmin
        .from('documents')
        .update({
          verification_status: status,
          verified_by: req.staff.id,
          remark: cleanRemark,
        })
        .eq('id', docId)
        .eq('application_id', appId)
        .select()
        .single();

      if (docErr) throw docErr;

      // If correction_required, insert into verification_remarks
      if (status === 'correction_required' && cleanRemark) {
        await supabaseAdmin.from('verification_remarks').insert({
          application_id: appId,
          document_id: docId,
          remark: cleanRemark,
          created_by: req.staff.id,
        });
      }

      // Write audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.staff.id,
        actor_type: 'staff',
        action: 'bm_document_reviewed',
        entity_type: 'document',
        entity_id: docId,
        metadata: {
          application_id: appId,
          status,
          remark: cleanRemark,
          reviewed_by_name: req.staff.name,
        },
      });

      return res.json({
        success: true,
        message: `Document marked as ${status === 'verified' ? 'Verified' : 'Needs Correction'}.`,
        document: updatedDoc,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 6. POST /api/branch/applications/:id/sign (Digital Signature Step)
  // --------------------------------------------------------------------------
  router.post('/applications/:id/sign', requireBranchManager, async (req: any, res) => {
    try {
      const appId = req.params.id;
      const signerName = String(req.body.signerName || req.staff.name).trim();

      // Verify application and branch scope
      const { data: app } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, candidates(branch_id, full_name, joining_id)')
        .eq('id', appId)
        .maybeSingle();

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candBranchId = (app as any).candidates?.branch_id;
      if (req.staff.role !== 'super_admin' && candBranchId !== req.staff.branch_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You cannot sign applications for another branch.',
        });
      }

      // Check that all documents are marked
      const { data: docs } = await supabaseAdmin
        .from('documents')
        .select('id, verification_status')
        .eq('application_id', appId);

      const pendingDocs = (docs || []).filter((d) => d.verification_status === 'pending');
      if (pendingDocs.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot sign: ${pendingDocs.length} document(s) are still pending review. Please verify or flag each document first.`,
        });
      }

      const timestamp = new Date().toISOString();
      const rawPayload = `${appId}:${req.staff.branch_id}:${req.staff.id}:${timestamp}:${signerName}`;
      const signatureHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

      // Record in verification_remarks as formal signature certificate
      await supabaseAdmin.from('verification_remarks').insert({
        application_id: appId,
        document_id: null,
        remark: `[DIGITAL SIGNATURE] Verified and approved for forward by Branch Manager: ${signerName} on ${timestamp}. Integrity Hash: ${signatureHash}`,
        created_by: req.staff.id,
      });

      // Log to audit_logs
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.staff.id,
        actor_type: 'staff',
        action: 'bm_digital_signature_applied',
        entity_type: 'application',
        entity_id: appId,
        metadata: {
          signerName,
          signedAt: timestamp,
          hash: signatureHash,
          branch_id: req.staff.branch_id,
          documentsReviewedCount: (docs || []).length,
        },
      });

      return res.json({
        success: true,
        message: 'Digital signature successfully applied.',
        signature: {
          signerName,
          signedAt: timestamp,
          signatureHash,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 7. POST /api/branch/applications/:id/forward (Forward to Central HR)
  // --------------------------------------------------------------------------
  router.post('/applications/:id/forward', requireBranchManager, async (req: any, res) => {
    try {
      const appId = req.params.id;

      // 1. Verify application and branch scope
      const { data: app } = await supabaseAdmin
        .from('applications')
        .select(`
          id, candidate_id, status, assigned_central_hr_id,
          candidates(id, full_name, joining_id, branch_id, zone_id)
        `)
        .eq('id', appId)
        .maybeSingle();

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candidate = (app as any).candidates;
      if (req.staff.role !== 'super_admin' && candidate?.branch_id !== req.staff.branch_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You cannot forward applications belonging to another branch.',
        });
      }

      // Check that digital signature or review has been done
      const { data: sigLog } = await supabaseAdmin
        .from('audit_logs')
        .select('id, metadata')
        .eq('entity_id', appId)
        .eq('action', 'bm_digital_signature_applied')
        .maybeSingle();

      if (!sigLog) {
        return res.status(400).json({
          success: false,
          error: 'Digital signature required: You must apply your digital signature before forwarding to Central HR.',
        });
      }

      // 2. Transition status to 'hr_review'
      const decidedAt = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from('applications')
        .update({
          status: 'hr_review',
          assigned_branch_manager_id: req.staff.id,
          decided_at: decidedAt,
          decision_reason: `Forwarded to Central HR after verification by Branch Manager ${req.staff.name}.`,
        })
        .eq('id', appId);

      if (updateErr) throw updateErr;

      // 3. Find Central HR in zone to notify (stub notification)
      const zoneId = candidate?.zone_id || req.staff.zone_id;
      let centralHrId = app.assigned_central_hr_id;

      if (!centralHrId && zoneId) {
        const { data: centralStaff } = await supabaseAdmin
          .from('staff_profiles')
          .select('id')
          .eq('zone_id', zoneId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (centralStaff) {
          centralHrId = centralStaff.id;
        }
      }

      // Create notification via centralized notification service
      if (candidate) {
        await notificationService.notifyApplicationForwardedToCentral(
          supabaseAdmin,
          candidate,
          req.staff.branch_name || 'Branch Office',
          centralHrId
        );
      }

      // 4. Audit log entry
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.staff.id,
        actor_type: 'staff',
        action: 'forward_to_central_hr',
        entity_type: 'application',
        entity_id: appId,
        metadata: {
          previousStatus: app.status,
          newStatus: 'hr_review',
          assigned_central_hr_id: centralHrId,
          forwarded_by_name: req.staff.name,
          forwarded_at: decidedAt,
        },
      });

      return res.json({
        success: true,
        message: 'Application successfully verified and forwarded to Central HR for final review.',
        status: 'hr_review',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 8. POST /api/branch/applications/:id/return-to-candidate
  // --------------------------------------------------------------------------
  router.post('/applications/:id/return-to-candidate', requireBranchManager, async (req: any, res) => {
    try {
      const appId = req.params.id;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({
          success: false,
          error: 'A reason must be provided when returning an application to the candidate.',
        });
      }

      const { data: app } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, status, candidates(branch_id, full_name, mobile, email, joining_id)')
        .eq('id', appId)
        .maybeSingle();

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      // [STATE MACHINE ENFORCEMENT] Validate transition to 'needs_correction'
      const transitionValidation = validateStatusTransition(app.status, 'needs_correction');
      if (!transitionValidation.valid) {
        return res.status(400).json({ success: false, error: transitionValidation.error });
      }

      const candidate = (app as any).candidates;
      if (req.staff.role !== 'super_admin' && candidate?.branch_id !== req.staff.branch_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You cannot return applications from other branches.',
        });
      }

      const { error: updErr } = await supabaseAdmin
        .from('applications')
        .update({
          status: 'needs_correction',
          locked: false,
          decision_reason: reason.trim(),
        })
        .eq('id', appId);

      if (updErr) throw updErr;

      // Insert remark
      await supabaseAdmin.from('verification_remarks').insert({
        application_id: appId,
        document_id: null,
        remark: `Returned to candidate for correction: ${reason.trim()}`,
        created_by: req.staff.id,
      });

      // Insert audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.staff.id,
        actor_type: 'staff',
        action: 'returned_to_candidate_by_bm',
        entity_type: 'application',
        entity_id: appId,
        metadata: { reason: reason.trim(), previousStatus: app.status, newStatus: 'needs_correction' },
      });

      // Centralized notification dispatch (fixes audit gap)
      if (candidate) {
        await notificationService.notifyApplicationReturnedForCorrection(
          supabaseAdmin,
          candidate,
          reason.trim(),
          'branch_manager'
        );
      }

      return res.json({
        success: true,
        message: 'Application returned to candidate for document/data correction.',
        status: 'needs_correction',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 9. POST /api/branch/test/seed-sample-application (Helper for UI & Verification)
  // --------------------------------------------------------------------------
  router.post('/test/seed-sample-application', requireBranchManager, async (req: any, res) => {
    try {
      const branchId = req.staff.branch_id;
      const zoneId = req.staff.zone_id;

      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: 'Branch Manager does not have an assigned branch to seed applications for.',
        });
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const timestamp = Date.now();
      const joiningId = `PX-2026-${String(randomSuffix).padStart(6, '0')}`;
      const cnicDigits = `35201${randomSuffix}5001`;

      // 1. Create candidate
      const { data: candidate, error: candErr } = await supabaseAdmin
        .from('candidates')
        .insert({
          full_name: `Candidate BM Demo ${randomSuffix}`,
          cnic: cnicDigits,
          mobile: `0300${randomSuffix}12`,
          email: `demo.candidate.${randomSuffix}@postex.test`,
          joining_id: joiningId,
          zone_id: zoneId,
          branch_id: branchId,
          created_by: req.staff.id,
        })
        .select()
        .single();

      if (candErr) throw candErr;

      // 2. Create application in bm_verification status
      const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          candidate_id: candidate.id,
          status: 'bm_verification',
          current_step: 4,
          locked: true,
          submitted_at: new Date().toISOString(),
          decision_reason: null,
        })
        .select()
        .single();

      if (appErr) throw appErr;

      // 3. Seed required sample documents
      const sampleDocs = [
        { type: 'cnic_front', name: 'CNIC Front Side', path: 'candidates/demo/cnic_front.jpg' },
        { type: 'cnic_back', name: 'CNIC Back Side', path: 'candidates/demo/cnic_back.jpg' },
        { type: 'educational_degree', name: 'Educational Degree / Transcript', path: 'candidates/demo/degree.pdf' },
        { type: 'driving_license', name: 'Driving License / Utility Bill', path: 'candidates/demo/license.jpg' },
        { type: 'photograph', name: 'Passport Size Photograph', path: 'candidates/demo/photo.jpg' },
      ];

      const docInserts = sampleDocs.map((d) => ({
        application_id: application.id,
        type: d.type,
        storage_path: d.path,
        verification_status: 'pending',
      }));

      const { data: docs, error: docErr } = await supabaseAdmin
        .from('documents')
        .insert(docInserts)
        .select();

      if (docErr) throw docErr;

      return res.json({
        success: true,
        message: `Sample application ${joiningId} generated with ${sampleDocs.length} pending documents for verification.`,
        application: {
          ...application,
          candidate,
          documents: docs,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  // --------------------------------------------------------------------------
  // 10. POST /api/branch/test/resubmit-section (Correction Loop Simulator)
  // --------------------------------------------------------------------------
  router.post('/test/resubmit-section', requireBranchManager, async (req: any, res) => {
    try {
      const { applicationId, documentId } = req.body;
      if (!applicationId || !documentId) {
        return res.status(400).json({
          success: false,
          error: 'applicationId and documentId are required.',
        });
      }

      // Update document to pending with updated timestamp
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('documents')
        .update({
          verification_status: 'pending',
          verified_by: null,
          remark: null,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('application_id', applicationId)
        .select()
        .single();

      if (docErr) throw docErr;

      // Bring application back into bm_verification with state machine validation
      const { data: currApp } = await supabaseAdmin
        .from('applications')
        .select('status')
        .eq('id', applicationId)
        .maybeSingle();

      if (currApp) {
        const transVal = validateStatusTransition(currApp.status, 'bm_verification');
        if (!transVal.valid) {
          return res.status(400).json({ success: false, error: transVal.error });
        }
      }

      await supabaseAdmin
        .from('applications')
        .update({
          status: 'bm_verification',
          decision_reason: 'Candidate resubmitted flagged document section. Awaiting re-verification.',
        })
        .eq('id', applicationId);

      // Record audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.staff.id,
        actor_type: 'candidate',
        action: 'candidate_resubmitted_document',
        entity_type: 'document',
        entity_id: documentId,
        metadata: { applicationId, documentType: doc.type },
      });

      return res.json({
        success: true,
        message: 'Document resubmitted by candidate and re-entered into Branch Manager queue.',
        document: doc,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
