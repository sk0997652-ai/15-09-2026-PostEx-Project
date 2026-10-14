import { Router, Request, Response } from 'express';
import { onboardingDb } from './onboardingDb';
import { executeStageTransition, InvalidStageTransitionError } from './onboardingStateMachine';
import { runOnboardingDemoSeed } from './scripts/seedOnboardingDemo';

export function createOnboardingRouter(): Router {
  const router = Router();

  // Initialize demo data if in dev/non-production mode and empty
  if (process.env.NODE_ENV !== 'production' && onboardingDb.getCandidatesCount() === 0) {
    runOnboardingDemoSeed().catch((err) => {
      console.warn('Initial demo seed skipped or encountered error:', err.message);
    });
  }

  // 1. Master Data: Branches (Read-only from existing table)
  router.get('/branches', async (_req: Request, res: Response) => {
    try {
      const branches = await onboardingDb.getBranches();
      res.json({ success: true, branches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Master Data: Designations (Read-only from existing table)
  router.get('/designations', async (_req: Request, res: Response) => {
    try {
      const designations = await onboardingDb.getDesignations();
      res.json({ success: true, designations });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Summary Metrics & Pipeline Breakdown
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined;
      const summary = await onboardingDb.getSummary(branchId);
      res.json({ success: true, ...summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Candidate List with Pagination, Search, Tab, Flashcard, and Sorting
  router.get('/candidates', async (req: Request, res: Response) => {
    try {
      const branch_id = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined;
      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
      const flashcard = typeof req.query.flashcard === 'string' ? req.query.flashcard : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const sort = req.query.sort as 'overdue' | 'oldest' | 'name' | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 15;

      const result = await onboardingDb.getCandidates({
        branch_id,
        tab,
        flashcard,
        search,
        sort,
        page,
        pageSize,
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Timeline Modal Details (6 Steps)
  router.get('/timeline/:id', async (req: Request, res: Response) => {
    try {
      const candidateId = req.params.id;
      const timeline = await onboardingDb.getCandidateTimeline(candidateId);
      if (!timeline) {
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }
      res.json({ success: true, timeline });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Remind Single Candidate
  router.post('/remind/:id', async (req: Request, res: Response) => {
    try {
      const candidateId = req.params.id;
      const log = await onboardingDb.remindCandidate(candidateId);
      res.json({ success: true, message: 'Reminder notification logged and sent', log });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7. Remind All Overdue Candidates in current branch scope
  router.post('/remind-all-overdue', async (req: Request, res: Response) => {
    try {
      const branchId = typeof req.body.branch_id === 'string' ? req.body.branch_id : undefined;
      const result = await onboardingDb.remindAllOverdue(branchId);
      res.json({
        success: true,
        message: `Successfully sent reminders to ${result.count} overdue case(s)`,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Create & Send Invite (+ New Joiner modal)
  router.post('/invite', async (req: Request, res: Response) => {
    try {
      const { full_name, cnic, mobile, email, branch_id, designation_id } = req.body;

      if (!full_name || !cnic || !mobile || !branch_id || !designation_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: full_name, cnic, mobile, branch_id, designation_id',
        });
      }

      const newCandidate = await onboardingDb.createCandidate({
        full_name,
        cnic,
        mobile,
        email,
        branch_id,
        designation_id,
      });

      res.status(201).json({
        success: true,
        message: 'Candidate created and invite sent successfully',
        candidate: newCandidate,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 9. State Transition Pipeline
  router.post('/transition/:id', async (req: Request, res: Response) => {
    try {
      const candidateId = req.params.id;
      const { targetStage, reviewerRole, reason, actorName, actorRole } = req.body;

      // Find candidate
      const rawCandidates = await onboardingDb.getCandidates({ page: 1, pageSize: 9999 });
      const candidateRow = rawCandidates.items.find((c) => c.id === candidateId);
      if (!candidateRow) {
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }

      // Read internal candidate object
      const candidate = (onboardingDb as any).candidates.get(candidateId);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found in memory store' });
      }

      const transitionResult = await executeStageTransition(candidate, {
        targetStage,
        reviewerRole,
        reason,
        actorName,
        actorRole,
      });

      (onboardingDb as any).candidates.set(candidateId, transitionResult.updatedCandidate);

      res.json({
        success: true,
        message: `Successfully transitioned to ${targetStage}`,
        candidate: transitionResult.updatedCandidate,
        employeeCreated: transitionResult.employeeCreated || false,
      });
    } catch (err: any) {
      if (err instanceof InvalidStageTransitionError) {
        return res.status(422).json({ success: false, error: err.message });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 10. Export CSV with required columns for current branch scope
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const branch_id = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;

      const result = await onboardingDb.getCandidates({
        branch_id,
        search,
        tab,
        page: 1,
        pageSize: 10000,
      });

      // CSV Columns: Emp ID, Emp Name, CNIC, Designation, Branch, Stage, With, Days in Stage, Invited On
      const headers = ['Emp ID', 'Emp Name', 'CNIC', 'Designation', 'Branch', 'Stage', 'With', 'Days in Stage', 'Invited On'];
      const rows = result.items.map((item) => [
        `"${item.emp_id}"`,
        `"${item.emp_name.replace(/"/g, '""')}"`,
        `"${item.cnic}"`,
        `"${item.designation.replace(/"/g, '""')}"`,
        `"${item.branch.replace(/"/g, '""')}"`,
        `"${item.stage}"`,
        `"${item.with_role}"`,
        item.days_in_stage,
        `"${item.invited_on}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="postex-onboarding-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
