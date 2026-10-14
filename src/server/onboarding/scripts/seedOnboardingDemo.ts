// ==============================================================================
// PostEx HR Onboarding Portal — Demo Seed Script (640 Candidates)
// ==============================================================================
// RULES COMPLIANCE:
// 1. Refuses to run when NODE_ENV === 'production'.
// 2. ONLY writes to onboarding_* tables/data structures.
// 3. ZERO writes to branches, designations, or employees tables.
// ==============================================================================

import { onboardingDb } from '../onboardingDb';
import { OnboardingCandidate, OnboardingTimelineEvent, OnboardingStage, OnboardingReviewerRole } from '../onboardingTypes';
import { masterDataAdapter } from '../adapters/masterDataAdapter';

export async function runOnboardingDemoSeed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Refusing to seed demo candidates in production environment (NODE_ENV=production).');
    throw new Error('Demo seed aborted: Production environment detected.');
  }

  console.log('🌱 Starting Onboarding Demo Seed (640 candidates across 8 pipeline stages)...');

  const branches = await masterDataAdapter.getExistingBranches();
  const designations = await masterDataAdapter.getExistingDesignations();

  if (branches.length === 0 || designations.length === 0) {
    throw new Error('Cannot seed onboarding candidates: No existing branches or designations found.');
  }

  onboardingDb.clearOnboardingData();

  const FIRST_NAMES = [
    'Muhammad', 'Ali', 'Ahmed', 'Usman', 'Hamza', 'Bilal', 'Omar', 'Hassan', 'Zubair', 'Tariq',
    'Faizan', 'Waqas', 'Kamran', 'Kashif', 'Farhan', 'Naveed', 'Saad', 'Asad', 'Zeeshan', 'Adnan',
    'Shahbaz', 'Babar', 'Imran', 'Rashid', 'Sajid', 'Salman', 'Junaid', 'Rizwan', 'Adeel', 'Danish',
    'Fatima', 'Ayesha', 'Zainab', 'Maryam', 'Sana', 'Hira', 'Iqra', 'Rabia', 'Sadia', 'Bushra'
  ];

  const LAST_NAMES = [
    'Khan', 'Ahmed', 'Malik', 'Chaudhry', 'Bhatti', 'Shah', 'Qureshi', 'Siddiqui', 'Rehman', 'Butt',
    'Javed', 'Akram', 'Gondal', 'Ansari', 'Mirza', 'Mughal', 'Sheikh', 'Raza', 'Abbasi', 'Tareen'
  ];

  const RETURN_REASONS = [
    'CNIC front scan is blurry, please re-upload clear photo',
    'Driving license expired, please submit renewed copy',
    'Residential address does not match utility bill proof',
    'Bank account title does not match applicant CNIC name',
    'Emergency contact number is not responding or unreachable',
  ];

  const REJECT_REASONS = [
    'Failed third-party criminal record verification',
    'Discrepancy in previous employer exit clearance',
    'Candidate did not appear for biometric machine verification',
    'Ineligible driving history for logistics role',
  ];

  // Target stage distribution for 640 candidates:
  // Invited: 70
  // Draft: 60
  // BM_Review: 95
  // HR_Review: 100
  // Need_Correction: 45
  // Joining_Tasks: 60
  // Onboarded: 160
  // Rejected: 50
  // Total = 640
  const stageDistribution: Array<{ stage: OnboardingStage; count: number }> = [
    { stage: 'Invited', count: 70 },
    { stage: 'Draft', count: 60 },
    { stage: 'BM_Review', count: 95 },
    { stage: 'HR_Review', count: 100 },
    { stage: 'Need_Correction', count: 45 },
    { stage: 'Joining_Tasks', count: 60 },
    { stage: 'Onboarded', count: 160 },
    { stage: 'Rejected', count: 50 },
  ];

  const now = Date.now();
  let candidateIndex = 1001;

  for (const group of stageDistribution) {
    for (let i = 0; i < group.count; i++) {
      const branch = branches[(candidateIndex + i) % branches.length];
      const designation = designations[(candidateIndex + i * 3) % designations.length];
      const firstName = FIRST_NAMES[(candidateIndex + i) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(candidateIndex + i * 2) % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;

      // Realistic CNIC format: XXXXX-XXXXXXX-X
      const cnicPrefix = 35201 + ((candidateIndex + i * 7) % 5000);
      const cnicMid = 1000000 + ((candidateIndex * 31 + i * 17) % 8999999);
      const cnicCheck = ((candidateIndex + i) % 9) + 1;
      const cnic = `${cnicPrefix}-${cnicMid}-${cnicCheck}`;

      // Pakistan Mobile format: +92 3XX XXXXXXX
      const mobileCode = ['00', '01', '02', '11', '12', '21', '33', '45'][(candidateIndex + i) % 8];
      const mobileNum = 1000000 + ((candidateIndex * 19 + i * 23) % 8999999);
      const mobile = `+92 3${mobileCode} ${mobileNum}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${candidateIndex % 99}@gmail.com`;

      // Calculate days in stage and invited date
      // For open stages, create a mix of SLA met (0-2 days) and overdue (3-9 days)
      let daysInStage = 1;
      if (group.stage === 'Onboarded') {
        daysInStage = 0;
      } else if (group.stage === 'Rejected') {
        daysInStage = (i % 5) + 1;
      } else {
        // ~30% overdue cases to demonstrate SLA tracking and Needs Attention panel
        if (i % 3 === 0) {
          daysInStage = 3 + (i % 6); // 3 to 8 days overdue
        } else {
          daysInStage = (i % 3); // 0, 1, or 2 days within SLA
        }
      }

      const totalDaysSinceInvite = daysInStage + (group.stage === 'Invited' ? 0 : (i % 7) + 2);
      const invitedAt = new Date(now - totalDaysSinceInvite * 24 * 60 * 60 * 1000).toISOString();
      const stageEnteredAt = new Date(now - daysInStage * 24 * 60 * 60 * 1000).toISOString();

      let returnedBy: OnboardingReviewerRole | undefined;
      let returnReason: string | undefined;
      let rejectedBy: OnboardingReviewerRole | undefined;
      let rejectReason: string | undefined;

      if (group.stage === 'Need_Correction') {
        returnedBy = i % 2 === 0 ? 'BM' : 'HR';
        returnReason = RETURN_REASONS[i % RETURN_REASONS.length];
      } else if (group.stage === 'Rejected') {
        rejectedBy = i % 2 === 0 ? 'BM' : 'HR';
        rejectReason = REJECT_REASONS[i % REJECT_REASONS.length];
      }

      const candidateId = `cand-demo-${candidateIndex}`;
      const candidate: OnboardingCandidate = {
        id: candidateId,
        emp_id: `PX-EMP-${candidateIndex}`,
        full_name: fullName,
        cnic,
        mobile,
        email,
        branch_id: branch.id,
        designation_id: designation.id,
        stage: group.stage,
        returned_by: returnedBy,
        rejected_by: rejectedBy,
        return_reason: returnReason,
        reject_reason: rejectReason,
        invited_at: invitedAt,
        stage_entered_at: stageEnteredAt,
        completed_at: group.stage === 'Onboarded' ? stageEnteredAt : undefined,
        reminders_count: daysInStage > 2 ? 1 + (i % 3) : 0,
        last_reminded_at: daysInStage > 2 ? new Date(now - 12 * 60 * 60 * 1000).toISOString() : undefined,
        created_at: invitedAt,
        updated_at: stageEnteredAt,
      };

      // Create realistic timeline events (1 to 6 steps)
      const events: OnboardingTimelineEvent[] = [
        {
          id: `evt-${candidateId}-1`,
          candidate_id: candidateId,
          step_number: 1,
          step_name: 'Profile Created',
          status: 'completed',
          details: 'HR created candidate profile and sent SMS/Email invitation link',
          actor_name: 'HR Operations',
          actor_role: 'central_hr',
          created_at: invitedAt,
        },
      ];

      if (group.stage !== 'Invited') {
        events.push({
          id: `evt-${candidateId}-2`,
          candidate_id: candidateId,
          step_number: 2,
          step_name: 'Joining Form Submitted',
          status: group.stage === 'Draft' ? 'current' : 'completed',
          details: group.stage === 'Draft' ? 'Candidate currently entering personal and bank details' : 'Candidate submitted digital onboarding form with verified CNIC scan',
          actor_name: fullName,
          actor_role: 'candidate',
          created_at: new Date(now - (totalDaysSinceInvite - 1) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      if (['BM_Review', 'HR_Review', 'Joining_Tasks', 'Onboarded'].includes(group.stage) || (group.stage === 'Need_Correction' && returnedBy === 'HR') || (group.stage === 'Rejected' && rejectedBy === 'HR')) {
        events.push({
          id: `evt-${candidateId}-3`,
          candidate_id: candidateId,
          step_number: 3,
          step_name: 'BM Review',
          status: group.stage === 'BM_Review' ? 'current' : 'completed',
          details: 'Branch Manager approved document authenticity and physical presence',
          actor_name: 'Tariq Mehmood (BM)',
          actor_role: 'branch_manager',
          created_at: new Date(now - (totalDaysSinceInvite - 2) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      onboardingDb.loadCandidate(candidate, events);
      candidateIndex++;
    }
  }

  console.log(`✅ Onboarding demo seed completed: ${onboardingDb.getCandidatesCount()} candidates loaded into onboarding_* storage.`);
}

// Auto-run if executed directly as CLI script
if (process.argv[1]?.includes('seedOnboardingDemo')) {
  runOnboardingDemoSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed execution failed:', err);
      process.exit(1);
    });
}
